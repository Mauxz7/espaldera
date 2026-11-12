import test from "node:test";
import assert from "node:assert/strict";
import { parseHealth, SAMPLE_EMAIL } from "../src/lib/health.js";

test("lee el correo semanal de Google Health", () => {
  const w = parseHealth(SAMPLE_EMAIL);
  assert.equal(w.totalSteps, 42000);
  assert.equal(w.avgSteps, 6000);
  assert.equal(w.bestSteps, 9000);
  assert.equal(w.floors, 40);
  assert.equal(w.distanceKm, 30);
  assert.equal(w.azmTotal, 300);
  assert.equal(w.sleepAvgMin, 450);
  assert.equal(w.restingHr, 55);
  assert.equal(w.weightKg, 70);
  assert.equal(w.bestDay, 4); // viernes: el día que falta en la fila
  assert.match(w.weekStart, /^\d{4}-01-03$/);
});
