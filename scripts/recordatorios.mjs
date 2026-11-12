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

// Si nunca se editaron los hábitos, estos son los 5 obligatorios iniciales (solo la creatina tiene hora por defecto).
export const FALLBACK_DEFS = [
  { id: "o_creatine", label: "Tomar creatina todos los días.", group: "req", kind: "check", target: 1, remindAt: "12:00" },
  { id: "o_prep", label: "Alistar la creatina del día siguiente.", group: "req", kind: "check", target: 1, remindAt: null },
  { id: "o_water", label: "Tomar 2 botellas de agua (2L en total).", group: "req", kind: "count", target: 2, remindAt: null },
  { id: "o_pills", label: "Tomar pastillas (magnesio, omega 3, vitamina C).", group: "req", kind: "check", target: 1, remindAt: null },
  { id: "o_screens", label: "Dejar dispositivos electrónicos a las 10:30 p.m.", group: "req", kind: "check", target: 1, remindAt: null },
];

export const SUMMARY_KINDS = ["strength", "run", "bike", "walk", "other"];

export const KIND_LABELS = {
  strength: "Fuerza",
  run: "Running",
  bike: "Bici",
  walk: "Caminata",
  other: "Otro",
};

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

export function buildNoticePayload(title, body = "") {
  const t = String(title || "").trim() || "Aviso de Espaldera";
  const b = String(body || "").trim();
  return { tag: "espaldera-aviso", url: APP_URL, title: t, body: b };
}

export function shiftDateKey(dateKey, offsetDays) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}

const unwrap = (entry, fallback) => (entry && typeof entry === "object" && !Array.isArray(entry) && "v" in entry ? entry.v : (entry ?? fallback));

function resolveTodayKey(now = new Date(), tz = TZ) {
  if (typeof now === "string" && /^\d{4}-\d{2}-\d{2}$/.test(now.trim())) return now.trim();
  const dt = now instanceof Date ? now : new Date(now);
  return localParts(isNaN(dt) ? new Date() : dt, tz).date;
}

export function computeRequiredHabitStats(defs, habits = {}, today = new Date(), windowDays = 7, tz = TZ) {
  const list = Array.isArray(defs) && defs.length ? defs : FALLBACK_DEFS;
  const reqDefs = list.filter((d) => d && !d.archived && (!d.group || d.group === "req"));
  const safeHabits = habits && typeof habits === "object" ? habits : {};
  const todayKey = resolveTodayKey(today, tz);
  const totalWindow = Math.max(1, Number(windowDays) || 7);

  const isAllReqDone = (dateKey) => {
    if (reqDefs.length === 0) return false;
    const dayData = safeHabits[dateKey];
    if (!dayData || typeof dayData !== "object") return false;
    return reqDefs.every((def) => isHabitDone(def, dayData[def.id]));
  };

  let daysDone = 0;
  for (let i = 0; i < totalWindow; i++) {
    const key = shiftDateKey(todayKey, i - (totalWindow - 1));
    if (isAllReqDone(key)) daysDone++;
  }
  const pct = Math.round((daysDone / totalWindow) * 100);

  let streak = 0;
  for (let offset = 0; offset >= -3650; offset--) {
    const key = shiftDateKey(todayKey, offset);
    if (isAllReqDone(key)) {
      streak++;
    } else if (offset < 0) {
      break;
    }
  }

  return { daysDone, windowDays: totalWindow, pct, streak, currentStreak: streak };
}

export function buildWeeklySummary(data = {}, now = new Date(), tz = TZ) {
  const safeData = data && typeof data === "object" ? data : {};
  const todayKey = resolveTodayKey(now, tz);
  const startKey = shiftDateKey(todayKey, -6);

  const rawWorkouts = unwrap(safeData.workouts, []);
  const byKind = Object.fromEntries(SUMMARY_KINDS.map((k) => [k, { count: 0, min: 0 }]));
  let workoutsCount = 0;
  let totalMin = 0;

  for (const w of Array.isArray(rawWorkouts) ? rawWorkouts : []) {
    if (!w || typeof w !== "object" || !w.start) continue;
    let wDate = "";
    if (typeof w.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w.start.trim())) {
      wDate = w.start.trim();
    } else {
      const dt = new Date(w.start);
      if (isNaN(dt)) continue;
      wDate = localParts(dt, tz).date;
    }
    if (wDate < startKey || wDate > todayKey) continue;
    const kind = SUMMARY_KINDS.includes(w.kind) ? w.kind : "other";
    const n = Number(w.min);
    const min = typeof w.min !== "boolean" && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    workoutsCount++;
    totalMin += min;
    byKind[kind].count++;
    byKind[kind].min += min;
  }

  const rawDefs = unwrap(safeData.habitDefs, null);
  const rawHabits = unwrap(safeData.habits, {});
  const habitStats = computeRequiredHabitStats(rawDefs, rawHabits, todayKey, 7, tz);

  const kindParts = SUMMARY_KINDS
    .filter((k) => byKind[k].count > 0)
    .map((k) => `${KIND_LABELS[k]}: ${byKind[k].count} (${byKind[k].min} min)`);

  const workoutLine = workoutsCount > 0
    ? `Entrenos (7d): ${workoutsCount} (${totalMin} min) · ${kindParts.join(", ")}.`
    : "Entrenos (7d): 0 entrenos (0 min).";

  const habitLine = `Hábitos obligatorios: ${habitStats.pct}% (${habitStats.daysDone}/7 días) · Racha actual: ${habitStats.streak} ${habitStats.streak === 1 ? "día" : "días"}.`;
  const lines = [workoutLine, habitLine];

  return {
    tag: "espaldera-resumen",
    url: APP_URL,
    title: "Resumen semanal",
    body: lines.join("\n"),
    lines,
    startDate: startKey,
    endDate: todayKey,
    workouts: workoutsCount,
    workoutsCount,
    totalMin,
    byKind,
    habitDaysDone: habitStats.daysDone,
    habitPct: habitStats.pct,
    streak: habitStats.streak,
    currentStreak: habitStats.streak,
  };
}

