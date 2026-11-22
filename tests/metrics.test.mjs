import { test } from "node:test";
import assert from "node:assert/strict";
import { trendCard, seriesOf, dailyStress, stressLevel, loadStatus, trainingLoad, muscleFreshness, muscleGroups, routineMuscles, recommendTraining, exercisePattern, cardioFocus, hasFreeWorkout } from "../src/lib/metrics.js";
import { dkey, fromKey, addDays } from "../src/lib/dates.js";

const day = (base, n) => dkey(addDays(fromKey(base), n));
const D = "2026-11-21";

test("trendCard: calibrando con <7 días previos, luego below/normal/above contra mediana ± MAD", () => {
  const s = {};
  for (let i = 1; i <= 5; i++) s[day(D, -i)] = 100;
  s[D] = 100;
  assert.equal(trendCard(s, D).status, "calibrating");
  for (let i = 6; i <= 20; i++) s[day(D, -i)] = 100 + (i % 3);
  assert.equal(trendCard(s, D).status, "normal");
  assert.equal(trendCard({ ...s, [D]: 80 }, D).status, "below");
  assert.equal(trendCard({ ...s, [D]: 130 }, D).status, "above");
  assert.equal(trendCard(s, day(D, 1)).status, "missing");
  const t = trendCard(s, D);
  assert.equal(t.spark.length, 30);
  assert.equal(t.spark.at(-1).date, D);
  assert.ok("d7" in t.changes && "d90" in t.changes);
});

test("seriesOf extrae un campo numérico por día", () => {
  assert.deepEqual(seriesOf({ a: { hrv: 1 }, b: { rhr: 2 }, c: { hrv: "x" } }, "hrv"), { a: 1 });
});

test("dailyStress sube con el pulso despierto y baja con HRV alta", () => {
  const base = { rhr: 50, awakeHr: 70 };
  const calm = dailyStress(base, { age: 22 });
  const tense = dailyStress({ ...base, awakeHr: 110 }, { age: 22 });
  assert.ok(tense.score > calm.score);
  const goodHrv = dailyStress({ ...base, hrv: 140 }, { age: 22, hrvRange: { low: 100, high: 120 } });
  assert.ok(goodHrv.score < calm.score);
  assert.deepEqual(dailyStress({ rhr: 50 }), { score: null, level: null, sleepScore: null });
  assert.equal(stressLevel(10), "low");
  assert.equal(stressLevel(45), "medium");
  assert.equal(stressLevel(75), "high");
});

test("loadStatus sigue la razón aguda/crónica y exige 14 días", () => {
  assert.equal(loadStatus(1.0, 5), "calibrating");
  assert.equal(loadStatus(0.5, 30), "detraining");
  assert.equal(loadStatus(0.9, 30), "maintaining");
  assert.equal(loadStatus(1.1, 30), "productive");
  assert.equal(loadStatus(1.2, 30), "peaking");
  assert.equal(loadStatus(1.4, 30), "fatigued");
  assert.equal(loadStatus(2, 30), "overtraining");
});

test("trainingLoad: carga estable = mantener; los días antes del primer registro no cuentan", () => {
  const s = {};
  for (let i = 0; i < 60; i++) s[day(D, -i)] = 10;
  const steady = trainingLoad(s, D);
  assert.equal(steady.value, 10);
  assert.equal(steady.status, "productive"); // razón 1.0
  assert.deepEqual(steady.optimal, { min: 8, max: 13 });
  assert.equal(Object.values(steady.breakdown).reduce((a, b) => a + b, 0), 30);

  const recent = { [day(D, -100)]: 0 };
  for (let i = 0; i < 20; i++) recent[day(D, -i)] = 10;
  assert.equal(trainingLoad(recent, D).status, "productive");
});

test("muscleFreshness: series de ayer bajan el grupo y se recupera en ~72 h", () => {
  const setLog = { [day(D, -1)]: { d1: { d1a1: Array(4).fill({ reps: 5, load: "" }) } } };
  assert.equal(exercisePattern("d1a1"), "pull_v");
  const now = muscleFreshness(setLog, D);
  const lats = now.find((g) => g.group === "lats");
  assert.ok(lats.pct < 100 && lats.pct > 50);
  assert.equal(lats.lastDate, day(D, -1));
  assert.equal(now.find((g) => g.group === "quads").pct, 100);
  const later = muscleFreshness(setLog, day(D, 3)).find((g) => g.group === "lats");
  assert.equal(later.pct, 100);
});

test("cardioFocus: null sin zonas; porcentajes cuando hay zonas", () => {
  assert.equal(cardioFocus([{ start: `${D}T12:00:00Z` }], D), null);
  const f = cardioFocus([{ start: `${D}T12:00:00Z`, zones: { light: 10, moderate: 10, vigorous: 15, peak: 5 } }], D);
  assert.deepEqual(f.focus, { lowAerobic: 50, highAerobic: 38, anaerobic: 13 });
});

