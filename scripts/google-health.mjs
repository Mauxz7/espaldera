// Receptor de entrenos de Fitbit desde la Google Health API (tarea S3).
// Corre en GitHub Actions dentro del repositorio PRIVADO (copia de este archivo y de entrenos.mjs en scripts/).
//
// Proyecto personal de Google Cloud (gratis) con la Google Health API activada y un cliente OAuth «Desktop».
// Secretos del repo privado: GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET, GOOGLE_HEALTH_REFRESH_TOKEN
// (los guarda el dueño con scripts/google-health-auth.mjs; este script nunca los imprime).
// Doc: GET https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints
//      permiso https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { classify, applyWorkouts } from "./entrenos.mjs";

export const API = "https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints";
export const SCOPE = "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";
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
    if (!res.ok) throw new Error(`Google Health respondió ${res.status} al pedir entrenos.`);
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
  return { points: points.length, added, total: list.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
