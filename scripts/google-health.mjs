// Receptor de entrenos de Fitbit desde la Google Health API (tarea S3).
// Corre en GitHub Actions dentro del repositorio PRIVADO (copia de este archivo y de entrenos.mjs en scripts/).
//
// Proyecto personal de Google Cloud (gratis) con la Google Health API activada y un cliente OAuth «Desktop».
// Secretos del repo privado: GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET, GOOGLE_HEALTH_REFRESH_TOKEN
// (los guarda el dueño con scripts/google-health-auth.mjs; este script nunca los imprime).
// Doc: GET https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints
//      permiso https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
// Sueño (D2): GET …/dataTypes/sleep/dataPoints con permiso googlehealth.sleep.readonly.
//      Si el token es anterior y no trae ese permiso, los entrenos siguen llegando y el registro lo avisa.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { classify, applyWorkouts } from "./entrenos.mjs";

export const API = "https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints";
export const SCOPE = "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";
export const SLEEP_API = "https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints";
export const SLEEP_SCOPE = "https://www.googleapis.com/auth/googlehealth.sleep.readonly";
export const SCOPES = [SCOPE, SLEEP_SCOPE].join(" ");
export const SLEEP_DAYS = 14; // cada corrida vuelve a pedir las últimas 2 semanas de sueño
export const SLEEP_KEEP_DAYS = 60;
export const FIRST_DAYS = 60; // primera corrida: hasta 60 días atrás
export const OVERLAP_DAYS = 3; // luego: desde el último entreno de Google menos 3 días (por si sincronizó tarde)

export const TYPE_LABELS = {
  RUNNING: "Correr", TREADMILL_RUNNING: "Correr (cinta)", TRAIL_RUNNING: "Correr (trail)",
  WALKING: "Caminata", TREADMILL_WALKING: "Caminata (cinta)", HIKING: "Senderismo",
  BIKING: "Bici", INDOOR_BIKING: "Bici (estática)", SPINNING: "Spinning", MOUNTAIN_BIKING: "Bici de montaña",
  WEIGHTLIFTING: "Pesas", STRENGTH_TRAINING: "Fuerza", WEIGHTS: "Pesas", CIRCUIT_TRAINING: "Circuito",
  HIIT: "HIIT", INTERVAL_TRAINING: "Intervalos", WORKOUT: "Entreno", CROSSFIT: "Crossfit", CALISTHENICS: "Calistenia",
  YOGA: "Yoga", PILATES: "Pilates", ELLIPTICAL: "Elíptica", STAIR_CLIMBING: "Escaladora", ROWING: "Remo",
  SWIMMING: "Natación", SOCCER: "Fútbol", TENNIS: "Tenis", SPORT: "Deporte",
};

function seconds(d) {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(String(d || ""));
  return m ? Number(m[1]) : null;
}

export function toWorkout(dp) {
  const ex = dp && dp.exercise;
  const iv = ex && ex.interval;
  if (!iv || !iv.startTime) return null;
  const start = new Date(iv.startTime);
  if (isNaN(start)) return null;
  const end = iv.endTime && !isNaN(new Date(iv.endTime)) ? new Date(iv.endTime) : null;
  const t = String(ex.exerciseType || "");
  const kind = classify(`${t} ${ex.displayName || ""}`.replace(/_/g, " "));
  const secs = seconds(ex.activeDuration) ?? (end ? (end - start) / 1000 : null);
  const iso = start.toISOString();
  const w = {
    id: `${iso.slice(0, 16)}-${kind}`, // mismo formato que el Atajo: un entreno repetido no se duplica
    type: TYPE_LABELS[t] || String(ex.displayName || t || "Entreno").trim() || "Entreno",
    kind,
    start: iso,
    end: end ? end.toISOString() : null,
    min: secs && secs > 0 ? Math.round(secs / 60) : null,
    source: "google",
  };
  const mm = Number(ex.metricsSummary && ex.metricsSummary.distanceMillimiters);
  if (mm > 0) w.km = Math.round(mm / 10000) / 100;
  return w;
}

// Fecha civil (AAAA-MM-DD) desde la que pedir entrenos.
export function sinceDate(list, now = new Date()) {
  const last = (Array.isArray(list) ? list : []).filter((w) => w && w.source === "google").map((w) => w.start).sort().pop();
  const from = last ? new Date(last).getTime() - OVERLAP_DAYS * 86400000 : now.getTime() - FIRST_DAYS * 86400000;
  return new Date(from).toISOString().slice(0, 10);
}

export async function accessToken(fetchImpl, env) {
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_HEALTH_CLIENT_ID,
      client_secret: env.GOOGLE_HEALTH_CLIENT_SECRET,
      refresh_token: env.GOOGLE_HEALTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString(),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    const why = j.error === "invalid_grant" ? "la autorización venció o se revocó" : `error ${res.status}`;
    throw new Error(`Google no renovó el acceso (${why}). Vuelve a correr: node scripts/google-health-auth.mjs`);
  }
  return j.access_token;
}

