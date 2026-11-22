// Métricas estilo Bevel que faltaban: tarjetas de tendencia, estrés diario, carga de
// entrenamiento (cardio y muscular), frescura muscular y Cardio Focus.
// Funciones puras: la UI solo las llama y pinta. Contrato completo en METRICAS.md.
import { dkey, fromKey, addDays, dayDiff, pruneDays } from "./dates.js";
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

let exerciseIndex = null;
function getExerciseIndex() {
  if (exerciseIndex) return exerciseIndex;
  exerciseIndex = {};
  const validMuscles = (m) => {
    if (!m || typeof m !== "object") return null;
    const entries = Object.entries(m).filter(([g, w]) => MUSCLE_GROUPS[g] && isNum(w) && w > 0);
    return entries.length ? Object.fromEntries(entries) : null;
  };
  const add = (ex, fallback = null) => {
    if (!ex || !ex.id || exerciseIndex[ex.id]) return;
    exerciseIndex[ex.id] = {
      pattern: ex.pattern || fallback?.pattern || null,
      muscles: validMuscles(ex.muscles) || fallback?.muscles || null,
      rir: isNum(ex.rir) ? ex.rir : fallback?.rir ?? null,
      tempo: typeof ex.tempo === "string" ? ex.tempo : fallback?.tempo ?? null,
    };
  };
  for (const r of ROUTINES) {
    (r.exercises || []).forEach((ex) => add(ex));
    for (const v of r.variants || []) (v.exercises || []).forEach((ex) => add(ex));
  }
  day3Exercises(1).forEach((ex) => add(ex));
  EXERCISE_LIBRARY.forEach((ex) => add(ex));
  for (const [baseId, alts] of Object.entries(SUBS || {})) {
    const base = exerciseIndex[baseId] || null;
    for (const a of Array.isArray(alts) ? alts : []) add(a, base);
  }
  return exerciseIndex;
}

function lookupExercise(exId) {
  if (!exId || typeof exId !== "string") return null;
  const idx = getExerciseIndex();
  if (idx[exId]) return idx[exId];
  // Ids derivados (p. ej. «d4c2p»): probar quitando sufijos.
  for (let id = exId; id && id.length > 2; id = id.slice(0, -1)) if (idx[id]) return idx[id];
  return null;
}

/** Mapa id de ejercicio → patrón (rutinas, variantes, día 3, sustitutos, biblioteca y personalizados). */
export function exercisePattern(exId, customExercises = null) {
  if (!exId || typeof exId !== "string") return null;
  const custom = findCustomExercise(exId, customExercises);
  if (custom) {
    return custom.pattern || GROUP_TO_PATTERN[custom.primaryGroup] || null;
  }
  return lookupExercise(exId)?.pattern || null;
}

