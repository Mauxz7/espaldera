import { dkey, fromKey, addDays } from "./dates.js";
import { DEFAULT_HABIT_DEFS, isHabitDone } from "../data/habits.js";

export const DEFAULT_WINDOW_DAYS = 30;

/**
 * Normaliza una referencia de fecha (Date o cadena YYYY-MM-DD) a clave YYYY-MM-DD.
 */
function normalizeDateKey(today = new Date()) {
  if (typeof today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return today;
  }
  if (today instanceof Date) {
    return dkey(today);
  }
  return dkey(new Date());
}

/**
 * Calcula las estadísticas de un hábito:
 * - currentStreak: racha actual de días consecutivos cumplidos (hasta hoy, o hasta ayer si hoy sigue pendiente)
 * - bestStreak: mejor racha de días consecutivos cumplidos en el historial disponible hasta hoy
 * - done30: cantidad de días cumplidos en la ventana (30 días por defecto)
 * - rate30 / pct30: porcentaje entero (0–100) de cumplimiento en los últimos 30 días
 * - days30: tira cronológica de los últimos 30 días [{ date, done }] (del más antiguo a hoy)
 */
export function computeHabitStats(def, habits = {}, today = new Date(), windowDays = DEFAULT_WINDOW_DAYS) {
  const habitDef = typeof def === "string" ? { id: def, kind: "check", target: 1 } : (def || { id: "", kind: "check", target: 1 });
  const safeHabits = habits && typeof habits === "object" ? habits : {};
  const todayKey = normalizeDateKey(today);
  const todayDate = fromKey(todayKey);
  const totalWindow = Math.max(1, Number(windowDays) || DEFAULT_WINDOW_DAYS);

  const days30 = Array.from({ length: totalWindow }, (_, i) => {
    const date = dkey(addDays(todayDate, i - (totalWindow - 1)));
    const dayData = safeHabits[date];
    const val = dayData && typeof dayData === "object" ? dayData[habitDef.id] : undefined;
    const done = isHabitDone(habitDef, val);
    return { date, done };
  });

  const done30 = days30.filter((d) => d.done).length;
  const rate30 = Math.round((done30 / totalWindow) * 100);

  // Si existen registros anteriores a la ventana de 30 días, incluirlos para no truncar rachas largas
  const windowStartKey = days30[0].date;
  const earlierKeys = Object.keys(safeHabits)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k < windowStartKey)
    .sort();

  let allDays = days30;
  if (earlierKeys.length > 0) {
    const earliestDate = fromKey(earlierKeys[0]);
    const windowStartDate = fromKey(windowStartKey);
    const extraCount = Math.round((windowStartDate - earliestDate) / 86400000);
    if (extraCount > 0 && extraCount <= 3650) {
      const prefix = Array.from({ length: extraCount }, (_, i) => {
        const date = dkey(addDays(earliestDate, i));
        const dayData = safeHabits[date];
        const val = dayData && typeof dayData === "object" ? dayData[habitDef.id] : undefined;
        return { date, done: isHabitDone(habitDef, val) };
      });
      allDays = [...prefix, ...days30];
    }
  }

  let bestStreak = 0;
  let run = 0;
  for (let i = 0; i < allDays.length; i++) {
    if (allDays[i].done) {
      run++;
      if (run > bestStreak) bestStreak = run;
    } else {
      run = 0;
    }
  }

  let currentStreak = 0;
  for (let i = allDays.length - 1; i >= 0; i--) {
    if (allDays[i].done) {
      currentStreak++;
    } else if (i !== allDays.length - 1) {
      break;
    }
  }

  return {
    id: habitDef.id,
    currentStreak,
    bestStreak,
    done30,
    rate30,
    pct30: rate30,
    days30,
  };
}

/**
 * Calcula las estadísticas de todos los hábitos activos (no archivados).
 */
export function computeAllHabitStats(defs = DEFAULT_HABIT_DEFS, habits = {}, today = new Date(), windowDays = DEFAULT_WINDOW_DAYS) {
  const list = Array.isArray(defs) ? defs : DEFAULT_HABIT_DEFS;
  let reqIdx = 0;
  let optIdx = 0;
  return list
    .filter((d) => d && !d.archived)
    .map((d) => {
      const isOpt = d.group === "opt";
      const code = d.code || (isOpt ? `F${++optIdx}` : `O${++reqIdx}`);
      return {
        ...d,
        code,
        ...computeHabitStats(d, habits, today, windowDays),
      };
    });
}
