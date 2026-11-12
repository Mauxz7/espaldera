import { pruneDays } from "./dates.js";

/**
 * Parsea el objetivo de repeticiones de una cadena como "4–6", "8–10", "30 s", etc.
 * Para rangos como "8–10" o "4–6", devuelve el número superior (meta de sobrecarga).
 * Para "8 / pierna", devuelve 8.
 * Si no contiene números, devuelve la cadena limpia.
 */
export function parseTargetReps(reps) {
  if (typeof reps === "number") return reps;
  if (!reps || typeof reps !== "string") return 10;
  const str = reps.trim();
  const rangeMatch = str.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (rangeMatch) return Number(rangeMatch[2]);
  const numMatch = str.match(/^(\d+)/);
  if (numMatch) return Number(numMatch[1]);
  return str;
}

/**
 * Busca la serie anterior completada en una sesión de un ejercicio.
 */
export function getPreviousSet(series, setIndex) {
  if (!Array.isArray(series) || setIndex <= 0) return null;
  for (let i = setIndex - 1; i >= 0; i--) {
    if (series[i] && (series[i].reps != null || series[i].load != null)) {
      return series[i];
    }
  }
  return null;
}

/**
 * Busca en setLog la última sesión registrada para un ejercicio antes de una fecha.
 * Devuelve { date, series, load, repsSummary } o null.
 */
export function getLastExerciseLog(setLog, exerciseId, beforeDate = null, routineId = null) {
  if (!setLog || typeof setLog !== "object") return null;
  const dates = Object.keys(setLog).sort().reverse();
  for (const d of dates) {
    if (beforeDate && d >= beforeDate) continue;
    const day = setLog[d];
    if (!day || typeof day !== "object") continue;

    // Si se pasa routineId, buscar primero en esa rutina
    const checkRoutines = routineId && day[routineId] ? [day[routineId], ...Object.values(day).filter((r) => r !== day[routineId])] : Object.values(day);

    for (const r of checkRoutines) {
      if (r && Array.isArray(r[exerciseId])) {
        const series = r[exerciseId].filter(Boolean);
        if (series.length > 0) {
          let lastLoad = "";
          for (let i = series.length - 1; i >= 0; i--) {
            if (series[i].load) {
              lastLoad = series[i].load;
              break;
            }
          }
          const repsSummary = series.map((s) => s.reps).filter((r) => r != null).join(", ");
          return {
            date: d,
            series,
            load: lastLoad,
            repsSummary: repsSummary ? `${repsSummary} reps` : "",
          };
        }
      }
    }
  }
  return null;
}

/**
 * Resuelve los valores por defecto ({ reps, load }) para una serie:
 * 1. Si la serie anterior en la sesión actual existe, precarga con ella.
 * 2. Si no, si hay una sesión previa del ejercicio en setLog, usa su última serie / carga.
 * 3. Si no, usa currentLoad o parseTargetReps(exReps).
 */
export function resolveDefaultSet({ series, setIndex, exReps, currentLoad, lastLog }) {
  const prev = getPreviousSet(series, setIndex);
  if (prev) {
    return { reps: prev.reps, load: prev.load || "" };
  }
  const load = currentLoad || (lastLog && lastLog.load) || "";
  let reps;
  if (lastLog && lastLog.series && lastLog.series.length > 0) {
    const prevSet = lastLog.series[setIndex] || lastLog.series[lastLog.series.length - 1];
    reps = prevSet.reps;
  } else {
    reps = parseTargetReps(exReps);
  }
  return { reps, load };
}

/**
 * Registra o actualiza una serie en setLog de forma inmutable, recortando a maxDays (90 por defecto).
 */
export function recordSet({ setLog = {}, date, routineId, exerciseId, setIndex, reps, load, maxDays = 90 }) {
  const day = { ...(setLog[date] || {}) };
  const r = { ...(day[routineId] || {}) };
  const curSeries = [...(r[exerciseId] || [])];

  while (curSeries.length < setIndex) {
    curSeries.push(null);
  }
  curSeries[setIndex] = {
    reps: reps !== "" && !isNaN(Number(reps)) ? Number(reps) : reps,
    load: typeof load === "string" ? load.trim() : (load || ""),
  };

  r[exerciseId] = curSeries;
  day[routineId] = r;
  const next = { ...setLog, [date]: day };
  return pruneDays(next, maxDays);
}

/**
 * Elimina o desmarca una serie de setLog de forma inmutable.
 */
export function removeSet({ setLog = {}, date, routineId, exerciseId, setIndex, maxDays = 90 }) {
  if (!setLog[date]?.[routineId]?.[exerciseId]) return setLog;

  const day = { ...(setLog[date] || {}) };
  const r = { ...(day[routineId] || {}) };
  const curSeries = [...(r[exerciseId] || [])];

  if (setIndex < curSeries.length) {
    curSeries[setIndex] = null;
  }

  while (curSeries.length > 0 && curSeries[curSeries.length - 1] == null) {
    curSeries.pop();
  }

  if (curSeries.length === 0 || curSeries.every((s) => s == null)) {
    delete r[exerciseId];
  } else {
    r[exerciseId] = curSeries;
  }

  if (Object.keys(r).length === 0) {
    delete day[routineId];
  } else {
    day[routineId] = r;
  }

  const next = { ...setLog };
  if (Object.keys(day).length === 0) {
    delete next[date];
  } else {
    next[date] = day;
  }

  return pruneDays(next, maxDays);
}

/**
 * Actualiza la carga de todas las series existentes de un ejercicio en una fecha en setLog.
 */
export function updateExerciseLoad({ setLog = {}, date, routineId, exerciseId, load, maxDays = 90 }) {
  if (!setLog[date]?.[routineId]?.[exerciseId]) return setLog;
  const day = { ...(setLog[date] || {}) };
  const r = { ...(day[routineId] || {}) };
  const curSeries = (r[exerciseId] || []).map((s) => (s ? { ...s, load: typeof load === "string" ? load.trim() : (load || "") } : null));

  r[exerciseId] = curSeries;
  day[routineId] = r;
  const next = { ...setLog, [date]: day };
  return pruneDays(next, maxDays);
}
