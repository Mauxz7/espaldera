import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLoad, isTimedSpec, seriesVolume, nextPendingSet, nextPendingExercise, suggestSet,
  exerciseRecord, buildWorkoutSummary, touchSession, finishSession, sessionDuration,
  formatDuration, formatClock, formatKg, SESSION_GAP_MS,
} from "../src/lib/workout.js";

test("parseLoad entiende kilos, decimales con coma, pares y libras", () => {
  assert.equal(parseLoad("40 kg"), 40);
  assert.equal(parseLoad("17,5"), 17.5);
  assert.equal(parseLoad("2 × 12 kg"), 24);
  assert.equal(parseLoad("2x8"), 16);
  assert.equal(parseLoad("45 lb"), 20.4);
  assert.equal(parseLoad(12), 12);
  assert.equal(parseLoad("banda roja"), null);
  assert.equal(parseLoad(""), null);
  assert.equal(parseLoad(null), null);
  assert.equal(parseLoad("0"), null);
});

test("isTimedSpec distingue ejercicios por tiempo", () => {
  assert.equal(isTimedSpec("30 s"), true);
  assert.equal(isTimedSpec("10–20 s"), true);
  assert.equal(isTimedSpec("5 min"), true);
  assert.equal(isTimedSpec("3 min de trote"), true);
  assert.equal(isTimedSpec("4–6"), false);
  assert.equal(isTimedSpec("8 / lado"), false);
  assert.equal(isTimedSpec("Máx. / pierna"), false);
});

test("seriesVolume suma reps × carga e ignora lo que no tiene número", () => {
  const series = [{ reps: 6, load: "40 kg" }, { reps: 5, load: "40 kg" }, null, { reps: "Máx.", load: "40" }, { reps: 8, load: "" }];
  assert.equal(seriesVolume(series), 440);
  assert.equal(seriesVolume(series, { fallbackLoad: "10 kg" }), 520);
  assert.equal(seriesVolume([{ reps: 30, load: "16 kg" }], { timed: true }), 0);
  assert.equal(seriesVolume(undefined), 0);
});

test("nextPendingSet y nextPendingExercise encuentran lo que falta", () => {
  assert.equal(nextPendingSet([true, false, false]), 1);
  assert.equal(nextPendingSet([true, true]), -1);
  const all = [[true, true], [true, false], [false]];
  assert.equal(nextPendingExercise(all, 0), 1);
  assert.equal(nextPendingExercise(all, 2), 2);
  assert.equal(nextPendingExercise([[true], [true, false]], 2), 1);
  assert.equal(nextPendingExercise([[true], [true]], 0), -1);
});

test("suggestSet usa la serie ya registrada, la meta de progresión o la serie anterior", () => {
  const last = { d: "2026-11-05", v: "40 kg", series: [{ reps: 6, load: "40 kg" }, { reps: 5, load: "40 kg" }, { reps: 5, load: "40 kg" }, { reps: 5, load: "40 kg" }] };
  const lastLog = { date: "2026-11-05", series: last.series, load: "40 kg", repsSummary: "6, 5, 5, 5 reps" };
  // Sin nada hoy: meta de la progresión (+1 rep) y carga de la última vez.
  const s0 = suggestSet({ series: [], setIndex: 0, exReps: "4–6", lastLog, last, sets: 4 });
  assert.equal(s0.reps, 6);
  assert.equal(s0.load, "40 kg");
  assert.equal(s0.progression.type, "reps");
  // Serie ya registrada: sus valores.
  const s1 = suggestSet({ series: [{ reps: 4, load: "42 kg" }], setIndex: 0, exReps: "4–6", lastLog, last, sets: 4 });
  assert.deepEqual([s1.reps, s1.load], [4, "42 kg"]);
  // Siguiente serie: la carga de la anterior de hoy.
  const s2 = suggestSet({ series: [{ reps: 4, load: "42 kg" }], setIndex: 1, exReps: "4–6", lastLog, last, sets: 4 });
  assert.deepEqual([s2.reps, s2.load], [6, "42 kg"]);
  // Sin historial: el tope del rango y la carga escrita hoy.
  const s3 = suggestSet({ series: [], setIndex: 0, exReps: "8–10", currentLoad: "12 kg", sets: 3 });
  assert.deepEqual([s3.reps, s3.load, s3.progression], [10, "12 kg", null]);
});

