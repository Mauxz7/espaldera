// Receptor de entrenos, sueño y signos vitales de Fitbit desde la Google Health API (S3, D2, Bevel 1/3).
// Corre en GitHub Actions dentro del repositorio PRIVADO (copia de este archivo y de entrenos.mjs en scripts/).
//
// Proyecto personal de Google Cloud (gratis) con la Google Health API activada y un cliente OAuth «Desktop».
// Secretos del repo privado: GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET, GOOGLE_HEALTH_REFRESH_TOKEN
// (los guarda el dueño con scripts/google-health-auth.mjs; este script nunca los imprime).
// Doc: GET https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints
//      permiso https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
// Sueño (D2): GET …/dataTypes/sleep/dataPoints con permiso googlehealth.sleep.readonly.
//      El sueño NO acepta filtro por civil_start_time (da 400): se filtra por sleep.interval.civil_end_time.
// Vitals (Bevel): GET/POST …/dataTypes/{daily-*,steps,active-zone-minutes,heart-rate}/… con permiso
//      googlehealth.health_metrics_and_measurements.readonly. Nunca persiste series intradía crudas.
//      Si el token es anterior y no trae permisos nuevos, los entrenos y el sueño siguen llegando y el registro lo avisa.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { classify, applyWorkouts } from "./entrenos.mjs";

export const BASE_API = "https://health.googleapis.com/v4/users/me/dataTypes";
export const API = `${BASE_API}/exercise/dataPoints`;
export const SCOPE = "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";
export const SLEEP_API = `${BASE_API}/sleep/dataPoints`;
export const SLEEP_SCOPE = "https://www.googleapis.com/auth/googlehealth.sleep.readonly";
export const METRICS_SCOPE = "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly";
export const SCOPES = [SCOPE, SLEEP_SCOPE, METRICS_SCOPE].join(" ");
export const SLEEP_DAYS = 14; // cada corrida vuelve a pedir las últimas 2 semanas de sueño
export const SLEEP_KEEP_DAYS = 60;
export const VITALS_DAYS = 14; // ventana diaria para signos vitales (dentro del límite de la API)
export const VITALS_HR_DAYS = 7; // ventana corta para resumir FC sueño/vigilia (hrDip) en memoria
export const VITALS_KEEP_DAYS = 90;
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

