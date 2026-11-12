import { dayDiff } from "./dates.js";
import { MIN_RUN_LEVEL, MAX_RUN_LEVEL } from "../data/runPlan.js";

export const INACTIVITY_DAYS = 14;
export const MAX_HISTORY = 52;

export const DEFAULT_RUN_LEVEL = {
  level: MIN_RUN_LEVEL,
  lastDone: null,
  history: [],
};

export function clampRunLevel(level, maxLevel = MAX_RUN_LEVEL) {
  const n = Number(level);
  if (!Number.isFinite(n)) return MIN_RUN_LEVEL;
  return Math.min(maxLevel, Math.max(MIN_RUN_LEVEL, Math.round(n)));
}

export function normalizeRunLevel(state, maxLevel = MAX_RUN_LEVEL) {
  if (typeof state === "number") {
    return {
      level: clampRunLevel(state, maxLevel),
      lastDone: null,
      history: [],
    };
  }
  if (!state || typeof state !== "object") {
    return {
      level: MIN_RUN_LEVEL,
      lastDone: null,
      history: [],
    };
  }
  const history = Array.isArray(state.history)
    ? state.history
        .filter((h) => h && typeof h.date === "string")
        .map((h) => (Number.isFinite(h.level)
          ? { date: h.date, done: Boolean(h.done), level: h.level }
          : { date: h.date, done: Boolean(h.done) }))
    : [];
  let lastDone = typeof state.lastDone === "string" && state.lastDone ? state.lastDone : null;
  if (!lastDone && history.length > 0) {
    const lastCompleted = [...history].reverse().find((h) => h.done);
    if (lastCompleted) lastDone = lastCompleted.date;
  }
  return {
    level: clampRunLevel(state.level ?? MIN_RUN_LEVEL, maxLevel),
    lastDone,
    history,
  };
}

/**
 * Determina la fecha de referencia desde la cual se cuentan los 14 días de inactividad:
 * parte de la última sesión completada (`lastDone`) y avanza si ya se aplicó un retroceso
 * posterior en el historial tras >= 14 días.
 */
function getInactivityAnchor(norm) {
  let anchor = norm.lastDone;
  if (!anchor) return null;
  const sorted = [...norm.history].sort((a, b) => a.date.localeCompare(b.date));
  for (const entry of sorted) {
    if (entry.date <= anchor) continue;
    if (entry.done) {
      anchor = entry.date;
    } else if (dayDiff(entry.date, anchor) >= INACTIVITY_DAYS) {
      anchor = entry.date;
    }
  }
  return anchor;
}

export function hasInactivityDecay(state, currentDate, maxLevel = MAX_RUN_LEVEL) {
  if (!currentDate || typeof currentDate !== "string") return false;
  const norm = normalizeRunLevel(state, maxLevel);
  const anchor = getInactivityAnchor(norm);
  if (!anchor) return false;
  return dayDiff(currentDate, anchor) >= INACTIVITY_DAYS;
}

/**
 * Devuelve el nivel efectivo para `currentDate` aplicando el retroceso de 1 nivel
 * si pasaron 14 días o más sin completar una sesión de running. Nunca baja de 1.
 */
export function getEffectiveRunLevel(state, currentDate = null, maxLevel = MAX_RUN_LEVEL) {
  const norm = normalizeRunLevel(state, maxLevel);
  if (currentDate && hasInactivityDecay(norm, currentDate, maxLevel)) {
    return clampRunLevel(norm.level - 1, maxLevel);
  }
  return norm.level;
}

/**
 * Aplica de forma inmutable el retroceso por inactividad (>= 14 días sin sesión completada).
 * Si no corresponde retroceder, devuelve el estado normalizado sin cambios.
 */
export function applyInactivityDecay(state, currentDate, maxLevel = MAX_RUN_LEVEL) {
  const norm = normalizeRunLevel(state, maxLevel);
  if (!currentDate || !hasInactivityDecay(norm, currentDate, maxLevel)) {
    return norm;
  }
  const nextLevel = clampRunLevel(norm.level - 1, maxLevel);
  const filtered = norm.history.filter((h) => h.date !== currentDate);
  const history = [...filtered, { date: currentDate, done: false }].slice(-MAX_HISTORY);
  return {
    level: nextLevel,
    lastDone: norm.lastDone,
    history,
  };
}

