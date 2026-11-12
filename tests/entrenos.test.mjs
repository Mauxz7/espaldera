import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classify, parseDuration, parseLine, parseInbox, mergeWorkouts, main } from "../scripts/entrenos.mjs";

test("classify reconoce los tipos en español e inglés", () => {
  assert.equal(classify("Correr"), "run");
  assert.equal(classify("Running"), "run");
  assert.equal(classify("Ciclismo en interiores"), "bike");
  assert.equal(classify("Caminar"), "walk");
  assert.equal(classify("Entrenamiento de fuerza tradicional"), "strength");
  assert.equal(classify("HIIT"), "strength");
  assert.equal(classify("Fútbol"), "other");
});

test("parseDuration entiende minutos, horas, h:mm:ss, segundos y cae a fin − inicio", () => {
  assert.equal(parseDuration("32 min"), 32);
  assert.equal(parseDuration("1 h 5 min"), 65);
  assert.equal(parseDuration("0:45:30"), 46);
  assert.equal(parseDuration("2700"), 45);
  assert.equal(parseDuration("40"), 40);
  assert.equal(parseDuration("", "2026-11-12T06:40:00-06:00", "2026-11-12T07:12:00-06:00"), 32);
});

test("parseLine arma el entreno y descarta líneas inválidas", () => {
  const w = parseLine("Correr | 2026-11-12T06:40:00-06:00 | 2026-11-12T07:12:00-06:00 | 32 min");
  assert.deepEqual(w, {
    id: "2026-11-12T12:40-run",
    type: "Correr",
    kind: "run",
    start: "2026-11-12T12:40:00.000Z",
    end: "2026-11-12T13:12:00.000Z",
    min: 32,
  });
  assert.equal(parseLine("espaldera-entrenos v1"), null);
  assert.equal(parseLine("Correr | ayer"), null);
  assert.equal(parseInbox("encabezado\n\nCorrer | 2026-11-12T06:40:00-06:00 | | 30 min\r\nCaminar | 2026-11-11T18:00:00-06:00 | 2026-11-11T18:40:00-06:00 |").length, 2);
});

test("mergeWorkouts no duplica, ordena del más reciente y descarta lo muy viejo", () => {
  const a = parseLine("Correr | 2026-11-12T06:40:00-06:00 | | 32 min");
  const b = parseLine("Caminar | 2026-11-10T18:00:00-06:00 | | 40 min");
  const old = parseLine("Caminar | 2024-01-01T18:00:00-06:00 | | 40 min");
  const first = mergeWorkouts([], [b, a, old], new Date("2026-11-12T20:00:00Z"));
  assert.equal(first.added, 3);
  assert.deepEqual(first.list.map((w) => w.kind), ["run", "walk"]);
  const again = mergeWorkouts(first.list, [a], new Date("2026-11-12T20:00:00Z"));
  assert.equal(again.added, 0);
  assert.equal(again.list.length, 2);
});

test("main fusiona la bandeja en data.json sin tocar otras claves y la vacía", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-salud-"));
  fs.mkdirSync(path.join(root, "health", "inbox"), { recursive: true });
  fs.writeFileSync(path.join(root, "data.json"), JSON.stringify({ habits: { v: { x: 1 }, at: 5 } }));
  fs.writeFileSync(path.join(root, "health", "inbox", "a.txt"), "Correr | 2026-11-12T06:40:00-06:00 | | 32 min\n");
  fs.writeFileSync(path.join(root, "health", "inbox", "b.txt"), "Correr | 2026-11-12T06:40:00-06:00 | | 32 min\nCaminar | 2026-11-11T18:00:00-06:00 | | 40 min\n");
  const now = new Date("2026-11-12T20:00:00Z");
  const res = main({ root, now });
  assert.deepEqual([res.files, res.added, res.total], [2, 2, 2]);
  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.deepEqual(data.habits, { v: { x: 1 }, at: 5 });
  assert.equal(data.workouts.at, now.getTime());
  assert.equal(data.workouts.v.length, 2);
  assert.deepEqual(fs.readdirSync(path.join(root, "health", "inbox")), []);
});

test("main repone la clave workouts si un dispositivo viejo la borró de data.json", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-salud-"));
  fs.mkdirSync(path.join(root, "health", "inbox"), { recursive: true });
  const w = parseLine("Correr | 2026-11-12T06:40:00-06:00 | | 32 min");
  fs.writeFileSync(path.join(root, "health", "workouts.json"), JSON.stringify([w]));
  fs.writeFileSync(path.join(root, "data.json"), JSON.stringify({ habits: { v: {}, at: 1 } }));
  const res = main({ root, now: new Date("2026-11-13T20:00:00Z") });
  assert.equal(res.repaired, true);
  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.equal(data.workouts.v.length, 1);
  // Sin cambios: no se reescribe data.json.
  const before = fs.statSync(path.join(root, "data.json")).mtimeMs;
  assert.equal(main({ root, now: new Date("2026-11-13T21:00:00Z") }).repaired, false);
  assert.equal(fs.statSync(path.join(root, "data.json")).mtimeMs, before);
});
