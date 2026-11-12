import { useMemo } from "react";
import { usePersisted } from "./storage.js";
import { dkey, fromKey, addDays, mondayOf, dayDiff, pruneDays } from "./dates.js";
import { routineById } from "../data/program.js";

export const MAIN = ["d1", "d2", "d3", "d4"];

export const TAG = { d1: "TOR", d2: "PIE", d3: "RUN", d4: "FUL", low: "RES" };

export const DEFAULT_OFFICE = [true, false, true, true, true, false, false]; // Lun…Dom: true = voy a la oficina

// Puntaje de una semana (menor es mejor). arr[i] = rutina del día i o null.
// Un día de oficina con la noche libre (sin clase) se entrena de noche: no compite con la mañana corta.
export const isEvening = (office, night, i) => !!(night && night[i] && office[i]);

export function scorePlan(arr, office, night, effort) {
  let s = 0;
  for (let i = 0; i < 7; i++) {
    const r = arr[i];
    if (!r) continue;
    const prev = i > 0 ? arr[i - 1] : null;
    const eve = isEvening(office, night, i);
    if (eve) s -= 8; // marcaste esa noche libre para entrenar: se aprovecha
    if (prev && isEvening(office, night, i - 1) && !eve) s += office[i] ? 6 : 3; // de noche y otra vez al amanecer: poca recuperación (en casa puedes empezar más tarde)
    if (office[i] && !eve) s += 6 + Math.max(0, routineById(r).minutes - 35) * 0.4; // mañana corta: mejor descansar o sesión breve
    if (i === 6) s += 3; // el domingo se prefiere libre
    if (effort && i > 0 && effort[i - 1] && !prev) {
      s += 2; // el día anterior hubo deporte fuerte en Fitbit: cuenta como días seguidos
      if (r === "d2") s += 8; // pierna después de raqueta, fútbol o similar
      if (r === "d3") s += 4;
    }
    if (prev) {
      s += 2; // días seguidos
      if (r === "d3" && prev === "d2") s += 1000; // nunca correr el día después de pierna
      if (r === "d3" && prev === "d4") s += 12; // full body también carga piernas
      if (r === "d2" && prev === "d3") s += 8; // pierna con las piernas del trote
      if ((r === "d4" && prev === "d2") || (r === "d2" && prev === "d4")) s += 6;
      if (i > 1 && arr[i - 2]) s += 8; // tres días seguidos
    }
  }
  s += MAIN.filter((m) => !arr.includes(m)).length * 100; // sesión que no cabe
  return s;
}

// Todas las formas de colocar las sesiones pendientes en los días libres desde fromIdx, de mejor a peor.
export function rankPlans(office, fixed, fromIdx, night, effort) {
  const done = Object.values(fixed);
  const left = MAIN.filter((m) => !done.includes(m));
  const free = [];
  for (let i = fromIdx; i < 7; i++) if (!fixed[i]) free.push(i);
  const base = Array(7).fill(null);
  Object.keys(fixed).forEach((i) => { base[i] = fixed[i]; });
  const out = [];
  const rec = (si, arr) => {
    if (si === left.length) { out.push({ arr: arr.slice(), score: scorePlan(arr, office, night, effort) }); return; }
    for (const d of free) if (!arr[d]) { arr[d] = left[si]; rec(si + 1, arr); arr[d] = null; }
    rec(si + 1, arr);
  };
  rec(0, base);
  out.sort((a, b) => a.score - b.score || a.arr.join().localeCompare(b.arr.join()));
  return out;
}

// Entrenos de Fitbit (clave `workouts`, solo lectura) por día de la semana.
// Fuerza o running de FIT_SESSION_MIN o más cuentan como la sesión del día; cualquier entreno
// de FIT_EFFORT_MIN o más (raqueta, fútbol, «Activity»…) cuenta como esfuerzo para no poner pierna al día siguiente.
export const FIT_SESSION_MIN = 20;
export const FIT_EFFORT_MIN = 30;
const STRENGTH_ORDER = ["d1", "d4", "d2"];

export function fitbitWeek(workouts, keys) {
  const byDay = keys.map(() => []);
  for (const w of Array.isArray(workouts) ? workouts : []) {
    if (!w || !w.start) continue;
    const d = new Date(w.start);
    if (isNaN(d)) continue;
    const i = keys.indexOf(dkey(d));
    if (i >= 0) byDay[i].push({ kind: w.kind || "other", type: w.type || "Entreno", min: Number(w.min) > 0 ? Math.round(Number(w.min)) : 0 });
  }
  return byDay.map((list) => {
    if (!list.length) return null;
    const total = list.reduce((a, w) => a + w.min, 0);
    const main = list.slice().sort((a, b) => b.min - a.min)[0];
    const session = list.filter((w) => (w.kind === "strength" || w.kind === "run") && w.min >= FIT_SESSION_MIN).sort((a, b) => b.min - a.min)[0] || null;
    return { list, total, main: session || main, session, effort: list.some((w) => w.min >= FIT_EFFORT_MIN) || !!session };
  });
}

