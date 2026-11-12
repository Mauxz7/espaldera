import { dkey, mondayOf, fmtShort } from "./dates.js";

export const WORKOUT_KINDS = ["run", "bike", "walk", "strength", "other"];

export const KIND_LABELS = {
  run: "Running",
  bike: "Bici",
  walk: "Caminata",
  strength: "Fuerza",
  other: "Otro",
};

/**
 * Valida y normaliza un entreno individual.
 * Devuelve null si la entrada no es un objeto válido o no tiene una fecha de inicio válida.
 */
export function normalizeWorkout(w) {
  if (!w || typeof w !== "object" || Array.isArray(w)) return null;
  if (typeof w.start !== "string" && !(w.start instanceof Date)) return null;
  if (typeof w.start === "string" && !w.start.trim()) return null;

  const startDate = new Date(w.start);
  if (isNaN(startDate.getTime())) return null;

  if (w.type !== undefined && (typeof w.type !== "string" || !w.type.trim())) return null;

  let min = null;
  if (w.min !== null && w.min !== undefined && w.min !== "") {
    if (typeof w.min === "boolean") return null;
    const n = Number(w.min);
    if (!Number.isFinite(n) || n < 0) return null;
    min = n > 0 ? Math.round(n) : 0;
  }

  const kind = WORKOUT_KINDS.includes(w.kind) ? w.kind : "other";
  const type = typeof w.type === "string" ? w.type.trim() : KIND_LABELS[kind];
  const date = dkey(startDate);
  const weekStart = dkey(mondayOf(startDate));

  return {
    id: w.id || `${startDate.toISOString().slice(0, 16)}-${kind}`,
    type,
    kind,
    start: startDate.toISOString(),
    end: w.end && !isNaN(new Date(w.end)) ? new Date(w.end).toISOString() : null,
    min,
    date,
    weekStart,
  };
}

/**
 * Filtra entradas inválidas y devuelve los entrenos ordenados del más reciente al más viejo.
 */
export function validWorkouts(workouts) {
  if (!Array.isArray(workouts)) return [];
  return workouts
    .map(normalizeWorkout)
    .filter(Boolean)
    .sort((a, b) => b.start.localeCompare(a.start));
}

/**
 * Agrupa los entrenos válidos por semana de lunes a domingo en hora local
 * (usando mondayOf y dkey de src/lib/dates.js).
 * Devuelve por semana (de la más antigua a la más reciente):
 * - weekStart: fecha del lunes en formato YYYY-MM-DD
 * - week: etiqueta corta (fmtShort)
 * - count: cantidad de entrenos en esa semana
 * - totalMin / min: minutos totales en esa semana
 * - run, bike, walk, strength, other: minutos por tipo
 * - byKind: { run, bike, walk, strength, other }
 */
export function groupWorkoutsByWeek(workouts, maxWeeks) {
  const valid = validWorkouts(workouts);
  const map = new Map();

  for (const w of valid) {
    let bucket = map.get(w.weekStart);
    if (!bucket) {
      bucket = {
        weekStart: w.weekStart,
        week: fmtShort(w.weekStart),
        count: 0,
        totalMin: 0,
        min: 0,
        run: 0,
        bike: 0,
        walk: 0,
        strength: 0,
        other: 0,
        byKind: { run: 0, bike: 0, walk: 0, strength: 0, other: 0 },
      };
      map.set(w.weekStart, bucket);
    }
    const m = w.min || 0;
    bucket.count += 1;
    bucket.totalMin += m;
    bucket.min += m;
    bucket[w.kind] += m;
    bucket.byKind[w.kind] += m;
  }

  const sorted = [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  if (typeof maxWeeks === "number" && maxWeeks > 0) {
    return sorted.slice(-maxWeeks);
  }
  return sorted;
}
