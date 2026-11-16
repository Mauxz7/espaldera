// Google Calendar ↔ Shift (Fase 7, C2 + C3). Corre en GitHub Actions dentro del repositorio PRIVADO
// (COPIA de este archivo y de google-health.mjs/entrenos.mjs en scripts/).
//
// C2 · Escribe: cal/plan.json (lo sube la app cuando cambia el plan) → calendario secundario «Shift».
//      Upsert por fecha con extendedProperties.private.shiftKey; borra las sesiones que ya no están en el plan.
//      Nunca toca el calendario principal.
// C3 · Lee: calendario principal, 14 días → clave `calBusy` de data.json:
//      { days: { "YYYY-MM-DD": { nightBusy, exam } } }. Oficina/casa NO se lee (lo decide el selector de la app).
//
// Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN
// (los guarda el dueño con scripts/google-health-auth.mjs). El id del calendario «Shift» vive en cal/state.json.
// Permisos: calendar.app.created (solo calendarios creados por la app) + calendar.events.readonly.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { accessToken } from "./google-health.mjs";

export const TZ = "America/Costa_Rica";
export const OFFSET = "-06:00"; // Costa Rica no cambia de horario
export const DAYS = 14;
export const NIGHT_FROM = "18:30";
export const NIGHT_TO = "21:00";
export const EXAM_RE = /\b(examen|entrega|parcial|quiz)\b/i;
const API = "https://www.googleapis.com/calendar/v3";
const H = 3600000;

// Fecha de Costa Rica (YYYY-MM-DD) de un instante.
export const crDate = (d) => new Date(new Date(d).getTime() - 6 * H).toISOString().slice(0, 10);
export const at = (date, hhmm) => new Date(`${date}T${hhmm}:00${OFFSET}`).getTime();
export function windowDates(now, n = DAYS) {
  const first = crDate(now);
  return Array.from({ length: n }, (_, i) => new Date(at(first, "12:00") + i * 24 * H).toISOString().slice(0, 10));
}

const pad = (n) => String(n).padStart(2, "0");
// "2026-11-16" + "06:30" + 45 min → hora local de fin "07:15" (mismo día; ninguna rutina cruza la medianoche).
export function endTime(start, min) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + Number(min || 0);
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
}

// Cuerpo del evento de Google a partir de una entrada de cal/plan.json.
export function eventFor(item) {
  return {
    summary: item.title,
    description: item.desc || "",
    start: { dateTime: `${item.date}T${item.start}:00${OFFSET}`, timeZone: TZ },
    end: { dateTime: `${item.date}T${endTime(item.start, item.min)}:00${OFFSET}`, timeZone: TZ },
    extendedProperties: { private: { shiftKey: item.date } },
  };
}

const sameInstant = (a, b) => !!a && !!b && new Date(a).getTime() === new Date(b).getTime();
const differs = (ev, want) =>
  ev.summary !== want.summary || (ev.description || "") !== want.description ||
  !sameInstant(ev.start && ev.start.dateTime, want.start.dateTime) || !sameInstant(ev.end && ev.end.dateTime, want.end.dateTime);

// Qué hacer en el calendario «Shift». Solo mira las fechas de la ventana (desde hoy); lo pasado no se toca.
export function planChanges(existing, items, dates) {
  const inWin = new Set(dates);
  const want = new Map();
  for (const it of items || []) if (it && inWin.has(it.date) && !want.has(it.date)) want.set(it.date, eventFor(it));
  const insert = [];
  const patch = [];
  const remove = [];
  const seen = new Set();
  for (const ev of existing || []) {
    const key = ev && ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.shiftKey;
    if (!key || !inWin.has(key)) continue;
    if (!want.has(key) || seen.has(key)) { remove.push(ev.id); continue; } // ya no hay sesión ese día, o un duplicado
    seen.add(key);
    if (differs(ev, want.get(key))) patch.push({ id: ev.id, body: want.get(key) });
  }
  for (const [key, body] of want) if (!seen.has(key)) insert.push(body);
  return { insert, patch, remove };
}

// C3: noches ocupadas y exámenes desde los eventos del calendario principal.
export function busyFromEvents(events, dates) {
  const days = {};
  for (const d of dates) days[d] = { nightBusy: false, exam: null };
  for (const ev of events || []) {
    if (!ev || ev.status === "cancelled") continue;
    const title = String(ev.summary || "");
    const me = (ev.attendees || []).find((a) => a.self);
    if (me && me.responseStatus === "declined") continue;
    const allDay = !!(ev.start && ev.start.date);
    const startDay = allDay ? ev.start.date : ev.start && ev.start.dateTime ? crDate(ev.start.dateTime) : null;
    if (EXAM_RE.test(title) && days[startDay] && !days[startDay].exam) days[startDay].exam = title.slice(0, 80);
    if (allDay || ev.transparency === "transparent" || title.trim().startsWith("🏋️")) continue; // libres o entrenos viejos
    const s = new Date(ev.start.dateTime).getTime();
    const e = new Date((ev.end && ev.end.dateTime) || ev.start.dateTime).getTime();
    for (const d of dates) if (s < at(d, NIGHT_TO) && e > at(d, NIGHT_FROM)) days[d].nightBusy = true;
  }
  return { days };
}