test("exerciseRecord detecta más carga, más reps o más carga total", () => {
  const prev = [{ reps: 6, load: "40 kg" }, { reps: 5, load: "40 kg" }];
  assert.equal(exerciseRecord([{ reps: 4, load: "42,5 kg" }], prev).type, "load");
  const reps = exerciseRecord([{ reps: 7, load: "40 kg" }, { reps: 5, load: "40 kg" }], prev);
  assert.equal(reps.type, "reps");
  assert.equal(reps.text, "Reps: 6 → 7 reps con 40 kg");
  assert.equal(exerciseRecord([{ reps: 6, load: "40 kg" }, { reps: 6, load: "40 kg" }], prev).type, "volume");
  assert.equal(exerciseRecord([{ reps: 6, load: "40 kg" }, { reps: 5, load: "40 kg" }], prev), null);
  assert.equal(exerciseRecord([{ reps: 3, load: "35 kg" }], prev), null);
  // Peso corporal: cuentan las reps.
  assert.equal(exerciseRecord([{ reps: 9, load: "" }], [{ reps: 8, load: "" }]).type, "reps");
  // Por tiempo.
  assert.equal(exerciseRecord([{ reps: 40, load: "" }], [{ reps: 30, load: "" }], { timed: true }).text, "Tiempo: 30 → 40 s");
  // Primera vez: no hay marca.
  assert.equal(exerciseRecord([{ reps: 6, load: "40 kg" }], []), null);
});

test("buildWorkoutSummary cuenta series, carga total, marcas y duración sin cambiar el registro", () => {
  const setLog = {
    "2026-11-05": { d1: { a: [{ reps: 6, load: "40 kg" }, { reps: 5, load: "40 kg" }], b: [{ reps: 10, load: "" }] } },
    "2026-11-12": { d1: { a: [{ reps: 6, load: "42 kg" }, { reps: 6, load: "42 kg" }], b: [{ reps: 10, load: "" }] } },
  };
  const sets = { "2026-11-12": { d1: { a: [true, true], b: [true, false], c: [true] } } };
  const copy = JSON.stringify(setLog);
  const session = { date: "2026-11-12", rid: "d1", startAt: 1000, lastAt: 1000, endAt: 1000 + 42 * 60000 };
  const s = buildWorkoutSummary({
    exercises: [{ id: "a", name: "Remo", reps: "4–6", sets: 2 }, { id: "b", name: "Plancha", reps: "30 s", sets: 2 }, { id: "c", name: "Dominada", reps: "Máx.", sets: 1 }],
    setLog, sets, date: "2026-11-12", routineId: "d1", session, now: 99999999,
  });
  assert.equal(s.setsDone, 4);
  assert.equal(s.setsTotal, 5);
  assert.equal(s.volume, 504);
  assert.equal(s.durationMs, 42 * 60000);
  assert.equal(s.complete, false);
  assert.deepEqual(s.records.map((r) => [r.exerciseId, r.type]), [["a", "load"]]);
  assert.equal(JSON.stringify(setLog), copy);
});

test("buildWorkoutSummary sin sesión de hoy no inventa la duración", () => {
  const s = buildWorkoutSummary({ exercises: [{ id: "a", name: "Remo", reps: "4–6", sets: 1 }], date: "2026-11-12", routineId: "d1", session: { date: "2026-11-11", rid: "d1", startAt: 5 } });
  assert.equal(s.durationMs, null);
  assert.equal(s.setsDone, 0);
});

test("touchSession, finishSession y sessionDuration llevan la hora de inicio y fin", () => {
  const ctx = { date: "2026-11-12", routineId: "d1" };
  let s = touchSession(null, { ...ctx, now: 1000 });
  assert.deepEqual(s, { date: "2026-11-12", rid: "d1", startAt: 1000, lastAt: 1000, endAt: null });
  s = touchSession(s, { ...ctx, now: 61000 });
  assert.equal(s.startAt, 1000);
  assert.equal(sessionDuration(s, { ...ctx, now: 121000 }), 120000);
  s = finishSession(s, { ...ctx, now: 181000 });
  assert.equal(s.endAt, 181000);
  assert.equal(finishSession(s, { ...ctx, now: 999999 }).endAt, 181000);
  assert.equal(sessionDuration(s, { ...ctx, now: 999999 }), 180000);
  // Seguir entrenando reabre la sesión.
  assert.equal(touchSession(s, { ...ctx, now: 200000 }).endAt, null);
  // Otra rutina, otro día o una pausa larga empiezan de cero.
  assert.equal(touchSession(s, { date: "2026-11-12", routineId: "d2", now: 200000 }).startAt, 200000);
  assert.equal(touchSession(s, { date: "2026-11-13", routineId: "d1", now: 200000 }).startAt, 200000);
  assert.equal(touchSession(s, { ...ctx, now: 181000 + SESSION_GAP_MS + 1 }).startAt, 181000 + SESSION_GAP_MS + 1);
  assert.equal(finishSession(null, { ...ctx, now: 5 }), null);
  assert.equal(sessionDuration(s, { date: "2026-11-12", routineId: "d2", now: 5 }), null);
});

test("formatos de duración, reloj y kilos", () => {
  assert.equal(formatDuration(null), "—");
  assert.equal(formatDuration(30000), "< 1 min");
  assert.equal(formatDuration(42 * 60000), "42 min");
  assert.equal(formatDuration(65 * 60000), "1 h 05 min");
  assert.equal(formatClock(245000), "4:05");
  assert.equal(formatClock(3729000), "1:02:09");
  assert.equal(formatKg(1240.4), "1,240 kg");
  assert.equal(formatKg(504), "504 kg");
});
