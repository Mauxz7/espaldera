import test from "node:test";
import assert from "node:assert/strict";
import { rankPlans, scorePlan, MAIN, computeStreak } from "../src/lib/planner.js";

const OFFICE = [true, false, true, true, true, false, false]; // Lun…Dom
const NONE = Array(7).fill(false);
const valid = (plans) => plans.filter((p) => p.score < 900);

test("coloca las cuatro sesiones", () => {
  const best = rankPlans(OFFICE, {}, 0, NONE)[0].arr;
  for (const m of MAIN) assert.ok(best.includes(m), `falta ${m}`);
});

test("running nunca va el día después de pierna", () => {
  for (const office of [OFFICE, NONE, Array(7).fill(true)]) {
    for (const p of valid(rankPlans(office, {}, 0, NONE))) {
      p.arr.forEach((r, i) => assert.ok(!(r === "d3" && p.arr[i - 1] === "d2"), p.arr.join()));
    }
  }
});

test("una noche libre en día de oficina se aprovecha", () => {
  const night = [true, false, false, false, false, false, false];
  assert.ok(rankPlans(OFFICE, {}, 0, night)[0].arr[0], "el lunes debería tener sesión");
});

test("respeta lo ya registrado y solo planifica de hoy en adelante", () => {
  const best = rankPlans(OFFICE, { 1: "d2" }, 2, NONE)[0].arr;
  assert.equal(best[1], "d2");
  assert.equal(best[0], null);
  assert.equal(best.filter((r) => r === "d2").length, 1);
});

test("entrenar en día de oficina penaliza", () => {
  const home = scorePlan(["d1", null, null, null, null, null, null], NONE, NONE);
  const office = scorePlan(["d1", null, null, null, null, null, null], [true, false, false, false, false, false, false], NONE);
  assert.ok(office > home);
});

// N2 · entrenos de Fitbit en el plan semanal
import { weekState, fitbitWeek, fitbitSession, FIT_SESSION_MIN } from "../src/lib/planner.js";

const MK = "2026-11-09"; // lunes
const at = (day, h, kind, min, type = "Entreno") => ({ id: `${day}-${kind}`, kind, min, type, start: new Date(2026, 10, day, h, 0).toISOString() });

test("fitbitWeek agrupa por día local y distingue sesión de esfuerzo", () => {
  const keys = Array.from({ length: 7 }, (_, i) => `2026-11-${String(9 + i).padStart(2, "0")}`);
  const fit = fitbitWeek([at(9, 7, "strength", 45, "Fuerza"), at(10, 18, "other", 60, "Racket sports"), at(11, 7, "walk", 15), at(20, 7, "run", 30)], keys);
  assert.equal(fit[0].session.kind, "strength");
  assert.equal(fit[1].session, null);
  assert.equal(fit[1].effort, true);
  assert.equal(fit[2].effort, false);
  assert.ok(fit.slice(3).every((f) => f === null), "un entreno de otra semana no cuenta");
  assert.equal(fitbitWeek([at(9, 7, "strength", FIT_SESSION_MIN - 1)], keys)[0].session, null);
});

test("fitbitSession usa la sesión planeada del mismo tipo o la siguiente pendiente", () => {
  assert.equal(fitbitSession("strength", "d2", []), "d2");
  assert.equal(fitbitSession("strength", "d3", []), "d1");
  assert.equal(fitbitSession("strength", null, ["d1"]), "d4");
  assert.equal(fitbitSession("run", "d1", []), "d3");
  assert.equal(fitbitSession("run", null, ["d3"]), null);
  assert.equal(fitbitSession("other", "d1", []), null);
  assert.equal(fitbitSession("strength", null, ["d1", "d2", "d4"]), null);
});

test("un entreno de fuerza en Fitbit cuenta como la sesión planeada y no se vuelve a planear", () => {
  const weekPlan = { [MK]: { office: NONE, night: NONE, plan: ["d1", null, "d3", null, "d2", "d4", null] } };
  const ws = weekState(weekPlan, {}, MK, [at(9, 7, "strength", 40, "Fuerza")]);
  assert.equal(ws.fixed[0], "d1");
  assert.equal(ws.fromFitbit[0], "d1");
  assert.equal(ws.arr.filter((r) => r === "d1").length, 1);
});

test("lo marcado en Espaldera tiene prioridad sobre Fitbit", () => {
  const ws = weekState({}, { "2026-11-09": { r: "d4" } }, MK, [at(9, 7, "strength", 40)]);
  assert.equal(ws.fixed[0], "d4");
  assert.equal(ws.fromFitbit[0], undefined);
});