function finiteNum(x) {
  if (x === null || x === undefined || x === "" || typeof x === "boolean") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

function extractZones(z) {
  if (!z || typeof z !== "object" || Array.isArray(z)) return null;
  const keys = [
    ["light", "lightTime"],
    ["moderate", "moderateTime"],
    ["vigorous", "vigorousTime"],
    ["peak", "peakTime"],
  ];
  const out = { light: 0, moderate: 0, vigorous: 0, peak: 0 };
  let total = 0;
  for (const [k, rawKey] of keys) {
    const raw = z[rawKey] !== undefined ? z[rawKey] : z[k];
    const secs = typeof raw === "string" && raw.endsWith("s") ? seconds(raw) : null;
    const mins = secs !== null ? secs / 60 : finiteNum(raw);
    if (mins !== null && mins > 0) {
      out[k] = round1(mins);
      total += out[k];
    }
  }
  return total > 0 ? out : null;
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
  const ms = ex.metricsSummary;
  if (ms && typeof ms === "object") {
    const mm = finiteNum(ms.distanceMillimiters ?? ms.distanceMillimeters);
    if (mm !== null && mm > 0) w.km = Math.round(mm / 10000) / 100;
    const avgHr = finiteNum(ms.averageHeartRateBeatsPerMinute);
    if (avgHr !== null && avgHr > 0) w.avgHr = Math.round(avgHr);
    const azm = finiteNum(ms.activeZoneMinutes);
    if (azm !== null && azm >= 0) w.azm = Math.round(azm);
    const kcal = finiteNum(ms.caloriesKcal);
    if (kcal !== null && kcal > 0) w.kcal = Math.round(kcal);
    const zones = extractZones(ms.heartRateZoneDurations);
    if (zones) w.zones = zones;
  }
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

function parseOffsetMs(offset) {
  const m = /^(-?\d+)s$/.exec(String(offset || ""));
  return m ? Number(m[1]) * 1000 : 0;
}

// Fecha y hora civil (de la zona del usuario) de un CivilDateTime; si falta, desde la hora UTC más el desfase ("-21600s").
function civil(ct, iso, offset) {
  if (ct && ct.date && ct.date.year) {
    const d = ct.date;
    const t = ct.time || {};
    return { date: `${d.year}-${pad(d.month)}-${pad(d.day)}`, hm: `${pad(t.hours || 0)}:${pad(t.minutes || 0)}` };
  }
  const ms = new Date(iso).getTime();
  if (!iso || isNaN(ms)) return null;
  const off = parseOffsetMs(offset);
  const x = new Date(ms + off).toISOString();
  return { date: x.slice(0, 10), hm: x.slice(11, 16) };
}

function civilDateObj(d) {
  if (!d) return null;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  if (d.year && d.month && d.day) return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
  return null;
}

function toGoogleDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

function dpCivilDate(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.date) return civilDateObj(obj.date);
  if (obj.interval) {
    const c = civil(obj.interval.civilStartTime, obj.interval.startTime, obj.interval.startUtcOffset)
      || civil(obj.interval.civilEndTime, obj.interval.endTime, obj.interval.endUtcOffset);
    return c ? c.date : null;
  }
  if (obj.civilSampleTime || obj.sampleTime) {
    const c = civil(obj.civilSampleTime, obj.sampleTime, obj.sampleUtcOffset || obj.utcOffset);
    return c ? c.date : null;
  }
  return null;
}

function parseStagesSummary(summary, stages) {
  const res = {};
  const raw = summary && summary.stagesSummary;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const type = String(item.type || item.stage || item.sleepStageType || "").toUpperCase();
      const mins = finiteNum(item.minutes);
      const count = finiteNum(item.count);
      if (type === "DEEP" && mins !== null && mins >= 0) res.deepMin = Math.round(mins);
      else if (type === "REM" && mins !== null && mins >= 0) res.remMin = Math.round(mins);
      else if (type === "LIGHT" && mins !== null && mins >= 0) res.lightMin = Math.round(mins);
      else if (type === "AWAKE") {
        if (mins !== null && mins >= 0) res.awakeMin = Math.round(mins);
        if (count !== null && count >= 0) res.awakenings = Math.round(count);
      }
    }
  } else if (raw && typeof raw === "object") {
    const readMin = (x) => finiteNum(x && typeof x === "object" ? x.minutes : x);
    const deep = readMin(raw.deep ?? raw.DEEP);
    const rem = readMin(raw.rem ?? raw.REM);
    const light = readMin(raw.light ?? raw.LIGHT);
    const awakeObj = raw.awake ?? raw.AWAKE;
    const awake = readMin(awakeObj);
    const awakeCnt = awakeObj && typeof awakeObj === "object" ? finiteNum(awakeObj.count) : null;
    if (deep !== null && deep >= 0) res.deepMin = Math.round(deep);
    if (rem !== null && rem >= 0) res.remMin = Math.round(rem);
    if (light !== null && light >= 0) res.lightMin = Math.round(light);
    if (awake !== null && awake >= 0) res.awakeMin = Math.round(awake);
    if (awakeCnt !== null && awakeCnt >= 0) res.awakenings = Math.round(awakeCnt);
  }
  if (res.awakenings === undefined && Array.isArray(stages) && stages.length > 0) {
    res.awakenings = stages.filter((st) => st && String(st.type || st.stage || st.sleepStageType || "").toUpperCase() === "AWAKE").length;
  }
  return res;
}

