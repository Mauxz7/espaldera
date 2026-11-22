import test from "node:test";
import assert from "node:assert/strict";
import { parseHealth, SAMPLE_EMAIL, hideHealthWeek, findWorkoutStrain } from "../src/lib/health.js";

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

test("hideHealthWeek elimina semanas manuales y marca hidden si existe en seed", () => {
  const manual = [
    { weekStart: "2026-10-03", totalSteps: 35000, source: "manual" },
    { weekStart: "2026-10-10", totalSteps: 42000, source: "manual" },
  ];
  const afterManual = hideHealthWeek(manual, "2026-10-03", []);
  assert.deepEqual(afterManual.map((w) => w.weekStart), ["2026-10-10"]);

  const seed = [{ weekStart: "2026-10-03", totalSteps: 30000, source: "gmail" }];
  const afterSeed = hideHealthWeek(manual, "2026-10-03", seed);
  const hiddenEntry = afterSeed.find((w) => w.weekStart === "2026-10-03");
  assert.deepEqual(hiddenEntry, { weekStart: "2026-10-03", hidden: true });
});

test("findWorkoutStrain encuentra el entreno por id o fallback kind+min sin fallar con datos vacíos", () => {
  const hist = {
    byDate: {
      "2026-11-20": {
        strain: {
          workouts: [
            { id: "w-run-1", kind: "run", min: 35, avgHr: 154, strainPct: 48 },
            { id: "w-str-2", kind: "strength", min: 42, avgHr: 121, strainPct: 31 },
          ],
        },
      },
    },
  };
  assert.equal(findWorkoutStrain(hist, { id: "w-run-1", date: "2026-11-20", kind: "run", min: 35 }).strainPct, 48);
  assert.equal(findWorkoutStrain(hist, { id: "otro", date: "2026-11-20", kind: "strength", min: 42 }).avgHr, 121);
  assert.equal(findWorkoutStrain(hist, { id: "x", date: "2026-11-19", kind: "run", min: 20 }), null);
  assert.equal(findWorkoutStrain(null, null), null);
});
