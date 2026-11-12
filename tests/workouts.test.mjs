import test from "node:test";
import assert from "node:assert/strict";
import { groupWorkoutsByWeek, validWorkouts, normalizeWorkout, KIND_LABELS } from "../src/lib/workouts.js";

// Construye un ISO UTC a partir de una fecha y hora en hora local del sistema.
function localIso(year, month, day, hour = 7, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

test("groupWorkoutsByWeek agrupa de lunes a domingo en hora local y suma entrenos y minutos por kind", () => {
  // Semana del lunes 2 nov 2026 al domingo 8 nov 2026 (hora local)
  // Semana del lunes 9 nov 2026 al domingo 15 nov 2026 (hora local)
  const items = [
    { id: "1", type: "Correr", kind: "run", start: localIso(2026, 11, 2, 6, 40), min: 32 },
    { id: "2", type: "Bici fija", kind: "bike", start: localIso(2026, 11, 5, 18, 0), min: 45 },
    { id: "3", type: "Caminata", kind: "walk", start: localIso(2026, 11, 8, 22, 30), min: 25 }, // domingo de noche local
    { id: "4", type: "Fuerza", kind: "strength", start: localIso(2026, 11, 9, 6, 30), min: 40 }, // lunes siguiente
    { id: "5", type: "Yoga", kind: "other", start: localIso(2026, 11, 11, 19, 0), min: 30 },
    { id: "6", type: "Correr", kind: "run", start: localIso(2026, 11, 12, 6, 45), min: 35 },
  ];

  const weeks = groupWorkoutsByWeek(items);
  assert.equal(weeks.length, 2);

  // Primera semana: 2026-11-02 (lunes a domingo incluye el domingo 8 a las 22:30 local)
  assert.equal(weeks[0].weekStart, "2026-11-02");
  assert.equal(weeks[0].count, 3);
  assert.equal(weeks[0].totalMin, 102);
  assert.equal(weeks[0].min, 102);
  assert.deepEqual(weeks[0].byKind, {
    run: 32,
    bike: 45,
    walk: 25,
    strength: 0,
    other: 0,
  });
  assert.equal(weeks[0].run, 32);
  assert.equal(weeks[0].bike, 45);
  assert.equal(weeks[0].walk, 25);

  // Segunda semana: 2026-11-09
  assert.equal(weeks[1].weekStart, "2026-11-09");
  assert.equal(weeks[1].count, 3);
  assert.equal(weeks[1].totalMin, 105);
  assert.deepEqual(weeks[1].byKind, {
    run: 35,
    bike: 0,
    walk: 0,
    strength: 40,
    other: 30,
  });
});

test("groupWorkoutsByWeek acepta entrenos con min null (cuenta el entreno con 0 minutos) y normaliza kind desconocido a other", () => {
  const items = [
    { id: "a", type: "Caminar", kind: "walk", start: localIso(2026, 11, 10, 12, 0), min: null },
    { id: "b", type: "Natación", kind: "swim", start: localIso(2026, 11, 11, 12, 0), min: 50 },
  ];

  const weeks = groupWorkoutsByWeek(items);
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].weekStart, "2026-11-09");
  assert.equal(weeks[0].count, 2);
  assert.equal(weeks[0].totalMin, 50);
  assert.deepEqual(weeks[0].byKind, {
    run: 0,
    bike: 0,
    walk: 0,
    strength: 0,
    other: 50,
  });
});

test("groupWorkoutsByWeek y validWorkouts ignoran entradas inválidas", () => {
  const mixed = [
    null,
    undefined,
    "no es objeto",
    42,
    [],
    {},
    { type: "Correr", kind: "run", start: "" },
    { type: "Correr", kind: "run", start: "fecha-invalida" },
    { type: "Correr", kind: "run", start: null },
    { type: "", kind: "run", start: localIso(2026, 11, 12, 7, 0), min: 30 },
    { type: "Correr", kind: "run", start: localIso(2026, 11, 12, 7, 0), min: -15 },
    { type: "Correr", kind: "run", start: localIso(2026, 11, 12, 7, 0), min: "abc" },
    { id: "ok", type: "Correr", kind: "run", start: localIso(2026, 11, 12, 7, 0), min: 30 },
  ];

  assert.equal(normalizeWorkout(null), null);
  assert.deepEqual(groupWorkoutsByWeek(null), []);
  assert.deepEqual(groupWorkoutsByWeek("invalido"), []);

  const valid = validWorkouts(mixed);
  assert.equal(valid.length, 1);
  assert.equal(valid[0].id, "ok");

  const weeks = groupWorkoutsByWeek(mixed);
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].count, 1);
  assert.equal(weeks[0].totalMin, 30);
});

test("groupWorkoutsByWeek recorta a las últimas N semanas cuando se indica maxWeeks", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({
    id: `w-${i}`,
    type: "Correr",
    kind: "run",
    start: localIso(2026, 9, 7 + i * 7, 7, 0),
    min: 20 + i,
  }));

  const all = groupWorkoutsByWeek(items);
  assert.equal(all.length, 10);

  const last8 = groupWorkoutsByWeek(items, 8);
  assert.equal(last8.length, 8);
  assert.equal(last8[0].weekStart, all[2].weekStart);
  assert.equal(last8[7].weekStart, all[9].weekStart);
});

test("KIND_LABELS expone las etiquetas en español requeridas", () => {
  assert.deepEqual(KIND_LABELS, {
    run: "Running",
    bike: "Bici",
    walk: "Caminata",
    strength: "Fuerza",
    other: "Otro",
  });
});