test("después de raqueta o fútbol no se pone pierna al día siguiente", () => {
  const sport = [at(13, 18, "other", 60, "Racket sports")]; // viernes
  const ws = weekState({}, {}, MK, sport);
  assert.equal(ws.effort[4], true);
  const fixed = { 0: "d1", 2: "d3", 3: "d4" };
  assert.equal(rankPlans(NONE, fixed, 5, NONE)[0].arr[5], "d2", "sin Fitbit, pierna caería el sábado");
  const best = rankPlans(NONE, fixed, 5, NONE, ws.effort)[0].arr;
  assert.notEqual(best[5], "d2", best.join());
  assert.equal(best[6], "d2", "la pierna se mueve al domingo");
});

// Continuidad entre semanas: el lunes se planea sabiendo lo del sábado y el domingo.
import { weekTail } from "../src/lib/planner.js";

const HOME = Array(7).fill(false);
const mon = (r) => [r, null, null, null, null, null, null];

test("scorePlan con la cola: nunca correr el lunes después de pierna el domingo", () => {
  assert.ok(scorePlan(mon("d3"), HOME, HOME, null, null, { r1: "d2" }) >= 1000);
  assert.ok(scorePlan(mon("d3"), HOME, HOME, null, null, null) < 1000);
});

test("scorePlan con la cola: deporte fuerte el domingo pesa sobre pierna el lunes; sábado+domingo+lunes = tres seguidos", () => {
  const base = scorePlan(mon("d2"), HOME, HOME, null, null, null);
  assert.equal(scorePlan(mon("d2"), HOME, HOME, null, null, { effort1: true }) - base, 10);
  const two = scorePlan(mon("d1"), HOME, HOME, null, null, { r1: "d4" });
  const three = scorePlan(mon("d1"), HOME, HOME, null, null, { r1: "d4", r2: "d2" });
  assert.equal(three - two, 8);
});

test("weekTail: lo registrado manda; lo planeado solo cuenta si ese día aún no pasa", () => {
  const plan = { "2026-11-09": { office: HOME, night: HOME, plan: [null, null, null, null, null, "d1", "d2"] } };
  assert.equal(weekTail(plan, {}, "2026-11-16", [], null, "2026-11-15").r1, "d2"); // domingo: vista previa con lo planeado
  assert.equal(weekTail(plan, {}, "2026-11-16", [], null, "2026-11-16").r1, null); // lunes: el domingo pasó sin entreno
  assert.equal(weekTail(plan, { "2026-11-15": { r: "d4" } }, "2026-11-16", [], null, "2026-11-16").r1, "d4");
});

test("weekState: el lunes que sigue a pierna del domingo no es running", () => {
  const ws = weekState({}, { "2026-11-15": { r: "d2" } }, "2026-11-16", [], null, { today: "2026-11-15" });
  assert.equal(ws.tail.r1, "d2");
  assert.notEqual(ws.arr[0], "d3");
});

// Integración Bevel en planner.js (100% retrocompatible + ajustes por recuperación)
import { applyBevelAdjustment, normalizeBevelSignal } from "../src/lib/planner.js";

test("retrocompatibilidad: sin datos Bevel, scorePlan, rankPlans y weekState devuelven exactamente lo mismo", () => {
  const plan = { [MK]: { office: OFFICE, night: NONE, plan: ["d1", "d2", null, "d3", null, "d4", null] } };
  const a = weekState(plan, {}, MK, [], null, { today: "2026-11-10" });
  const b = weekState(plan, {}, MK, [], null, { today: "2026-11-10", bevel: null });
  assert.deepEqual(a.arr, b.arr);
  assert.equal(a.bevelAdjustment, null);
  assert.equal(normalizeBevelSignal(null), null);
});

test("Bevel recuperación baja (<=33%): cambia sesión exigente de hoy a 'low' y reacomoda la sesión pendiente", () => {
  // Semana del lunes 2026-11-09; hoy es martes 2026-11-10 con d2 planeada y lunes d1 ya completado.
  const weekPlan = { [MK]: { office: HOME, night: HOME, plan: ["d1", "d2", null, "d3", null, "d4", null] } };
  const log = { "2026-11-09": { r: "d1" } };
  const bevelDay = {
    date: "2026-11-10",
    recovery: { score: 25, zone: "low", alert: null },
    strain: { score: 10, target: { min: 15, max: 35, label: "Suave" } },
  };
  const ws = weekState(weekPlan, log, MK, [], null, { today: "2026-11-10", bevelDay });
  assert.equal(ws.arr[0], "d1", "la sesión completada del lunes no se toca");
  assert.equal(ws.arr[1], "low", "hoy pasa a Modo Baja Energía");
  assert.ok(ws.arr.slice(2).includes("d2"), "d2 se reacomoda en el resto de la semana");
  assert.ok(ws.arr.slice(2).includes("d3"), "d3 sigue en la semana");
  assert.ok(ws.arr.slice(2).includes("d4"), "d4 sigue en la semana");
  // Nunca running el día después de pierna
  ws.arr.forEach((r, i) => assert.ok(!(r === "d3" && ws.arr[i - 1] === "d2"), ws.arr.join()));
  assert.equal(ws.bevelAdjustment.applied, true);
  assert.equal(ws.bevelAdjustment.originalCode, "d2");
  assert.equal(ws.bevelAdjustment.recommendedCode, "low");
  assert.equal(ws.bevelAdjustment.zone, "low");
  assert.equal(ws.bevelAdjustment.recoveryScore, 25);
  assert.ok(ws.bevelAdjustment.movedToDate > "2026-11-10");
  assert.match(ws.bevelAdjustment.reason, /Baja Energía/i);
});

