// Métricas estilo Bevel que faltaban: tarjetas de tendencia, estrés diario, carga de
// entrenamiento (cardio y muscular), frescura muscular y Cardio Focus.
// Funciones puras: la UI solo las llama y pinta. Contrato completo en METRICAS.md.
import { dkey, fromKey, addDays, dayDiff } from "./dates.js";
import { median, mad, clamp, MAD_SCALE } from "./baselines.js";
import { ROUTINES, day3Exercises, routineById } from "../data/program.js";
import { SUBS, EXERCISE_LIBRARY } from "../data/subs.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const r1 = (v) => Math.round(v * 10) / 10;
const shift = (k, n) => dkey(addDays(fromKey(k), n));

export const TREND_WINDOWS = [3, 7, 14, 30, 90];

// ───────────────────────── Tarjetas de tendencia ─────────────────────────

/**
 * Tarjeta de tendencia (sparkline + pill de estado) para cualquier serie diaria.
 * @param {Record<string, number>} seriesByDate  { "2026-11-21": 113, ... }
 * @param {string} dateKey  Día a evaluar.
 * @param {{ baselineDays?: number, minFloor?: number, sparkDays?: number }} [opts]
 * @returns {{
 *   value: number|null, status: "missing"|"calibrating"|"below"|"normal"|"above",
 *   range: { low: number, high: number }|null,
 *   changes: Record<"d3"|"d7"|"d14"|"d30"|"d90", number|null>,
 *   spark: Array<{ date: string, value: number|null }>
 * }}
 */
