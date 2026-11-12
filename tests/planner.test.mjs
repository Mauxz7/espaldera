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
