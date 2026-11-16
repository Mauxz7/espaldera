import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { toWorkout, sinceDate, main, toSleep, applySleep } from "../scripts/google-health.mjs";

// Forma tomada del ejemplo oficial de la Google Health API.
const walk = {
  name: "users/1/dataTypes/exercise/dataPoints/88",
  dataSource: { recordingMethod: "MANUAL", platform: "FITBIT" },
  exercise: {
    interval: { startTime: "2026-11-12T12:40:00Z", startUtcOffset: "-21600s", endTime: "2026-11-12T13:15:00Z", endUtcOffset: "-21600s" },
    exerciseType: "WALKING",
    metricsSummary: { caloriesKcal: 120, distanceMillimiters: 3218688, steps: "4100" },
    displayName: "Walk",
    activeDuration: "1920s",
  },
};
const lift = { exercise: { interval: { startTime: "2026-11-11T23:00:00Z", endTime: "2026-11-11T23:45:00Z" }, exerciseType: "WEIGHTLIFTING", displayName: "Weights" } };

test("toWorkout traduce un entreno de Google Health al formato de la app", () => {
  assert.deepEqual(toWorkout(walk), {
    id: "2026-11-12T12:40-walk",
    type: "Caminata",
    kind: "walk",
    start: "2026-11-12T12:40:00.000Z",
    end: "2026-11-12T13:15:00.000Z",
    min: 32,
    source: "google",
    km: 3.22,
  });
  const w = toWorkout(lift);
  assert.deepEqual([w.kind, w.type, w.min, "km" in w], ["strength", "Pesas", 45, false]);
  assert.equal(toWorkout({ exercise: { interval: { startTime: "2026-11-10T12:00:00Z" }, exerciseType: "INDOOR_BIKING" } }).kind, "bike");
  assert.equal(toWorkout({ exercise: { interval: { startTime: "2026-11-10T12:00:00Z" }, exerciseType: "TREADMILL_RUNNING" } }).kind, "run");
  assert.equal(toWorkout({ exercise: { interval: {} } }), null);
  assert.equal(toWorkout({}), null);
});

test("sinceDate usa el último entreno de Google con margen, o 60 días la primera vez", () => {
  const now = new Date("2026-11-12T20:00:00Z");
  assert.equal(sinceDate([], now), "2026-09-13");
  assert.equal(sinceDate([{ start: "2026-11-11T00:00:00.000Z", source: "google" }, { start: "2026-11-12T00:00:00.000Z" }], now), "2026-11-08");
});

function fakeFetch({ pages = [[walk, lift]], tokenOk = true } = {}) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url.includes("oauth2.googleapis.com")) {
      return tokenOk
        ? { ok: true, json: async () => ({ access_token: "acc" }) }
        : { ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) };
    }
    const tok = new URL(url).searchParams.get("pageToken");
    const i = tok ? Number(tok) : 0;
    return { ok: true, json: async () => ({ dataPoints: pages[i] || [], nextPageToken: i + 1 < pages.length ? String(i + 1) : "" }) };
  };
  fn.calls = calls;
  return fn;
}

const env = { GOOGLE_HEALTH_CLIENT_ID: "id", GOOGLE_HEALTH_CLIENT_SECRET: "s", GOOGLE_HEALTH_REFRESH_TOKEN: "r" };

test("main pagina, fusiona en data.json sin tocar otras claves y no duplica", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-gh-"));
  fs.writeFileSync(path.join(root, "data.json"), JSON.stringify({ habits: { v: {}, at: 1 } }));
  const now = new Date("2026-11-12T20:00:00Z");
  const f = fakeFetch({ pages: [[walk], [lift]] });
  const res = await main({ root, now, env, fetchImpl: f });
  assert.deepEqual([res.points, res.added, res.total], [2, 2, 2]);
  const api = f.calls.filter((c) => c.url.includes("/dataTypes/exercise/"));
  assert.equal(api.length, 2);
  assert.equal(api[0].opts.headers.Authorization, "Bearer acc");
  assert.match(new URL(api[0].url).searchParams.get("filter"), /^exercise\.interval\.civil_start_time >= "2026-09-13"$/);
  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.deepEqual(data.habits, { v: {}, at: 1 });
  assert.equal(data.workouts.v.length, 2);
  const again = await main({ root, now, env, fetchImpl: fakeFetch() });
  assert.deepEqual([again.added, again.total], [0, 2]);
});