// Una noche de sueño de Google Health → { date (día en que despertaste), min dormidos, bed, wake, ...fases/eff } o null (siestas y datos incompletos).
export function toSleep(dp) {
  const s = dp && dp.sleep;
  const iv = s && s.interval;
  if (!iv || !iv.endTime || (s.metadata && s.metadata.nap)) return null;
  const end = civil(iv.civilEndTime, iv.endTime, iv.endUtcOffset);
  const start = civil(iv.civilStartTime, iv.startTime, iv.startUtcOffset || iv.endUtcOffset);
  const sum = s.summary || {};
  const min = finiteNum(sum.minutesAsleep);
  if (!end || !(min > 0)) return null;

  const out = {
    date: end.date,
    min: Math.round(min),
    bed: start ? start.hm : null,
    wake: end.hm,
  };

  const inBed = finiteNum(sum.minutesInSleepPeriod);
  if (inBed !== null && inBed > 0) {
    out.inBedMin = Math.round(inBed);
    out.eff = Math.min(1, Math.round((min / inBed) * 1000) / 1000);
  }

  const stageData = parseStagesSummary(sum, s.stages);
  const awakeSummary = finiteNum(sum.minutesAwake);
  if (awakeSummary !== null && awakeSummary >= 0) out.awakeMin = Math.round(awakeSummary);
  else if (stageData.awakeMin !== undefined) out.awakeMin = stageData.awakeMin;

  // Fases STAGES (en registros CLASSIC no existen deep/rem/light y se omiten).
  if (stageData.deepMin !== undefined) out.deepMin = stageData.deepMin;
  if (stageData.remMin !== undefined) out.remMin = stageData.remMin;
  if (stageData.lightMin !== undefined) out.lightMin = stageData.lightMin;

  const awak = finiteNum(sum.awakenings ?? sum.awakeCount);
  if (awak !== null && awak >= 0) out.awakenings = Math.round(awak);
  else if (stageData.awakenings !== undefined) out.awakenings = stageData.awakenings;

  return out;
}

// Extrae en memoria la ventana principal de sueño [startMs, endMs] por fecha civil de despertar (nunca se persiste).
export function extractSleepWindows(sleepPoints) {
  const windows = {};
  for (const dp of Array.isArray(sleepPoints) ? sleepPoints : []) {
    const s = dp && dp.sleep;
    const iv = s && s.interval;
    if (!iv || !iv.startTime || !iv.endTime || (s.metadata && s.metadata.nap)) continue;
    const startMs = new Date(iv.startTime).getTime();
    const endMs = new Date(iv.endTime).getTime();
    const min = finiteNum(s.summary && s.summary.minutesAsleep);
    const end = civil(iv.civilEndTime, iv.endTime, iv.endUtcOffset);
    if (!end || isNaN(startMs) || isNaN(endMs) || endMs <= startMs || !(min > 0)) continue;
    if (!windows[end.date] || min > windows[end.date].min) {
      windows[end.date] = {
        startMs,
        endMs,
        min,
        offsetMs: parseOffsetMs(iv.endUtcOffset || iv.startUtcOffset),
      };
    }
  }
  return windows;
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
    const q = new URLSearchParams({ pageSize: "25", filter: `sleep.interval.civil_end_time >= "${since}"` });
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

async function fetchDataPoints(fetchImpl, token, dataType, filter, { pageSize = "100", maxPages = 20 } = {}) {
  const out = [];
  let pageToken = "";
  for (let i = 0; i < maxPages; i++) {
    const q = new URLSearchParams({ pageSize });
    if (filter) q.set("filter", filter);
    if (pageToken) q.set("pageToken", pageToken);
    const res = await fetchImpl(`${BASE_API}/${dataType}/dataPoints?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const why = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
      const err = new Error(`Google Health respondió ${res.status} al pedir ${dataType}. ${why}`);
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

async function fetchDailyRollupOrPoints(fetchImpl, token, dataType, filterField, since, now) {
  const startDate = toGoogleDate(since);
  const nextDay = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const endDate = toGoogleDate(nextDay);
  if (startDate && endDate) {
    const res = await fetchImpl(`${BASE_API}/${dataType}/dataPoints:dailyRollUp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        range: { start: { date: startDate }, end: { date: endDate } },
        windowSizeDays: 1,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j.rollupDataPoints)) return j.rollupDataPoints;
      if (Array.isArray(j.dataPoints)) return j.dataPoints;
      return [];
    }
    if (res.status !== 404 && res.status !== 400 && res.status !== 405) {
      const why = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
      const err = new Error(`Google Health respondió ${res.status} al pedir ${dataType}. ${why}`);
      err.status = res.status;
      throw err;
    }
  }
  return fetchDataPoints(fetchImpl, token, dataType, `${filterField} >= "${since}"`, { pageSize: "1000", maxPages: 30 });
}

