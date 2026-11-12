import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { toWorkout, sinceDate, main } from "../scripts/google-health.mjs";

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
  const api = f.calls.filter((c) => c.url.includes("health.googleapis.com"));
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
