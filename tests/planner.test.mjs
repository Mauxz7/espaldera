import test from "node:test";
import assert from "node:assert/strict";
import { rankPlans, scorePlan, MAIN } from "../src/lib/planner.js";

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
