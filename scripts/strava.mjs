// Receptor de entrenos desde Strava (tarea S3).
// Corre en GitHub Actions dentro del repositorio PRIVADO (copia de este archivo y de entrenos.mjs en scripts/).
//
// Camino de los datos: Fitbit → app Google Health → conexión oficial con Strava (sube cada entreno nuevo,
// con o sin GPS) → este script lee la API de Strava → clave «workouts» de data.json.
// Secretos del repo privado: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN
// (los guarda el dueño con scripts/strava-auth.mjs; este script nunca los imprime).
//
// Strava puede rotar el refresh token. El nuevo se guarda cifrado (AES-256-GCM con una llave derivada
// del client secret) en strava/token.enc, así la tarea sigue funcionando sin tocar los secretos.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { classify, applyWorkouts } from "./entrenos.mjs";

export const FIRST_DAYS = 60; // primera corrida: trae hasta 60 días atrás
export const OVERLAP_DAYS = 3; // luego: desde el último entreno de Strava menos 3 días (por si llegó tarde)

export const SPORT_LABELS = {
  Run: "Correr", TrailRun: "Correr (trail)", VirtualRun: "Correr (cinta)",
  Walk: "Caminata", Hike: "Senderismo",
  Ride: "Bici", VirtualRide: "Bici (estática)", MountainBikeRide: "Bici de montaña", GravelRide: "Bici gravel", EBikeRide: "Bici eléctrica",
  WeightTraining: "Pesas", Workout: "Entreno", HighIntensityIntervalTraining: "HIIT", Crossfit: "Crossfit",
  Yoga: "Yoga", Pilates: "Pilates", Elliptical: "Elíptica", StairStepper: "Escaladora", Rowing: "Remo",
  Swim: "Natación", Soccer: "Fútbol", Tennis: "Tenis",
};

export function toWorkout(a) {
  if (!a || !a.start_date) return null;
  const start = new Date(a.start_date);
  if (isNaN(start)) return null;
  const sport = a.sport_type || a.type || "";
  const kind = classify(sport);
  const secs = Number(a.moving_time) > 0 ? Number(a.moving_time) : Number(a.elapsed_time) || 0;
  const elapsed = Number(a.elapsed_time) > 0 ? Number(a.elapsed_time) : secs;
  const iso = start.toISOString();
  const w = {
    id: `${iso.slice(0, 16)}-${kind}`, // mismo formato que el Atajo: un entreno repetido no se duplica
    type: SPORT_LABELS[sport] || String(a.name || sport || "Entreno").trim() || "Entreno",
    kind,
    start: iso,
    end: elapsed ? new Date(start.getTime() + elapsed * 1000).toISOString() : null,
    min: secs ? Math.round(secs / 60) : null,
    source: "strava",
  };
  if (Number(a.distance) > 0) w.km = Math.round(Number(a.distance) / 10) / 100;
  return w;
}

function keyFrom(secret) {
  return crypto.createHash("sha256").update(String(secret)).digest();
}

export function encryptToken(token, secret) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const body = Buffer.concat([c.update(String(token), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(blob, secret) {
  try {
    const [iv, tag, body] = String(blob).trim().split(".").map((x) => Buffer.from(x, "base64"));
    const d = crypto.createDecipheriv("aes-256-gcm", keyFrom(secret), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// Desde cuándo pedir actividades (segundos epoch).
export function sinceEpoch(list, now = new Date()) {
  const last = (Array.isArray(list) ? list : []).filter((w) => w && w.source === "strava").map((w) => w.start).sort().pop();
  const from = last ? new Date(last).getTime() - OVERLAP_DAYS * 86400000 : now.getTime() - FIRST_DAYS * 86400000;
  return Math.floor(from / 1000);
}

async function refresh(fetchImpl, env, refreshToken) {
  const res = await fetchImpl("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j && j.access_token ? j : null;
}

export async function main({ root = process.cwd(), now = new Date(), env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET || !env.STRAVA_REFRESH_TOKEN) {
    console.log("Strava sin configurar: faltan secretos. Nada que hacer.");
    return { skipped: true };
  }
  const tokenPath = path.join(root, "strava", "token.enc");
  const saved = fs.existsSync(tokenPath) ? decryptToken(fs.readFileSync(tokenPath, "utf8"), env.STRAVA_CLIENT_SECRET) : null;
  // Primero el token rotado que guardamos; si falla (p. ej. se volvió a autorizar), el del secreto.
  let used = saved || env.STRAVA_REFRESH_TOKEN;
  let tok = await refresh(fetchImpl, env, used);
  if (!tok && saved && saved !== env.STRAVA_REFRESH_TOKEN) tok = await refresh(fetchImpl, env, (used = env.STRAVA_REFRESH_TOKEN));
  if (!tok) throw new Error("Strava rechazó la autorización. Vuelve a correr scripts/strava-auth.mjs.");
  let rotated = false;
  if (tok.refresh_token && tok.refresh_token !== saved) {
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, encryptToken(tok.refresh_token, env.STRAVA_CLIENT_SECRET) + "\n");
    rotated = true;
  }

  const storePath = path.join(root, "health", "workouts.json");
  const stored = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : [];
  const after = sinceEpoch(stored, now);
  const activities = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetchImpl(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!res.ok) throw new Error(`Strava respondió ${res.status} al pedir actividades.`);
    const batch = await res.json();
    if (!Array.isArray(batch) || !batch.length) break;
    activities.push(...batch);
    if (batch.length < 100) break;
  }
  const incoming = activities.map(toWorkout).filter(Boolean);
  const { list, added } = applyWorkouts({ root, incoming, now });
  // Solo conteos en el registro.
  console.log(`actividades de Strava: ${activities.length} · nuevas: ${added} · total: ${list.length}${rotated ? " · token renovado" : ""}`);
  return { activities: activities.length, added, total: list.length, rotated };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
