import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  localParts,
  dueHabits,
  planSend,
  buildPayload,
  buildNoticePayload,
  computeRequiredHabitStats,
  buildWeeklySummary,
  parseCliArgs,
  main,
  isHabitDone,
} from "../scripts/recordatorios.mjs";
import { isHabitDone as appIsHabitDone, DEFAULT_HABIT_DEFS } from "../src/data/habits.js";
import { urlBase64ToUint8Array, subscriptionRecord, VAPID_PUBLIC_KEY } from "../src/lib/push.js";
import { execFileSync } from "node:child_process";

// 18:07 UTC = 12:07 p.m. en Costa Rica (UTC−6, sin horario de verano).
const at = (iso) => new Date(iso);

test("localParts usa la hora de Costa Rica", () => {
  const p = localParts(at("2026-11-13T05:30:00Z"));
  assert.deepEqual([p.date, p.hour, p.minute], ["2026-11-12", 23, 30]);
});

test("isHabitDone del remitente coincide con el de la app", () => {
  const water = DEFAULT_HABIT_DEFS.find((d) => d.id === "o_water");
  for (const v of [undefined, null, false, true, 0, 1, 2, 3, "2"]) {
    assert.equal(isHabitDone(water, v), appIsHabitDone(water, v));
  }
});

test("dueHabits solo devuelve hábitos con hora ya pasada y sin marcar", () => {
  const defs = [
    { id: "o_creatine", label: "Creatina", kind: "check", remindAt: "12:00" },
    { id: "o_water", label: "Agua", kind: "count", target: 2, remindAt: "09:00" },
    { id: "f_fruit", label: "Fruta", kind: "check", remindAt: "15:00" },
    { id: "f_read", label: "Leer", kind: "check", remindAt: null },
    { id: "x", label: "Archivado", kind: "check", remindAt: "08:00", archived: true },
  ];
  const p = localParts(at("2026-11-12T18:07:00Z"));
  const due = dueHabits(defs, { o_water: 1 }, p).map((d) => d.id);
  assert.deepEqual(due, ["o_creatine", "o_water"]);
  assert.deepEqual(dueHabits(defs, { o_water: 2, o_creatine: true }, p), []);
});

test("planSend avisa una vez por hora y respeta el horario de silencio", () => {
  const due = [{ id: "o_creatine" }];
  const p1 = localParts(at("2026-11-12T18:07:00Z"));
  const first = planSend(due, {}, p1);
  assert.equal(first.send, true);
  const again = planSend(due, first.nextSent, localParts(at("2026-11-12T18:37:00Z")));
  assert.equal(again.send, false);
  const nextHour = planSend(due, first.nextSent, localParts(at("2026-11-12T19:07:00Z")));
  assert.equal(nextHour.send, true);
  // Un hábito nuevo pendiente en la misma hora sí dispara el aviso.
  const more = planSend([...due, { id: "o_water" }], first.nextSent, localParts(at("2026-11-12T18:37:00Z")));
  assert.equal(more.send, true);
  // 11:50 p.m. y 5:30 a.m.: silencio.
  assert.equal(planSend(due, {}, localParts(at("2026-11-13T05:50:00Z"))).send, false);
  assert.equal(planSend(due, {}, localParts(at("2026-11-12T11:30:00Z"))).send, false);
});

test("buildPayload arma textos en español", () => {
  const p = localParts(at("2026-11-12T18:07:00Z"));
  assert.equal(buildPayload([{ id: "o_creatine", label: "Tomar creatina." }], p).title, "Creatina pendiente");
  assert.match(buildPayload([{ id: "o_creatine" }], p).body, /12:07 p\.m\./);
  const two = buildPayload([{ id: "a", label: "Agua." }, { id: "b", label: "Fruta" }], p);
  assert.equal(two.title, "2 hábitos pendientes");
  assert.match(two.body, /Agua, Fruta/);
});

test("main envía, guarda el estado y elimina suscripciones vencidas", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-push-"));
  fs.mkdirSync(path.join(root, "push", "subs"), { recursive: true });
  fs.writeFileSync(path.join(root, "data.json"), JSON.stringify({ habits: { v: { "2026-11-12": { o_water: 1 } }, at: 1 } }));
  const rec = (id) => ({ id, device: "iPhone", endpoint: `https://push.example/${id}`, keys: { p256dh: "x", auth: "y" } });
  fs.writeFileSync(path.join(root, "push", "subs", "a.json"), JSON.stringify(rec("a")));
  fs.writeFileSync(path.join(root, "push", "subs", "b.json"), JSON.stringify(rec("b")));
  const bodies = [];
  const send = async (r, body) => { if (r.id === "b") throw { statusCode: 410 }; bodies.push(JSON.parse(body)); };

  const res = await main({ root, now: at("2026-11-12T18:07:00Z"), send });
  assert.equal(res.sent, 1);
  assert.equal(res.gone, 1);
  assert.equal(bodies[0].title, "Creatina pendiente");
  assert.ok(!fs.existsSync(path.join(root, "push", "subs", "b.json")));
  const state = JSON.parse(fs.readFileSync(path.join(root, "push", "state.json"), "utf8"));
  assert.equal(state.sent.o_creatine, "2026-11-12-12");

  const again = await main({ root, now: at("2026-11-12T18:37:00Z"), send });
  assert.equal(again.sent, 0);
});