export function trendCard(seriesByDate, dateKey, { baselineDays = 30, minFloor = 0.5, sparkDays = 30 } = {}) {
  const s = seriesByDate && typeof seriesByDate === "object" ? seriesByDate : {};
  const val = (k) => (isNum(s[k]) ? s[k] : null);
  const value = val(dateKey);

  const prior = [];
  for (let i = 1; i <= baselineDays; i++) { const v = val(shift(dateKey, -i)); if (v != null) prior.push(v); }
  let range = null;
  if (prior.length >= 7) {
    const c = median(prior);
    const spread = Math.max(MAD_SCALE * (mad(prior, c) ?? 0), minFloor);
    range = { low: r1(c - spread), high: r1(c + spread) };
  }
  const status = value == null ? "missing"
    : !range ? "calibrating"
    : value < range.low ? "below" : value > range.high ? "above" : "normal";

  // Cambio del promedio móvil de 7 días contra el de hace N días (como Bevel).
  const roll7 = (end) => {
    const xs = [];
    for (let i = 0; i < 7; i++) { const v = val(shift(end, -i)); if (v != null) xs.push(v); }
    return xs.length >= 3 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const now = roll7(dateKey);
  const changes = {};
  for (const n of TREND_WINDOWS) {
    const then = roll7(shift(dateKey, -n));
    changes[`d${n}`] = now != null && then != null ? r1(now - then) : null;
  }

  const spark = [];
  for (let i = sparkDays - 1; i >= 0; i--) { const k = shift(dateKey, -i); spark.push({ date: k, value: val(k) }); }
  return { value, status, range, changes, spark };
}

/** Extrae una serie { fecha: número } de un mapa de objetos por día (vitals, sleep…). */
export function seriesOf(mapByDate, field) {
  const out = {};
  for (const [k, v] of Object.entries(mapByDate || {})) if (v && isNum(v[field])) out[k] = v[field];
  return out;
}

// ───────────────────────── Estrés diario ─────────────────────────

export const STRESS_LEVELS = Object.freeze({ low: [0, 30], medium: [30, 60], high: [60, 100] });

/**
 * Estrés diario 0–100 a partir del pulso despierto (sin ejercicio) frente al reposo,
 * corregido por la HRV del día respecto a su línea base. Fitbit no nos da pulso por
 * minuto, así que es una cifra diaria (Bevel la da por hora).
 * @returns {{ score: number|null, level: "low"|"medium"|"high"|null, sleepScore: number|null }}
 */
export function dailyStress(vitalsDay, { age = null, maxHr = null, hrvRange = null } = {}) {
  const v = vitalsDay || {};
  if (!isNum(v.awakeHr) || !isNum(v.rhr)) return { score: null, level: null, sleepScore: null };
  const hrMax = isNum(maxHr) ? maxHr : isNum(age) ? 208 - 0.7 * age : 190;
  const reserve = Math.max(20, hrMax - v.rhr);
  let hrvFactor = 1;
  if (isNum(v.hrv) && hrvRange && isNum(hrvRange.low) && isNum(hrvRange.high) && hrvRange.high > hrvRange.low) {
    const mid = (hrvRange.low + hrvRange.high) / 2;
    const half = (hrvRange.high - hrvRange.low) / 2;
    hrvFactor = clamp(1 - 0.25 * ((v.hrv - mid) / half), 0.7, 1.3);
  }
  const score = Math.round(clamp(((v.awakeHr - v.rhr) / reserve) * 150 * hrvFactor, 0, 100));
  const sleepScore = isNum(v.sleepHr) ? Math.round(clamp(((v.sleepHr - v.rhr) / reserve) * 150, 0, 100)) : null;
  return { score, level: stressLevel(score), sleepScore };
}

export const stressLevel = (s) => (!isNum(s) ? null : s < 30 ? "low" : s < 60 ? "medium" : "high");

// ───────────────────────── Carga de entrenamiento ─────────────────────────

export const LOAD_STATUS = ["calibrating", "detraining", "maintaining", "productive", "peaking", "fatigued", "overtraining"];

/** Estado según la razón carga aguda (7 d) / crónica (42 d). */
export function loadStatus(ratio, daysOfData) {
  if (daysOfData < 14 || !isNum(ratio)) return "calibrating";
  if (ratio < 0.8) return "detraining";
  if (ratio < 1.0) return "maintaining";
  if (ratio < 1.15) return "productive";
  if (ratio < 1.3) return "peaking";
  if (ratio < 1.5) return "fatigued";
  return "overtraining";
}

/**
 * Carga de entrenamiento estilo Bevel para una serie diaria de carga.
 * value = media 7 d; óptimo = media 42 d × [0.8, 1.3]; breakdown = días en cada estado (últimos 30).
 * @param {Record<string, number>} dailyLoad
 */
export function trainingLoad(dailyLoad, dateKey, { breakdownDays = 30 } = {}) {
  const s = dailyLoad || {};
  const keys = Object.keys(s).filter((k) => isNum(s[k]) && s[k] > 0).sort(); // el historial empieza con la primera carga real
  const first = keys[0] || null;
  const at = (end) => {
    const days = first ? dayDiff(end, first) + 1 : 0;
    // Promedia solo sobre días con historial: sin esto, las semanas antes del primer
    // registro cuentan como 0 y la carga crónica sale baja (todo parece «sobreentreno»).
    const avg = (n) => { const m = Math.max(1, Math.min(n, days)); let t = 0; for (let i = 0; i < m; i++) t += isNum(s[shift(end, -i)]) ? s[shift(end, -i)] : 0; return t / m; };
    const acute = avg(7);
    const chronic = avg(42);
    const ratio = chronic > 0 ? acute / chronic : null;
    return { acute, chronic, ratio, status: loadStatus(ratio, days) };
  };
  const today = at(dateKey);
  const breakdown = Object.fromEntries(LOAD_STATUS.map((k) => [k, 0]));
  const history = [];
  for (let i = breakdownDays - 1; i >= 0; i--) {
    const k = shift(dateKey, -i);
    const x = at(k);
    breakdown[x.status] += 1;
    history.push({ date: k, value: r1(x.acute), low: r1(x.chronic * 0.8), high: r1(x.chronic * 1.3), status: x.status });
  }
  return {
    value: Math.round(today.acute),
    optimal: { min: Math.round(today.chronic * 0.8), max: Math.round(today.chronic * 1.3) },
    ratio: today.ratio != null ? Math.round(today.ratio * 100) / 100 : null,
    status: today.status,
    breakdown,
    history,
  };
}

/** Cardio y muscular a partir del historial Bevel (strain.cardioLoad / strain.muscularLoad por día). */
export function trainingLoads(bevelHistory, dateKey) {
  const cardio = {};
  const muscular = {};
  for (const [k, d] of Object.entries(bevelHistory?.byDate || {})) {
    if (isNum(d?.strain?.cardioLoad)) cardio[k] = d.strain.cardioLoad;
    if (isNum(d?.strain?.muscularLoad)) muscular[k] = d.strain.muscularLoad;
  }
  return { cardio: trainingLoad(cardio, dateKey), muscular: trainingLoad(muscular, dateKey) };
}

// ───────────────────────── Frescura muscular ─────────────────────────

export const MUSCLE_GROUPS = Object.freeze({
  chest: "Pecho", lats: "Dorsales", upperBack: "Espalda alta", shoulders: "Hombros",
  biceps: "Bíceps", triceps: "Tríceps", core: "Core", quads: "Cuádriceps",
  glutes: "Glúteos", hamstrings: "Isquios", calves: "Pantorrillas",
});

// Peso de cada grupo por patrón (1 = motor principal, 0.5 = secundario).
export const PATTERN_MUSCLES = Object.freeze({
  pull_v: { lats: 1, biceps: 0.5, upperBack: 0.5 },
  pull_h: { upperBack: 1, lats: 0.5, biceps: 0.5 },
  push_h: { chest: 1, triceps: 0.5, shoulders: 0.5 },
  push_v: { shoulders: 1, triceps: 0.5 },
  arms: { biceps: 1, triceps: 1 },
  squat: { quads: 1, glutes: 0.5 },
  hinge: { hamstrings: 1, glutes: 1 },
  full: { quads: 0.5, glutes: 0.5, shoulders: 0.5, core: 0.5 },
  core: { core: 1 },
  run: { calves: 0.5, quads: 0.5 },
});

const GROUP_TO_PATTERN = Object.freeze({
  chest: "push_h",
  lats: "pull_v",
  upperBack: "pull_h",
  shoulders: "push_v",
  biceps: "arms",
  triceps: "arms",
  core: "core",
  quads: "squat",
  glutes: "hinge",
  hamstrings: "hinge",
  calves: "run",
});

function findCustomExercise(exId, customExercises) {
  if (!exId || typeof exId !== "string" || !customExercises) return null;
  if (Array.isArray(customExercises)) {
    return customExercises.find((c) => c && c.id === exId) || null;
  }
  if (typeof customExercises === "object") {
    return customExercises[exId] || null;
  }
  return null;
}

function customExerciseMuscles(custom) {
  if (!custom || typeof custom !== "object") return null;
  if (custom.muscles && typeof custom.muscles === "object") {
    const entries = Object.entries(custom.muscles).filter(([g, w]) => MUSCLE_GROUPS[g] && isNum(w) && w > 0);
    if (entries.length) return Object.fromEntries(entries);
  }
  if (custom.primaryGroup && MUSCLE_GROUPS[custom.primaryGroup]) {
    const out = { [custom.primaryGroup]: 1 };
    for (const g of Array.isArray(custom.secondaryGroups) ? custom.secondaryGroups : []) {
      if (g !== custom.primaryGroup && MUSCLE_GROUPS[g] && out[g] == null) out[g] = 0.5;
    }
    return out;
  }
  return null;
}

let patternIndex = null;
/** Mapa id de ejercicio → patrón (rutinas, variantes, día 3, sustitutos, biblioteca y personalizados). */
export function exercisePattern(exId, customExercises = null) {
  if (!exId || typeof exId !== "string") return null;
  const custom = findCustomExercise(exId, customExercises);
  if (custom) {
    return custom.pattern || GROUP_TO_PATTERN[custom.primaryGroup] || null;
  }
  if (!patternIndex) {
    patternIndex = {};
    const add = (ex) => { if (ex && ex.id && ex.pattern && !patternIndex[ex.id]) patternIndex[ex.id] = ex.pattern; };
    for (const r of ROUTINES) {
      (r.exercises || []).forEach(add);
      for (const v of r.variants || []) (v.exercises || []).forEach(add);
    }
    day3Exercises(1).forEach(add);
    EXERCISE_LIBRARY.forEach(add);
    for (const [baseId, alts] of Object.entries(SUBS || {})) {
      const p = patternIndex[baseId];
      for (const a of Array.isArray(alts) ? alts : []) if (a && a.id && !patternIndex[a.id]) patternIndex[a.id] = a.pattern || p;
    }
  }
  if (patternIndex[exId]) return patternIndex[exId];
  // Ids derivados (p. ej. «d4c2p»): probar quitando sufijos.
  for (let id = exId; id && id.length > 2; id = id.slice(0, -1)) if (patternIndex[id]) return patternIndex[id];
  return null;
}

/** Indica si hay al menos una serie válida registrada hoy en el entreno libre (`setLog[date].free`). */
export function hasFreeWorkout(setLog, dateKey) {
  const free = setLog && dateKey ? setLog[dateKey]?.free : null;
  if (!free || typeof free !== "object") return false;
  for (const series of Object.values(free)) {
    if (!Array.isArray(series)) continue;
    if (series.some((s) => s && (isNum(s.reps) ? s.reps > 0 : Boolean(String(s.reps || "").trim())))) {
      return true;
    }
  }
  return false;
}

const RECOVERY_HOURS = 72;     // un grupo «cargado al máximo» vuelve a 100 % en ~72 h
const SETS_TO_FULL_FATIGUE = 10; // 10 series efectivas de motor principal = 0 % fresco

// Estado de un grupo según su frescura (mismos cortes que la tarjeta: 80 / 50).
export const FRESH_STATUS = Object.freeze({
  recovered: { label: "Recuperado", tone: "good" },
  fatigued: { label: "Fatigado", tone: "accent" },
  depleted: { label: "Agotado", tone: "warn" },
});
export const freshnessStatus = (pct) => (pct >= 80 ? "recovered" : pct >= 50 ? "fatigued" : "depleted");

const firstInt = (txt, fallback) => {
  const m = String(txt || "").match(/\d+/);
  return m ? Number(m[0]) : fallback;
};

/**
 * Series de trabajo por día y ejercicio: lo registrado en setLog y, para sesiones marcadas
 * con «Ya la hice» (log) sin series, las series planeadas de esa rutina. Entrenos de Fitbit
 * tipo «run» en días sin sesión de Shift cuentan como trote (patrón run).
 * @returns {Array<{ day: string, exId: string|null, pattern: string, sets: number, reps: number }>}
 */
function workEntries(setLog, { log = null, workouts = null, customExercises = null } = {}) {
  const out = [];
  for (const [day, routines] of Object.entries(setLog || {})) {
    for (const exs of Object.values(routines || {})) {
      for (const [exId, series] of Object.entries(exs || {})) {
        const ok = (Array.isArray(series) ? series : []).filter((x) => x && isNum(x.reps) && x.reps > 0);
        if (!ok.length) continue;
        const custom = findCustomExercise(exId, customExercises);
        const muscles = custom ? customExerciseMuscles(custom) : null;
        out.push({
          day,
          exId,
          pattern: exercisePattern(exId, customExercises),
          muscles,
          sets: ok.length,
          reps: ok.reduce((a, x) => a + x.reps, 0),
        });
      }
    }
  }
  for (const [day, entry] of Object.entries(log || {})) {
    const rid = entry && entry.r;
    if (!rid || rid === "free" || (setLog?.[day]?.[rid] && Object.keys(setLog[day][rid]).length)) continue;
    const routine = routineById(rid, 1, entry.v);
    for (const ex of routine?.exercises || []) {
      if (!ex.pattern) continue;
      const sets = ex.sets || 0;
      out.push({ day, exId: ex.id, pattern: ex.pattern, muscles: null, sets, reps: sets * firstInt(ex.reps, 10), planned: true });
    }
  }
  for (const w of Array.isArray(workouts) ? workouts : []) {
    if (!w || w.kind !== "run" || !w.start || !isNum(w.min)) continue;
    const day = dkey(new Date(w.start));
    if (log?.[day]?.r) continue;
    const sets = Math.max(1, Math.round(w.min / 10));
    out.push({ day, exId: null, pattern: "run", muscles: null, sets, reps: sets * 10 });
  }
  return out;
}

/**
 * Grupos musculares a una fecha: frescura (0–100 %), estado, volumen (series ponderadas)
 * y carga (repeticiones ponderadas) de los últimos `days` días.
 * @param {object} setLog  fecha → rutina → ejercicio → series
 * @param {string} dateKey
 * @param {{ log?: object, workouts?: Array, customExercises?: Array|object, now?: Date, sessionHour?: number, days?: number }} [opts]
 * @returns {{ groups: Array<{ group, label, pct, status, sets, reps, lastDate, trained }>,
 *            counts: { recovered: number, fatigued: number, depleted: number } }}
 */
export function muscleGroups(setLog, dateKey, { log = null, workouts = null, customExercises = null, now = null, sessionHour = 7, days = 7 } = {}) {
  const ref = now instanceof Date ? now : new Date(fromKey(dateKey).getTime() + 23.99 * 3600e3);
  const fatigue = {};
  const last = {};
  const sets = {};
  const reps = {};
  for (const e of workEntries(setLog, { log, workouts, customExercises })) {
    const hoursAgo = (ref - (fromKey(e.day).getTime() + sessionHour * 3600e3)) / 3600e3;
    if (hoursAgo < 0) continue;
    const decay = Math.max(0, 1 - hoursAgo / RECOVERY_HOURS);
    const inWindow = hoursAgo <= days * 24;
    for (const [g, w] of Object.entries(e.muscles || PATTERN_MUSCLES[e.pattern] || {})) {
      fatigue[g] = (fatigue[g] || 0) + (e.sets * w * decay) / SETS_TO_FULL_FATIGUE;
      if (inWindow) {
        sets[g] = (sets[g] || 0) + e.sets * w;
        reps[g] = (reps[g] || 0) + e.reps * w;
        if (!last[g] || e.day > last[g]) last[g] = e.day;
      }
    }
  }
  const counts = { recovered: 0, fatigued: 0, depleted: 0 };
  const groups = Object.entries(MUSCLE_GROUPS).map(([group, label]) => {
    const pct = Math.round(clamp(100 * (1 - (fatigue[group] || 0)), 0, 100));
    const status = freshnessStatus(pct);
    counts[status] += 1;
    return {
      group, label, pct, status,
      sets: r1(sets[group] || 0),
      reps: Math.round(reps[group] || 0),
      lastDate: last[group] || null,
      trained: (sets[group] || 0) > 0,
    };
  });
  return { groups, counts };
}

/**
 * Frescura por grupo muscular (0–100 %) a partir de las series registradas (setLog).
 * Atajo de muscleGroups() que conserva la forma de siempre.
 * @returns {Array<{ group: string, label: string, pct: number, lastDate: string|null, sets: number }>}
 */
export function muscleFreshness(setLog, dateKey, opts = {}) {
  return muscleGroups(setLog, dateKey, opts).groups.map(({ group, label, pct, lastDate, sets }) => ({ group, label, pct, lastDate, sets }));
}

/** Peso de cada grupo en una rutina (0–1, 1 = el grupo que más series recibe). */
export function routineMuscles(rid, variantId = null) {
  const routine = routineById(rid, 1, variantId);
  const acc = {};
  for (const ex of routine?.exercises || []) {
    for (const [g, w] of Object.entries(PATTERN_MUSCLES[ex.pattern] || {})) acc[g] = (acc[g] || 0) + (ex.sets || 1) * w;
  }
  const max = Math.max(0, ...Object.values(acc));
  return Object.fromEntries(Object.entries(acc).map(([g, v]) => [g, max ? r1(v / max) : 0]));
}

const RECOMMENDABLE = ["d1", "d2", "d3", "d4"];

/**
 * Qué conviene entrenar hoy: ordena las rutinas por lo frescos que están sus músculos
 * principales, con un empujón a la del plan y a las que aún no hiciste esta semana.
 * Con recuperación baja propone la sesión suave.
 * @param {{ groups: Array, recovery?: number|null, plannedRid?: string|null, doneToday?: string|null,
 *           weekDone?: string[], routineVariants?: object }} input
 * @returns {{ rid: string|null, kind: "train"|"low"|"done", readiness: number|null, reason: string,
 *            fresh: Array, tired: Array, ranking: Array<{ rid, readiness, score }> }}
 */
export function recommendTraining({ groups, recovery = null, plannedRid = null, doneToday = null, weekDone = [], routineVariants = {}, setLog = null, today = null }) {
  const byGroup = Object.fromEntries((groups || []).map((g) => [g.group, g]));
  const ranking = RECOMMENDABLE.map((rid) => {
    const weights = routineMuscles(rid, routineVariants?.[rid]);
    const main = Object.entries(weights).filter(([, w]) => w >= 0.4);
    const tot = main.reduce((a, [, w]) => a + w, 0);
    const readiness = tot ? Math.round(main.reduce((a, [g, w]) => a + w * (byGroup[g]?.pct ?? 100), 0) / tot) : 100;
    const timesThisWeek = weekDone.filter((r) => r === rid).length;
    const score = readiness + (rid === plannedRid ? 6 : 0) + (timesThisWeek ? -10 * timesThisWeek : 6);
    return { rid, readiness, score, main: main.sort((a, b) => b[1] - a[1]).map(([g]) => g) };
  }).sort((a, b) => b.score - a.score);

  const tired = (groups || []).filter((g) => g.status !== "recovered").sort((a, b) => a.pct - b.pct);
  const didToday = doneToday || (setLog && today && hasFreeWorkout(setLog, today) ? "free" : null);
  if (didToday) {
    return { rid: null, kind: "done", readiness: null, reason: "Ya entrenaste hoy: deja que los músculos recuperen.", fresh: [], tired, ranking };
  }
  const top = ranking[0];
  const fresh = top.main.map((g) => byGroup[g]).filter(Boolean).slice(0, 3);
  if (isNum(recovery) && (recovery < 34 || (recovery < 50 && top.readiness < 70))) {
    return {
      rid: "low", kind: "low", readiness: top.readiness,
      reason: `Recuperación ${Math.round(recovery)} %: hoy rinde más una sesión suave que cargar músculos.`,
      fresh, tired, ranking,
    };
  }
  const avoid = tired.find((g) => !top.main.includes(g.group));
  const reason = (top.readiness >= 80 ? "Los músculos de esta rutina están frescos." : "Es la rutina con los músculos más recuperados.")
    + (avoid ? ` Dejas descansar ${avoid.label.toLowerCase()} (${avoid.pct} %).` : "");
  return { rid: top.rid, kind: "train", readiness: top.readiness, reason, fresh, tired, ranking };
}

// ───────────────────────── Cardio Focus y zonas ─────────────────────────

/**
 * Reparto de minutos de ejercicio por zona (Fitbit: light/moderate/vigorous/peak) en N días.
 * Devuelve null si ningún entreno trae zonas (la UI muestra «sin datos de pulso»).
 * @returns {{ minutes: {light:number,moderate:number,vigorous:number,peak:number},
 *            focus: { lowAerobic:number, highAerobic:number, anaerobic:number } } | null}
 */
export function cardioFocus(workouts, dateKey, { days = 30 } = {}) {
  const from = shift(dateKey, -(days - 1));
  const m = { light: 0, moderate: 0, vigorous: 0, peak: 0 };
  let any = false;
  for (const w of Array.isArray(workouts) ? workouts : []) {
    const z = w && w.zones;
    if (!z || !w.start) continue;
    const k = dkey(new Date(w.start));
    if (k < from || k > dateKey) continue;
    any = true;
    for (const f of Object.keys(m)) if (isNum(z[f])) m[f] += z[f];
  }
  if (!any) return null;
  const low = m.light + m.moderate;
  const total = low + m.vigorous + m.peak;
  const pct = (x) => (total > 0 ? Math.round((100 * x) / total) : 0);
  return { minutes: m, focus: { lowAerobic: pct(low), highAerobic: pct(m.vigorous), anaerobic: pct(m.peak) } };
}
