import test from "node:test";
import assert from "node:assert/strict";
import { RUN_PLAN, MIN_RUN_LEVEL, MAX_RUN_LEVEL, getRunLevel } from "../src/data/runPlan.js";
import {
  DEFAULT_RUN_LEVEL,
  getEffectiveRunLevel,
  applyInactivityDecay,
  recordRunSession,
} from "../src/lib/runProgress.js";
import { routineById, effSets } from "../src/data/program.js";

test("RUN_PLAN define una progresión suave de 9 niveles de bajo impacto", () => {
  assert.equal(RUN_PLAN.length, 9);
  assert.equal(MIN_RUN_LEVEL, 1);
  assert.equal(MAX_RUN_LEVEL, 9);

  for (let i = 0; i < RUN_PLAN.length; i++) {
    const lvl = RUN_PLAN[i];
    assert.equal(lvl.level, i + 1);
    assert.ok(lvl.reps >= 1);
    assert.ok(lvl.runMin >= 1);
    assert.ok(lvl.walkMin >= 1);
    assert.ok(lvl.warmupMin >= 1);
    assert.ok(lvl.cooldownMin >= 1);
    assert.ok(typeof lvl.note === "string" && lvl.note.length > 0);
    if (i > 0) {
      // Sin saltos grandes entre niveles (máximo +1 min de trote por bloque)
      assert.ok(lvl.runMin - RUN_PLAN[i - 1].runMin <= 1);
    }
  }
});

test("avanza un nivel al completar la sesión de running y no avanza dos veces el mismo día", () => {
  let state = DEFAULT_RUN_LEVEL;
  assert.equal(state.level, 1);

  state = recordRunSession(state, { date: "2026-10-01", done: true });
  assert.equal(state.level, 2);
  assert.equal(state.lastDone, "2026-10-01");
  assert.deepEqual(state.history, [{ date: "2026-10-01", done: true, level: 1 }]);

  // Intentar registrar otra vez el mismo día no vuelve a subir de nivel
  const duplicate = recordRunSession(state, { date: "2026-10-01", done: true });
  assert.equal(duplicate.level, 2);
  assert.equal(duplicate.history.length, 1);
});

test("repite el nivel si la sesión no se completó antes de 14 días", () => {
  const initial = {
    level: 4,
    lastDone: "2026-10-01",
    history: [{ date: "2026-10-01", done: true }],
  };

  const next = recordRunSession(initial, { date: "2026-10-08", done: false });
  assert.equal(next.level, 4);
  assert.equal(next.lastDone, "2026-10-01");
  assert.deepEqual(next.history.at(-1), { date: "2026-10-08", done: false });
});

test("retrocede un nivel si pasaron 14 días o más sin una sesión de running completada", () => {
  const initial = {
    level: 4,
    lastDone: "2026-10-01",
    history: [{ date: "2026-10-01", done: true }],
  };

  // A los 13 días todavía mantiene el nivel 4
  assert.equal(getEffectiveRunLevel(initial, "2026-10-14"), 4);

  // A los 14 días exactos retrocede al nivel 3
  assert.equal(getEffectiveRunLevel(initial, "2026-10-15"), 3);

  const decayed = applyInactivityDecay(initial, "2026-10-15");
  assert.equal(decayed.level, 3);
  assert.equal(decayed.lastDone, "2026-10-01");

  // No vuelve a retroceder al día siguiente si ya se aplicó el retroceso
  const nextDay = applyInactivityDecay(decayed, "2026-10-16");
  assert.equal(nextDay.level, 3);

  // También retrocede cuando se registra una sesión incompleta tras >= 14 días
  const fromIncomplete = recordRunSession(initial, { date: "2026-10-20", done: false });
  assert.equal(fromIncomplete.level, 3);
});

test("nunca baja de 1 ni pasa del último nivel", () => {
  const atMin = {
    level: 1,
    lastDone: "2026-10-01",
    history: [{ date: "2026-10-01", done: true }],
  };
  assert.equal(getEffectiveRunLevel(atMin, "2026-10-25"), 1);
  assert.equal(applyInactivityDecay(atMin, "2026-10-25").level, 1);
  assert.equal(recordRunSession(atMin, { date: "2026-10-25", done: false }).level, 1);

  const atMax = {
    level: MAX_RUN_LEVEL,
    lastDone: "2026-10-01",
    history: [{ date: "2026-10-01", done: true }],
  };
  const afterMax = recordRunSession(atMax, { date: "2026-10-08", done: true });
  assert.equal(afterMax.level, MAX_RUN_LEVEL);
  assert.equal(afterMax.lastDone, "2026-10-08");
});

test("Día 3 toma series y tiempos del nivel actual sin cambiar tobillos, talones ni tibial", () => {
  const d3Lvl1 = routineById("d3", 1);
  const d3Lvl3 = routineById("d3", 3);
  const lvl3 = getRunLevel(3);

  const ex3b = d3Lvl3.exercises.find((e) => e.id === "d3b");
  const ex3c = d3Lvl3.exercises.find((e) => e.id === "d3c");
  const ex3d = d3Lvl3.exercises.find((e) => e.id === "d3d");

  assert.equal(ex3b.reps, `${lvl3.warmupMin} min`);
  assert.equal(ex3c.sets, lvl3.reps);
  assert.equal(effSets(ex3c, 4), lvl3.reps);
  assert.equal(ex3c.reps, `${lvl3.runMin} min de trote`);
  assert.equal(ex3c.rest, lvl3.walkMin * 60);
  assert.equal(ex3d.reps, `${lvl3.cooldownMin} min`);

  // El resto del Día 3 (d3a, d3e, d3f) no cambia entre niveles
  for (const id of ["d3a", "d3e", "d3f"]) {
    assert.deepEqual(
      d3Lvl1.exercises.find((e) => e.id === id),
      d3Lvl3.exercises.find((e) => e.id === id),
    );
  }
});

test("getDisplayRunLevel mantiene el nivel corrido el mismo día y muestra el nuevo al día siguiente", async () => {
  const { getDisplayRunLevel, recordRunSession } = await import("../src/lib/runProgress.js");
  const after = recordRunSession({ level: 3, lastDone: null, history: [] }, { date: "2026-11-14", done: true });
  assert.equal(after.level, 4);
  assert.equal(getDisplayRunLevel(after, "2026-11-14"), 3);
  assert.equal(getDisplayRunLevel(after, "2026-11-21"), 4);
});

test("undoRunSession revierte el avance al quitar el registro del día", async () => {
  const { undoRunSession, recordRunSession } = await import("../src/lib/runProgress.js");
  const before = recordRunSession({ level: 2, lastDone: null, history: [] }, { date: "2026-11-07", done: true });
  const after = recordRunSession(before, { date: "2026-11-14", done: true });
  assert.equal(after.level, 4);
  const undone = undoRunSession(after, "2026-11-14");
  assert.equal(undone.level, 3);
  assert.equal(undone.lastDone, "2026-11-07");
  assert.equal(undone.history.length, 1);
});
