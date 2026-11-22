import { useMemo } from "react";
import { usePersisted } from "./storage.js";
import { dkey, fromKey, addDays, mondayOf, dayDiff, pruneDays, DAYS_LONG } from "./dates.js";
import { routineById } from "../data/program.js";
import { calNight, calExamSoon } from "./calendar.js";
import { hasFreeWorkout } from "./metrics.js";

export const MAIN = ["d1", "d2", "d3", "d4"];

export const TAG = { d1: "TOR", d2: "PIE", d3: "RUN", d4: "FUL", low: "RES" };

export const DEFAULT_OFFICE = [true, false, true, true, true, false, false]; // Lun…Dom: true = voy a la oficina

// Prioridad de carga para favorecer sesiones exigentes cuando la recuperación es alta.
const SESSION_PRIORITY = { d2: 4, d4: 3, d3: 2, d1: 1 };

export function normalizeBevelSignal(bevelInput, dateKey = null) {
  if (!bevelInput || typeof bevelInput !== "object") return null;
  const day = bevelInput.byDate && typeof bevelInput.byDate === "object"
    ? ((dateKey && bevelInput.byDate[dateKey]) || bevelInput.today || null)
    : bevelInput;
  if (!day || typeof day !== "object") return null;

  const rec = day.recovery && typeof day.recovery === "object" ? day.recovery : null;
  if (!rec) return null;
  const hasScore = typeof rec.score === "number" && Number.isFinite(rec.score);
  const biometricsOff = rec.alert === "biometrics_off";
  if (!hasScore && !rec.zone && !biometricsOff) return null;

  const recoveryScore = hasScore ? Math.round(rec.score) : null;
  let zone = rec.zone || null;
  if (biometricsOff || (recoveryScore != null && recoveryScore <= 33)) zone = "low";
  else if (!zone && recoveryScore != null) zone = recoveryScore >= 67 ? "high" : "mid";
  if (!zone) return null;

  const strain = day.strain && typeof day.strain === "object" ? day.strain : null;
  const targetStrain = strain && strain.target && typeof strain.target === "object"
    ? { min: strain.target.min, max: strain.target.max, label: strain.target.label }
    : zone === "high"
      ? { min: 60, max: 85, label: "Óptimo" }
      : zone === "mid"
        ? { min: 35, max: 60, label: "Moderado" }
        : { min: 15, max: 35, label: "Suave" };

  return {
    recoveryScore,
    zone,
    biometricsOff,
    alert: rec.alert || null,
    strainScore: strain && typeof strain.score === "number" && Number.isFinite(strain.score) ? strain.score : null,
    targetStrain,
  };
}

// Puntaje de una semana (menor es mejor). arr[i] = rutina del día i o null.
// Un día de oficina con la noche libre (sin clase) se entrena de noche: no compite con la mañana corta.
export const isEvening = (office, night, i) => !!(night && night[i] && office[i]);

// tail: los dos últimos días de la semana anterior ({ r1: domingo, r2: sábado, effort1, eve1 }).
// Así el lunes no se planea «en blanco»: si el domingo hubo pierna o deporte fuerte, cuenta como el día anterior.
// bevelOpts (opcional): { todayIdx, zone, biometricsOff } para modular la puntuación de hoy según recuperación.
export function scorePlan(arr, office, night, effort, exam, tail, bevelOpts = null) {
  const t = tail || {};
  const P = (j) => (j >= 0 ? arr[j] : j === -1 ? t.r1 || null : j === -2 ? t.r2 || null : null);
  const E = (j) => (j >= 0 ? !!(effort && effort[j]) : j === -1 ? !!t.effort1 : false);
  const V = (j) => (j >= 0 ? isEvening(office, night, j) : j === -1 ? !!t.eve1 : false);
  let s = 0;
  for (let i = 0; i < 7; i++) {
    const r = arr[i];
    if (!r) continue;
    const prev = P(i - 1);
    const eve = isEvening(office, night, i);
    if (eve) s -= 8; // marcaste esa noche libre para entrenar: se aprovecha
    if (prev && V(i - 1) && !eve) s += office[i] ? 6 : 3; // de noche y otra vez al amanecer: poca recuperación (en casa puedes empezar más tarde)
    if (office[i] && !eve) s += 6 + Math.max(0, routineById(r).minutes - 35) * 0.4; // mañana corta: mejor descansar o sesión breve
    if (i === 6) s += 3; // el domingo se prefiere libre
    if (exam && exam[i]) s += r === "d2" || r === "d4" ? 8 : 4; // examen o entrega hoy o mañana (Google Calendar): mejor descanso o algo liviano
    if (E(i - 1) && !prev) {
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
      if (P(i - 2)) s += 8; // tres días seguidos
    }
  }
  if (bevelOpts && typeof bevelOpts.todayIdx === "number" && bevelOpts.todayIdx >= 0 && bevelOpts.todayIdx < 7) {
    const ti = bevelOpts.todayIdx;
    const r = arr[ti];
    if (r && MAIN.includes(r)) {
      if (bevelOpts.zone === "low" || bevelOpts.biometricsOff) {
        s += r === "d2" || r === "d4" ? 25 : r === "d3" ? 20 : 18;
      } else if (bevelOpts.zone === "mid") {
        const prevHeavy = !!(P(ti - 1) && MAIN.includes(P(ti - 1))) || E(ti - 1);
        const nextHeavy = ti < 6 && !!(arr[ti + 1] && MAIN.includes(arr[ti + 1]));
        if (prevHeavy) s += r === "d2" || r === "d4" ? 12 : 8;
        if (nextHeavy) s += 8;
      } else if (bevelOpts.zone === "high") {
        s -= r === "d2" || r === "d4" ? 6 : 3;
      }
    }
  }
  s += MAIN.filter((m) => !arr.includes(m)).length * 100; // sesión que no cabe
  return s;
}

