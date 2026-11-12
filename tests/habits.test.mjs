import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_HABIT_DEFS,
  isHabitDone,
  reqDone,
  optDone,
  CREATINE_ID,
} from "../src/data/habits.js";

test("DEFAULT_HABIT_DEFS incluye los 7 hábitos originales con sus mismos IDs más «Comer una fruta»", () => {
  assert.equal(DEFAULT_HABIT_DEFS.length, 8);
  const ids = DEFAULT_HABIT_DEFS.map((h) => h.id);
  const expectedOriginal = [
    "o_creatine",
    "o_prep",
    "o_water",
    "o_pills",
    "o_screens",
    "f_read",
    "f_shake",
  ];
  for (const id of expectedOriginal) {
    assert.ok(ids.includes(id), `Falta el hábito original ${id}`);
  }
  const fruit = DEFAULT_HABIT_DEFS.find((h) => h.id === "f_fruit");
  assert.ok(fruit, "Debe existir el hábito de la fruta");
  assert.equal(fruit.group, "opt");
  assert.match(fruit.label, /fruta/i);

  // Comprobar la estructura de cada hábito
  for (const h of DEFAULT_HABIT_DEFS) {
    assert.ok(typeof h.id === "string" && h.id.length > 0);
    assert.ok(typeof h.label === "string" && h.label.length > 0);
    assert.ok(h.group === "req" || h.group === "opt");
    assert.ok(h.kind === "check" || h.kind === "count");
    assert.ok(typeof h.target === "number");
    assert.ok("unit" in h);
    assert.ok("remindAt" in h);
  }
});

test("isHabitDone evalúa casillas (kind: check)", () => {
  const checkDef = { id: "test_check", kind: "check", target: 1 };
  assert.equal(isHabitDone(checkDef, true), true);
  assert.equal(isHabitDone(checkDef, false), false);
  assert.equal(isHabitDone(checkDef, undefined), false);
  assert.equal(isHabitDone(checkDef, null), false);
  assert.equal(isHabitDone(checkDef, 1), true);
  assert.equal(isHabitDone(checkDef, 0), false);
});

test("isHabitDone evalúa contadores (kind: count)", () => {
  const countDef = { id: "water", kind: "count", target: 2, unit: "botellas" };

  // Los valores true ya guardados siguen valiendo como cumplido
  assert.equal(isHabitDone(countDef, true), true);

  // Valores numéricos comparados contra target
  assert.equal(isHabitDone(countDef, 0), false);
  assert.equal(isHabitDone(countDef, 1), false);
  assert.equal(isHabitDone(countDef, 2), true);
  assert.equal(isHabitDone(countDef, 3), true);

  // Valores ausentes o false
  assert.equal(isHabitDone(countDef, false), false);
  assert.equal(isHabitDone(countDef, undefined), false);
  assert.equal(isHabitDone(countDef, null), false);
});

test("reqDone y optDone calculan el cumplimiento de hábitos activos", () => {
  const customDefs = [
    { id: "o1", group: "req", kind: "check", target: 1 },
    { id: "o2", group: "req", kind: "count", target: 3 },
    { id: "o3", group: "req", kind: "check", target: 1, archived: true }, // archivado no cuenta
    { id: "f1", group: "opt", kind: "check", target: 1 },
    { id: "f2", group: "opt", kind: "count", target: 2 },
    { id: "f3", group: "opt", kind: "check", target: 1, archived: true }, // archivado no cuenta
  ];

  // Caso 1: Nada completado
  assert.equal(reqDone({}, customDefs), 0);
  assert.equal(optDone({}, customDefs), 0);

  // Caso 2: Parcialmente completado
  const h1 = {
    o1: true,
    o2: 2, // falta 1 para llegar a 3
    f1: false,
    f2: 2, // completado
  };
  assert.equal(reqDone(h1, customDefs), 1); // solo o1
  assert.equal(optDone(h1, customDefs), 1); // solo f2

  // Caso 3: o2 completado con número y o1 completado con true
  const h2 = {
    o1: true,
    o2: 3,
    o3: true, // archivado: no debe sumar
    f1: true,
    f2: 2,
    f3: true, // archivado: no debe sumar
  };
  assert.equal(reqDone(h2, customDefs), 2); // o1 y o2
  assert.equal(optDone(h2, customDefs), 2); // f1 y f2

  // Caso 4: o2 completado con valor booleano previo true
  const h3 = {
    o1: true,
    o2: true, // true histórico vale como cumplido
  };
  assert.equal(reqDone(h3, customDefs), 2);
});

test("reqDone y optDone funcionan con DEFAULT_HABIT_DEFS por defecto", () => {
  const h = {
    [CREATINE_ID]: true,
    o_prep: true,
    f_read: true,
  };
  assert.equal(reqDone(h), 2);
  assert.equal(optDone(h), 1);
  assert.equal(reqDone(null), 0);
  assert.equal(optDone(null), 0);
});