// Resume FC de sueño vs. vigilia en memoria (nunca persiste series minuto a minuto).
export function computeHrDip(hrPoints, sleepWindows) {
  const entries = Object.entries(sleepWindows || {});
  if (!entries.length || !Array.isArray(hrPoints) || !hrPoints.length) return {};

  const samples = [];
  for (const dp of hrPoints) {
    if (!dp || typeof dp !== "object") continue;
    const hr = dp.heartRate && typeof dp.heartRate === "object" ? dp.heartRate : dp;
    const bpm = finiteNum(
      hr.beatsPerMinuteAvg ?? hr.averageBeatsPerMinute ?? hr.beatsPerMinute ?? hr.avgBeatsPerMinute
    );
    if (bpm === null || bpm <= 0) continue;

    let ms = NaN;
    const startRaw = dp.startTime || (hr.interval && hr.interval.startTime);
    const endRaw = dp.endTime || (hr.interval && hr.interval.endTime);
    if (startRaw && endRaw) {
      const a = new Date(startRaw).getTime();
      const b = new Date(endRaw).getTime();
      if (!isNaN(a) && !isNaN(b)) ms = (a + b) / 2;
    } else {
      const tRaw = hr.sampleTime || dp.sampleTime || startRaw;
      if (tRaw) ms = new Date(tRaw).getTime();
    }
    if (Number.isFinite(ms)) samples.push({ ms, bpm });
  }
  if (!samples.length) return {};

  const allWins = entries.map(([, w]) => w);
  const inAnySleep = (ms) => allWins.some((w) => ms >= w.startMs && ms <= w.endMs);
  const out = {};

  for (const [date, win] of entries) {
    const dayStartMs = Date.parse(`${date}T00:00:00Z`) - (win.offsetMs || 0);
    const dayEndMs = dayStartMs + 86400000;
    let sleepSum = 0, sleepN = 0, awakeSum = 0, awakeN = 0;
    for (const s of samples) {
      if (s.ms >= win.startMs && s.ms <= win.endMs) {
        sleepSum += s.bpm;
        sleepN++;
      } else if (s.ms >= dayStartMs && s.ms < dayEndMs && !inAnySleep(s.ms)) {
        awakeSum += s.bpm;
        awakeN++;
      }
    }
    if (sleepN > 0 && awakeN > 0) {
      const sleepHr = round1(sleepSum / sleepN);
      const awakeHr = round1(awakeSum / awakeN);
      if (awakeHr > 0 && sleepHr > 0) {
        out[date] = {
          sleepHr,
          awakeHr,
          hrDip: Math.round(((awakeHr - sleepHr) / awakeHr) * 1000) / 10,
        };
      }
    }
  }
  return out;
}

