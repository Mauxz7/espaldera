import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { toWorkout, encryptToken, decryptToken, sinceEpoch, main } from "../scripts/strava.mjs";

const run = { name: "Carrera matutina", sport_type: "Run", start_date: "2026-11-12T12:40:00Z", moving_time: 1920, elapsed_time: 2000, distance: 4567 };
const lift = { name: "Fuerza", sport_type: "WeightTraining", start_date: "2026-11-11T23:00:00Z", moving_time: 0, elapsed_time: 2700, distance: 0 };

test("toWorkout traduce actividades de Strava al formato de la app", () => {
  assert.deepEqual(toWorkout(run), {
    id: "2026-11-12T12:40-run",
    type: "Correr",
    kind: "run",
    start: "2026-11-12T12:40:00.000Z",
    end: "2026-11-12T13:13:20.000Z",
    min: 32,
    source: "strava",
    km: 4.57,
  });
  const w = toWorkout(lift);
  assert.equal(w.kind, "strength");
  assert.equal(w.min, 45);
  assert.equal("km" in w, false);
  assert.equal(toWorkout({ sport_type: "Ride", start_date: "2026-11-10T12:00:00Z", elapsed_time: 600 }).kind, "bike");
  assert.equal(toWorkout({ sport_type: "Run" }), null);
});

test("el token se cifra y solo se descifra con el mismo secreto", () => {
  const blob = encryptToken("abc123", "secreto");
  assert.notEqual(blob.includes("abc123"), true);
  assert.equal(decryptToken(blob, "secreto"), "abc123");
  assert.equal(decryptToken(blob, "otro"), null);
});

test("sinceEpoch usa el último entreno de Strava con margen, o 60 días la primera vez", () => {
  const now = new Date("2026-11-12T20:00:00Z");
  assert.equal(sinceEpoch([], now), Math.floor((now.getTime() - 60 * 86400000) / 1000));
  const list = [{ start: "2026-11-11T00:00:00.000Z", source: "strava" }, { start: "2026-11-12T00:00:00.000Z" }];
  assert.equal(sinceEpoch(list, now), Math.floor((Date.parse("2026-11-11T00:00:00Z") - 3 * 86400000) / 1000));
});

function fakeFetch({ tokens = { good: "nuevo" }, pages = [[run, lift]] } = {}) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push(url);
    if (url.includes("/oauth/token")) {
      const rt = new URLSearchParams(opts.body).get("refresh_token");
      if (!(rt in tokens)) return { ok: false, status: 400, json: async () => ({}) };
      return { ok: true, json: async () => ({ access_token: "acc", refresh_token: tokens[rt] }) };
    }
    const page = Number(new URL(url).searchParams.get("page"));
    return { ok: true, json: async () => pages[page - 1] || [] };
  };
  fn.calls = calls;
  return fn;
}

const env = { STRAVA_CLIENT_ID: "1", STRAVA_CLIENT_SECRET: "s", STRAVA_REFRESH_TOKEN: "good" };

test("main trae actividades, las fusiona en data.json y guarda el token rotado cifrado", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-strava-"));
  fs.writeFileSync(path.join(root, "data.json"), JSON.stringify({ habits: { v: {}, at: 1 } }));
  const now = new Date("2026-11-12T20:00:00Z");
  const res = await main({ root, now, env, fetchImpl: fakeFetch() });
  assert.deepEqual([res.activities, res.added, res.total, res.rotated], [2, 2, 2, true]);
  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.deepEqual(data.habits, { v: {}, at: 1 });
  assert.equal(data.workouts.v.length, 2);
  const blob = fs.readFileSync(path.join(root, "strava", "token.enc"), "utf8");
  assert.equal(blob.includes("nuevo"), false);
  assert.equal(decryptToken(blob, "s"), "nuevo");

  // Segunda corrida: usa el token guardado y no duplica.
  const again = await main({ root, now, env, fetchImpl: fakeFetch({ tokens: { nuevo: "nuevo" } }) });
  assert.deepEqual([again.added, again.total, again.rotated], [0, 2, false]);
});

test("main vuelve al token del secreto si el guardado ya no sirve, y sale tranquilo sin secretos", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-strava-"));
  fs.mkdirSync(path.join(root, "strava"));
  fs.writeFileSync(path.join(root, "strava", "token.enc"), encryptToken("viejo", "s"));
  const f = fakeFetch({ tokens: { good: "good" }, pages: [[]] });
  const res = await main({ root, now: new Date("2026-11-12T20:00:00Z"), env, fetchImpl: f });
  assert.equal(res.activities, 0);
  assert.equal(f.calls.filter((u) => u.includes("/oauth/token")).length, 2);
  assert.equal(decryptToken(fs.readFileSync(path.join(root, "strava", "token.enc"), "utf8"), "s"), "good");
  assert.deepEqual(await main({ root, env: {} }), { skipped: true });
});
