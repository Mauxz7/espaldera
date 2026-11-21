import test from "node:test";
import assert from "node:assert/strict";
import { EQ, ROUTINES, routineById, variantsFor } from "../src/data/program.js";
import { SUBS, EXERCISE_LIBRARY, PATTERNS, altFor } from "../src/data/subs.js";
import {
  resolveVariantId,
  getActiveRoutine,
  setRoutineVariant,
  isExerciseSkipped,
  toggleSkipExercise,
  computeRoutineProgress,
  getAlternativesForExercise,
} from "../src/lib/routines.js";

test("EQ incluye correas, rueda abdominal, tabla inclinada y paralelas además del equipo previo", () => {
  for (const key of ["ladder", "dips", "trx", "wheel", "board", "bar", "db", "kb", "mb", "bw", "run", "bike"]) {
    assert.ok(EQ[key], `falta equipo ${key}`);
  }
});

test("todos los ejercicios en ROUTINES, variantes, SUBS y EXERCISE_LIBRARY son válidos y sin IDs repetidos en una misma rutina", () => {
  const validEq = new Set(Object.keys(EQ));
  const validPatterns = new Set(Object.keys(PATTERNS));
  const checkExercise = (ex, ctx) => {
    assert.ok(ex.id && typeof ex.id === "string", `${ctx}: falta id`);
    assert.ok(ex.name && typeof ex.name === "string", `${ctx}: falta name`);
    assert.ok(Array.isArray(ex.eq) && ex.eq.length > 0, `${ctx}: eq vacío en ${ex.id}`);
    for (const e of ex.eq) assert.ok(validEq.has(e), `${ctx}: equipo desconocido ${e} en ${ex.id}`);
    assert.ok(validPatterns.has(ex.pattern), `${ctx}: pattern inválido ${ex.pattern} en ${ex.id}`);
  };

  for (const r of ROUTINES) {
    const ids = new Set();
    for (const ex of r.exercises) {
      checkExercise(ex, `base:${r.id}`);
      assert.ok(!ids.has(ex.id), `id duplicado ${ex.id} en ${r.id}`);
      ids.add(ex.id);
    }
    for (const v of r.variants || []) {
      const vids = new Set();
      assert.ok(v.id && v.label && v.name && v.minutes > 0, `variante incompleta en ${r.id}`);
      for (const ex of v.exercises) {
        checkExercise(ex, `${r.id}:${v.id}`);
        assert.ok(!vids.has(ex.id), `id duplicado ${ex.id} en ${r.id}:${v.id}`);
        vids.add(ex.id);
      }
    }
  }

  for (const [exId, list] of Object.entries(SUBS)) {
    for (const sub of list) {
      assert.ok(sub.id && sub.name, `sub incompleto en ${exId}`);
      for (const e of sub.eq) assert.ok(validEq.has(e), `equipo desconocido ${e} en SUBS.${exId}.${sub.id}`);
    }
  }

  const libIds = new Set();
  for (const item of EXERCISE_LIBRARY) {
    assert.ok(!libIds.has(item.id), `id duplicado en biblioteca: ${item.id}`);
    libIds.add(item.id);
    checkExercise(item, "library");
  }
});

test("Día 4 base reemplaza Turkish get-up y Suitcase march manteniendo thruster, complejo KB, negativas y L-sit", () => {
  const d4 = routineById("d4");
  const ids = d4.exercises.map((e) => e.id);
  assert.deepEqual(ids, ["d4a", "d4b", "d4c1", "d4c2p", "d4d1", "d4d2s"]);
  assert.equal(d4.exercises.find((e) => e.id === "d4c2p").name, "Press de pecho en correas");
  assert.equal(d4.exercises.find((e) => e.id === "d4d2s").name, "Swings con KB");
});

test("las variantes nuevas existen y routineById mantiene compatibilidad hacia atrás", () => {
  assert.deepEqual(variantsFor("d1").map((v) => v.id), ["base", "trx"]);
  assert.deepEqual(variantsFor("d2").map((v) => v.id), ["base", "uni"]);
  assert.deepEqual(variantsFor("d3"), []);
  assert.deepEqual(variantsFor("d4").map((v) => v.id), ["base", "bar_trx", "express"]);
  assert.deepEqual(variantsFor("low").map((v) => v.id), ["base", "trx_upper"]);

  assert.equal(routineById("d1").name, "Torso Fuerza / Calistenia");
  assert.equal(routineById("d1", 1, "trx").name, "Torso en Correas & Hipertrofia");
  assert.equal(routineById("d2", undefined, "uni").name, "Pierna Unilateral & Estabilidad");
  assert.equal(routineById("d4", undefined, "bar_trx").name, "Full Body · Barra & Correas");
  assert.equal(routineById("d4", undefined, "express").minutes, 30);
  assert.equal(routineById("low", undefined, "trx_upper").name, "Torso Express en Correas (20 min)");
  // Variante desconocida cae a la primera variante (base)
  assert.equal(routineById("d1", 1, "inexistente").variantId, "base");
});

