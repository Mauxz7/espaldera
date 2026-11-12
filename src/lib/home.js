// Cálculos de la pestaña Inicio (sin interfaz, con pruebas en tests/home.test.mjs).
import { MAIN } from "./planner.js";
import { DEFAULT_HABIT_DEFS, reqDone } from "../data/habits.js";
import { dkey } from "./dates.js";

// Progreso de la semana en curso (lunes a hoy) para los tres anillos de Inicio.
// - sesiones: rutinas principales distintas hechas (en Espaldera o cubiertas por Fitbit) de 4.
// - hábitos: días con todos los obligatorios cumplidos, sobre los días transcurridos.
// - minutos: minutos de entrenos de Fitbit en la semana, contra una meta de 150 (recomendación OMS).
export const MINUTES_GOAL = 150;

export function weekProgress({ keys, todayIdx, fixed, habits, habitDefs, workouts }) {
  const done = new Set(Object.values(fixed || {}).filter((r) => MAIN.includes(r)));
  const defs = (habitDefs || DEFAULT_HABIT_DEFS).filter((d) => !d.archived && (!d.group || d.group === "req"));
  const days = Math.max(1, Math.min(7, todayIdx + 1));
  let habitDays = 0;
  for (let i = 0; i < days; i++) {
    const h = (habits || {})[keys[i]];
    if (defs.length && h && reqDone(h, defs) === defs.length) habitDays++;
  }
  let minutes = 0;
  for (const w of Array.isArray(workouts) ? workouts : []) {
    if (!w || !w.start) continue;
    const d = new Date(w.start);
    if (isNaN(d)) continue;
    const i = keys.indexOf(dkey(d));
    if (i >= 0 && i <= todayIdx && Number(w.min) > 0) minutes += Math.round(Number(w.min));
  }
  return {
    sessions: { value: done.size, goal: MAIN.length },
    habits: { value: habitDays, goal: days },
    minutes: { value: minutes, goal: MINUTES_GOAL },
  };
}

// Qué mostrar en la tarjeta «Hoy».
export function todayPlan({ info, logged, fromFitbit }) {
  if (logged) return { state: "done", rid: logged.r };
  if (fromFitbit) return { state: "fitbit", rid: fromFitbit };
  if (info && info.rid) return { state: "planned", rid: info.rid, evening: !!info.evening, office: !!info.office };
  return { state: "rest", rid: null, office: !!(info && info.office) };
}
