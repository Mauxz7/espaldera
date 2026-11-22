import { test } from "node:test";
import assert from "node:assert/strict";
import { trendCard, seriesOf, dailyStress, stressLevel, loadStatus, trainingLoad, muscleFreshness, exercisePattern, cardioFocus } from "../src/lib/metrics.js";
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