test("altFor resuelve tanto sustitutos directos como ejercicios de EXERCISE_LIBRARY", () => {
  assert.equal(altFor("d1a1", "chin").name, "Dominadas supinas");
  assert.equal(altFor("d1a1", "lib_trx_row").name, "Remo invertido en correas");
  assert.equal(altFor("d1a1", "no_existe"), null);
  assert.equal(altFor("d1a1", null), null);
});

test("resolveVariantId, setRoutineVariant y getActiveRoutine gestionan la variante elegida", () => {
  assert.equal(resolveVariantId("d1", {}), "base");
  assert.equal(resolveVariantId("d1", { d1: "trx" }), "trx");
  assert.equal(resolveVariantId("d1", { d1: "vieja" }), "base");
  assert.equal(resolveVariantId("d3", { d3: "algo" }), null);

  const next = setRoutineVariant({ d1: "base" }, "d4", "express");
  assert.deepEqual(next, { d1: "base", d4: "express" });
  assert.equal(getActiveRoutine("d4", { routineVariants: next }).minutes, 30);
  assert.deepEqual(setRoutineVariant({ d1: "trx" }, "d1", "invalida"), { d1: "trx" });
});

test("toggleSkipExercise marca/desmarca bloques y poda a 21 días", () => {
  let skips = {};
  for (let i = 1; i <= 25; i++) {
    const date = `2026-10-${String(i).padStart(2, "0")}`;
    skips = toggleSkipExercise(skips, { date, rid: "d4", exId: "d4a", maxDays: 21 });
  }
  assert.equal(Object.keys(skips).length, 21);
  assert.equal(isExerciseSkipped(skips, "2026-10-01", "d4", "d4a"), false);
  assert.equal(isExerciseSkipped(skips, "2026-10-25", "d4", "d4a"), true);

  skips = toggleSkipExercise(skips, { date: "2026-10-25", rid: "d4", exId: "d4a", maxDays: 21 });
  assert.equal(isExerciseSkipped(skips, "2026-10-25", "d4", "d4a"), false);
  assert.equal(skips["2026-10-25"], undefined);
});

test("computeRoutineProgress excluye saltados y no marca 100 % si todos fueron saltados", () => {
  const exercises = [
    { id: "a", sets: 3 },
    { id: "b", sets: 2 },
  ];
  const res1 = computeRoutineProgress(exercises, {
    daySetLog: { a: [{ reps: 5 }, { reps: 5 }, { reps: 5 }] },
    daySkips: { b: true },
    week: 1,
  });
  assert.equal(res1.activeExercises.length, 1);
  assert.equal(res1.skippedExercises.length, 1);
  assert.equal(res1.done, 3);
  assert.equal(res1.total, 3);
  assert.equal(res1.progress, 1);

  const allSkipped = computeRoutineProgress(exercises, {
    daySkips: { a: true, b: true },
    week: 1,
  });
  assert.equal(allSkipped.total, 0);
  assert.equal(allSkipped.progress, 0);
});

test("getAlternativesForExercise separa sugeridas, mismo patrón y otros patrones sin duplicados", () => {
  const d1 = routineById("d1");
  const ex = d1.exercises.find((e) => e.id === "d1b1"); // Remo inclinado con barra (pull_h)
  const { suggested, samePattern, otherPatterns } = getAlternativesForExercise(ex);

  assert.ok(suggested.length > 0);
  const allNames = [ex.name, ...suggested.map((s) => s.name)];
  for (const item of samePattern) {
    assert.equal(item.pattern, "pull_h");
    assert.ok(!allNames.includes(item.name), `duplicado en samePattern: ${item.name}`);
  }
  assert.equal(otherPatterns.pull_h, undefined);
  assert.ok(Array.isArray(otherPatterns.push_h) && otherPatterns.push_h.length > 0);
});