/** Mapa id de ejercicio → pesos musculares ({ grupo: peso }); cae a PATTERN_MUSCLES solo si no hay mapa. */
export function exerciseMuscles(exId, customExercises = null) {
  if (!exId || typeof exId !== "string") return {};
  const custom = findCustomExercise(exId, customExercises);
  if (custom) {
    const map = customExerciseMuscles(custom);
    if (map) return map;
    const p = custom.pattern || GROUP_TO_PATTERN[custom.primaryGroup] || null;
    return (p && PATTERN_MUSCLES[p]) || {};
  }
  const meta = lookupExercise(exId);
  if (meta?.muscles) return meta.muscles;
  if (meta?.pattern && PATTERN_MUSCLES[meta.pattern]) return PATTERN_MUSCLES[meta.pattern];
  return {};
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

const PLATEAU_HOURS = 12;
const NOVELTY_DAYS = 10;
const NOVELTY_FACTOR = 1.25;
const MANUAL_SORENESS_CAP = 65;
const MANUAL_SORENESS_HOURS = 24;

// Capacidad (series efectivas diarias de referencia) y horas de recuperación por tamaño de grupo.
// Nota: grupos chicos ajustados de 5 → 6 series efectivas para que el estímulo indirecto de
// dominadas negativas recupere a ≥ 80 % en 30 h, manteniendo ~40 % tras 4 series directas.
export const MUSCLE_PROFILE = Object.freeze({
  chest:      { size: "large",  capacity: 7, recoveryHours: 72 },
  lats:       { size: "large",  capacity: 7, recoveryHours: 72 },
  quads:      { size: "large",  capacity: 7, recoveryHours: 72 },
  glutes:     { size: "large",  capacity: 7, recoveryHours: 72 },
  hamstrings: { size: "large",  capacity: 7, recoveryHours: 72 },
  shoulders:  { size: "medium", capacity: 6, recoveryHours: 60 },
  upperBack:  { size: "medium", capacity: 6, recoveryHours: 60 },
  core:       { size: "medium", capacity: 6, recoveryHours: 60 },
  biceps:     { size: "small",  capacity: 6, recoveryHours: 48 },
  triceps:    { size: "small",  capacity: 6, recoveryHours: 48 },
  calves:     { size: "small",  capacity: 6, recoveryHours: 48 },
});
const DEFAULT_PROFILE = { size: "large", capacity: 7, recoveryHours: 72 };

export const parseRir = (v) => {
  if (v === "" || v == null || typeof v === "boolean") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Multiplicador por RIR (cercanía al fallo): ≤1 → 1,2 · 2 → 1,0 · ≥3 → 0,75. */
export function rirFactor(rir) {
  const n = parseRir(rir);
  if (n == null) return 1;
  if (n <= 1) return 1.2;
  if (n >= 3) return 0.75;
  return 1;
}

/** Multiplicador por excéntrica lenta (primer dígito del tempo ≥ 4 → 1,3). */
export function eccentricFactor(tempo) {
  const m = String(tempo || "").match(/^\s*(\d+)/);
  return m && Number(m[1]) >= 4 ? 1.3 : 1;
}

/**
 * Curva de recuperación no lineal: fatiga restante = 1 durante las primeras 12 h
 * y luego desciende suave con medio coseno hasta 0 en `totalHours`.
 */
export function recoveryDecay(hoursAgo, totalHours = 72) {
  if (!isNum(hoursAgo) || hoursAgo < 0) return 0;
  if (hoursAgo <= PLATEAU_HOURS) return 1;
  if (hoursAgo >= totalHours) return 0;
  const span = Math.max(1, totalHours - PLATEAU_HOURS);
  const t = (hoursAgo - PLATEAU_HOURS) / span;
  return 0.5 * (1 + Math.cos(Math.PI * t));
}

function isNovelGroupOnDay(group, day, trainedDaysByGroup) {
  const daysSet = trainedDaysByGroup[group];
  if (!daysSet) return true;
  for (const prev of daysSet) {
    const diff = dayDiff(day, prev);
    if (diff >= 1 && diff <= NOVELTY_DAYS) return false;
  }
  return true;
}

/** Marca o desmarca manualmente un grupo muscular como cargado en una fecha (inmutable, recorta a 90 días). */
export function toggleSoreness(soreness, { date, group, maxDays = 90 } = {}) {
  if (!date || !group || !MUSCLE_GROUPS[group]) return soreness && typeof soreness === "object" ? soreness : {};
  const base = soreness && typeof soreness === "object" ? { ...soreness } : {};
  const day = base[date] && typeof base[date] === "object" ? { ...base[date] } : {};
  if (day[group]) delete day[group];
  else day[group] = true;
  if (!Object.keys(day).length) delete base[date];
  else base[date] = day;
  return pruneDays(base, maxDays);
}

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
 * @returns {Array<{ day: string, exId: string|null, pattern: string|null, muscles: object|null, sets: number, effSets: number, reps: number }>}
 */
function workEntries(setLog, { log = null, workouts = null, customExercises = null } = {}) {
  const out = [];
  for (const [day, routines] of Object.entries(setLog || {})) {
    for (const exs of Object.values(routines || {})) {
      for (const [exId, series] of Object.entries(exs || {})) {
        const ok = (Array.isArray(series) ? series : []).filter((x) => x && isNum(x.reps) && x.reps > 0);
        if (!ok.length) continue;
        const custom = findCustomExercise(exId, customExercises);
        const meta = custom ? null : lookupExercise(exId);
        const muscles = exerciseMuscles(exId, customExercises);
        const effSets = ok.reduce((sum, s) => {
          const rir = parseRir(s.rir) ?? parseRir(meta?.rir);
          const tempo = typeof s.tempo === "string" ? s.tempo : meta?.tempo;
          return sum + rirFactor(rir) * eccentricFactor(tempo);
        }, 0);
        out.push({
          day,
          exId,
          pattern: exercisePattern(exId, customExercises),
          muscles: Object.keys(muscles).length ? muscles : null,
          sets: ok.length,
          effSets,
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
      const muscles = ex.muscles || exerciseMuscles(ex.id);
      if (!ex.pattern && !Object.keys(muscles).length) continue;
      const sets = ex.sets || 0;
      const effSets = sets * rirFactor(parseRir(ex.rir)) * eccentricFactor(ex.tempo);
      out.push({
        day,
        exId: ex.id,
        pattern: ex.pattern || null,
        muscles: Object.keys(muscles).length ? muscles : null,
        sets,
        effSets,
        reps: sets * firstInt(ex.reps, 10),
        planned: true,
      });
    }
  }
  for (const w of Array.isArray(workouts) ? workouts : []) {
    if (!w || w.kind !== "run" || !w.start || !isNum(w.min)) continue;
    const day = dkey(new Date(w.start));
    if (log?.[day]?.r) continue;
    const sets = Math.max(1, Math.round(w.min / 10));
    out.push({ day, exId: null, pattern: "run", muscles: null, sets, effSets: sets, reps: sets * 10 });
  }
  return out;
}

/**
 * Grupos musculares a una fecha: frescura (0–100 %), estado, volumen (series ponderadas),
 * carga (repeticiones ponderadas) de los últimos `days` días y marca manual (`soreness`).
 * @param {object} setLog  fecha → rutina → ejercicio → series
 * @param {string} dateKey
 * @param {{ log?: object, workouts?: Array, customExercises?: Array|object, soreness?: object, now?: Date, sessionHour?: number, days?: number }} [opts]
 * @returns {{ groups: Array<{ group, label, pct, status, sets, reps, lastDate, trained, manual }>,
 *            counts: { recovered: number, fatigued: number, depleted: number } }}
 */
export function muscleGroups(setLog, dateKey, { log = null, workouts = null, customExercises = null, soreness = null, now = null, sessionHour = 7, days = 7 } = {}) {
  // Hoy se mide «ahora»; un día pasado, al final de ese día.
  const ref = now instanceof Date ? now : dateKey === dkey() ? new Date() : new Date(fromKey(dateKey).getTime() + 23.99 * 3600e3);
  // Hora real de la sesión: cuando se marcó en el log (si cae ese mismo día); si no, `sessionHour`.
  const sessionStart = (day) => {
    const at = Number(log?.[day]?.at);
    if (Number.isFinite(at) && at > 0 && dkey(new Date(at)) === day) return at;
    return fromKey(day).getTime() + sessionHour * 3600e3;
  };
  const entries = workEntries(setLog, { log, workouts, customExercises });
  const trainedDaysByGroup = {};
  for (const e of entries) {
    if (!(e.sets > 0)) continue;
    for (const [g, w] of Object.entries(e.muscles || PATTERN_MUSCLES[e.pattern] || {})) {
      if (!(w > 0)) continue;
      if (!trainedDaysByGroup[g]) trainedDaysByGroup[g] = new Set();
      trainedDaysByGroup[g].add(e.day);
    }
  }

  const dayEffLoad = {};
  const last = {};
  const sets = {};
  const reps = {};
  for (const e of entries) {
    const hoursAgo = (ref - sessionStart(e.day)) / 3600e3;
    if (hoursAgo < 0) continue;
    const inWindow = hoursAgo <= days * 24;
    if (!dayEffLoad[e.day]) dayEffLoad[e.day] = {};
    for (const [g, w] of Object.entries(e.muscles || PATTERN_MUSCLES[e.pattern] || {})) {
      if (!(w > 0)) continue;
      dayEffLoad[e.day][g] = (dayEffLoad[e.day][g] || 0) + e.effSets * w;
      if (inWindow) {
        sets[g] = (sets[g] || 0) + e.sets * w;
        reps[g] = (reps[g] || 0) + e.reps * w;
        if (!last[g] || e.day > last[g]) last[g] = e.day;
      }
    }
  }

  const fatigue = {};
  for (const [day, groupMap] of Object.entries(dayEffLoad)) {
    const hoursAgo = (ref - sessionStart(day)) / 3600e3;
    if (hoursAgo < 0) continue;
    for (const [g, rawEff] of Object.entries(groupMap)) {
      const profile = MUSCLE_PROFILE[g] || DEFAULT_PROFILE;
      const decay = recoveryDecay(hoursAgo, profile.recoveryHours);
      if (decay <= 0) continue;
      const nov = isNovelGroupOnDay(g, day, trainedDaysByGroup) ? NOVELTY_FACTOR : 1;
      const dayFatigue = 1 - Math.exp(-(rawEff * nov) / profile.capacity);
      fatigue[g] = (fatigue[g] || 0) + dayFatigue * decay;
    }
  }

  const isManualSore = (group) => {
    if (!soreness || typeof soreness !== "object") return false;
    if (soreness[dateKey]?.[group]) return true;
    if (!(now instanceof Date)) return false;
    for (const [d, map] of Object.entries(soreness)) {
      if (!map || !map[group]) continue;
      const hrs = (ref - (fromKey(d).getTime() + sessionHour * 3600e3)) / 3600e3;
      if (hrs >= 0 && hrs <= MANUAL_SORENESS_HOURS) return true;
    }
    return false;
  };

  const counts = { recovered: 0, fatigued: 0, depleted: 0 };
  const groups = Object.entries(MUSCLE_GROUPS).map(([group, label]) => {
    const manual = isManualSore(group);
    let pct = Math.round(clamp(100 * (1 - (fatigue[group] || 0)), 0, 100));
    if (manual) pct = Math.min(pct, MANUAL_SORENESS_CAP);
    const status = freshnessStatus(pct);
    counts[status] += 1;
    return {
      group, label, pct, status,
      sets: r1(sets[group] || 0),
      reps: Math.round(reps[group] || 0),
      lastDate: last[group] || null,
      trained: (sets[group] || 0) > 0,
      manual,
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
    const map = ex.muscles || exerciseMuscles(ex.id);
    const weights = Object.keys(map).length ? map : PATTERN_MUSCLES[ex.pattern] || {};
    for (const [g, w] of Object.entries(weights)) acc[g] = (acc[g] || 0) + (ex.sets || 1) * w;
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
