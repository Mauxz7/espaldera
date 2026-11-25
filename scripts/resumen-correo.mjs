// Resumen semanal por correo (Shift).
// Corre cada lunes en GitHub Actions dentro del repositorio PRIVADO (copia de este archivo en scripts/).
// Lee data.json y envía un correo HTML + texto plano vía SMTP (Gmail con Contraseña de aplicación).
// Sin dependencias de interfaz ni importaciones desde src/; probado en tests/resumen-correo.test.mjs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const TZ = "America/Costa_Rica";
export const APP_URL = "https://mauxz7.github.io/espaldera/";
export const SUMMARY_KINDS = ["strength", "run", "bike", "walk", "other"];
export const MAIN_ROUTINES = ["d1", "d2", "d3", "d4"];
export const MINUTES_GOAL = 150;
export const SLEEP_GOAL_MIN = 7 * 60;
export const BED_GOAL = "23:00";
export const FIT_SESSION_MIN = 20;
export const ATHLETE_ID = "atleta";
export const REST_ID = "descanso";
export const IDENTITY_COLORS = ["accent", "good", "cool", "warn"];

export const KIND_LABELS = {
  strength: "Fuerza",
  run: "Running",
  bike: "Bici",
  walk: "Caminata",
  other: "Otro",
};

const STRENGTH_ORDER = ["d1", "d4", "d2"];

export const FALLBACK_HABIT_DEFS = [
  { id: "o_creatine", label: "Tomar creatina todos los días.", group: "req", kind: "check", target: 1, identity: "atleta" },
  { id: "o_prep", label: "Alistar la creatina del día siguiente.", group: "req", kind: "check", target: 1, identity: "atleta" },
  { id: "o_water", label: "Tomar 2 botellas de agua (2L en total).", group: "req", kind: "count", target: 2, identity: "atleta" },
  { id: "o_pills", label: "Tomar pastillas (magnesio, omega 3, vitamina C).", group: "req", kind: "check", target: 1, identity: "atleta" },
  { id: "o_screens", label: "Dejar dispositivos electrónicos a las 10:30 p.m.", group: "req", kind: "check", target: 1, identity: "descanso" },
  { id: "f_read", label: "Leer 15 min de libro personal.", group: "opt", kind: "check", target: 1, identity: "lector" },
  { id: "f_shake", label: "Tomar batido de proteína.", group: "opt", kind: "check", target: 1, identity: "atleta" },
  { id: "f_fruit", label: "Comer una fruta.", group: "opt", kind: "check", target: 1, identity: "atleta" },
];

export const FALLBACK_IDENTITIES = [
  { id: "atleta", label: "Atleta", emoji: "🏋️", color: "accent" },
  { id: "estudiante", label: "Estudiante de Derecho", emoji: "⚖️", color: "warn" },
  { id: "lector", label: "Lector", emoji: "📚", color: "good" },
  { id: "descanso", label: "Persona descansada", emoji: "😴", color: "cool" },
];

export const DEFAULT_HABIT_IDENTITY = {
  o_creatine: "atleta",
  o_prep: "atleta",
  o_water: "atleta",
  o_pills: "atleta",
  f_shake: "atleta",
  f_fruit: "atleta",
  f_read: "lector",
  o_screens: "descanso",
};

export const FALLBACK_DOPAMINE_DEFS = [
  { id: "d_social", label: "Redes sociales (15 min)", kind: "cheap", limit: 2 },
  { id: "d_shorts", label: "Videos cortos (reels/TikTok)", kind: "cheap", limit: 1 },
  { id: "d_binge", label: "Series en maratón (1 episodio extra)", kind: "cheap", limit: 1 },
  { id: "d_walk", label: "Caminar afuera", kind: "good", identity: "descanso", goal: 0 },
  { id: "d_study", label: "Estudiar sin celular (25 min)", kind: "good", identity: "estudiante", goal: 0 },
  { id: "d_read", label: "Leer por gusto", kind: "good", identity: "lector", goal: 0 },
  { id: "d_sport", label: "Entrenar o deporte", kind: "good", identity: "atleta", goal: 0 },
];

const unwrap = (entry, fallback) => (entry && typeof entry === "object" && !Array.isArray(entry) && "v" in entry ? entry.v : (entry ?? fallback));

