import { dkey, mondayOf, fmtShort } from "./dates.js";

export const WORKOUT_KINDS = ["run", "bike", "walk", "strength", "other"];

export const KIND_LABELS = {
  run: "Running",
  bike: "Bici",
  walk: "Caminata",
  strength: "Fuerza",
  other: "Otro",
};

function optNumber(v, { min = 0, strictPositive = false } = {}) {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (strictPositive ? n <= min : n < min) return null;
  return n;
}

function sanitizeZones(z) {
  if (!z || typeof z !== "object" || Array.isArray(z)) return null;
  const out = { light: 0, moderate: 0, vigorous: 0, peak: 0 };
  let total = 0;
  for (const k of ["light", "moderate", "vigorous", "peak"]) {
    const n = optNumber(z[k], { min: 0 });
    if (n !== null) {
      out[k] = Math.round(n * 10) / 10;
      total += out[k];
    }
  }
  return total > 0 ? out : null;
}

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

  const out = {
    id: w.id || `${startDate.toISOString().slice(0, 16)}-${kind}`,
    type,
    kind,
    start: startDate.toISOString(),
    end: w.end && !isNaN(new Date(w.end)) ? new Date(w.end).toISOString() : null,
    min,
    date,
    weekStart,
  };

  if (typeof w.source === "string" && w.source.trim()) out.source = w.source.trim();
  const km = optNumber(w.km, { strictPositive: true });
  if (km !== null) out.km = Math.round(km * 100) / 100;
  const avgHr = optNumber(w.avgHr, { strictPositive: true });
  if (avgHr !== null) out.avgHr = Math.round(avgHr);
  const azm = optNumber(w.azm, { min: 0 });
  if (azm !== null) out.azm = Math.round(azm);
  const kcal = optNumber(w.kcal, { strictPositive: true });
  if (kcal !== null) out.kcal = Math.round(kcal);
  const zones = sanitizeZones(w.zones);
  if (zones) out.zones = zones;

  return out;
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

/**
 * Las últimas `n` semanas del calendario (de lunes a domingo, hora local) que terminan en la semana
 * de `today`, incluidas las semanas sin entrenos en cero, para que el gráfico no oculte huecos.
 */
export function lastWeeks(workouts, n = 8, today = new Date()) {
  const byStart = new Map(groupWorkoutsByWeek(workouts).map((w) => [w.weekStart, w]));
  const thisMonday = mondayOf(today);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - 7 * (n - 1 - i));
    const key = dkey(d);
    return byStart.get(key) || {
      weekStart: key, week: fmtShort(key), count: 0, totalMin: 0, min: 0,
      run: 0, bike: 0, walk: 0, strength: 0, other: 0,
      byKind: { run: 0, bike: 0, walk: 0, strength: 0, other: 0 },
    };
  });
}
