import { getLastExerciseLog } from "./setLog.js";

/**
 * Parsea la especificación de repeticiones de un ejercicio (ej. "4–6", "8–10 / lado", "10", "10–20 s").
 * Devuelve { min, max, unit: "reps" | "s", perSide: "lado" | "pierna" | null } o null si no es progresable por reps/segundos.
 */
export function parseRepRange(repsSpec) {
  if (typeof repsSpec === "number" && Number.isFinite(repsSpec) && repsSpec > 0) {
    return { min: repsSpec, max: repsSpec, unit: "reps", perSide: null };
  }
  if (Array.isArray(repsSpec) && repsSpec.length >= 2) {
    const min = Number(repsSpec[0]);
    const max = Number(repsSpec[1]);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min) {
      return { min, max, unit: "reps", perSide: null };
    }
    return null;
  }
  if (repsSpec && typeof repsSpec === "object" && !Array.isArray(repsSpec)) {
    const min = Number(repsSpec.min);
    const max = Number(repsSpec.max ?? repsSpec.min);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min) {
      return {
        min,
        max,
        unit: repsSpec.unit === "s" ? "s" : "reps",
        perSide: repsSpec.perSide || null,
      };
    }
    return null;
  }
  if (!repsSpec || typeof repsSpec !== "string") return null;

  const str = repsSpec.trim();
  // Descartar ejercicios compuestos con "+", tiempos en minutos o rondas
  if (str.includes("+") || /\bmin\b/i.test(str) || /\bronda\b/i.test(str)) {
    return null;
  }

  const rangeMatch = str.match(/^(\d+)\s*[–-]\s*(\d+)(?:\s*(s)\b)?(?:\s*\/\s*(lado|pierna))?$/i);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (min > 0 && max >= min) {
      return {
        min,
        max,
        unit: rangeMatch[3] ? "s" : "reps",
        perSide: rangeMatch[4] ? rangeMatch[4].toLowerCase() : null,
      };
    }
    return null;
  }

  const singleMatch = str.match(/^(\d+)(?:\s*(s)\b)?(?:\s*\/\s*(lado|pierna))?$/i);
  if (singleMatch) {
    const val = Number(singleMatch[1]);
    if (val > 0) {
      return {
        min: val,
        max: val,
        unit: singleMatch[2] ? "s" : "reps",
        perSide: singleMatch[3] ? singleMatch[3].toLowerCase() : null,
      };
    }
  }

  return null;
}

/**
 * Extrae las series y la última carga desde distintas formas de historial:
 * - Array de series: [{ reps, load }, ...]
 * - Objeto de sesión: { series: [...], load, v }
 * - Array de sesiones: [{ date, series: [...] }, ...]
 */
function normalizeHistory(history) {
  if (!history) return null;

  if (Array.isArray(history)) {
    if (history.length === 0) return null;
    // Si es una lista de sesiones con .series, tomar la más reciente con datos
    if (history.some((item) => item && typeof item === "object" && Array.isArray(item.series))) {
      const sorted = [...history]
        .filter((item) => item && Array.isArray(item.series) && item.series.some(Boolean))
        .sort((a, b) => String(b.date || b.d || "").localeCompare(String(a.date || a.d || "")));
      if (sorted.length === 0) return null;
      return normalizeHistory(sorted[0]);
    }
    // Lista directa de series [{ reps, load }, ...]
    const series = history;
    let load = "";
    for (let i = series.length - 1; i >= 0; i--) {
      if (series[i] && series[i].load) {
        load = String(series[i].load).trim();
        break;
      }
    }
    return { series, load };
  }

  if (typeof history === "object") {
    if (Array.isArray(history.series)) {
      let load = history.load || history.v || "";
      for (let i = history.series.length - 1; i >= 0; i--) {
        if (history.series[i] && history.series[i].load) {
          load = String(history.series[i].load).trim();
          break;
        }
      }
      return { series: history.series, load: String(load || "").trim() };
    }
  }

  return null;
}