// Todas las formas de colocar las sesiones pendientes en los días libres desde fromIdx, de mejor a peor.
export function rankPlans(office, fixed, fromIdx, night, effort, exam, tail, bevelOpts = null) {
  const done = Object.values(fixed);
  const left = MAIN.filter((m) => !done.includes(m));
  const free = [];
  for (let i = fromIdx; i < 7; i++) if (!fixed[i]) free.push(i);
  const base = Array(7).fill(null);
  Object.keys(fixed).forEach((i) => { base[i] = fixed[i]; });
  const out = [];
  const rec = (si, arr) => {
    if (si === left.length) { out.push({ arr: arr.slice(), score: scorePlan(arr, office, night, effort, exam, tail, bevelOpts) }); return; }
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

// Cola de la semana anterior: lo hecho (registro o Fitbit) en sábado y domingo; si esos días todavía no
// pasan (vista previa desde el fin de semana), lo planeado. Un día que ya pasó sin entreno cuenta como descanso.
export function weekTail(weekPlan, log, mk, workouts, calBusy, today = dkey()) {
  const prevMk = dkey(addDays(fromKey(mk), -7));
  const pw = weekState(weekPlan, log, prevMk, workouts, calBusy, { noTail: true });
  const pick = (i) => (pw.fixed[i] || (pw.keys[i] >= today ? pw.arr[i] : null)) || null;
  const r1 = pick(6);
  return { r1, r2: pick(5), effort1: !!pw.effort[6], eve1: !!r1 && isEvening(pw.office, pw.night, 6) };
}

function pickBestValid(ranked) {
  return ranked.find((p) => p.score < 900) || ranked[0] || null;
}

function countMain(arr) {
  return (arr || []).filter((r) => MAIN.includes(r)).length;
}

function hasBackToBackAt(arr, idx, effort, tail) {
  const cur = arr[idx];
  if (!cur || !MAIN.includes(cur)) return false;
  const prevR = idx > 0 ? arr[idx - 1] : (tail && tail.r1) || null;
  const prevE = idx > 0 ? !!(effort && effort[idx - 1]) : !!(tail && tail.effort1);
  const nextR = idx < 6 ? arr[idx + 1] : null;
  const prevHeavy = !!(prevR && MAIN.includes(prevR)) || prevE;
  const nextHeavy = !!(nextR && MAIN.includes(nextR));
  return prevHeavy || nextHeavy;
}

/**
 * Aplica ajuste opcional basado en el estado Bevel del día (`recovery` y `strain`)
 * sobre el plan de la semana en curso sin sobrescribir sesiones ya completadas ni romper reglas de calendario.
 */
export function applyBevelAdjustment({ arr, keys, office, night, fixed, effort, exam, tail, todayIdx, bevel }) {
  const signal = normalizeBevelSignal(bevel, todayIdx >= 0 && todayIdx < 7 ? keys[todayIdx] : null);
  if (!signal || todayIdx < 0 || todayIdx > 6) {
    return { arr, bevelAdjustment: null };
  }

  const { recoveryScore, zone, biometricsOff, targetStrain } = signal;
  const baseMeta = { recoveryScore, zone, targetStrain, biometricsOff };
  const originalCode = arr[todayIdx] || null;

  // Nunca sobrescribir una sesión ya completada hoy (registro en Shift o entreno de Fitbit).
  if (fixed && fixed[todayIdx]) {
    return {
      arr,
      bevelAdjustment: {
        ...baseMeta,
        applied: false,
        action: "completed",
        originalCode,
        recommendedCode: originalCode,
        reason: "Ya completaste la sesión de hoy; mantenemos tu registro sin cambios.",
      },
    };
  }

  // 1. Recuperación baja (<= 33%) o biomarcadores fuera de rango (`biometrics_off`).
  if (zone === "low" || biometricsOff) {
    if (!originalCode || !MAIN.includes(originalCode)) {
      return {
        arr,
        bevelAdjustment: {
          ...baseMeta,
          applied: false,
          action: "keep_rest",
          originalCode,
          recommendedCode: originalCode,
          reason: biometricsOff
            ? "Tus señales biométricas están fuera de rango. Hoy toca descanso: prioriza hidratarte y dormir bien."
            : `Recuperación baja (${recoveryScore}%). Hoy ya toca descanso; aprovecha para recuperar.`,
        },
      };
    }

    const rescheduled = pickBestValid(rankPlans(office, fixed, todayIdx + 1, night, effort, exam, tail));
    const nextArr = rescheduled ? rescheduled.arr.slice() : arr.slice();
    const recommendedCode = biometricsOff ? null : "low";
    nextArr[todayIdx] = recommendedCode;

    const movedToIdx = nextArr.findIndex((r, idx) => idx > todayIdx && r === originalCode);
    const movedToDate = movedToIdx > todayIdx ? keys[movedToIdx] : null;
    const origName = routineById(originalCode).name;
    const movedText = movedToIdx > todayIdx
      ? ` y movimos ${origName} al ${DAYS_LONG[movedToIdx].toLowerCase()}`
      : ` y pospusimos ${origName} para más adelante`;

    const reason = biometricsOff
      ? `Señales biométricas fuera de rango${recoveryScore != null ? ` (recuperación ${recoveryScore}%)` : ""}. Cambiamos hoy por descanso activo${movedText}.`
      : `Recuperación baja (${recoveryScore}%). Adaptamos hoy a Modo Baja Energía${movedText}.`;

    return {
      arr: nextArr,
      bevelAdjustment: {
        ...baseMeta,
        applied: true,
        action: biometricsOff ? "rest" : "swap_low",
        originalCode,
        recommendedCode,
        movedToIdx: movedToIdx > todayIdx ? movedToIdx : null,
        movedToDate,
        reason,
      },
    };
  }

  // 2. Recuperación media (34–66%): mantener sesiones clave, evitar apilar días exigentes seguidos si hay margen.
  if (zone === "mid") {
    if (!originalCode || !MAIN.includes(originalCode)) {
      return {
        arr,
        bevelAdjustment: {
          ...baseMeta,
          applied: false,
          action: "keep_rest",
          originalCode,
          recommendedCode: originalCode,
          reason: `Recuperación media (${recoveryScore}%). Hoy toca descanso; aprovecha para recargar.`,
        },
      };
    }

    const guidance = targetStrain
      ? `Controla el RIR y mantén tu Strain entre ${targetStrain.min} y ${targetStrain.max}%.`
      : "Controla el RIR y evita entrenar al fallo.";

    if (hasBackToBackAt(arr, todayIdx, effort, tail)) {
      const bevelOpts = { todayIdx, zone: "mid", biometricsOff: false };
      const ranked = rankPlans(office, fixed, todayIdx, night, effort, exam, tail, bevelOpts);
      const curMain = countMain(arr);
      const cand = ranked.find((p) => (
        p.score < 900
        && countMain(p.arr) >= curMain
        && !hasBackToBackAt(p.arr, todayIdx, effort, tail)
      ));

      if (cand && cand.arr.join() !== arr.join()) {
        const nextArr = cand.arr.slice();
        const movedToIdx = nextArr.findIndex((r, idx) => idx > todayIdx && r === originalCode);
        const recommendedCode = nextArr[todayIdx] || null;
        return {
          arr: nextArr,
          bevelAdjustment: {
            ...baseMeta,
            applied: true,
            action: "unstack",
            originalCode,
            recommendedCode,
            movedToIdx: movedToIdx > todayIdx ? movedToIdx : null,
            movedToDate: movedToIdx > todayIdx ? keys[movedToIdx] : null,
            reason: `Recuperación media (${recoveryScore}%). Separamos días exigentes seguidos para repartir mejor la carga sin perder sesiones.`,
            guidance,
          },
        };
      }
    }

    return {
      arr,
      bevelAdjustment: {
        ...baseMeta,
        applied: false,
        action: "control_effort",
        originalCode,
        recommendedCode: originalCode,
        reason: `Recuperación media (${recoveryScore}%). Mantén ${routineById(originalCode).name} cuidando la intensidad. ${guidance}`,
        guidance,
      },
    };
  }

  // 3. Recuperación alta (67–100%): favorecer sesión de mayor prioridad/carga si había una diferida o una más exigente pendiente.
  const hasDeferred = arr.some((r, i) => r && MAIN.includes(r) && i < todayIdx && !fixed[i])
    || MAIN.some((m) => !arr.includes(m) && !Object.values(fixed || {}).includes(m));
  const todayPrio = originalCode ? (SESSION_PRIORITY[originalCode] || 0) : 0;
  const hasHigherLater = arr.some((r, i) => i > todayIdx && !fixed[i] && (SESSION_PRIORITY[r] || 0) > todayPrio);

  if ((hasDeferred || (originalCode && hasHigherLater)) && !(exam && exam[todayIdx] && !originalCode)) {
    const bevelOpts = { todayIdx, zone: "high", biometricsOff: false };
    const curScore = scorePlan(arr, office, night, effort, exam, tail, bevelOpts);
    const curMain = countMain(arr);
    const ranked = rankPlans(office, fixed, todayIdx, night, effort, exam, tail, bevelOpts);
    const cand = ranked.find((p) => {
      if (p.score >= 900 || countMain(p.arr) < curMain) return false;
      const candToday = p.arr[todayIdx];
      if (!candToday || !MAIN.includes(candToday)) return false;
      if (hasDeferred && !originalCode) return true;
      return (SESSION_PRIORITY[candToday] || 0) > todayPrio && p.score <= curScore;
    });

    if (cand && cand.arr.join() !== arr.join()) {
      const nextArr = cand.arr.slice();
      const recommendedCode = nextArr[todayIdx];
      return {
        arr: nextArr,
        bevelAdjustment: {
          ...baseMeta,
          applied: true,
          action: "prioritize",
          originalCode,
          recommendedCode,
          reason: `Recuperación alta (${recoveryScore}%). Aprovechamos tu buen estado hoy para priorizar ${routineById(recommendedCode).name}.`,
        },
      };
    }
  }

  return {
    arr,
    bevelAdjustment: {
      ...baseMeta,
      applied: false,
      action: originalCode ? "ready_push" : "keep_rest",
      originalCode,
      recommendedCode: originalCode,
      reason: originalCode
        ? `Recuperación alta (${recoveryScore}%). Buen día para apretar en ${routineById(originalCode).name}${targetStrain ? ` (meta de Strain ${targetStrain.min}–${targetStrain.max}%)` : ""}.`
        : `Recuperación alta (${recoveryScore}%). Hoy tienes descanso programado.`,
    },
  };
}

export function weekState(weekPlan, log, mk, workouts, calBusy, opts = {}) {
  const keys = Array.from({ length: 7 }, (_, i) => dkey(addDays(fromKey(mk), i)));
  const stored = (weekPlan || {})[mk];
  const lastKey = Object.keys(weekPlan || {}).filter((k) => k <= mk && weekPlan[k] && weekPlan[k].office).sort().pop();
  const office = (stored && stored.office) || (lastKey && weekPlan[lastKey].office) || DEFAULT_OFFICE;
  // Noches: lo que marcaste esta semana manda; si no tocaste nada, se sugiere desde Google Calendar (sin datos = ocupada).
  // Las marcas no se heredan de otra semana.
  const night = (stored && Array.isArray(stored.night) && stored.night) || calNight(calBusy, keys);
  const exam = calExamSoon(calBusy, keys);
  const tail = opts.noTail ? null : weekTail(weekPlan, log, mk, workouts, calBusy, opts.today);
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
  } else arr = rankPlans(office, fixed, 0, night, effort, exam, tail)[0].arr;

  const bevelInput = opts.bevelDay || opts.bevel || null;
  let bevelAdjustment = null;
  if (bevelInput) {
    const today = opts.today || dkey();
    const todayIdx = keys.indexOf(today);
    const adjusted = applyBevelAdjustment({
      arr,
      keys,
      office,
      night,
      fixed,
      effort,
      exam,
      tail,
      todayIdx,
      bevel: bevelInput,
    });
    arr = adjusted.arr;
    bevelAdjustment = adjusted.bevelAdjustment;
  }

  return { keys, office, night, fixed, arr, fit, effort, fromFitbit, exam, tail, bevelAdjustment };
}

export function useWeekPlan(log, opts = {}) {
  const [weekPlan, setWeekPlan] = usePersisted("weekPlan", {});
  const [workouts] = usePersisted("workouts", []); // de Fitbit; solo lectura
  const [calBusy] = usePersisted("calBusy", null); // de Google Calendar; solo lectura
  const today = dkey();
  const mk = dkey(mondayOf(new Date()));
  const todayIdx = dayDiff(today, mk);
  const bevel = opts && typeof opts === "object" ? (opts.bevelDay || opts.bevel || (opts.recovery ? opts : null)) : null;
  const ws = useMemo(
    () => weekState(weekPlan, log, mk, workouts, calBusy, bevel ? { bevel, today } : {}),
    [weekPlan, log, mk, workouts, calBusy, bevel, today],
  );

  const save = (all, office, plan, night) => pruneDays({ ...(all || {}), [mk]: { office, plan, night } }, 8);
  // Reacomodar: recoloca lo pendiente de hoy en adelante y, en cada toque, pasa a la siguiente mejor opción.
  const shuffle = () => setWeekPlan((all) => {
    const cur = weekState(all, log, mk, workouts, calBusy);
    const ranked = rankPlans(cur.office, cur.fixed, todayIdx, cur.night, cur.effort, cur.exam, cur.tail);
    const ok = ranked.filter((p) => p.score < 1000);
    const pool = (ok.length ? ok : ranked).slice(0, 6);
    const idx = pool.findIndex((p) => p.arr.join() === cur.arr.join());
    return save(all, cur.office, pool[(idx + 1) % pool.length].arr, cur.night);
  });
  const toggleOffice = (i) => setWeekPlan((all) => {
    const cur = weekState(all, log, mk, workouts, calBusy);
    const office = cur.office.map((v, k) => (k === i ? !v : v));
    return save(all, office, rankPlans(office, cur.fixed, todayIdx, cur.night, cur.effort, cur.exam, cur.tail)[0].arr, cur.night);
  });
  const toggleNight = (i) => setWeekPlan((all) => {
    const cur = weekState(all, log, mk, workouts, calBusy);
    const night = cur.night.map((v, k) => (k === i ? !v : v));
    return save(all, cur.office, rankPlans(cur.office, cur.fixed, todayIdx, night, cur.effort, cur.exam, cur.tail)[0].arr, night);
  });
  const dayInfo = (w, m, dateKey) => {
    const i = dayDiff(dateKey, m);
    const rid = w.arr[i] || null;
    const evening = !!rid && isEvening(w.office, w.night, i);
    const base = { date: dateKey, office: !!w.office[i], night: !!w.night[i], rid, evening, wake: rid && !evening ? "6:30" : "7:00", exam: !!(w.exam && w.exam[i]) };
    if (dateKey === today && w.bevelAdjustment) base.bevelAdjustment = w.bevelAdjustment;
    return base;
  };
  const info = (dateKey) => {
    const m = dkey(mondayOf(fromKey(dateKey)));
    return dayInfo(m === mk ? ws : weekState(weekPlan, log, m, workouts, calBusy), m, dateKey);
  };
  // Próximos 14 días (para Google Calendar), calculando cada semana una sola vez.
  const upcoming = useMemo(() => {
    const cache = { [mk]: ws };
    return Array.from({ length: 14 }, (_, n) => {
      const k = dkey(addDays(fromKey(today), n));
      const m = dkey(mondayOf(fromKey(k)));
      if (!cache[m]) cache[m] = weekState(weekPlan, log, m, workouts, calBusy);
      return dayInfo(cache[m], m, k);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, today, weekPlan, log, workouts, calBusy]);
  const nextRid = ws.arr.slice(todayIdx).find((r, k) => r && !ws.fixed[todayIdx + k]) || null;
  const late = ws.arr.some((r, i) => r && i < todayIdx && !ws.fixed[i]);
  return { ...ws, todayIdx, shuffle, toggleOffice, toggleNight, info, nextRid, late, upcoming };
}

export function computeStreak(log, setLog = null) {
  const daySet = new Set(Object.keys(log || {}));
  for (const k of Object.keys(setLog || {})) {
    if (hasFreeWorkout(setLog, k)) daySet.add(k);
  }
  const keys = [...daySet].sort().reverse();
  if (!keys.length) return 0;
  if (dayDiff(dkey(), keys[0]) > 3) return 0;
  let n = 1;
  for (let i = 1; i < keys.length; i++) {
    if (dayDiff(keys[i - 1], keys[i]) <= 3) n++;
    else break;
  }
  return n;
}