async function fetchHeartRateRange(fetchImpl, token, startMs, endMs) {
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  const res = await fetchImpl(`${BASE_API}/heart-rate/dataPoints:rollUp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      range: { startTime: startIso, endTime: endIso },
      windowSize: "900s",
    }),
  });
  if (res.ok) {
    const j = await res.json();
    if (Array.isArray(j.rollupDataPoints)) return j.rollupDataPoints;
    if (Array.isArray(j.dataPoints)) return j.dataPoints;
    return [];
  }
  if (res.status !== 404 && res.status !== 400 && res.status !== 405) {
    const why = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    const err = new Error(`Google Health respondió ${res.status} al pedir heart-rate. ${why}`);
    err.status = res.status;
    throw err;
  }
  return fetchDataPoints(
    fetchImpl,
    token,
    "heart-rate",
    `heart_rate.sample_time >= "${startIso}" AND heart_rate.sample_time <= "${endIso}"`,
    { pageSize: "1000", maxPages: 30 }
  );
}

// Consulta todos los signos vitales con degradación elegante por endpoint ante 403/404.
export async function fetchVitals(fetchImpl, token, since, { now = new Date(), sleepPoints = [], hrDays = VITALS_HR_DAYS } = {}) {
  const map = {};
  const warnings = [];
  const setField = (date, key, val) => {
    if (!date || val === null || val === undefined || val === "") return;
    if (!map[date]) map[date] = {};
    map[date][key] = val;
  };
  const safe = async (endpoint, fn) => {
    try {
      return await fn();
    } catch (e) {
      warnings.push({ endpoint, status: (e && e.status) || "error", message: (e && e.message) || String(e) });
      return null;
    }
  };

  // 1. HRV diaria (RMSSD nocturna)
  const hrvPts = await safe("daily-heart-rate-variability", () =>
    fetchDataPoints(fetchImpl, token, "daily-heart-rate-variability", `daily_heart_rate_variability.date >= "${since}"`)
  );
  for (const dp of hrvPts || []) {
    const x = dp && dp.dailyHeartRateVariability;
    const d = dpCivilDate(x);
    const v = finiteNum(
      x && (x.averageHeartRateVariabilityMilliseconds
        ?? x.dailyRmssdMilliseconds
        ?? x.rmssdMilliseconds
        ?? x.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds)
    );
    if (d && v !== null && v > 0) {
      setField(d, "hrv", round1(v));
      setField(d, "hrvKind", "rmssd");
    }
  }

  // 2. RHR diaria
  const rhrPts = await safe("daily-resting-heart-rate", () =>
    fetchDataPoints(fetchImpl, token, "daily-resting-heart-rate", `daily_resting_heart_rate.date >= "${since}"`)
  );
  for (const dp of rhrPts || []) {
    const x = dp && dp.dailyRestingHeartRate;
    const d = dpCivilDate(x);
    const v = finiteNum(x && x.beatsPerMinute);
    if (d && v !== null && v > 0) setField(d, "rhr", round1(v));
  }

  // 3. Frecuencia respiratoria diaria (con fallback a respiratory-rate-sleep-summary si 404/400/vacío)
  let respCount = 0;
  let respErr = null;
  try {
    const respPts = await fetchDataPoints(fetchImpl, token, "daily-respiratory-rate", `daily_respiratory_rate.date >= "${since}"`);
    for (const dp of respPts) {
      const x = dp && dp.dailyRespiratoryRate;
      const d = dpCivilDate(x);
      const v = finiteNum(x && (x.breathsPerMinute ?? (x.fullSleepSummary && x.fullSleepSummary.breathsPerMinute)));
      if (d && v !== null && v > 0) { setField(d, "resp", round1(v)); respCount++; }
    }
  } catch (e) {
    respErr = e;
  }
  if (respCount === 0 && (!respErr || (respErr.status !== 403))) {
    try {
      const sumPts = await fetchDataPoints(
        fetchImpl,
        token,
        "respiratory-rate-sleep-summary",
        `respiratory_rate_sleep_summary.sample_time >= "${since}T00:00:00Z"`
      );
      for (const dp of sumPts) {
        const x = dp && dp.respiratoryRateSleepSummary;
        const d = dpCivilDate(x);
        const v = finiteNum(x && ((x.fullSleepSummary && x.fullSleepSummary.breathsPerMinute) ?? x.breathsPerMinute));
        if (d && v !== null && v > 0) { setField(d, "resp", round1(v)); respCount++; }
      }
      if (respCount > 0) respErr = null;
    } catch (e2) {
      if (respErr || (e2 && e2.status === 403)) respErr = respErr || e2;
    }
  }
  if (respErr) {
    warnings.push({ endpoint: "daily-respiratory-rate", status: respErr.status || "error", message: respErr.message || String(respErr) });
  }

  // 4. SpO2 diaria
  const spo2Pts = await safe("daily-oxygen-saturation", () =>
    fetchDataPoints(fetchImpl, token, "daily-oxygen-saturation", `daily_oxygen_saturation.date >= "${since}"`)
  );
  for (const dp of spo2Pts || []) {
    const x = dp && dp.dailyOxygenSaturation;
    const d = dpCivilDate(x);
    const raw = x && (x.averagePercentage ?? (x.percentage && typeof x.percentage === "object" ? x.percentage.mean : x.percentage) ?? x.meanPercentage);
    const v = finiteNum(raw);
    if (d && v !== null && v > 0 && v <= 100) setField(d, "spo2", round1(v));
  }

  // 5. Desviación de temperatura cutánea nocturna
  const tempPts = await safe("daily-sleep-temperature-derivations", () =>
    fetchDataPoints(fetchImpl, token, "daily-sleep-temperature-derivations", `daily_sleep_temperature_derivations.date >= "${since}"`)
  );
  for (const dp of tempPts || []) {
    const x = dp && dp.dailySleepTemperatureDerivations;
    const d = dpCivilDate(x);
    if (!d || !x) continue;
    let v = finiteNum(x.relativeTemperatureCelsius ?? x.temperatureVariationCelsius ?? x.deviationCelsius);
    if (v === null) {
      const nightly = finiteNum(x.nightlyTemperatureCelsius);
      const baseline = finiteNum(x.baselineTemperatureCelsius);
      if (nightly !== null && baseline !== null) v = nightly - baseline;
    }
    if (v !== null) setField(d, "tempDev", round2(v));
  }

  // 6. Pasos diarios agregados por día civil
  const stepItems = await safe("steps", () =>
    fetchDailyRollupOrPoints(fetchImpl, token, "steps", "steps.interval.civil_start_time", since, now)
  );
  const stepTotals = {};
  for (const item of stepItems || []) {
    const st = item && item.steps;
    if (!st) continue;
    const d = civilDateObj(item.civilStartTime && item.civilStartTime.date) || dpCivilDate(st) || dpCivilDate(item);
    const c = finiteNum(st.countSum ?? st.count);
    if (d && c !== null && c >= 0) stepTotals[d] = (stepTotals[d] || 0) + c;
  }
  for (const [d, total] of Object.entries(stepTotals)) {
    if (total > 0) setField(d, "steps", Math.round(total));
  }

  // 7. Active Zone Minutes diarios agregados por día civil
  const azmItems = await safe("active-zone-minutes", () =>
    fetchDailyRollupOrPoints(fetchImpl, token, "active-zone-minutes", "active_zone_minutes.interval.civil_start_time", since, now)
  );
  const azmTotals = {};
  for (const item of azmItems || []) {
    const az = item && item.activeZoneMinutes;
    if (!az) continue;
    const d = civilDateObj(item.civilStartTime && item.civilStartTime.date) || dpCivilDate(az) || dpCivilDate(item);
    let c = finiteNum(az.activeZoneMinutesSum ?? az.totalActiveZoneMinutes ?? az.countSum ?? az.minutesSum ?? az.activeZoneMinutes ?? az.count ?? az.minutes);
    if (c === null && az.heartRateZone) {
      const z = String(az.heartRateZone).toUpperCase();
      if (z === "MODERATE" || z === "FAT_BURN") c = 1;
      else if (z === "VIGOROUS" || z === "PEAK" || z === "CARDIO") c = 2;
    }
    if (d && c !== null && c >= 0) azmTotals[d] = (azmTotals[d] || 0) + c;
  }
  for (const [d, total] of Object.entries(azmTotals)) {
    if (total > 0) setField(d, "azm", Math.round(total));
  }

  // 8. FC de sueño vs. vigilia (solo resumido en memoria usando ventanas de sueño recientes; nunca crudo).
  const allWindows = extractSleepWindows(sleepPoints);
  const hrCut = new Date(now.getTime() - hrDays * 86400000).toISOString().slice(0, 10);
  const recentWindows = {};
  for (const [d, w] of Object.entries(allWindows)) {
    if (d >= hrCut) recentWindows[d] = w;
  }
  const winEntries = Object.entries(recentWindows);
  if (winEntries.length > 0) {
    let minMs = Infinity;
    let maxMs = -Infinity;
    for (const [d, w] of winEntries) {
      const dayStart = Date.parse(`${d}T00:00:00Z`) - (w.offsetMs || 0);
      const dayEnd = dayStart + 86400000;
      if (w.startMs < minMs) minMs = w.startMs;
      if (dayStart < minMs) minMs = dayStart;
      if (w.endMs > maxMs) maxMs = w.endMs;
      if (dayEnd > maxMs) maxMs = dayEnd;
    }
    maxMs = Math.min(maxMs, now.getTime());
    const maxSpan = 13.5 * 86400000;
    if (maxMs - minMs > maxSpan) minMs = maxMs - maxSpan;
    if (maxMs > minMs) {
      const hrPoints = await safe("heart-rate", () => fetchHeartRateRange(fetchImpl, token, minMs, maxMs));
      const dips = computeHrDip(hrPoints || [], recentWindows);
      for (const [d, dip] of Object.entries(dips)) {
        setField(d, "sleepHr", dip.sleepHr);
        setField(d, "awakeHr", dip.awakeHr);
        setField(d, "hrDip", dip.hrDip);
      }
    }
  }

  const vitals = {};
  for (const d of Object.keys(map).sort()) {
    const clean = {};
    for (const [k, val] of Object.entries(map[d])) {
      if (val !== null && val !== undefined && val !== "") clean[k] = val;
    }
    if (Object.keys(clean).length > 0) {
      clean.src = "google";
      vitals[d] = clean;
    }
  }
  return { vitals, warnings };
}

// Fusiona signos vitales diarios en health/vitals.json (90 días) y en la clave `vitals` de data.json (solo si cambió).
export function applyVitals({ root = process.cwd(), incoming = {}, now = new Date() } = {}) {
  const storePath = path.join(root, "health", "vitals.json");
  const dataPath = path.join(root, "data.json");
  const stored = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : {};
  const data = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, "utf8")) : {};
  const map = { ...stored };

  for (const [date, entry] of Object.entries(incoming || {})) {
    if (!date || !entry || typeof entry !== "object") continue;
    const merged = { ...(map[date] || {}) };
    for (const [k, val] of Object.entries(entry)) {
      if (val !== null && val !== undefined && val !== "") merged[k] = val;
    }
    if (Object.keys(merged).length > 0) map[date] = merged;
  }

  const cut = new Date(now.getTime() - VITALS_KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  const v = {};
  Object.keys(map).sort().forEach((d) => { if (d >= cut) v[d] = map[d]; });

  const hasData = Object.keys(v).length > 0 || fs.existsSync(storePath);
  if (hasData) {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(v, null, 1) + "\n");
  }

  const prev = data.vitals && data.vitals.v ? data.vitals.v : null;
  const changed = (Object.keys(v).length > 0 || prev !== null) && JSON.stringify(prev) !== JSON.stringify(v);
  if (changed) {
    data.vitals = { v, at: now.getTime() };
    fs.writeFileSync(dataPath, JSON.stringify(data));
  }
  return { days: Object.keys(v).length, changed };
}

export async function main({ root = process.cwd(), now = new Date(), env = process.env, fetchImpl = globalThis.fetch, dryRun = false, argv = [] } = {}) {
  if (!env.GOOGLE_HEALTH_CLIENT_ID || !env.GOOGLE_HEALTH_CLIENT_SECRET || !env.GOOGLE_HEALTH_REFRESH_TOKEN) {
    console.log("Google Health sin configurar: faltan secretos. Nada que hacer.");
    return { skipped: true };
  }
  const isDryRun = dryRun || (Array.isArray(argv) && argv.includes("--dry-run"));
  const token = await accessToken(fetchImpl, env);
  const storePath = path.join(root, "health", "workouts.json");
  const stored = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : [];
  const points = await fetchExercises(fetchImpl, token, sinceDate(stored, now));
  const incoming = points.map(toWorkout).filter(Boolean);

  if (isDryRun) {
    console.log(`[dry-run] entrenos de Google Health: ${points.length} · válidos: ${incoming.length}`);
  }
  const appliedW = isDryRun ? { list: stored, added: 0 } : applyWorkouts({ root, incoming, now });
  const { list, added } = appliedW;
  if (!isDryRun) {
    // Solo conteos en el registro.
    console.log(`entrenos de Google Health: ${points.length} · nuevos: ${added} · total: ${list.length}`);
  }

  // Sueño: si falla (p. ej. token sin el permiso nuevo), los entrenos ya quedaron guardados.
  let sleep = null;
  let sleepPoints = [];
  try {
    const since = new Date(now.getTime() - SLEEP_DAYS * 86400000).toISOString().slice(0, 10);
    sleepPoints = await fetchSleep(fetchImpl, token, since);
    const nights = sleepPoints.map(toSleep).filter(Boolean);
    if (isDryRun) {
      sleep = { nights: nights.length, changed: false };
      console.log(`[dry-run] sueño de Google Health: ${nights.length} noches`);
    } else {
      sleep = applySleep({ root, incoming: nights, now });
      console.log(`sueño de Google Health: ${nights.length} noches · guardadas: ${sleep.nights}${sleep.changed ? " · actualizado" : ""}`);
    }
  } catch (e) {
    const hint = e.status === 403 ? " Falta el permiso de sueño: en tu Mac corre ESPALDERA_BROWSER=Safari node scripts/google-health-auth.mjs --solo-fitbit" : "";
    console.log(`sueño: no disponible (${e.status || "error"}).${hint}`);
  }

  // Vitals: degradación elegante por endpoint; si falla o falta scope, nunca afecta entrenos ni sueño.
  let vitals = null;
  try {
    const vSince = new Date(now.getTime() - VITALS_DAYS * 86400000).toISOString().slice(0, 10);
    const { vitals: incomingVitals, warnings } = await fetchVitals(fetchImpl, token, vSince, { now, sleepPoints });
    const count = Object.keys(incomingVitals).length;
    if (warnings.length) {
      const has403 = warnings.some((w) => w.status === 403);
      const summary = warnings.map((w) => `${w.endpoint}(${w.status})`).join(", ");
      const hint = has403 ? " Falta el permiso de signos vitales: corre node scripts/google-health-auth.mjs --solo-fitbit" : "";
      console.log(`vitals avisos: ${summary}.${hint}`);
    }
    if (isDryRun) {
      vitals = { days: count, changed: false, warnings };
      console.log(`[dry-run] vitals de Google Health: ${count} días`);
    } else {
      const appliedV = applyVitals({ root, incoming: incomingVitals, now });
      vitals = { ...appliedV, warnings };
      console.log(`vitals de Google Health: ${count} días nuevos · guardados: ${appliedV.days}${appliedV.changed ? " · actualizado" : ""}`);
    }
  } catch (e) {
    console.log(`vitals: no disponibles (${(e && e.status) || "error"}).`);
  }

  return isDryRun
    ? { dryRun: true, points: points.length, added: 0, total: incoming.length, sleep, vitals }
    : { points: points.length, added, total: list.length, sleep, vitals };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main({ argv: process.argv.slice(2) }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