async function gapi(fetchImpl, token, method, url, body) {
  const res = await fetchImpl(url.startsWith("http") ? url : API + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = (j.error && (j.error.message || j.error.status)) || "";
    throw Object.assign(new Error(`Google Calendar respondió ${res.status} (${method} ${url.split("?")[0]}). ${why}`), { status: res.status });
  }
  return j;
}

async function listEvents(fetchImpl, token, calId, timeMin, timeMax) {
  const out = [];
  let page = "";
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", maxResults: "250", showDeleted: "false" });
    if (page) q.set("pageToken", page);
    const j = await gapi(fetchImpl, token, "GET", `/calendars/${encodeURIComponent(calId)}/events?${q}`);
    out.push(...(j.items || []));
    page = j.nextPageToken || "";
    if (!page) break;
  }
  return out;
}

const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return fallback; } };

async function ensureCalendar(fetchImpl, token, statePath) {
  const st = readJson(statePath, {});
  if (st.calendarId) {
    try { await gapi(fetchImpl, token, "GET", `/calendars/${encodeURIComponent(st.calendarId)}`); return st.calendarId; }
    catch (e) { if (e.status !== 404 && e.status !== 403) throw e; } // lo borraste: se crea otro
  }
  const cal = await gapi(fetchImpl, token, "POST", "/calendars", { summary: "Shift", description: "Sesiones planeadas por la app Shift. Se actualiza solo.", timeZone: TZ });
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ calendarId: cal.id }, null, 1) + "\n");
  console.log("calendario «Shift» creado");
  return cal.id;
}

export async function main({ root = process.cwd(), now = new Date(), env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    console.log("Calendario sin configurar: faltan secretos. Nada que hacer.");
    return { skipped: true };
  }
  const token = await accessToken(fetchImpl, {
    GOOGLE_HEALTH_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_HEALTH_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    GOOGLE_HEALTH_REFRESH_TOKEN: env.GOOGLE_CALENDAR_REFRESH_TOKEN,
  });
  const dates = windowDates(now);
  const timeMin = new Date(at(dates[0], "00:00")).toISOString();
  const timeMax = new Date(at(dates[dates.length - 1], "23:59")).toISOString();
  const out = {};

  // C2 · escribir el plan (solo si la app ya subió cal/plan.json; sin archivo no se borra nada)
  const plan = readJson(path.join(root, "cal", "plan.json"), null);
  if (plan && Array.isArray(plan.items)) {
    const calId = await ensureCalendar(fetchImpl, token, path.join(root, "cal", "state.json"));
    const existing = await listEvents(fetchImpl, token, calId, timeMin, timeMax);
    const ch = planChanges(existing, plan.items, dates);
    const base = `/calendars/${encodeURIComponent(calId)}/events`;
    for (const body of ch.insert) await gapi(fetchImpl, token, "POST", base, body);
    for (const p of ch.patch) await gapi(fetchImpl, token, "PUT", `${base}/${encodeURIComponent(p.id)}`, p.body);
    for (const id of ch.remove) await gapi(fetchImpl, token, "DELETE", `${base}/${encodeURIComponent(id)}`);
    Object.assign(out, { insert: ch.insert.length, patch: ch.patch.length, remove: ch.remove.length });
  }

  // C3 · leer el calendario principal → calBusy (solo se escribe si cambió, para no despertar a los dispositivos)
  const events = await listEvents(fetchImpl, token, "primary", timeMin, timeMax);
  const busy = busyFromEvents(events, dates);
  const dataPath = path.join(root, "data.json");
  const data = readJson(dataPath, {});
  const prev = data.calBusy && data.calBusy.v;
  if (JSON.stringify(prev) !== JSON.stringify(busy)) {
    data.calBusy = { v: busy, at: now.getTime() };
    fs.writeFileSync(dataPath, JSON.stringify(data));
    out.busyChanged = true;
  }
  const nights = Object.values(busy.days).filter((d) => d.nightBusy).length;
  const exams = Object.values(busy.days).filter((d) => d.exam).length;
  // Solo conteos en el registro.
  console.log(`calendario: +${out.insert || 0} ~${out.patch || 0} -${out.remove || 0} · noches ocupadas ${nights}/${dates.length} · exámenes ${exams}${out.busyChanged ? " · calBusy actualizado" : ""}`);
  return { ...out, nights, exams };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
