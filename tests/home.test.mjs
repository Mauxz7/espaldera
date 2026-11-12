import test from "node:test";
import assert from "node:assert/strict";
import { weekProgress, todayPlan, MINUTES_GOAL } from "../src/lib/home.js";

const keys = Array.from({ length: 7 }, (_, i) => `2026-11-${String(9 + i).padStart(2, "0")}`);
const defs = [
  { id: "a", group: "req", kind: "check", target: 1 },
  { id: "b", group: "req", kind: "count", target: 2 },
  { id: "x", group: "opt", kind: "check", target: 1 },
];
const at = (day, min) => ({ start: new Date(2026, 10, day, 8, 0).toISOString(), min, kind: "strength" });

test("weekProgress cuenta sesiones distintas, días de hábitos y minutos hasta hoy", () => {
  const p = weekProgress({
    keys,
    todayIdx: 3, // jueves
    fixed: { 0: "d1", 1: "low", 2: "d1", 3: "d3" },
    habits: { "2026-11-09": { a: true, b: 2 }, "2026-11-10": { a: true, b: 1 }, "2026-11-12": { a: true, b: 2, x: true }, "2026-11-14": { a: true, b: 2 } },
    habitDefs: defs,
    workouts: [at(9, 45), at(11, 30), at(14, 60), at(2, 99)],
  });
  assert.deepEqual(p.sessions, { value: 2, goal: 4 }); // d1 y d3; «low» no es sesión principal
  assert.deepEqual(p.habits, { value: 2, goal: 4 }); // lunes y jueves; el sábado aún no llega
  assert.deepEqual(p.minutes, { value: 75, goal: MINUTES_GOAL });
});

test("weekProgress tolera datos vacíos", () => {
  const p = weekProgress({ keys, todayIdx: 0, fixed: {}, habits: undefined, habitDefs: undefined, workouts: null });
  assert.deepEqual([p.sessions.value, p.habits.value, p.habits.goal, p.minutes.value], [0, 0, 1, 0]);
});

test("todayPlan prioriza lo registrado, luego Fitbit, luego el plan", () => {
  assert.deepEqual(todayPlan({ info: { rid: "d2" }, logged: { r: "d4" } }), { state: "done", rid: "d4" });
  assert.deepEqual(todayPlan({ info: { rid: "d2" }, fromFitbit: "d1" }), { state: "fitbit", rid: "d1" });
  assert.deepEqual(todayPlan({ info: { rid: "d2", evening: true, office: true } }), { state: "planned", rid: "d2", evening: true, office: true });
  assert.deepEqual(todayPlan({ info: { rid: null, office: true } }), { state: "rest", rid: null, office: true });
});