export function parseCliArgs(argv = process.argv.slice(2), env = process.env) {
  const args = Array.isArray(argv) ? [...argv] : [];
  let test = env.PRUEBA === "true";
  let mode = "hourly";
  let title = "";
  let body = "";
  let root = process.cwd();

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--test") {
      test = true;
    } else if (a === "--resumen") {
      mode = "resumen";
    } else if (a === "--aviso") {
      mode = "aviso";
      const next1 = args[i + 1];
      if (next1 !== undefined && !next1.startsWith("--")) {
        title = next1;
        i++;
        const next2 = args[i + 1];
        if (next2 !== undefined && !next2.startsWith("--")) {
          body = next2;
          i++;
        }
      }
    } else if (a === "--root" && args[i + 1]) {
      root = args[++i];
    }
  }

  return { mode, test, title, body, root };
}

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return fallback; } };

async function sendToSubs(subs, payload, send) {
  if (!send) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.log("faltan los secretos VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY");
      return { sent: 0, gone: 0, skipped: true };
    }
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(APP_URL, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    send = (rec, body) => webpush.sendNotification({ endpoint: rec.endpoint, keys: rec.keys }, body, { TTL: 3600, urgency: "high" });
  }
  const message = JSON.stringify({ tag: payload.tag, url: payload.url, title: payload.title, body: payload.body });
  let ok = 0;
  let gone = 0;
  for (const s of subs) {
    try {
      await send(s.rec, message);
      ok++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { fs.unlinkSync(s.file); gone++; }
      else console.log(`fallo ${s.rec.device || "?"}: ${e && e.statusCode ? e.statusCode : "red"}`);
    }
  }
  return { sent: ok, gone };
}

export async function main(opts = {}) {
  const cli = opts.argv ? parseCliArgs(opts.argv, opts.env || process.env) : null;
  const root = opts.root || (cli && cli.root) || process.cwd();
  const now = opts.now || new Date();
  const test = opts.test !== undefined ? opts.test : Boolean(cli && cli.test);
  const send = opts.send;
  const mode = opts.mode || (opts.resumen ? "resumen" : opts.aviso ? "aviso" : (cli && cli.mode) || "hourly");

  const data = readJson(path.join(root, "data.json"), {});
  const subsDir = path.join(root, "push", "subs");
  const subs = fs.existsSync(subsDir)
    ? fs.readdirSync(subsDir).filter((f) => f.endsWith(".json")).map((f) => ({ file: path.join(subsDir, f), rec: readJson(path.join(subsDir, f), null) })).filter((s) => s.rec && s.rec.endpoint && s.rec.keys)
    : [];

  if (mode === "aviso" || mode === "resumen") {
    const payload = mode === "aviso"
      ? buildNoticePayload(opts.title ?? (opts.aviso && opts.aviso.title) ?? (cli && cli.title), opts.body ?? (opts.aviso && opts.aviso.body) ?? (cli && cli.body))
      : buildWeeklySummary(data, now);

    if (test) {
      console.log(`${payload.title}\n${payload.body}`);
      return { sent: 0, test: true, payload };
    }
    if (subs.length === 0) {
      console.log("sin dispositivos suscritos");
      return { sent: 0, payload };
    }
    const { sent: ok, gone, skipped } = await sendToSubs(subs, payload, send);
    if (skipped) return { sent: 0, payload };
    console.log(`${mode === "resumen" ? "resumen" : "aviso"} enviado a ${ok} de ${subs.length} dispositivos${gone ? ` · ${gone} vencidos eliminados` : ""}`);
    return { sent: ok, gone, payload };
  }

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

  const { sent: ok, gone, skipped } = await sendToSubs(subs, payload, send);
  if (skipped) return { sent: 0 };
  if (!test) { fs.mkdirSync(path.dirname(statePath), { recursive: true }); fs.writeFileSync(statePath, JSON.stringify({ sent: nextSent }, null, 2) + "\n"); }
  // Solo conteos en el registro: nada de direcciones de suscripción ni contenido de hábitos.
  console.log(`${test ? "prueba" : "aviso"} enviado a ${ok} de ${subs.length} dispositivos${gone ? ` · ${gone} vencidos eliminados` : ""}`);
  return { sent: ok, gone };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main({ argv: process.argv.slice(2), env: process.env }).catch((e) => { console.error("error", e && e.message); process.exit(1); });
}