/**
 * Dado el historial de un ejercicio y su rango de repeticiones, sugiere la meta de hoy:
 * - "reps": subir 1 repetición (cuando completó todas las series dentro del rango sin llegar al tope).
 * - "load": subir carga y volver al mínimo del rango (cuando completó todas las series en o sobre el tope del rango).
 * - "repeat": repetir la meta si no completó todas las series o alguna quedó por debajo del mínimo.
 *
 * Puede invocarse como:
 *   suggestProgression(history, repsSpec, targetSets)
 * o con un objeto de opciones:
 *   suggestProgression({ history, reps, targetSets, setLog, exerciseId, beforeDate, routineId })
 */
export function suggestProgression(historyOrOptions, repsSpec, targetSets) {
  let history = historyOrOptions;
  let reps = repsSpec;
  let sets = targetSets;

  if (
    historyOrOptions &&
    typeof historyOrOptions === "object" &&
    !Array.isArray(historyOrOptions) &&
    repsSpec === undefined &&
    ("reps" in historyOrOptions ||
      "exReps" in historyOrOptions ||
      "history" in historyOrOptions ||
      "last" in historyOrOptions ||
      "setLog" in historyOrOptions)
  ) {
    const opts = historyOrOptions;
    reps = opts.reps ?? opts.exReps;
    sets = opts.targetSets ?? opts.sets;
    if (opts.history !== undefined || opts.last !== undefined) {
      history = opts.history ?? opts.last;
    } else if (opts.setLog && opts.exerciseId) {
      history = getLastExerciseLog(opts.setLog, opts.exerciseId, opts.beforeDate, opts.routineId);
    }
  }

  const range = parseRepRange(reps);
  if (!range) return null;

  const norm = normalizeHistory(history);
  if (!norm || !Array.isArray(norm.series) || norm.series.length === 0) return null;

  const validSets = norm.series
    .filter((s) => s != null && s.reps !== "" && s.reps != null && !isNaN(Number(s.reps)))
    .map((s) => ({
      reps: Number(s.reps),
      load: s.load ? String(s.load).trim() : "",
    }))
    .filter((s) => s.reps > 0);

  if (validSets.length === 0) return null;

  const expectedSets =
    typeof sets === "number" && sets > 0 ? sets : norm.series.length || validSets.length;
  const completedAllSets = validSets.length >= expectedSets;
  const minRepsDone = Math.min(...validSets.map((s) => s.reps));
  const load = norm.load || "";
  const unitLabel = range.unit === "s" ? "s" : "reps";
  const stepUnit = range.unit === "s" ? "s" : "rep";

  // 1. Si no completó todas las series o alguna serie cayó por debajo del mínimo -> repetir
  if (!completedAllSets || minRepsDone < range.min) {
    const goalReps = minRepsDone >= range.min ? Math.min(range.max, minRepsDone) : range.min;
    const loadSuffix = load ? ` con ${load}` : "";
    const text = `Meta hoy: repite ${expectedSets} × ${goalReps} ${unitLabel}${loadSuffix}`;
    return {
      type: "repeat",
      action: "repeat",
      targetReps: goalReps,
      reps: goalReps,
      targetSets: expectedSets,
      sets: expectedSets,
      load,
      unit: range.unit,
      text,
    };
  }

  // 2. Si todas las series llegaron al tope del rango (o lo superaron) -> subir carga
  if (minRepsDone >= range.max) {
    const goalReps = range.min;
    // Sin carga registrada (peso corporal): sugerir lastre o una variante más dura.
    const head = load ? `sube carga (>${load})` : "más difícil (lastre o variante)";
    const text = `Meta hoy: ${head} · ${expectedSets} × ${goalReps} ${unitLabel}`;
    return {
      type: "load",
      action: "load",
      targetReps: goalReps,
      reps: goalReps,
      targetSets: expectedSets,
      sets: expectedSets,
      load,
      unit: range.unit,
      text,
    };
  }

  // 3. Completó todas las series dentro del rango pero bajo el tope -> subir 1 repetición
  const goalReps = Math.min(range.max, minRepsDone + 1);
  const loadSuffix = load ? ` con ${load}` : "";
  const text = `Meta hoy: sube a ${expectedSets} × ${goalReps} ${unitLabel}${loadSuffix} (+1 ${stepUnit})`;
  return {
    type: "reps",
    action: "reps",
    targetReps: goalReps,
    reps: goalReps,
    targetSets: expectedSets,
    sets: expectedSets,
    load,
    unit: range.unit,
    text,
  };
}
