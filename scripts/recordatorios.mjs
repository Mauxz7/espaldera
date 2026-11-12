// Remitente de avisos con la app cerrada (tarea H4).
// Corre en GitHub Actions dentro del repositorio PRIVADO (copia de este archivo en scripts/).
// Lee data.json (hábitos del día y sus horas), las suscripciones en push/subs/*.json y
// el estado en push/state.json; envía un aviso por hora mientras haya hábitos pendientes.
// Las funciones puras se prueban en tests/recordatorios.test.mjs del repositorio público.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const TZ = "America/Costa_Rica";
export const APP_URL = "https://mauxz7.github.io/espaldera/";
export const QUIET = { from: 6 * 60, to: 23 * 60 + 45 }; // solo entre 6:00 a.m. y 11:45 p.m.

// Si nunca se editaron los hábitos, solo la creatina tiene hora (igual que en la app).
export const FALLBACK_DEFS = [
  { id: "o_creatine", label: "Tomar creatina todos los días.", kind: "check", target: 1, remindAt: "12:00" },
];

export function localParts(now = new Date(), tz = TZ) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  const hour = Number(p.hour) % 24;
  const minute = Number(p.minute);
  return { date: `${p.year}-${p.month}-${p.day}`, hour, minute, minutes: hour * 60 + minute };
}

export function parseRemindAt(s) {
  const m = typeof s === "string" ? /^(\d{1,2}):(\d{2})$/.exec(s.trim()) : null;
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

// Misma regla que isHabitDone en src/data/habits.js.
export function isHabitDone(def, val) {
  if (val === true) return true;
  if (val === false || val == null) return false;
  if (def && def.kind === "count") {
    const num = typeof val === "number" ? val : Number(val);
    const target = def.target != null ? Number(def.target) : 1;
    return !isNaN(num) && num >= target;
  }
  return Boolean(val);
}

export function dueHabits(defs, dayHabits, parts) {
  return (Array.isArray(defs) && defs.length ? defs : FALLBACK_DEFS).filter((d) => {
    if (!d || d.archived) return false;
    const at = parseRemindAt(d.remindAt);
    return at !== null && parts.minutes >= at && !isHabitDone(d, (dayHabits || {})[d.id]);
  });
}

// Un aviso por hora: se envía si algún hábito pendiente no avisó todavía en esta hora.
export function planSend(due, sent, parts) {
  const slot = `${parts.date}-${parts.hour}`;
  const inWindow = parts.minutes >= QUIET.from && parts.minutes <= QUIET.to;
  const fresh = due.filter((d) => (sent || {})[d.id] !== slot);
  if (!inWindow || fresh.length === 0) return { send: false, slot, nextSent: sent || {} };
  const nextSent = {};
  for (const [k, v] of Object.entries(sent || {})) if (typeof v === "string" && v.startsWith(parts.date)) nextSent[k] = v;
  for (const d of due) nextSent[d.id] = slot;
  return { send: true, slot, nextSent };
}

const clean = (s) => (typeof s === "string" ? s.trim().replace(/\.+$/, "") : "") || "Hábito";
const hhmm = (p) => `${p.hour % 12 || 12}:${String(p.minute).padStart(2, "0")} ${p.hour < 12 ? "a.m." : "p.m."}`;

export function buildPayload(due, parts) {
  const base = { tag: "espaldera-recordatorio", url: APP_URL };
  if (due.length === 1) {
    const name = clean(due[0].label);
    if (due[0].id === "o_creatine") return { ...base, title: "Creatina pendiente", body: `Son las ${hhmm(parts)} y aún no la marcas. Tómala y márcala en Espaldera.` };
    return { ...base, title: `Hábito pendiente: ${name}`, body: `Son las ${hhmm(parts)} y aún no marcas «${name}».` };
  }
  return { ...base, title: `${due.length} hábitos pendientes`, body: `Son las ${hhmm(parts)}. Pendientes: ${due.map((d) => clean(d.label)).join(", ")}.` };
}

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return fallback; } };

export async function main({ root = process.cwd(), now = new Date(), test = false, send } = {}) {
  const data = readJson(path.join(root, "data.json"), {});
  const subsDir = path.join(root, "push", "subs");
  const subs = fs.existsSync(subsDir)
    ? fs.readdirSync(subsDir).filter((f) => f.endsWith(".json")).map((f) => ({ file: path.join(subsDir, f), rec: readJson(path.join(subsDir, f), null) })).filter((s) => s.rec && s.rec.endpoint && s.rec.keys)
    : [];
  const statePath = path.join(root, "push", "state.json");
  const state = readJson(statePath, { sent: {} });
  const parts = localParts(now);
  if (subs.length === 0) { console.log("sin dispositivos suscritos"); return { sent: 0 }; }

  let payload;
  let nextSent = state.sent || {};
  if (test) {
    payload = { tag: "espaldera-prueba", url: APP_URL, title: "Prueba de Espaldera", body: "Si ves esto, los avisos con la app cerrada funcionan en este dispositivo." };
  } else {
    const defs = data.habitDefs && Array.isArray(data.habitDefs.v) ? data.habitDefs.v : FALLBACK_DEFS;
    const day = (data.habits && data.habits.v && data.habits.v[parts.date]) || {};
    const due = dueHabits(defs, day, parts);
    const plan = planSend(due, state.sent, parts);
    if (!plan.send) { console.log(`${parts.date} ${parts.hour}:${String(parts.minute).padStart(2, "0")} · pendientes: ${due.length} · sin aviso nuevo`); return { sent: 0 }; }
    payload = buildPayload(due, parts);
    nextSent = plan.nextSent;
  }

  if (!send) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) { console.log("faltan los secretos VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY"); return { sent: 0 }; }
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(APP_URL, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    send = (rec, body) => webpush.sendNotification({ endpoint: rec.endpoint, keys: rec.keys }, body, { TTL: 3600, urgency: "high" });
  }
  let ok = 0;
  let gone = 0;
  for (const s of subs) {
    try {
      await send(s.rec, JSON.stringify(payload));
      ok++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { fs.unlinkSync(s.file); gone++; }
      else console.log(`fallo ${s.rec.device || "?"}: ${e && e.statusCode ? e.statusCode : "red"}`);
    }
  }
  if (!test) { fs.mkdirSync(path.dirname(statePath), { recursive: true }); fs.writeFileSync(statePath, JSON.stringify({ sent: nextSent }, null, 2) + "\n"); }
  // Solo conteos en el registro: nada de direcciones de suscripción ni contenido de hábitos.
  console.log(`${test ? "prueba" : "aviso"} enviado a ${ok} de ${subs.length} dispositivos${gone ? ` · ${gone} vencidos eliminados` : ""}`);
  return { sent: ok, gone };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main({ test: process.env.PRUEBA === "true" }).catch((e) => { console.error("error", e && e.message); process.exit(1); });
}