test("Bevel biometrics_off: cambia sesión exigente a descanso activo (null) y reacomoda la sesión", () => {
  const weekPlan = { [MK]: { office: HOME, night: HOME, plan: ["d1", "d2", null, "d3", null, "d4", null] } };
  const bevelDay = {
    date: "2026-11-10",
    recovery: { score: 48, zone: "mid", alert: "biometrics_off" },
    strain: { score: 0, target: { min: 15, max: 35, label: "Suave" } },
  };
  const ws = weekState(weekPlan, { "2026-11-09": { r: "d1" } }, MK, [], null, { today: "2026-11-10", bevelDay });
  assert.equal(ws.arr[1], null);
  assert.equal(ws.bevelAdjustment.applied, true);
  assert.equal(ws.bevelAdjustment.action, "rest");
  assert.equal(ws.bevelAdjustment.originalCode, "d2");
  assert.ok(ws.arr.slice(2).includes("d2"));
});

test("Bevel nunca sobrescribe una sesión ya completada en log o Fitbit", () => {
  const weekPlan = { [MK]: { office: HOME, night: HOME, plan: ["d1", "d2", null, "d3", null, "d4", null] } };
  const lowBevel = { recovery: { score: 20, zone: "low", alert: null }, strain: { target: { min: 15, max: 35, label: "Suave" } } };

  // Completada en log
  const wsLog = weekState(weekPlan, { "2026-11-10": { r: "d2" } }, MK, [], null, { today: "2026-11-10", bevelDay: lowBevel });
  assert.equal(wsLog.arr[1], "d2");
  assert.equal(wsLog.bevelAdjustment.applied, false);

  // Completada en Fitbit
  const wsFit = weekState(weekPlan, {}, MK, [at(10, 7, "strength", 40, "Fuerza")], null, { today: "2026-11-10", bevelDay: lowBevel });
  assert.equal(wsFit.arr[1], "d2");
  assert.equal(wsFit.fromFitbit[1], "d2");
  assert.equal(wsFit.bevelAdjustment.applied, false);
});

test("Bevel recuperación media (34–66%): separa días exigentes seguidos si hay margen o sugiere controlar RIR", () => {
  // Lunes d1 ya hecho; martes (hoy) tiene d2 pegado a lunes, con miércoles..domingo libres para separar
  const weekPlan = { [MK]: { office: HOME, night: HOME, plan: ["d1", "d2", null, "d3", null, "d4", null] } };
  const midBevel = {
    recovery: { score: 52, zone: "mid", alert: null },
    strain: { score: 15, target: { min: 35, max: 60, label: "Moderado" } },
  };
  const ws = weekState(weekPlan, { "2026-11-09": { r: "d1" } }, MK, [], null, { today: "2026-11-10", bevelDay: midBevel });
  assert.equal(ws.arr[0], "d1");
  assert.equal(ws.arr[1], null, "separa martes del lunes ya hecho cuando hay margen");
  assert.equal(ws.bevelAdjustment.applied, true);
  assert.equal(ws.bevelAdjustment.action, "unstack");
  for (const m of MAIN) assert.ok(ws.arr.includes(m), `no pierde ${m}`);

  // Cuando no está apilado (lunes libre, martes d2, miércoles libre): mantiene sesión y da guía de RIR/Target Strain
  const spacedPlan = { [MK]: { office: HOME, night: HOME, plan: [null, "d2", null, "d3", null, "d4", "d1"] } };
  const wsKeep = weekState(spacedPlan, {}, MK, [], null, { today: "2026-11-10", bevelDay: midBevel });
  assert.equal(wsKeep.arr[1], "d2");
  assert.equal(wsKeep.bevelAdjustment.applied, false);
  assert.equal(wsKeep.bevelAdjustment.action, "control_effort");
  assert.match(wsKeep.bevelAdjustment.reason, /RIR/i);
});