/**
 * Registra el resultado de una sesión de running en `date`:
 * - Si `done` es true: avanza un nivel (sin pasar del máximo) y actualiza `lastDone`.
 *   No avanza dos veces el mismo día.
 * - Si `done` es false: repite el nivel actual (o retrocede un nivel si pasaron >= 14 días
 *   desde la última sesión completada).
 */
export function recordRunSession(state, sessionOrDate, doneArg = true, maxLevel = MAX_RUN_LEVEL) {
  let date = sessionOrDate;
  let done = doneArg;
  let max = maxLevel;

  if (sessionOrDate && typeof sessionOrDate === "object") {
    date = sessionOrDate.date;
    done = sessionOrDate.done !== undefined ? Boolean(sessionOrDate.done) : true;
    if (sessionOrDate.maxLevel !== undefined) max = sessionOrDate.maxLevel;
  } else {
    done = Boolean(doneArg);
  }

  const norm = normalizeRunLevel(state, max);
  if (!date || typeof date !== "string") return norm;

  const alreadyDoneToday =
    norm.lastDone === date || norm.history.some((h) => h.date === date && h.done);

  if (alreadyDoneToday && done) {
    return norm;
  }

  const decayed = hasInactivityDecay(norm, date, max);
  const baseLevel = decayed ? clampRunLevel(norm.level - 1, max) : norm.level;

  if (done) {
    const nextLevel = clampRunLevel(baseLevel + 1, max);
    const filtered = norm.history.filter((h) => h.date !== date);
    // Guarda el nivel que se corrió ese día para seguir mostrándolo hasta mañana.
    const history = [...filtered, { date, done: true, level: baseLevel }].slice(-MAX_HISTORY);
    const lastDone = !norm.lastDone || date >= norm.lastDone ? date : norm.lastDone;
    return {
      level: nextLevel,
      lastDone,
      history,
    };
  }

  if (alreadyDoneToday && !done) {
    return norm;
  }

  const filtered = norm.history.filter((h) => h.date !== date);
  const history = [...filtered, { date, done: false }].slice(-MAX_HISTORY);
  return {
    level: baseLevel,
    lastDone: norm.lastDone,
    history,
  };
}

/**
 * Nivel que se muestra en `date`: si ese día ya se completó una sesión, el nivel que se corrió
 * (el avance aplica desde la próxima sesión); si no, el nivel efectivo con el retroceso aplicado.
 */
export function getDisplayRunLevel(state, date, maxLevel = MAX_RUN_LEVEL) {
  const norm = normalizeRunLevel(state, maxLevel);
  const doneToday = norm.history.find((h) => h.date === date && h.done);
  if (doneToday) {
    return clampRunLevel(Number.isFinite(doneToday.level) ? doneToday.level : norm.level - 1, maxLevel);
  }
  return getEffectiveRunLevel(norm, date, maxLevel);
}

/**
 * Deshace la sesión completada en `date` (al tocar «Quitar registro»): vuelve al nivel
 * que se corrió ese día y recalcula `lastDone` con la sesión completada anterior.
 */
export function undoRunSession(state, date, maxLevel = MAX_RUN_LEVEL) {
  const norm = normalizeRunLevel(state, maxLevel);
  const entry = norm.history.find((h) => h.date === date && h.done);
  if (!entry) return norm;
  const history = norm.history.filter((h) => h.date !== date);
  const prevDone = [...history].filter((h) => h.done).sort((a, b) => a.date.localeCompare(b.date)).pop();
  return {
    level: clampRunLevel(Number.isFinite(entry.level) ? entry.level : norm.level - 1, maxLevel),
    lastDone: prevDone ? prevDone.date : null,
    history,
  };
}

export const updateRunLevel = recordRunSession;
export const advanceRunLevel = recordRunSession;
