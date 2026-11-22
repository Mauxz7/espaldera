// Cálculos de la pestaña Inicio (sin interfaz, con pruebas en tests/home.test.mjs).
import { MAIN } from "./planner.js";
import { DEFAULT_HABIT_DEFS, reqDone } from "../data/habits.js";
import { dkey } from "./dates.js";
import { isPoorSleep, fmtSleep } from "./sleep.js";

// Progreso de la semana en curso (lunes a hoy) para los tres anillos de Inicio.
// - sesiones: rutinas principales distintas hechas (en Shift o cubiertas por Fitbit) de 4.
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

/**
 * Unifica el aviso del planificador Bevel y la alerta de sueño corto (< 6 h) en la tarjeta «Hoy»
 * para que nunca aparezcan dos avisos duplicados a la vez.
 */
export function buildTodayBevelBanner({ plan, night, bevelAdjustment }) {
  const adj = bevelAdjustment && typeof bevelAdjustment === "object" ? bevelAdjustment : null;
  const isPlannedMain = plan && plan.state === "planned" && plan.rid && plan.rid !== "low";
  const poorSleep = isPoorSleep(night);

  if (adj && adj.applied) {
    const tone = adj.action === "prioritize" ? "good" : adj.action === "unstack" ? "cool" : "warn";
    const text = adj.reason || "";
    const extraGuidance = adj.guidance && !text.includes(adj.guidance) ? ` ${adj.guidance}` : "";
    return {
      tone,
      title: adj.action === "prioritize" ? "Plan ajustado por recuperación alta" : "Plan ajustado por recuperación",
      text: `${text}${extraGuidance}`.trim(),
      offerLow: false,
    };
  }

  if (adj && adj.biometricsOff) {
    return {
      tone: "warn",
      title: "Señales biométricas fuera de rango",
      text: adj.reason || "Prioriza descanso, hidratación y sueño hoy.",
      offerLow: !!isPlannedMain,
    };
  }

  if (isPlannedMain && poorSleep) {
    const guidance = adj && adj.guidance ? ` ${adj.guidance}` : "";
    return {
      tone: "warn",
      title: `Dormiste ${fmtSleep(night.min)}.`,
      text: guidance
        ? `Con poco sueño rinde más una sesión liviana.${guidance}`
        : "Con poco sueño rinde más una sesión liviana: haz la suave de 20 min o quita una serie por ejercicio.",
      offerLow: true,
    };
  }

  if (adj && adj.guidance && plan && plan.state === "planned") {
    return {
      tone: "cool",
      title: "Guía de esfuerzo para hoy",
      text: adj.reason || adj.guidance,
      offerLow: false,
    };
  }

  return null;
}