export function localDateKey(now = new Date(), tz = TZ) {
  if (typeof now === "string" && /^\d{4}-\d{2}-\d{2}$/.test(now.trim())) return now.trim();
  const dt = now instanceof Date ? now : new Date(now);
  const target = isNaN(dt) ? new Date() : dt;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(target).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

export function shiftDateKey(dateKey, offsetDays) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}

// 0 = lunes, ..., 6 = domingo
function weekdayMon0(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/**
 * Resuelve la semana del resumen:
 * - "last" (por defecto): última semana completa lunes–domingo (si hoy es domingo, es la que cierra hoy; si es lunes..sábado, es la anterior).
 * - "current": semana en curso desde el lunes hasta hoy.
 */
export function resolveSummaryWeek(now = new Date(), weekMode = "last", tz = TZ) {
  const todayKey = localDateKey(now, tz);
  const dow = weekdayMon0(todayKey);
  const currentMonday = shiftDateKey(todayKey, -dow);

  if (weekMode === "current" || weekMode === "actual") {
    const keys = Array.from({ length: dow + 1 }, (_, i) => shiftDateKey(currentMonday, i));
    return {
      mode: "current",
      mondayKey: currentMonday,
      startDate: currentMonday,
      endDate: todayKey,
      keys,
    };
  }

  const mondayKey = dow === 6 ? currentMonday : shiftDateKey(currentMonday, -7);
  const keys = Array.from({ length: 7 }, (_, i) => shiftDateKey(mondayKey, i));
  return {
    mode: "last",
    mondayKey,
    startDate: keys[0],
    endDate: keys[6],
    keys,
  };
}

export function formatDateShort(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  if (!y || !m || !d) return String(dateKey || "");
  return new Intl.DateTimeFormat("es-CR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d))).replace(/\.$/, "");
}

export function formatSleep(min) {
  const t = Math.round(Number(min) || 0);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHabitDone(def, val) {
  if (val === true) return true;
  if (val === false || val == null) return false;
  if (def && def.kind === "count") {
    const num = typeof val === "number" ? val : Number(val);
    const target = def.target != null ? Number(def.target) : 1;
    return !isNaN(num) && num >= target;
  }
  return Boolean(val);
}

function isHabitDoneOrMini(def, dayMap) {
  if (!def || !dayMap || typeof dayMap !== "object") return false;
  if (isHabitDone(def, dayMap[def.id])) return true;
  return Boolean(dayMap._mini && dayMap._mini[def.id]);
}

function bedMinutes(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || ""));
  if (!m) return null;
  const h = Number(m[1]);
  return (h < 12 ? h + 24 : h) * 60 + Number(m[2]);
}

function isRested(night) {
  if (!night || !(night.min > 0)) return false;
  if (night.min >= SLEEP_GOAL_MIN) return true;
  const bed = bedMinutes(night.bed);
  return bed !== null && bed <= bedMinutes(BED_GOAL);
}

function normalizeIdentities(list) {
  if (!Array.isArray(list)) return FALLBACK_IDENTITIES;
  const seen = new Set();
  const out = [];
  list.forEach((it, i) => {
    if (!it || typeof it.id !== "string" || !it.id || seen.has(it.id)) return;
    seen.add(it.id);
    out.push({
      id: it.id,
      label: typeof it.label === "string" && it.label.trim() ? it.label : "Identidad",
      emoji: typeof it.emoji === "string" ? it.emoji : "",
      color: IDENTITY_COLORS.includes(it.color) ? it.color : IDENTITY_COLORS[i % IDENTITY_COLORS.length],
    });
  });
  return out;
}

function habitIdentity(def) {
  if (!def) return null;
  if (Object.prototype.hasOwnProperty.call(def, "identity")) return def.identity || null;
  return DEFAULT_HABIT_IDENTITY[def.id] || null;
}

function parseDopamineCount(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normalizeDopamineDefs(list) {
  if (!Array.isArray(list)) return FALLBACK_DOPAMINE_DEFS;
  const seen = new Set();
  const out = [];
  for (const it of list) {
    if (!it || typeof it.id !== "string" || !it.id || seen.has(it.id)) continue;
    seen.add(it.id);
    const label = typeof it.label === "string" && it.label.trim() ? it.label.trim() : "Elemento";
    const kind = it.kind === "cheap" ? "cheap" : "good";
    if (kind === "cheap") {
      out.push({ id: it.id, label, kind, limit: parseDopamineCount(it.limit, 1) });
    } else {
      const identity = typeof it.identity === "string" && it.identity ? it.identity : null;
      out.push({ id: it.id, label, kind, identity, goal: parseDopamineCount(it.goal, 0) });
    }
  }
  return out;
}

function fitbitSession(kind, planned, done) {
  if (kind === "run") return done.includes("d3") ? null : "d3";
  if (kind !== "strength") return null;
  if (planned && STRENGTH_ORDER.includes(planned) && !done.includes(planned)) return planned;
  return STRENGTH_ORDER.find((r) => !done.includes(r)) || null;
}

export function buildWeeklyReport(data = {}, opts = {}) {
  const safeData = data && typeof data === "object" ? data : {};
  const tz = opts.tz || TZ;
  const week = resolveSummaryWeek(opts.now || new Date(), opts.week || "last", tz);
  const keys = week.keys;

  // Hábitos
  const rawDefs = unwrap(safeData.habitDefs, null);
  const habitDefs = (Array.isArray(rawDefs) && rawDefs.length ? rawDefs : FALLBACK_HABIT_DEFS).filter((d) => d && d.id && !d.archived);
  const reqDefs = habitDefs.filter((d) => !d.group || d.group === "req");
  const safeHabits = unwrap(safeData.habits, {}) || {};
  const isAllReqDone = (k) => reqDefs.length > 0 && Boolean(safeHabits[k] && typeof safeHabits[k] === "object" && reqDefs.every((d) => isHabitDoneOrMini(d, safeHabits[k])));

  let habitDaysDone = 0;
  for (const k of keys) {
    if (isAllReqDone(k)) habitDaysDone++;
  }
  const habitDaysTotal = keys.length;
  const habitPct = habitDaysTotal > 0 ? Math.round((habitDaysDone / habitDaysTotal) * 100) : 0;

  let streak = 0;
  for (let offset = 0; offset >= -3650; offset--) {
    const k = shiftDateKey(week.endDate, offset);
    if (isAllReqDone(k)) streak++;
    else if (offset < 0) break;
  }

  const perHabit = reqDefs.map((d) => {
    let daysDone = 0;
    for (const k of keys) {
      if (isHabitDoneOrMini(d, safeHabits[k])) daysDone++;
    }
    return { id: d.id, label: String(d.label || d.id).replace(/\.+$/, ""), daysDone, total: habitDaysTotal };
  });

  // Entrenos (Fitbit) y cobertura de sesiones
  const rawWorkouts = unwrap(safeData.workouts, []);
  const byKind = Object.fromEntries(SUMMARY_KINDS.map((k) => [k, { count: 0, min: 0 }]));
  const fitByDay = keys.map(() => []);
  let workoutsCount = 0;
  let totalMin = 0;

  for (const w of Array.isArray(rawWorkouts) ? rawWorkouts : []) {
    if (!w || typeof w !== "object" || !w.start) continue;
    const wDate = localDateKey(w.start, tz);
    const dayIdx = keys.indexOf(wDate);
    if (dayIdx < 0) continue;
    const kind = SUMMARY_KINDS.includes(w.kind) ? w.kind : "other";
    const n = Number(w.min);
    const min = typeof w.min !== "boolean" && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    workoutsCount++;
    totalMin += min;
    byKind[kind].count++;
    byKind[kind].min += min;
    fitByDay[dayIdx].push({ kind, min });
  }

  const log = unwrap(safeData.log, {}) || {};
  const weekPlan = unwrap(safeData.weekPlan, {}) || {};
  const storedPlan = weekPlan[week.mondayKey] && Array.isArray(weekPlan[week.mondayKey].plan) ? weekPlan[week.mondayKey].plan : null;
  const fixed = {};
  const fromFitbit = {};

  keys.forEach((k, i) => {
    if (log[k] && log[k].r) fixed[i] = log[k].r;
  });
  fitByDay.forEach((list, i) => {
    if (fixed[i] || !list.length) return;
    const session = list
      .filter((w) => (w.kind === "strength" || w.kind === "run") && w.min >= FIT_SESSION_MIN)
      .sort((a, b) => b.min - a.min)[0];
    if (!session) return;
    const planned = storedPlan ? storedPlan[i] : null;
    const r = fitbitSession(session.kind, planned, Object.values(fixed));
    if (r) {
      fixed[i] = r;
      fromFitbit[i] = r;
    }
  });

  const sessionsDone = new Set(Object.values(fixed).filter((r) => MAIN_ROUTINES.includes(r))).size;

  // Sueño
  const sleepMap = unwrap(safeData.sleep, {}) || {};
  let sleepNights = 0;
  let nights7h = 0;
  let restedNights = 0;
  let sleepTotalMin = 0;
  for (const k of keys) {
    const n = sleepMap[k];
    if (n && Number(n.min) > 0) {
      const min = Math.round(Number(n.min));
      sleepNights++;
      sleepTotalMin += min;
      if (min >= SLEEP_GOAL_MIN) nights7h++;
      if (isRested(n)) restedNights++;
    }
  }
  const avgSleepMin = sleepNights > 0 ? Math.round(sleepTotalMin / sleepNights) : null;

  // Dopamina
  const dopaDefs = normalizeDopamineDefs(unwrap(safeData.dopamineDefs, null));
  const dopamine = unwrap(safeData.dopamine, {}) || {};
  let goodCount = 0;
  let cheapCount = 0;
  let failedDays = 0;
  const goodDefs = dopaDefs.filter((d) => d.kind === "good");
  const cheapDefs = dopaDefs.filter((d) => d.kind === "cheap");

  for (const k of keys) {
    const day = dopamine[k] && typeof dopamine[k] === "object" ? dopamine[k] : {};
    for (const d of goodDefs) {
      const c = Math.max(0, Math.floor(Number(day[d.id]) || 0));
      goodCount += c;
    }
    let dayFailed = false;
    for (const d of cheapDefs) {
      const c = Math.max(0, Math.floor(Number(day[d.id]) || 0));
      cheapCount += c;
      if (d.limit === 0 && c > 0) dayFailed = true;
    }
    if (dayFailed) failedDays++;
  }

  // Identidades (votos)
  const identities = normalizeIdentities(unwrap(safeData.identities, null));
  const votesRows = identities.map((it) => ({ ...it, votes: 0, days: 0 }));
  const votesById = new Map(votesRows.map((r) => [r.id, r]));
  const dopaGoodWithId = goodDefs.filter((d) => d.identity);

  keys.forEach((k, i) => {
    const dayVotes = new Map();
    const add = (id) => { if (votesById.has(id)) dayVotes.set(id, (dayVotes.get(id) || 0) + 1); };
    const h = safeHabits[k] || {};
    habitDefs.forEach((d) => { if (isHabitDoneOrMini(d, h)) add(habitIdentity(d)); });
    if ((log[k] && log[k].r) || fromFitbit[i]) add(ATHLETE_ID);
    const dopaDay = dopamine[k] || {};
    dopaGoodWithId.forEach((d) => {
      const cnt = Math.max(0, Math.floor(Number(dopaDay[d.id]) || 0));
      if (cnt >= Math.max(1, d.goal || 0)) add(d.identity);
    });
    if (isRested(sleepMap[k])) add(REST_ID);
    dayVotes.forEach((_, id) => {
      const row = votesById.get(id);
      row.votes += dayVotes.get(id);
      row.days += 1;
    });
  });

  let topIdentity = null;
  for (const r of votesRows) {
    if (r.votes > 0 && (!topIdentity || r.votes > topIdentity.votes)) topIdentity = r;
  }
  const votesPhrase = topIdentity
    ? `Esta semana votaste ${topIdentity.votes} ${topIdentity.votes === 1 ? "vez" : "veces"} por ser ${topIdentity.label}`
    : "Aún no hay votos esta semana: cada hábito cumplido cuenta.";

  // Frasco de logros
  const keySet = new Set(keys);
  const rawWins = unwrap(safeData.wins, []);
  const wins = (Array.isArray(rawWins) ? rawWins : [])
    .filter((w) => w && typeof w.text === "string" && w.text.trim() && keySet.has(w.date))
    .map((w) => ({ id: w.id || w.date, date: w.date, text: w.text.trim() }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Cierre de semana (revisión del domingo)
  const reviews = unwrap(safeData.reviews, {}) || {};
  const rawRev = reviews[week.mondayKey];
  const review = rawRev && typeof rawRev === "object" && ((typeof rawRev.good === "string" && rawRev.good.trim()) || (typeof rawRev.adjust === "string" && rawRev.adjust.trim()))
    ? { good: (rawRev.good || "").trim(), adjust: (rawRev.adjust || "").trim() }
    : null;

  const rangeLabel = week.startDate === week.endDate
    ? formatDateShort(week.startDate)
    : `${formatDateShort(week.startDate)} – ${formatDateShort(week.endDate)}`;

  return {
    week,
    rangeLabel,
    sessions: { done: sessionsDone, goal: MAIN_ROUTINES.length },
    workouts: { count: workoutsCount, totalMin, goalMin: MINUTES_GOAL, byKind },
    habits: { daysDone: habitDaysDone, totalDays: habitDaysTotal, pct: habitPct, streak, perHabit },
    sleep: { nights: sleepNights, nights7h, restedNights, avgMin: avgSleepMin },
    dopamine: { good: goodCount, cheap: cheapCount, failedDays },
    identities: { votes: votesRows, top: topIdentity, phrase: votesPhrase },
    wins,
    review,
  };
}

export function buildWeeklyEmail(data = {}, opts = {}) {
  const report = buildWeeklyReport(data, opts);
  const subject = `Shift · Resumen semanal (${report.rangeLabel})`;
  const reviewUrl = `${APP_URL}?ver=revision`;

  const kindParts = SUMMARY_KINDS
    .filter((k) => report.workouts.byKind[k].count > 0)
    .map((k) => `${KIND_LABELS[k]}: ${report.workouts.byKind[k].count} (${report.workouts.byKind[k].min} min)`);

  // Texto plano
  const textLines = [
    `SHIFT · RESUMEN SEMANAL (${report.rangeLabel})`,
    "",
    `${report.identities.top && report.identities.top.emoji ? report.identities.top.emoji + " " : ""}${report.identities.phrase}`,
    "",
    "ENTRENAMIENTO",
    `- Sesiones del plan: ${report.sessions.done} / ${report.sessions.goal}`,
    `- Fitbit: ${report.workouts.count} ${report.workouts.count === 1 ? "entreno" : "entrenos"} · ${report.workouts.totalMin} min (meta ${report.workouts.goalMin} min)${kindParts.length ? ` · ${kindParts.join(", ")}` : ""}`,
    "",
    "HÁBITOS OBLIGATORIOS",
    `- Días completos: ${report.habits.pct}% (${report.habits.daysDone}/${report.habits.totalDays} días) · Racha: ${report.habits.streak} ${report.habits.streak === 1 ? "día" : "días"}`,
    ...report.habits.perHabit.map((h) => `  • ${h.label}: ${h.daysDone}/${h.total}`),
    "",
    "SUEÑO Y DOPAMINA",
    `- Sueño: ${report.sleep.nights7h} ${report.sleep.nights7h === 1 ? "noche" : "noches"} ≥ 7 h · Promedio: ${report.sleep.avgMin != null ? formatSleep(report.sleep.avgMin) : "Sin datos"}`,
    `- Dopamina: ${report.dopamine.good} buenas · ${report.dopamine.cheap} baratas${report.dopamine.failedDays > 0 ? ` (${report.dopamine.failedDays} ${report.dopamine.failedDays === 1 ? "día fallado" : "días fallados"})` : ""}`,
    "",
    "VOTOS POR IDENTIDAD",
    ...report.identities.votes.map((v) => `- ${v.emoji ? v.emoji + " " : ""}${v.label}: ${v.votes} ${v.votes === 1 ? "voto" : "votos"}`),
  ];

  if (report.wins.length > 0) {
    textLines.push("", "FRASCO DE LOGROS", ...report.wins.map((w) => `- (${formatDateShort(w.date)}) ${w.text}`));
  }
  if (report.review) {
    textLines.push("", "CIERRE DE SEMANA");
    if (report.review.good) textLines.push(`Qué salió bien: ${report.review.good}`);
    if (report.review.adjust) textLines.push(`Qué ajustar: ${report.review.adjust}`);
  }
  textLines.push("", `Abrir revisión semanal en Shift: ${reviewUrl}`);
  const text = textLines.join("\n");

  // HTML (estilos en línea compatibles con Gmail y Apple Mail)
  const colorHex = { accent: "#b87a1e", good: "#2c8a56", cool: "#2f7a96", warn: "#c45b3b" };
  const maxVotes = Math.max(1, ...report.identities.votes.map((v) => v.votes));

  const identityHtml = report.identities.votes.map((v) => {
    const pct = Math.round((v.votes / maxVotes) * 100);
    const barColor = colorHex[v.color] || colorHex.accent;
    return `
      <tr>
        <td style="padding:6px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="font-size:14px;color:#1b2028;font-weight:500;">${v.emoji ? `${escapeHtml(v.emoji)} ` : ""}${escapeHtml(v.label)}</td>
              <td align="right" style="font-size:13px;color:#4f5966;font-family:ui-monospace,Menlo,monospace;"><strong>${v.votes}</strong> ${v.votes === 1 ? "voto" : "votos"}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:4px;">
                <div style="background:#e9edf2;border-radius:999px;height:8px;overflow:hidden;">
                  <div style="background:${barColor};height:8px;width:${pct}%;border-radius:999px;"></div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join("");

  const habitsHtml = report.habits.perHabit.map((h) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#2c3440;border-bottom:1px solid #eef1f5;">${escapeHtml(h.label)}</td>
      <td align="right" style="padding:6px 0 6px 12px;font-size:13px;color:#1b2028;font-family:ui-monospace,Menlo,monospace;font-weight:600;white-space:nowrap;border-bottom:1px solid #eef1f5;">${h.daysDone}/${h.total}</td>
    </tr>`).join("");

  const winsHtml = report.wins.length > 0
    ? `<ul style="margin:8px 0 0;padding-left:18px;color:#2c3440;font-size:14px;line-height:1.5;">${report.wins.map((w) => `<li style="margin-bottom:6px;"><span style="color:#6b7480;font-size:12px;">${escapeHtml(formatDateShort(w.date))}:</span> ${escapeHtml(w.text)}</li>`).join("")}</ul>`
    : `<p style="margin:6px 0 0;font-size:13px;color:#6b7480;">Sin logros anotados en el frasco esta semana.</p>`;

  const reviewHtml = report.review ? `
    <div style="margin-top:16px;padding:16px;background:#f8f9fb;border:1px solid #e3e8ef;border-radius:12px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7480;margin-bottom:8px;">Cierre de semana</div>
      ${report.review.good ? `<p style="margin:0 0 8px;font-size:14px;color:#1b2028;"><strong>Qué salió bien:</strong> ${escapeHtml(report.review.good)}</p>` : ""}
      ${report.review.adjust ? `<p style="margin:0;font-size:14px;color:#1b2028;"><strong>Qué ajustar:</strong> ${escapeHtml(report.review.adjust)}</p>` : ""}
    </div>` : "";

  const kpiCell = (title, value, sub, accent) => `
    <td width="50%" valign="top" style="padding:6px;">
      <div style="background:#f8f9fb;border:1px solid #e3e8ef;border-radius:12px;padding:12px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7480;">${escapeHtml(title)}</div>
        <div style="margin-top:4px;font-size:20px;font-weight:700;color:${accent};font-family:ui-monospace,Menlo,monospace;">${escapeHtml(value)}</div>
        <div style="margin-top:2px;font-size:12px;color:#5a6573;">${escapeHtml(sub)}</div>
      </div>
    </td>`;

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1b2028;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f4f8;padding:20px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e3e8ef;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#14171c;padding:22px 24px;color:#e9ecef;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#e2b46c;">Shift · Hábitos e identidad</div>
              <h1 style="margin:6px 0 4px;font-size:24px;line-height:1.15;color:#ffffff;">Resumen semanal</h1>
              <div style="font-size:14px;color:#aab4c0;">${escapeHtml(report.rangeLabel)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;">
              <div style="padding:12px 14px;background:#fdf8ef;border:1px solid #f0dfb9;border-radius:12px;font-size:14px;font-weight:600;color:#4a3512;">
                ${report.identities.top && report.identities.top.emoji ? `${escapeHtml(report.identities.top.emoji)} ` : ""}${escapeHtml(report.identities.phrase)}
              </div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;border-collapse:separate;">
                <tr>
                  ${kpiCell("Sesiones", `${report.sessions.done} / ${report.sessions.goal}`, `Fitbit: ${report.workouts.count} (${report.workouts.totalMin} min)`, "#b87a1e")}
                  ${kpiCell("Hábitos", `${report.habits.pct}%`, `${report.habits.daysDone}/${report.habits.totalDays} días · racha ${report.habits.streak}d`, "#2c8a56")}
                </tr>
                <tr>
                  ${kpiCell("Sueño", `${report.sleep.nights7h} ${report.sleep.nights7h === 1 ? "noche" : "noches"} ≥ 7h`, `Prom: ${report.sleep.avgMin != null ? formatSleep(report.sleep.avgMin) : "Sin datos"}`, "#2f7a96")}
                  ${kpiCell("Dopamina", `${report.dopamine.good} buenas`, `${report.dopamine.cheap} baratas${report.dopamine.failedDays > 0 ? ` · ${report.dopamine.failedDays}d fallado` : ""}`, "#c45b3b")}
                </tr>
              </table>

              ${kindParts.length ? `<p style="margin:10px 6px 0;font-size:13px;color:#4f5966;"><strong>Entrenos por tipo:</strong> ${escapeHtml(kindParts.join(" · "))}</p>` : ""}

              <div style="margin-top:18px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7480;margin-bottom:6px;">Votos por identidad</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${identityHtml}</table>
              </div>

              ${report.habits.perHabit.length ? `
              <div style="margin-top:18px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7480;margin-bottom:4px;">Cumplimiento por hábito obligatorio</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${habitsHtml}</table>
              </div>` : ""}

              <div style="margin-top:18px;">
                <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7480;">Frasco de logros (${report.wins.length})</div>
                ${winsHtml}
              </div>

              ${reviewHtml}

              <div style="margin-top:22px;text-align:center;">
                <a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#e2b46c;color:#1e1508;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:10px;">Abrir revisión semanal en Shift</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html, report };
}

export function parseCliArgs(argv = process.argv.slice(2), env = process.env) {
  const args = Array.isArray(argv) ? [...argv] : [];
  let test = env.PRUEBA === "true";
  let htmlOnly = false;
  let week = env.SEMANA === "actual" || env.SEMANA === "current" ? "current" : "last";
  let root = process.cwd();

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--test") {
      test = true;
    } else if (a === "--html") {
      htmlOnly = true;
    } else if (a === "--semana" && args[i + 1]) {
      const val = String(args[++i]).toLowerCase();
      week = val === "actual" || val === "current" ? "current" : "last";
    } else if (a === "--root" && args[i + 1]) {
      root = args[++i];
    }
  }
  return { test, htmlOnly, week, root };
}

export function resolveSmtpConfig(env = process.env) {
  const user = String(env.SMTP_USER || "").trim();
  const pass = String(env.SMTP_PASS || "").replace(/\s+/g, "");
  const to = String(env.SUMMARY_EMAIL || user).trim();
  const host = String(env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(env.SMTP_PORT || 465);
  const secure = env.SMTP_SECURE != null ? env.SMTP_SECURE === "true" : port === 465;
  return { user, pass, to, host, port, secure };
}

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return fallback; } };

export async function main(opts = {}) {
  const env = opts.env || process.env;
  const cli = opts.argv ? parseCliArgs(opts.argv, env) : { test: false, htmlOnly: false, week: "last", root: process.cwd() };
  const root = opts.root || cli.root || process.cwd();
  const now = opts.now || new Date();
  const test = opts.test !== undefined ? opts.test : cli.test;
  const week = opts.week || cli.week;

  const data = readJson(path.join(root, "data.json"), {});
  const email = buildWeeklyEmail(data, { now, week, tz: opts.tz || TZ });

  if (test) {
    console.log(cli.htmlOnly ? email.html : `${email.subject}\n\n${email.text}`);
    return { sent: false, test: true, email };
  }

  const smtp = resolveSmtpConfig(env);
  if (!opts.sendMail && (!smtp.user || !smtp.pass || !smtp.to)) {
    console.log("Correo semanal sin configurar: faltan secretos SMTP_USER / SMTP_PASS. Nada que hacer.");
    return { sent: false, skipped: true, reason: "missing_config", email };
  }

  let sendMail = opts.sendMail;
  if (!sendMail) {
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    sendMail = (mail) => transporter.sendMail(mail);
  }

  await sendMail({
    from: `Shift <${smtp.user}>`,
    to: smtp.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  // Nunca imprimir direcciones ni contenido personal en los registros de Actions.
  console.log(`correo semanal enviado (${email.report.week.startDate}..${email.report.week.endDate})`);
  return { sent: true, email };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main({ argv: process.argv.slice(2), env: process.env }).catch((e) => {
    console.error("error", e && e.message);
    process.exit(1);
  });
}
