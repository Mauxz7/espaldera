// Líneas base móviles adaptativas (estadística robusta, sin interfaz).
// Ventana estrictamente previa [d - windowDays, d - 1] para no contaminar la referencia con el día actual.
import { dkey, fromKey, addDays } from "./dates.js";

export const CALIBRATION_MIN_DAYS = 7;
export const CALIBRATION_READY_DAYS = 21;
export const MAD_SCALE = 1.4826;

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const isDateKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);

export function median(values) {
  if (!Array.isArray(values) || !values.length) return null;
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mad(values, med = null) {
  if (!Array.isArray(values) || !values.length) return null;
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  const center = Number.isFinite(med) ? med : median(finite);
  if (center == null) return null;
  return median(finite.map((v) => Math.abs(v - center)));
}

export function ewma(values, alpha = 0.06) {
  if (!Array.isArray(values) || !values.length) return null;
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  let acc = finite[0];
  for (let i = 1; i < finite.length; i++) {
    acc = alpha * finite[i] + (1 - alpha) * acc;
  }
  return acc;
}

export function calibrationStatus(n, { minDays = CALIBRATION_MIN_DAYS, readyDays = CALIBRATION_READY_DAYS } = {}) {
  if (n < minDays) return "calibrating";
  if (n < readyDays) return "provisional";
  return "ready";
}

function extractEntry(entry, { field = null, kindField = "hrvKind", filterKind = null } = {}) {
  if (entry == null) return null;
  if (typeof entry === "number") {
    if (filterKind != null) return null;
    return Number.isFinite(entry) ? entry : null;
  }
  if (typeof entry !== "object" || Array.isArray(entry)) return null;

  const entryKind = entry.kind !== undefined ? entry.kind : entry[kindField];
  if (filterKind != null) {
    if (entryKind !== filterKind) return null;
  }

  const raw = field != null ? entry[field] : entry.value;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return raw;
}

/**
 * Calcula una línea base robusta sobre la ventana estrictamente previa [dateKey - windowDays, dateKey - 1].
 *
 * @param {Record<string, number | { value: number, kind?: string, hrvKind?: string }>} seriesByDate
 * @param {string} dateKey Fecha objetivo YYYY-MM-DD (nunca se incluye en su propia línea base).
 * @param {object} [options]
 * @param {number} [options.windowDays=60] Días calendario previos a incluir.
 * @param {number} [options.minFloor=1] Piso mínimo de dispersión (evita divisiones explosivas).
 * @param {(v: number) => number | null} [options.transform=null] Transformación opcional (p. ej. Math.log para HRV).
 * @param {(v: number) => number | null} [options.inverseTransform=null] Inversa opcional (auto Math.exp si transform === Math.log).
 * @param {string | null} [options.filterKind=null] Si se especifica (p. ej. "rmssd" o "sdnn"), filtra estrictamente por ese tipo.
 * @param {string | null} [options.field=null] Campo numérico a leer si las entradas son objetos compuestos (p. ej. vitals).
 * @param {string} [options.kindField="hrvKind"] Campo de tipo cuando se filtra por `filterKind`.
 */
export function computeBaseline(seriesByDate, dateKey, options = {}) {
  const {
    windowDays = 60,
    minFloor = 1,
    transform = null,
    inverseTransform = null,
    filterKind = null,
    field = null,
    kindField = "hrvKind",
  } = options || {};

  const win = Math.max(1, Math.round(Number(windowDays) || 60));
  const floor = Number.isFinite(minFloor) && minFloor > 0 ? minFloor : 1e-6;
  const inv = typeof inverseTransform === "function"
    ? inverseTransform
    : transform === Math.log
      ? Math.exp
      : null;

  const empty = {
    n: 0,
    windowDays: win,
    status: "calibrating",
    ready: false,
    minRequired: CALIBRATION_MIN_DAYS,
    fullRequired: CALIBRATION_READY_DAYS,
    center: null,
    median: null,
    ewma: null,
    mad: null,
    spread: null,
    low: null,
    high: null,
    rawCenter: null,
    rawLow: null,
    rawHigh: null,
    min: null,
    max: null,
    kind: filterKind || null,
  };

  if (!seriesByDate || typeof seriesByDate !== "object" || !isDateKey(dateKey)) {
    return empty;
  }

  const targetDate = fromKey(dateKey);
  const startKey = dkey(addDays(targetDate, -win));
  const endKey = dkey(addDays(targetDate, -1));

  const keys = Object.keys(seriesByDate)
    .filter((k) => isDateKey(k) && k >= startKey && k <= endKey && k < dateKey)
    .sort();

  const rawValues = [];
  const transformedValues = [];

  for (const k of keys) {
    const raw = extractEntry(seriesByDate[k], { field, kindField, filterKind });
    if (raw == null) continue;
    if (typeof transform === "function") {
      if (transform === Math.log && raw <= 0) continue;
      const t = transform(raw);
      if (!Number.isFinite(t)) continue;
      rawValues.push(raw);
      transformedValues.push(t);
    } else {
      rawValues.push(raw);
      transformedValues.push(raw);
    }
  }

  const n = transformedValues.length;
  if (n === 0) return empty;

  const center = median(transformedValues);
  const madVal = mad(transformedValues, center);
  const spread = Math.max(MAD_SCALE * (madVal ?? 0), floor);
  const low = center - spread;
  const high = center + spread;
  const ewmaVal = ewma(transformedValues, 0.06);
  const status = calibrationStatus(n);

  const rawCenter = inv ? inv(center) : center;
  const rawLow = inv ? inv(low) : low;
  const rawHigh = inv ? inv(high) : high;

  return {
    n,
    windowDays: win,
    status,
    ready: n >= CALIBRATION_MIN_DAYS,
    minRequired: CALIBRATION_MIN_DAYS,
    fullRequired: CALIBRATION_READY_DAYS,
    center,
    median: center,
    ewma: ewmaVal,
    mad: madVal,
    spread,
    low,
    high,
    rawCenter,
    rawLow,
    rawHigh,
    min: Math.min(...rawValues),
    max: Math.max(...rawValues),
    kind: filterKind || null,
  };
}

/**
 * Calcula el z-score de un valor respecto a una línea base.
 * Devuelve null si el valor o la línea base no son utilizables.
 */
export function zScore(value, baseline, transform = null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!baseline || baseline.center == null || !(baseline.spread > 0)) return null;
  const v = typeof transform === "function"
    ? (transform === Math.log && value <= 0 ? NaN : transform(value))
    : value;
  if (!Number.isFinite(v)) return null;
  return (v - baseline.center) / baseline.spread;
}