test("Bevel recuperación alta (67–100%): favorece sesión diferida o de mayor carga respetando exámenes de calendario", () => {
  // Lunes d2 se saltó/quedó atrás (!fixed[0]) y martes (hoy) era descanso; con recuperación alta adelanta d2 a hoy
  const weekPlan = { [MK]: { office: HOME, night: HOME, plan: ["d2", null, null, "d3", null, "d4", "d1"] } };
  const highBevel = {
    recovery: { score: 86, zone: "high", alert: null },
    strain: { score: 5, target: { min: 60, max: 85, label: "Óptimo" } },
  };
  const ws = weekState(weekPlan, {}, MK, [], null, { today: "2026-11-10", bevelDay: highBevel });
  assert.ok(MAIN.includes(ws.arr[1]), "aprovecha recuperación alta para recuperar sesión diferida");
  assert.equal(ws.bevelAdjustment.applied, true);
  assert.equal(ws.bevelAdjustment.action, "prioritize");

  // Con examen hoy en calBusy, NO mete una sesión exigente en un día de descanso por recuperación alta
  const calBusy = { days: { "2026-11-10": { exam: "Parcial", nightBusy: true } } };
  const wsExam = weekState(weekPlan, {}, MK, [], calBusy, { today: "2026-11-10", bevelDay: highBevel });
  assert.equal(wsExam.arr[1], null);
  assert.equal(wsExam.bevelAdjustment.applied, false);
});

test("applyBevelAdjustment ignora semanas que no contienen today", () => {
  const res = applyBevelAdjustment({
    arr: ["d1", null, "d2", null, "d3", "d4", null],
    keys: ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"],
    office: HOME,
    night: HOME,
    fixed: {},
    effort: Array(7).fill(false),
    exam: Array(7).fill(false),
    tail: null,
    todayIdx: -1,
    bevel: { recovery: { score: 20, zone: "low" } },
  });
  assert.equal(res.bevelAdjustment, null);
  assert.deepEqual(res.arr, ["d1", null, "d2", null, "d3", "d4", null]);
});

test("Bevel acepta el historial completo { byDate, today }, domingo sin huecos y recuperación alta intercambia d1 por d2", () => {
  // Domingo (último día de la semana) con recuperación baja: pasa a 'low' y pospone d4 sin romper nada
  const sunPlan = { [MK]: { office: HOME, night: HOME, plan: ["d1", null, "d2", null, "d3", null, "d4"] } };
  const sunLog = { "2026-11-09": { r: "d1" }, "2026-11-11": { r: "d2" }, "2026-11-13": { r: "d3" } };
  const bevelHistory = {
    byDate: {
      "2026-11-15": {
        date: "2026-11-15",
        recovery: { score: 22, zone: "low", alert: null },
        strain: { score: 5, target: { min: 15, max: 35, label: "Suave" } },
      },
    },
    today: null,
  };
  const wsSun = weekState(sunPlan, sunLog, MK, [], null, { today: "2026-11-15", bevel: bevelHistory });
  assert.equal(wsSun.arr[6], "low");
  assert.equal(wsSun.bevelAdjustment.applied, true);
  assert.equal(wsSun.bevelAdjustment.movedToDate, null);

  // Recuperación alta cuando hoy tenía d1 (menor carga) y más adelante hay d2: prioriza d2 hoy sin romper reglas
  const lightTodayPlan = { [MK]: { office: HOME, night: HOME, plan: ["d1", null, "d2", null, "d3", null, "d4"] } };
  const highBevel = { recovery: { score: 90, zone: "high", alert: null }, strain: { target: { min: 60, max: 85, label: "Óptimo" } } };
  const wsHigh = weekState(lightTodayPlan, {}, MK, [], null, { today: "2026-11-09", bevelDay: highBevel });
  assert.equal(wsHigh.arr[0], "d2");
  assert.equal(wsHigh.bevelAdjustment.applied, true);
  assert.equal(wsHigh.bevelAdjustment.originalCode, "d1");
  assert.equal(wsHigh.bevelAdjustment.recommendedCode, "d2");
  wsHigh.arr.forEach((r, i) => assert.ok(!(r === "d3" && wsHigh.arr[i - 1] === "d2"), wsHigh.arr.join()));
});

test("computeStreak incluye días con entreno libre en setLog", () => {
  const now = new Date();
  const fmt = (daysAgo) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  const log = { [fmt(4)]: { r: "d1" } };
  const setLog = { [fmt(1)]: { free: { lib_trx_curl: [{ reps: 12, load: "10 kg" }] } } };
  assert.equal(computeStreak(log, setLog), 2);
});
