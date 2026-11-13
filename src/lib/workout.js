// Modo entreno y resumen al terminar: cálculos puros (sin interfaz).
// Lee el registro por serie (`setLog`) y las casillas (`sets`) tal como ya se guardan; no cambia su forma.
import { getLastExerciseLog, resolveDefaultSet } from "./setLog.js";
import { parseRepRange, suggestProgression } from "./progression.js";

const LB_TO_KG = 0.45359237;
// Si pasan más de 2 h sin registrar series, la siguiente serie abre una sesión nueva (otro momento del día).
export const SESSION_GAP_MS = 2 * 3600000;

/**
 * Convierte la carga escrita a mano en kilos: "40 kg" → 40, "17,5" → 17.5, "2 × 12 kg" → 24 (par de mancuernas),
 * "45 lb" → 20.4. Lo que no tiene número (banda, peso corporal) devuelve null.
 */
export function parseLoad(load) {
  if (typeof load === "number") return Number.isFinite(load) && load > 0 ? load : null;
  if (load == null) return null;
  const str = String(load).toLowerCase().replace(/(\d),(\d)/g, "$1.$2").trim();
  const m = str.match(/(\d+(?:\.\d+)?)\s*(?:[x×*]\s*(\d+(?:\.\d+)?))?\s*(kg|kilos?|lbs?|libras?)?/);
  if (!m) return null;
  let kg = Number(m[1]);
  if (m[2]) kg *= Number(m[2]);
  if (m[3] && /^(lb|libra)/.test(m[3])) kg *= LB_TO_KG;
  if (!Number.isFinite(kg) || kg <= 0) return null;
  return Math.round(kg * 10) / 10;
}

/** Ejercicios por tiempo («30 s», «5 min»): sus «reps» son segundos o minutos y no suman carga levantada. */
export function isTimedSpec(repsSpec) {
  const range = parseRepRange(repsSpec);
  if (range) return range.unit === "s";
  return /\bmin\b/i.test(String(repsSpec || ""));
}

const numReps = (s) => (s && s.reps !== "" && s.reps != null && !isNaN(Number(s.reps)) ? Number(s.reps) : null);

/** Carga total de una lista de series: suma de reps × carga (kg). Las series sin número no suman. */
export function seriesVolume(series, { timed = false, fallbackLoad = "" } = {}) {
  if (timed || !Array.isArray(series)) return 0;
  let total = 0;
  for (const s of series) {
    const reps = numReps(s);
    const kg = parseLoad((s && s.load) || fallbackLoad);
    if (reps && kg) total += reps * kg;
  }
  return Math.round(total * 10) / 10;
}

/** Índice de la primera serie pendiente, o -1 si todas están hechas. */
export function nextPendingSet(done) {
  if (!Array.isArray(done)) return 0;
  return done.findIndex((d) => !d);
}

/** Índice del primer ejercicio con series pendientes a partir de `from` (da la vuelta); -1 si no queda ninguno. */
export function nextPendingExercise(doneByExercise, from = 0) {
  const n = doneByExercise.length;
  for (let k = 0; k < n; k++) {
    const i = (from + k) % n;
    if (nextPendingSet(doneByExercise[i]) >= 0) return i;
  }
  return -1;
}

/**
 * Lo que se precarga en el modo entreno para la serie `setIndex`:
 * - si ya está registrada, sus propios valores;
 * - reps: la meta de la progresión (lib/progression.js) o, si no hay historial, lo de la serie anterior / el rango;
 * - carga: la de hoy, la de la serie anterior o la de la última vez (igual que al tocar una serie en la lista).
 */
export function suggestSet({ series = [], setIndex, exReps, currentLoad = "", lastLog = null, last = null, sets }) {
  const progression = suggestProgression(last, exReps, sets);
  const own = series[setIndex];
  if (own) return { reps: own.reps, load: own.load || "", progression };
  const resolved = resolveDefaultSet({ series, setIndex, exReps, currentLoad, lastLog });
  const reps = progression && progression.targetReps != null ? progression.targetReps : resolved.reps;
  return { reps, load: resolved.load || "", progression };
}

/**
 * Marca nueva de un ejercicio frente a la última vez (o null):
 * 1. "load": más carga máxima que la última vez.
 * 2. "reps": misma carga máxima (o sin carga) y más repeticiones en la mejor serie.
 * 3. "volume": más carga total (reps × carga).
 */