test("la llave pública VAPID se decodifica a 65 bytes y el registro guarda solo lo necesario", () => {
  assert.equal(urlBase64ToUint8Array(VAPID_PUBLIC_KEY).length, 65);
  const r = subscriptionRecord({ endpoint: "https://e", keys: { p256dh: "p", auth: "a" }, expirationTime: null }, "dev1", "iPhone", 5);
  assert.deepEqual(r, { id: "dev1", device: "iPhone", endpoint: "https://e", keys: { p256dh: "p", auth: "a" }, at: 5 });
});

test("buildWeeklySummary resume entrenos y minutos por tipo, % de hábitos obligatorios y racha actual en <= 3 líneas", () => {
  const defs = [
    { id: "o_creatine", label: "Creatina", group: "req", kind: "check", target: 1 },
    { id: "o_water", label: "Agua", group: "req", kind: "count", target: 2 },
    { id: "f_read", label: "Leer", group: "opt", kind: "check", target: 1 },
    { id: "o_old", label: "Viejo", group: "req", kind: "check", target: 1, archived: true },
  ];
  const fullDay = { o_creatine: true, o_water: 2 };
  // Ventana de 7 días hasta 2026-11-12: del 2026-11-06 al 2026-11-12.
  const habits = {
    "2026-11-05": fullDay, // fuera de la ventana de 7d
    "2026-11-06": fullDay, // cumplido (1)
    "2026-11-07": { o_creatine: true, o_water: 1 }, // agua incompleta -> no cumplido
    "2026-11-08": fullDay, // cumplido (2)
    "2026-11-09": fullDay, // cumplido (3)
    "2026-11-10": fullDay, // cumplido (4)
    "2026-11-11": fullDay, // cumplido (5)
    "2026-11-12": { o_creatine: true, o_water: 0 }, // hoy aún pendiente -> racha conserva los 4 días hasta ayer
  };
  const workouts = [
    { id: "old", type: "Correr", kind: "run", start: "2026-11-04T12:00:00Z", min: 40 }, // fuera de 7d
    { id: "w1", type: "Fuerza", kind: "strength", start: "2026-11-07T13:00:00Z", min: 45 },
    { id: "w2", type: "Fuerza", kind: "strength", start: "2026-11-10T13:00:00Z", min: 40 },
    { id: "w3", type: "Correr", kind: "run", start: "2026-11-11T12:30:00Z", min: 30 },
    { id: "w4", type: "Caminata", kind: "walk", start: "2026-11-12T14:00:00Z", min: 25 },
  ];

  const summary = buildWeeklySummary(
    {
      habitDefs: { v: defs, at: 1 },
      habits: { v: habits, at: 1 },
      workouts: { v: workouts, at: 1 },
    },
    at("2026-11-12T18:07:00Z"),
  );

  assert.equal(summary.workoutsCount, 4);
  assert.equal(summary.totalMin, 140);
  assert.deepEqual(summary.byKind.strength, { count: 2, min: 85 });
  assert.deepEqual(summary.byKind.run, { count: 1, min: 30 });
  assert.deepEqual(summary.byKind.walk, { count: 1, min: 25 });
  assert.deepEqual(summary.byKind.bike, { count: 0, min: 0 });
  assert.equal(summary.habitDaysDone, 5);
  assert.equal(summary.habitPct, 71);
  assert.equal(summary.streak, 4);
  assert.ok(summary.body.split("\n").length <= 3);
  assert.match(summary.body, /Fuerza: 2 \(85 min\)/);
  assert.match(summary.body, /Running: 1 \(30 min\)/);
  assert.match(summary.body, /Caminata: 1 \(25 min\)/);
  assert.match(summary.body, /71% \(5\/7 días\)/);
  assert.match(summary.body, /Racha actual: 4 días/);

  // Si hoy también se completa, el cumplimiento sube a 6/7 (86%) y la racha sube a 5 días.
  habits["2026-11-12"] = fullDay;
  const summaryDoneToday = buildWeeklySummary({ habitDefs: { v: defs }, habits: { v: habits }, workouts: { v: workouts } }, "2026-11-12");
  assert.equal(summaryDoneToday.habitDaysDone, 6);
  assert.equal(summaryDoneToday.habitPct, 86);
  assert.equal(summaryDoneToday.streak, 5);
});

