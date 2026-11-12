import test from "node:test";
import assert from "node:assert/strict";
import { computeHabitStats, computeAllHabitStats } from "../src/lib/habitStats.js";
import { addDays, dkey, fromKey } from "../src/lib/dates.js";

test("computeHabitStats devuelve ceros y 30 días en falso cuando no hay registros", () => {
  const def = { id: "o_creatine", group: "req", kind: "check", target: 1 };
  const stats = computeHabitStats(def, {}, "2026-11-12");

  assert.equal(stats.id, "o_creatine");
  assert.equal(stats.currentStreak, 0);
  assert.equal(stats.bestStreak, 0);
  assert.equal(stats.done30, 0);
  assert.equal(stats.rate30, 0);
  assert.equal(stats.pct30, 0);
  assert.equal(stats.days30.length, 30);
  assert.equal(stats.days30[0].date, "2026-10-14");
  assert.equal(stats.days30[29].date, "2026-11-12");
  assert.ok(stats.days30.every((d) => d.done === false));
});

test("computeHabitStats calcula racha actual incluyendo hoy o manteniendo la de ayer si hoy está pendiente", () => {
  const def = { id: "o_creatine", group: "req", kind: "check", target: 1 };
  const today = "2026-11-12";

  // Caso 1: Ayer y anteayer cumplidos, hoy aún pendiente -> racha actual de 2
  const habitsPendingToday = {
    "2026-11-10": { o_creatine: true },
    "2026-11-11": { o_creatine: true },
  };
  const s1 = computeHabitStats(def, habitsPendingToday, today);
  assert.equal(s1.currentStreak, 2);
  assert.equal(s1.bestStreak, 2);
  assert.equal(s1.done30, 2);
  assert.equal(s1.rate30, Math.round((2 / 30) * 100));
  assert.equal(s1.days30[27].done, true);
  assert.equal(s1.days30[28].done, true);
  assert.equal(s1.days30[29].done, false);

  // Caso 2: Se marca hoy también -> racha sube a 3
  const habitsDoneToday = {
    ...habitsPendingToday,
    "2026-11-12": { o_creatine: true },
  };
  const s2 = computeHabitStats(def, habitsDoneToday, today);
  assert.equal(s2.currentStreak, 3);
  assert.equal(s2.bestStreak, 3);
  assert.equal(s2.done30, 3);
  assert.equal(s2.rate30, 10);
  assert.equal(s2.days30[29].done, true);

  // Caso 3: Anteayer cumplido, pero ayer no y hoy tampoco -> racha actual es 0, mejor racha es 1
  const habitsBrokenYesterday = {
    "2026-11-10": { o_creatine: true },
  };
  const s3 = computeHabitStats(def, habitsBrokenYesterday, today);
  assert.equal(s3.currentStreak, 0);
  assert.equal(s3.bestStreak, 1);
});

test("computeHabitStats distingue entre mejor racha histórica y racha actual", () => {
  const def = { id: "f_read", group: "opt", kind: "check", target: 1 };
  const today = "2026-11-12";
  const habits = {
    // Racha de 5 días a finales de octubre
    "2026-10-20": { f_read: true },
    "2026-10-21": { f_read: true },
    "2026-10-22": { f_read: true },
    "2026-10-23": { f_read: true },
    "2026-10-24": { f_read: true },
    // Hueco y luego racha actual de 2 días
    "2026-11-11": { f_read: true },
    "2026-11-12": { f_read: true },
  };

  const stats = computeHabitStats(def, habits, today);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.bestStreak, 5);
  assert.equal(stats.done30, 7);
  assert.equal(stats.rate30, Math.round((7 / 30) * 100));
});

test("computeHabitStats evalúa correctamente hábitos de tipo contador (count) y valores booleanos previos", () => {
  const waterDef = { id: "o_water", group: "req", kind: "count", target: 2, unit: "botellas" };
  const today = "2026-11-12";
  const habits = {
    "2026-11-08": { o_water: true }, // legado booleano: cuenta como cumplido
    "2026-11-09": { o_water: 2 },    // llega al target: cumplido
    "2026-11-10": { o_water: 1 },    // parcial (< 2): NO cumplido (rompe racha)
    "2026-11-11": { o_water: 3 },    // supera target: cumplido
    "2026-11-12": { o_water: 2 },    // llega al target: cumplido
  };

  const stats = computeHabitStats(waterDef, habits, today);
  assert.equal(stats.currentStreak, 2); // 11 y 12 de nov
  assert.equal(stats.bestStreak, 2);    // 8-9 de nov o 11-12 de nov
  assert.equal(stats.done30, 4);
  assert.equal(stats.rate30, Math.round((4 / 30) * 100));
});

test("computeHabitStats conserva rachas que superan los 30 días si existen en el historial", () => {
  const def = { id: "o_creatine", group: "req", kind: "check", target: 1 };
  const today = "2026-11-12";
  const todayDate = fromKey(today);
  const habits = {};

  // 35 días consecutivos cumplidos hasta hoy
  for (let i = 0; i < 35; i++) {
    const k = dkey(addDays(todayDate, -i));
    habits[k] = { o_creatine: true };
  }

  const stats = computeHabitStats(def, habits, today);
  assert.equal(stats.currentStreak, 35);
  assert.equal(stats.bestStreak, 35);
  assert.equal(stats.done30, 30);
  assert.equal(stats.rate30, 100);
});

test("computeAllHabitStats omite hábitos archivados y asigna códigos por grupo", () => {
  const defs = [
    { id: "o1", label: "Creatina", group: "req", kind: "check", target: 1 },
    { id: "o2", label: "Archivado", group: "req", kind: "check", target: 1, archived: true },
    { id: "f1", label: "Fruta", group: "opt", kind: "check", target: 1 },
  ];
  const habits = {
    "2026-11-12": { o1: true, o2: true, f1: false },
  };

  const all = computeAllHabitStats(defs, habits, "2026-11-12");
  assert.equal(all.length, 2);
  assert.equal(all[0].id, "o1");
  assert.equal(all[0].code, "O1");
  assert.equal(all[0].currentStreak, 1);
  assert.equal(all[1].id, "f1");
  assert.equal(all[1].code, "F1");
  assert.equal(all[1].currentStreak, 0);
});
