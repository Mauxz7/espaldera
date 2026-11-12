import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { localParts, dueHabits, planSend, buildPayload, main } from "../scripts/recordatorios.mjs";
import { isHabitDone as appIsHabitDone, DEFAULT_HABIT_DEFS } from "../src/data/habits.js";
import { isHabitDone } from "../scripts/recordatorios.mjs";
import { urlBase64ToUint8Array, subscriptionRecord, VAPID_PUBLIC_KEY } from "../src/lib/push.js";

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
