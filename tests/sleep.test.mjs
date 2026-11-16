import test from "node:test";
import assert from "node:assert/strict";
import { bedMinutes, isRested, lastNight, isPoorSleep, fmtSleep } from "../src/lib/sleep.js";
import { weekVotes } from "../src/lib/identity.js";

test("bedMinutes ordena la noche: 22:30 antes que 00:30", () => {
  assert.ok(bedMinutes("22:30") < bedMinutes("23:00"));
  assert.ok(bedMinutes("23:00") < bedMinutes("00:30"));
  assert.equal(bedMinutes("x"), null);
});

test("isRested: 7 h o más, o dormirse antes de las 11 p.m.", () => {
  assert.equal(isRested({ min: 420, bed: "01:00" }), true);
  assert.equal(isRested({ min: 380, bed: "22:45" }), true);
  assert.equal(isRested({ min: 380, bed: "23:30" }), false);
  assert.equal(isRested({ min: 380, bed: "00:15" }), false);
  assert.equal(isRested(null), false);
});

test("lastNight, isPoorSleep y fmtSleep", () => {
  const sleep = { "2026-11-16": { min: 330, bed: "00:40", wake: "06:10" } };
  assert.deepEqual(lastNight(sleep, "2026-11-16"), sleep["2026-11-16"]);
  assert.equal(lastNight(sleep, "2026-11-17"), null);
  assert.equal(lastNight(null, "2026-11-16"), null);
  assert.equal(isPoorSleep(sleep["2026-11-16"]), true);
  assert.equal(isPoorSleep({ min: 360 }), false);
  assert.equal(fmtSleep(330), "5 h 30 min");
  assert.equal(fmtSleep(420), "7 h");
});

test("weekVotes: cada noche de descanso es un voto para «Persona descansada»", () => {
  const keys = Array.from({ length: 7 }, (_, i) => `2026-11-${String(16 + i).padStart(2, "0")}`);
  const sleep = {
    "2026-11-16": { min: 430, bed: "23:40" },
    "2026-11-17": { min: 300, bed: "01:00" },
    "2026-11-18": { min: 390, bed: "22:30" },
    "2026-11-19": { min: 480, bed: "22:00" }, // después de hoy: no cuenta
  };
  const rows = weekVotes({ keys, todayIdx: 2, habits: {}, habitDefs: [], log: {}, sleep });
  const rest = rows.find((r) => r.id === "descanso");
  assert.deepEqual([rest.votes, rest.days], [2, 2]);
});