test("computeRequiredHabitStats y buildWeeklySummary manejan datos vacíos y rachas largas", () => {
  const empty = buildWeeklySummary({}, "2026-11-12");
  assert.equal(empty.workoutsCount, 0);
  assert.equal(empty.totalMin, 0);
  assert.equal(empty.habitDaysDone, 0);
  assert.equal(empty.habitPct, 0);
  assert.equal(empty.streak, 0);
  assert.match(empty.body, /0 entrenos \(0 min\)/);
  assert.match(empty.body, /0% \(0\/7 días\)/);

  const defs = [{ id: "o_creatine", group: "req", kind: "check", target: 1 }];
  const habits = {};
  for (let d = 1; d <= 12; d++) {
    habits[`2026-11-${String(d).padStart(2, "0")}`] = { o_creatine: true };
  }
  const st = computeRequiredHabitStats(defs, habits, "2026-11-12");
  assert.equal(st.daysDone, 7);
  assert.equal(st.pct, 100);
  assert.equal(st.streak, 12);
});

test("parseCliArgs y buildNoticePayload interpretan --aviso, --resumen y --test", () => {
  assert.deepEqual(
    parseCliArgs(["--aviso", "Renueva Google Health", "Corre el script en tu Mac"]),
    { mode: "aviso", test: false, title: "Renueva Google Health", body: "Corre el script en tu Mac", root: process.cwd() },
  );
  assert.deepEqual(
    parseCliArgs(["--resumen", "--test"]),
    { mode: "resumen", test: true, title: "", body: "", root: process.cwd() },
  );
  const p = buildNoticePayload("Renueva Google Health", "Corre el script en tu Mac");
  assert.equal(p.title, "Renueva Google Health");
  assert.equal(p.body, "Corre el script en tu Mac");
  assert.equal(p.tag, "espaldera-aviso");
});

test("main con --aviso envía sin horario silencioso y no modifica state.json", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-aviso-"));
  fs.mkdirSync(path.join(root, "push", "subs"), { recursive: true });
  const rec = (id) => ({ id, device: "iPhone", endpoint: `https://push.example/${id}`, keys: { p256dh: "x", auth: "y" } });
  fs.writeFileSync(path.join(root, "push", "subs", "a.json"), JSON.stringify(rec("a")));
  const bodies = [];
  const send = async (r, body) => { bodies.push(JSON.parse(body)); };

  // 11:55 p.m. hora de Costa Rica (dentro del horario silencioso de recordatorios normales)
  const res = await main({
    root,
    now: at("2026-11-13T05:55:00Z"),
    argv: ["--aviso", "Renueva Google Health", "Corre el script en tu Mac"],
    send,
  });

  assert.equal(res.sent, 1);
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].title, "Renueva Google Health");
  assert.equal(bodies[0].body, "Corre el script en tu Mac");
  assert.ok(!fs.existsSync(path.join(root, "push", "state.json")));
});

test("main con --resumen envía el resumen semanal y con --test imprime sin enviar", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-resumen-"));
  const sampleData = {
    habitDefs: { v: [{ id: "o_creatine", label: "Creatina", group: "req", kind: "check", target: 1 }], at: 1 },
    habits: {
      v: {
        "2026-11-10": { o_creatine: true },
        "2026-11-11": { o_creatine: true },
        "2026-11-12": { o_creatine: true },
      },
      at: 1,
    },
    workouts: {
      v: [
        { id: "w1", type: "Fuerza", kind: "strength", start: "2026-11-10T13:00:00Z", min: 45 },
        { id: "w2", type: "Correr", kind: "run", start: "2026-11-12T12:30:00Z", min: 30 },
      ],
      at: 1,
    },
  };
  fs.writeFileSync(path.join(root, "data.json"), JSON.stringify(sampleData));

  // Modo --resumen --test por línea de comandos real (sin suscripciones ni llaves VAPID)
  const scriptPath = path.resolve("scripts/recordatorios.mjs");
  const out = execFileSync(process.execPath, [scriptPath, "--resumen", "--test"], { cwd: root, encoding: "utf8" });
  assert.match(out, /Resumen semanal/);
  assert.match(out, /Entrenos \(7d\): 2 \(75 min\)/);
  assert.match(out, /Fuerza: 1 \(45 min\), Running: 1 \(30 min\)/);

  // Modo --resumen enviando a suscriptores
  fs.mkdirSync(path.join(root, "push", "subs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "push", "subs", "a.json"),
    JSON.stringify({ id: "a", device: "Mac", endpoint: "https://push.example/a", keys: { p256dh: "x", auth: "y" } }),
  );
  const bodies = [];
  const send = async (r, body) => { bodies.push(JSON.parse(body)); };
  const res = await main({ root, now: at("2026-11-12T18:00:00Z"), argv: ["--resumen"], send });
  assert.equal(res.sent, 1);
  assert.equal(bodies[0].title, "Resumen semanal");
  assert.match(bodies[0].body, /43% \(3\/7 días\)/);
  assert.match(bodies[0].body, /Racha actual: 3 días/);
});