// Qué sesión del plan cubre un entreno de Fitbit: la planeada ese día si es del mismo tipo; si no, la siguiente pendiente.
export function fitbitSession(kind, planned, done) {
  if (kind === "run") return done.includes("d3") ? null : "d3";
  if (kind !== "strength") return null;
  if (planned && STRENGTH_ORDER.includes(planned) && !done.includes(planned)) return planned;
  return STRENGTH_ORDER.find((r) => !done.includes(r)) || null;
}

export function weekState(weekPlan, log, mk, workouts) {
  const keys = Array.from({ length: 7 }, (_, i) => dkey(addDays(fromKey(mk), i)));
  const stored = (weekPlan || {})[mk];
  const lastKey = Object.keys(weekPlan || {}).filter((k) => k <= mk && weekPlan[k] && weekPlan[k].office).sort().pop();
  const office = (stored && stored.office) || (lastKey && weekPlan[lastKey].office) || DEFAULT_OFFICE;
  const night = (stored && Array.isArray(stored.night) && stored.night) || Array(7).fill(false); // las cancelaciones no se heredan de otra semana
  const fixed = {};
  keys.forEach((k, i) => { if (log[k]) fixed[i] = log[k].r; });
  const fit = fitbitWeek(workouts, keys);
  const effort = fit.map((f) => !!(f && f.effort));
  const fromFitbit = {};
  fit.forEach((f, i) => {
    if (!f || !f.session || fixed[i]) return;
    const planned = stored && Array.isArray(stored.plan) ? stored.plan[i] : null;
    const r = fitbitSession(f.session.kind, planned, Object.values(fixed));
    if (r) { fixed[i] = r; fromFitbit[i] = r; }
  });
  let arr;
  if (stored && Array.isArray(stored.plan)) {
    const done = Object.values(fixed);
    arr = stored.plan.map((r, i) => (r && !fixed[i] && !done.includes(r) ? r : null));
    Object.keys(fixed).forEach((i) => { arr[i] = fixed[i]; });
  } else arr = rankPlans(office, fixed, 0, night, effort)[0].arr;
  return { keys, office, night, fixed, arr, fit, effort, fromFitbit };
}

export function useWeekPlan(log) {
  const [weekPlan, setWeekPlan] = usePersisted("weekPlan", {});
  const [workouts] = usePersisted("workouts", []); // de Fitbit; solo lectura
  const today = dkey();
  const mk = dkey(mondayOf(new Date()));
  const todayIdx = dayDiff(today, mk);
  const ws = useMemo(() => weekState(weekPlan, log, mk, workouts), [weekPlan, log, mk, workouts]);

  const save = (all, office, plan, night) => pruneDays({ ...(all || {}), [mk]: { office, plan, night } }, 8);
  // Reacomodar: recoloca lo pendiente de hoy en adelante y, en cada toque, pasa a la siguiente mejor opción.
  const shuffle = () => setWeekPlan((all) => {
    const cur = weekState(all, log, mk, workouts);
    const ranked = rankPlans(cur.office, cur.fixed, todayIdx, cur.night, cur.effort);
    const ok = ranked.filter((p) => p.score < 1000);
    const pool = (ok.length ? ok : ranked).slice(0, 6);
    const idx = pool.findIndex((p) => p.arr.join() === cur.arr.join());
    return save(all, cur.office, pool[(idx + 1) % pool.length].arr, cur.night);
  });
  const toggleOffice = (i) => setWeekPlan((all) => {
    const cur = weekState(all, log, mk, workouts);
    const office = cur.office.map((v, k) => (k === i ? !v : v));
    return save(all, office, rankPlans(office, cur.fixed, todayIdx, cur.night, cur.effort)[0].arr, cur.night);
  });
  const toggleNight = (i) => setWeekPlan((all) => {
    const cur = weekState(all, log, mk, workouts);
    const night = cur.night.map((v, k) => (k === i ? !v : v));
    return save(all, cur.office, rankPlans(cur.office, cur.fixed, todayIdx, night, cur.effort)[0].arr, night);
  });
  const info = (dateKey) => {
    const m = dkey(mondayOf(fromKey(dateKey)));
    const w = m === mk ? ws : weekState(weekPlan, log, m, workouts);
    const i = dayDiff(dateKey, m);
    const rid = w.arr[i] || null;
    const evening = !!rid && isEvening(w.office, w.night, i);
    return { date: dateKey, office: !!w.office[i], night: !!w.night[i], rid, evening, wake: rid && !evening ? "6:30" : "7:00" };
  };
  const nextRid = ws.arr.slice(todayIdx).find((r, k) => r && !ws.fixed[todayIdx + k]) || null;
  const late = ws.arr.some((r, i) => r && i < todayIdx && !ws.fixed[i]);
  return { ...ws, todayIdx, shuffle, toggleOffice, toggleNight, info, nextRid, late };
}

export function computeStreak(log) {
  const keys = Object.keys(log || {}).sort().reverse();
  if (!keys.length) return 0;
  if (dayDiff(dkey(), keys[0]) > 3) return 0;
  let n = 1;
  for (let i = 1; i < keys.length; i++) {
    if (dayDiff(keys[i - 1], keys[i]) <= 3) n++;
    else break;
  }
  return n;
}