test("muscleGroups: estado, volumen y carga; «Ya la hice» cuenta las series planeadas", () => {
  const setLog = { [day(D, -1)]: { d2: { d2a: Array(4).fill({ reps: 8, load: "40" }), d2b: Array(3).fill({ reps: 6, load: "" }), d2c1: Array(3).fill({ reps: 8, load: "" }) } } };
  const { groups, counts } = muscleGroups(setLog, D);
  const quads = groups.find((g) => g.group === "quads");
  assert.equal(quads.sets, 10);
  assert.equal(quads.reps, 32 + 18 + 24);
  assert.equal(quads.trained, true);
  assert.equal(quads.status, quads.pct >= 80 ? "recovered" : quads.pct >= 50 ? "fatigued" : "depleted");
  assert.ok(quads.pct < 80);
  assert.equal(groups.find((g) => g.group === "chest").trained, false);
  assert.equal(counts.recovered + counts.fatigued + counts.depleted, groups.length);

  // Sesión marcada sin series → usa la rutina planeada.
  const viaLog = muscleGroups({}, D, { log: { [day(D, -1)]: { r: "d1" } } }).groups;
  assert.ok(viaLog.find((g) => g.group === "lats").pct < 100);
  assert.equal(viaLog.find((g) => g.group === "quads").trained, false);
  // Si el día ya tiene series de esa rutina, no se duplica.
  const both = muscleGroups(setLog, D, { log: { [day(D, -1)]: { r: "d2" } } }).groups.find((g) => g.group === "quads");
  assert.equal(both.sets, 10);
  // Fuera de la ventana de 7 días no suma volumen.
  assert.equal(muscleGroups(setLog, day(D, 8)).groups.find((g) => g.group === "quads").sets, 0);
});

test("routineMuscles: pierna pesa en cuádriceps; torso en dorsales/pecho", () => {
  assert.equal(routineMuscles("d2").quads, 1);
  assert.ok(!routineMuscles("d2").chest);
  assert.ok(routineMuscles("d1").lats > 0.4 && routineMuscles("d1").chest > 0.4);
});

test("recommendTraining: evita lo fatigado, sesión suave con recuperación baja, nada si ya entrenaste", () => {
  const legsYesterday = { [day(D, -1)]: { d2: { d2a: Array(4).fill({ reps: 8 }), d2b: Array(3).fill({ reps: 6 }), d2c1: Array(3).fill({ reps: 8 }), d2d: Array(3).fill({ reps: 8 }) } } };
  const { groups } = muscleGroups(legsYesterday, D);
  const rec = recommendTraining({ groups, recovery: 70 });
  assert.equal(rec.kind, "train");
  assert.equal(rec.rid, "d1");
  assert.match(rec.reason, /Dejas descansar/);
  assert.equal(recommendTraining({ groups, recovery: 25 }).kind, "low");
  assert.equal(recommendTraining({ groups, doneToday: "d1" }).kind, "done");
  // Ya hiciste torso esta semana → baja en el ranking.
  const fresh = muscleGroups({}, D).groups;
  assert.notEqual(recommendTraining({ groups: fresh, weekDone: ["d1", "d1"] }).rid, "d1");
});

test("entreno libre: muscleGroups baja con solo setLog.free, exercisePattern resuelve cus_* y recommendTraining da done", () => {
  const freeOnly = {
    [D]: {
      free: {
        lib_trx_curl: [
          { reps: 12, load: "10 kg" },
          { reps: 12, load: "10 kg" },
          { reps: 10, load: "10 kg" },
          { reps: 10, load: "10 kg" },
        ],
      },
    },
  };
  assert.equal(hasFreeWorkout(freeOnly, D), true);
  assert.equal(hasFreeWorkout({ [D]: { free: { lib_trx_curl: [{ reps: 0, load: "" }] } } }, D), false);

  const resFree = muscleGroups(freeOnly, D);
  const biceps = resFree.groups.find((g) => g.group === "biceps");
  assert.ok(biceps.pct < 100);
  assert.equal(biceps.sets, 4);
  assert.equal(biceps.trained, true);
  assert.equal(resFree.groups.find((g) => g.group === "quads").pct, 100);

  // exercisePattern y muscleGroups resuelven ejercicios personalizados cus_*
  const customList = [
    { id: "cus_1700000001", name: "Curl concentrado", primaryGroup: "biceps", secondaryGroups: [] },
  ];
  assert.equal(exercisePattern("cus_1700000001", customList), "arms");
  assert.equal(exercisePattern("cus_1700000001", { cus_1700000001: customList[0] }), "arms");

  const customSetLog = {
    [D]: {
      free: {
        cus_1700000001: Array(4).fill({ reps: 12, load: "10 kg" }),
      },
    },
  };
  const resCus = muscleGroups(customSetLog, D, { customExercises: customList });
  assert.ok(resCus.groups.find((g) => g.group === "biceps").pct < 100);
  assert.equal(resCus.groups.find((g) => g.group === "triceps").pct, 100);

  // recommendTraining da kind: "done" con un entreno libre hoy
  assert.equal(recommendTraining({ groups: resFree.groups, doneToday: "free" }).kind, "done");
  assert.equal(recommendTraining({ groups: resFree.groups, setLog: freeOnly, today: D }).kind, "done");
  assert.notEqual(recommendTraining({ groups: resFree.groups, setLog: { [D]: { free: {} } }, today: D }).kind, "done");
});