test("main explica cómo reautorizar si Google rechaza el token, y sale tranquilo sin secretos", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-gh-"));
  await assert.rejects(main({ root, env, fetchImpl: fakeFetch({ tokenOk: false }) }), /google-health-auth\.mjs/);
  assert.deepEqual(await main({ root, env: {} }), { skipped: true });
});

const night = (o = {}) => ({
  sleep: {
    interval: {
      startTime: "2026-11-15T04:40:00Z", endTime: "2026-11-15T12:10:00Z", startUtcOffset: "-21600s", endUtcOffset: "-21600s",
      civilStartTime: { date: { year: 2026, month: 11, day: 14 }, time: { hours: 22, minutes: 40 } },
      civilEndTime: { date: { year: 2026, month: 11, day: 15 }, time: { hours: 6, minutes: 10 } },
    },
    summary: { minutesAsleep: "418" },
    metadata: { mainSleep: true },
    ...o,
  },
});

test("toSleep usa el día en que despertaste, la hora civil y descarta siestas", () => {
  assert.deepEqual(toSleep(night()), { date: "2026-11-15", min: 418, bed: "22:40", wake: "06:10" });
  assert.equal(toSleep(night({ metadata: { nap: true } })), null);
  assert.equal(toSleep({ exercise: {} }), null);
  const noCivil = night();
  delete noCivil.sleep.interval.civilStartTime;
  delete noCivil.sleep.interval.civilEndTime;
  assert.deepEqual(toSleep(noCivil), { date: "2026-11-15", min: 418, bed: "22:40", wake: "06:10" });
});

test("applySleep guarda la noche más larga por día, poda a 60 días y solo reescribe data.json si cambió", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-sl-"));
  fs.writeFileSync(path.join(root, "data.json"), JSON.stringify({ habits: { v: {}, at: 1 } }));
  const now = new Date("2026-11-16T12:00:00Z");
  const r = applySleep({ root, now, incoming: [
    { date: "2026-11-15", min: 300, bed: "01:00", wake: "06:00" },
    { date: "2026-11-15", min: 418, bed: "22:40", wake: "06:10" },
    { date: "2026-08-01", min: 400, bed: "22:00", wake: "05:00" },
  ] });
  assert.deepEqual(r, { nights: 1, changed: true });
  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.deepEqual(data.sleep.v, { "2026-11-15": { min: 418, bed: "22:40", wake: "06:10" } });
  assert.deepEqual(data.habits, { v: {}, at: 1 });
  assert.equal(applySleep({ root, now: new Date("2026-11-16T13:00:00Z"), incoming: [] }).changed, false);
});

test("main sigue con los entrenos si Google niega el permiso de sueño", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-gh-"));
  const base = fakeFetch({ pages: [[walk]] });
  const f = async (url, opts) => (url.includes("/dataTypes/sleep/")
    ? { ok: false, status: 403, text: async () => "PERMISSION_DENIED" }
    : base(url, opts));
  const res = await main({ root, now: new Date("2026-11-12T20:00:00Z"), env, fetchImpl: f });
  assert.equal(res.added, 1);
  assert.equal(res.sleep, null);
});

test("main guarda el sueño en data.json", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-gh-"));
  const base = fakeFetch({ pages: [[walk]] });
  const calls = [];
  const f = async (url, opts) => (calls.push(url), url.includes("/dataTypes/sleep/")
    ? { ok: true, json: async () => ({ dataPoints: [night()] }) }
    : base(url, opts));
  const res = await main({ root, now: new Date("2026-11-16T12:00:00Z"), env, fetchImpl: f });
  assert.deepEqual(res.sleep, { nights: 1, changed: true });
  const sleepCall = calls.find((u) => u.includes("/dataTypes/sleep/"));
  assert.equal(new URL(sleepCall).searchParams.get("filter"), 'sleep.interval.civil_end_time >= "2026-11-02"'); // civil_start_time da 400 en sueño
  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.equal(data.sleep.v["2026-11-15"].min, 418);
});