export function exerciseRecord(todaySeries, lastSeries, { timed = false, fallbackLoad = "" } = {}) {
  const today = (todaySeries || []).filter((s) => numReps(s));
  const prev = (lastSeries || []).filter((s) => numReps(s));
  if (!today.length || !prev.length) return null;

  const loadOf = (s) => parseLoad(s.load || fallbackLoad);
  const best = (list) => {
    let top = null;
    for (const s of list) {
      const kg = loadOf(s);
      if (kg != null && (top == null || kg > top.kg)) top = { kg, label: s.load || fallbackLoad };
    }
    return top;
  };
  const repsAt = (list, kg) => Math.max(...list.filter((s) => (kg == null ? loadOf(s) == null : loadOf(s) === kg)).map(numReps), 0);

  const tTop = best(today);
  const pTop = best(prev);
  if (tTop && pTop && tTop.kg > pTop.kg) {
    return { type: "load", from: pTop.label, to: tTop.label, text: `Carga: ${pTop.label} → ${tTop.label}` };
  }
  if ((tTop && pTop && tTop.kg === pTop.kg) || (!tTop && !pTop)) {
    const kg = tTop ? tTop.kg : null;
    const t = repsAt(today, kg);
    const p = repsAt(prev, kg);
    if (t > p) {
      const unit = timed ? "s" : "reps";
      return { type: "reps", from: p, to: t, text: `${timed ? "Tiempo" : "Reps"}: ${p} → ${t} ${unit}${tTop ? ` con ${tTop.label}` : ""}` };
    }
  }
  const tv = seriesVolume(today, { timed, fallbackLoad });
  const pv = seriesVolume(prev, { timed });
  if (tv > 0 && pv > 0 && tv > pv) {
    return { type: "volume", from: pv, to: tv, text: `Carga total: ${formatKg(pv)} → ${formatKg(tv)}` };
  }
  return null;
}

/**
 * Resumen de la rutina de hoy.
 * exercises: [{ id, name, reps, sets }] con el nombre y las reps del sustituto si hay uno, y `sets` = series efectivas.
 * Devuelve { durationMs, setsDone, setsTotal, volume, exercises: [...], records: [...], complete }.
 */
export function buildWorkoutSummary({ exercises = [], setLog = {}, sets = {}, loads = {}, date, routineId, session = null, now = Date.now() }) {
  const daySetLog = (setLog[date] || {})[routineId] || {};
  const daySets = (sets[date] || {})[routineId] || {};
  const dayLoads = (loads[date] || {})[routineId] || {};
  let setsDone = 0;
  let setsTotal = 0;
  let volume = 0;
  const rows = [];
  const records = [];

  for (const ex of exercises) {
    const n = ex.sets || 0;
    const series = (daySetLog[ex.id] || []).slice(0, n);
    const boxes = daySets[ex.id] || [];
    let done = 0;
    for (let i = 0; i < n; i++) if (series[i] || boxes[i]) done++;
    const timed = isTimedSpec(ex.reps);
    const fallbackLoad = dayLoads[ex.id] || "";
    const vol = seriesVolume(series, { timed, fallbackLoad });
    setsDone += done;
    setsTotal += n;
    volume += vol;
    rows.push({ id: ex.id, name: ex.name, done, total: n, volume: vol });

    const last = getLastExerciseLog(setLog, ex.id, date, routineId);
    const rec = last ? exerciseRecord(series.filter(Boolean), last.series, { timed, fallbackLoad }) : null;
    if (rec) records.push({ exerciseId: ex.id, name: ex.name, ...rec });
  }

  return {
    durationMs: sessionDuration(session, { date, routineId, now }),
    setsDone,
    setsTotal,
    volume: Math.round(volume * 10) / 10,
    exercises: rows,
    records,
    complete: setsTotal > 0 && setsDone >= setsTotal,
  };
}

// ---- Sesión (hora de inicio y fin), guardada solo en este dispositivo ----

const sameSession = (s, date, routineId) => !!(s && s.date === date && s.rid === routineId && s.startAt);

/** Registra actividad: abre la sesión si no hay una de hoy para esa rutina (o si hubo una pausa larga) y la reabre si se había terminado. */
export function touchSession(prev, { date, routineId, now = Date.now() }) {
  if (sameSession(prev, date, routineId) && now - (prev.lastAt || prev.startAt) <= SESSION_GAP_MS) {
    return { ...prev, lastAt: now, endAt: null };
  }
  return { date, rid: routineId, startAt: now, lastAt: now, endAt: null };
}

/** Fija la hora de fin (al terminar o al completar todas las series). */
export function finishSession(prev, { date, routineId, now = Date.now() }) {
  if (!sameSession(prev, date, routineId)) return prev;
  return prev.endAt ? prev : { ...prev, endAt: now };
}

/** Duración en ms de la sesión de hoy para esa rutina, o null si no se sabe cuándo empezó. */
export function sessionDuration(session, { date, routineId, now = Date.now() }) {
  if (!sameSession(session, date, routineId)) return null;
  const end = session.endAt || now;
  return Math.max(0, end - session.startAt);
}

// ---- Formatos ----

export function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, "0")} min`;
}

/** Reloj del modo entreno: "4:05" o "1:02:09". */
export function formatClock(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function formatKg(kg) {
  const v = Math.round(kg || 0);
  return `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} kg`;
}
