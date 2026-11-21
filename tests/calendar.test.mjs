import test from "node:test";
import assert from "node:assert/strict";
import { calNight, calExamSoon, buildCalPlan, planFile } from "../src/lib/calendar.js";
import { scorePlan, weekState } from "../src/lib/planner.js";
import { windowDates, endTime, eventFor, planChanges, busyFromEvents, crDate } from "../scripts/calendario.mjs";

const keys = Array.from({ length: 7 }, (_, i) => `2026-11-${String(16 + i).padStart(2, "0")}`); // lunes 16 → domingo 22
const busy = (days) => ({ days });

test("calNight: sin datos la noche queda ocupada; con datos, libre si nada la ocupa", () => {
  assert.deepEqual(calNight(null, keys.slice(0, 2)), [false, false]);
  assert.deepEqual(calNight(busy({ "2026-11-16": { nightBusy: true }, "2026-11-17": { nightBusy: false } }), keys.slice(0, 3)), [false, true, false]);
});

test("calExamSoon marca el día del examen y el anterior (también cruzando de semana)", () => {
  const b = busy({ "2026-11-18": { exam: "Examen" }, "2026-11-23": { exam: "Entrega" } });
  assert.deepEqual(calExamSoon(b, keys), [false, true, true, false, false, false, true]);
});

test("scorePlan castiga sesiones cerca de un examen, más si son pierna o full body", () => {
  const office = Array(7).fill(false);
  const arr = ["d2", null, null, null, null, null, null];
  const exam = [true, false, false, false, false, false, false];
  const base = scorePlan(arr, office, null, null);
  assert.equal(scorePlan(arr, office, null, null, exam) - base, 8);
  assert.equal(scorePlan(["d1", null, null, null, null, null, null], office, null, null, exam) - scorePlan(["d1", null, null, null, null, null, null], office, null, null), 4);
});

test("weekState: las noches salen del calendario salvo que las hayas marcado esa semana", () => {
  const b = busy({ "2026-11-18": { nightBusy: false }, "2026-11-19": { nightBusy: true } });
  const auto = weekState({}, {}, "2026-11-16", [], b);
  assert.equal(auto.night[2], true);
  assert.equal(auto.night[3], false);
  const manual = weekState({ "2026-11-16": { office: Array(7).fill(true), night: Array(7).fill(false) } }, {}, "2026-11-16", [], b);
  assert.equal(manual.night[2], false); // tu marca gana
});

test("buildCalPlan: solo días con sesión, hora de mañana o de noche y duración de la rutina", () => {
  const items = buildCalPlan([
    { date: "2026-11-16", rid: "d1", office: true, evening: false },
    { date: "2026-11-17", rid: null },
    { date: "2026-11-18", rid: "d2", office: true, evening: true },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].start, "06:30");
  assert.equal(items[1].start, "19:00");
  assert.match(items[0].title, /^🏋️ Día 1 · /);
  assert.ok(items[0].min > 0 && items[0].desc.includes("•"));
  assert.equal(planFile(items), planFile(items)); // estable: no cambia si el plan no cambia

  const custom = buildCalPlan([{ date: "2026-11-21", rid: "d4", office: false, evening: false }], { d4: "express" });
  assert.equal(custom[0].min, 30);
  assert.match(custom[0].title, /Metabólico Express/);
});

test("fechas y horas de Costa Rica", () => {
  assert.equal(crDate("2026-11-16T03:30:00Z"), "2026-11-15"); // 9:30 p.m. del domingo en CR
  const w = windowDates(new Date("2026-11-16T05:00:00Z"), 3);
  assert.deepEqual(w, ["2026-11-15", "2026-11-16", "2026-11-17"]);
  assert.equal(endTime("06:30", 45), "07:15");
  const ev = eventFor({ date: "2026-11-16", title: "t", desc: "d", start: "19:00", min: 38 });
  assert.equal(ev.start.dateTime, "2026-11-16T19:00:00-06:00");
  assert.equal(ev.end.dateTime, "2026-11-16T19:38:00-06:00");
  assert.equal(ev.extendedProperties.private.shiftKey, "2026-11-16");
});

test("planChanges: crea, actualiza, borra y no toca fechas fuera de la ventana", () => {
  const dates = ["2026-11-16", "2026-11-17", "2026-11-18"];
  const item = (date, title) => ({ date, title, desc: "", start: "06:30", min: 40 });
  const ev = (id, it) => ({ id, ...eventFor(it) });
  const existing = [
    ev("a", item("2026-11-16", "igual")),
    ev("b", item("2026-11-17", "viejo")),
    ev("c", item("2026-11-18", "se quita")),
    ev("d", item("2026-11-10", "pasado")),
    { id: "e", summary: "ajeno" },
  ];
  const ch = planChanges(existing, [item("2026-11-16", "igual"), item("2026-11-17", "nuevo"), item("2026-11-25", "lejos")], dates);
  assert.equal(ch.insert.length, 0);
  assert.deepEqual(ch.patch.map((p) => p.id), ["b"]);
  assert.deepEqual(ch.remove, ["c"]);
  const ch2 = planChanges([], [item("2026-11-18", "x")], dates);
  assert.equal(ch2.insert.length, 1);
});

test("busyFromEvents: noches ocupadas y exámenes; ignora libres, todo el día, rechazados y entrenos viejos", () => {
  const dates = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"];
  const t = (d, a, b, extra = {}) => ({ start: { dateTime: `${d}T${a}:00-06:00` }, end: { dateTime: `${d}T${b}:00-06:00` }, summary: "Clase", ...extra });
  const b = busyFromEvents([
    t("2026-11-16", "16:00", "21:50"),
    t("2026-11-17", "15:00", "16:00", { transparency: "transparent" }),
    t("2026-11-17", "20:15", "21:00", { summary: "🏋️ Ejercicio - Pull" }),
    t("2026-11-17", "16:00", "18:00", { summary: "DE2012 | Examen" }),
    t("2026-11-18", "19:00", "20:00", { attendees: [{ self: true, responseStatus: "declined" }] }),
    t("2026-11-19", "17:00", "18:30"), // termina justo cuando empieza la noche
    { start: { date: "2026-11-19" }, end: { date: "2026-11-20" }, summary: "Feriado" },
  ], dates);
  assert.equal(b.days["2026-11-16"].nightBusy, true);
  assert.equal(b.days["2026-11-17"].nightBusy, false);
  assert.equal(b.days["2026-11-17"].exam, "DE2012 | Examen");
  assert.equal(b.days["2026-11-18"].nightBusy, false);
  assert.equal(b.days["2026-11-19"].nightBusy, false);
});