export async function fetchExercises(fetchImpl, token, since) {
  const out = [];
  let pageToken = "";
  for (let i = 0; i < 40; i++) {
    const q = new URLSearchParams({ pageSize: "25", filter: `exercise.interval.civil_start_time >= "${since}"` });
    if (pageToken) q.set("pageToken", pageToken);
    const res = await fetchImpl(`${API}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const why = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 400);
      throw new Error(`Google Health respondió ${res.status} al pedir entrenos. ${why}`);
    }
    const j = await res.json();
    out.push(...(j.dataPoints || []));
    pageToken = j.nextPageToken || "";
    if (!pageToken) break;
  }
  return out;
}

const pad = (n) => String(n).padStart(2, "0");

// Fecha y hora civil (de la zona del usuario) de un CivilDateTime; si falta, desde la hora UTC más el desfase ("-21600s").
function civil(ct, iso, offset) {
  if (ct && ct.date && ct.date.year) {
    const d = ct.date;
    const t = ct.time || {};
    return { date: `${d.year}-${pad(d.month)}-${pad(d.day)}`, hm: `${pad(t.hours || 0)}:${pad(t.minutes || 0)}` };
  }
  const ms = new Date(iso).getTime();
  if (!iso || isNaN(ms)) return null;
  const m = /^(-?\d+)s$/.exec(String(offset || "")); // desfase con signo, p. ej. "-21600s" en Costa Rica
  const off = m ? Number(m[1]) * 1000 : 0;
  const x = new Date(ms + off).toISOString();
  return { date: x.slice(0, 10), hm: x.slice(11, 16) };
}

// Una noche de sueño de Google Health → { date (día en que despertaste), min dormidos, bed, wake } o null (siestas y datos incompletos).
export function toSleep(dp) {
  const s = dp && dp.sleep;
  const iv = s && s.interval;
  if (!iv || !iv.endTime || (s.metadata && s.metadata.nap)) return null;
  const end = civil(iv.civilEndTime, iv.endTime, iv.endUtcOffset);
  const start = civil(iv.civilStartTime, iv.startTime, iv.startUtcOffset || iv.endUtcOffset);
  const min = Number(s.summary && s.summary.minutesAsleep);
  if (!end || !(min > 0)) return null;
  return { date: end.date, min: Math.round(min), bed: start ? start.hm : null, wake: end.hm };
}

// Fusiona noches nuevas (la más larga por día) en health/sleep.json y en la clave `sleep` de data.json (solo si cambió).
export function applySleep({ root = process.cwd(), incoming = [], now = new Date() } = {}) {
  const storePath = path.join(root, "health", "sleep.json");
  const dataPath = path.join(root, "data.json");
  const stored = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : {};
  const data = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, "utf8")) : {};
  const map = { ...stored };
  const seen = new Set();
  for (const n of incoming) {
    if (!n || !n.date) continue;
    const { date, ...rest } = n;
    if (!seen.has(date) || rest.min > map[date].min) map[date] = rest; // lo de Google reemplaza lo guardado
    seen.add(date);
  }
  const cut = new Date(now.getTime() - SLEEP_KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  const v = {};
  Object.keys(map).sort().forEach((d) => { if (d >= cut) v[d] = map[d]; });
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(v, null, 1) + "\n");
  const changed = JSON.stringify((data.sleep && data.sleep.v) || null) !== JSON.stringify(v);
  if (changed) {
    data.sleep = { v, at: now.getTime() };
    fs.writeFileSync(dataPath, JSON.stringify(data));
  }
  return { nights: Object.keys(v).length, changed };
}

export async function fetchSleep(fetchImpl, token, since) {
  const out = [];
  let pageToken = "";
  for (let i = 0; i < 20; i++) {
    const q = new URLSearchParams({ pageSize: "25", filter: `sleep.interval.civil_start_time >= "${since}"` });
    if (pageToken) q.set("pageToken", pageToken);
    const res = await fetchImpl(`${SLEEP_API}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const why = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 400);
      const err = new Error(`Google Health respondió ${res.status} al pedir sueño. ${why}`);
      err.status = res.status;
      throw err;
    }
    const j = await res.json();
    out.push(...(j.dataPoints || []));
    pageToken = j.nextPageToken || "";
    if (!pageToken) break;
  }
  return out;
}

export async function main({ root = process.cwd(), now = new Date(), env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!env.GOOGLE_HEALTH_CLIENT_ID || !env.GOOGLE_HEALTH_CLIENT_SECRET || !env.GOOGLE_HEALTH_REFRESH_TOKEN) {
    console.log("Google Health sin configurar: faltan secretos. Nada que hacer.");
    return { skipped: true };
  }
  const token = await accessToken(fetchImpl, env);
  const storePath = path.join(root, "health", "workouts.json");
  const stored = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : [];
  const points = await fetchExercises(fetchImpl, token, sinceDate(stored, now));
  const incoming = points.map(toWorkout).filter(Boolean);
  const { list, added } = applyWorkouts({ root, incoming, now });
  // Solo conteos en el registro.
  console.log(`entrenos de Google Health: ${points.length} · nuevos: ${added} · total: ${list.length}`);
  // Sueño: si falla (p. ej. token sin el permiso nuevo), los entrenos ya quedaron guardados.
  let sleep = null;
  try {
    const since = new Date(now.getTime() - SLEEP_DAYS * 86400000).toISOString().slice(0, 10);
    const nights = (await fetchSleep(fetchImpl, token, since)).map(toSleep).filter(Boolean);
    sleep = applySleep({ root, incoming: nights, now });
    console.log(`sueño de Google Health: ${nights.length} noches · guardadas: ${sleep.nights}${sleep.changed ? " · actualizado" : ""}`);
  } catch (e) {
    const hint = e.status === 403 ? " Falta el permiso de sueño: en tu Mac corre ESPALDERA_BROWSER=Safari node scripts/google-health-auth.mjs --solo-fitbit" : "";
    console.log(`sueño: no disponible (${e.status || "error"}).${hint}`);
  }
  return { points: points.length, added, total: list.length, sleep };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
