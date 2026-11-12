import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTargetReps,
  getPreviousSet,
  getLastExerciseLog,
  resolveDefaultSet,
  recordSet,
  removeSet,
  updateExerciseLoad,
} from "../src/lib/setLog.js";

test("parseTargetReps extrae el tope del rango o número principal", () => {
  assert.equal(parseTargetReps("4–6"), 6);
  assert.equal(parseTargetReps("8–10"), 10);
  assert.equal(parseTargetReps("10–15"), 15);
  assert.equal(parseTargetReps("8 / pierna"), 8);
  assert.equal(parseTargetReps("30 s"), 30);
  assert.equal(parseTargetReps(12), 12);
  assert.equal(parseTargetReps("Máx. / pierna"), "Máx. / pierna");
  assert.equal(parseTargetReps(null), 10);
});

test("getPreviousSet obtiene la serie previa completada", () => {
  assert.equal(getPreviousSet([], 0), null);
  assert.equal(getPreviousSet([{ reps: 6, load: "40 kg" }], 0), null);

  const series = [
    { reps: 6, load: "40 kg" },
    null,
    { reps: 5, load: "42 kg" },
  ];
  assert.deepEqual(getPreviousSet(series, 1), { reps: 6, load: "40 kg" });
  assert.deepEqual(getPreviousSet(series, 2), { reps: 6, load: "40 kg" });
  assert.deepEqual(getPreviousSet(series, 3), { reps: 5, load: "42 kg" });
});

test("recordSet y removeSet manejan el registro por serie de forma inmutable", () => {
  let log = {};
  log = recordSet({
    setLog: log,
    date: "2026-11-10",
    routineId: "d1",
    exerciseId: "d1a1",
    setIndex: 0,
    reps: 6,
    load: "10 kg",
  });
  assert.deepEqual(log["2026-11-10"]["d1"]["d1a1"], [{ reps: 6, load: "10 kg" }]);

  // Agrega serie 2 dejando hueco en serie 1
  log = recordSet({
    setLog: log,
    date: "2026-11-10",
    routineId: "d1",
    exerciseId: "d1a1",
    setIndex: 2,
    reps: 5,
    load: "10 kg",
  });
  assert.equal(log["2026-11-10"]["d1"]["d1a1"].length, 3);
  assert.equal(log["2026-11-10"]["d1"]["d1a1"][1], null);
  assert.deepEqual(log["2026-11-10"]["d1"]["d1a1"][2], { reps: 5, load: "10 kg" });

  // Desmarcar serie 2
  log = removeSet({
    setLog: log,
    date: "2026-11-10",
    routineId: "d1",
    exerciseId: "d1a1",
    setIndex: 2,
  });
  // Serie 2 eliminada, trailing nulls eliminados
  assert.equal(log["2026-11-10"]["d1"]["d1a1"].length, 1);

  // Desmarcar serie 0 limpia la estructura completa
  log = removeSet({
    setLog: log,
    date: "2026-11-10",
    routineId: "d1",
    exerciseId: "d1a1",
    setIndex: 0,
  });
  assert.equal(log["2026-11-10"], undefined);
});

test("recordSet recorta a maxDays (90 días por defecto)", () => {
  let log = {};
  for (let i = 1; i <= 95; i++) {
    const day = `2026-01-${String(i).padStart(2, "0")}`;
    log = recordSet({
      setLog: log,
      date: day,
      routineId: "d1",
      exerciseId: "d1a1",
      setIndex: 0,
      reps: 5,
      load: "40 kg",
      maxDays: 90,
    });
  }
  const dates = Object.keys(log);
  assert.equal(dates.length, 90);
  assert.ok(!log["2026-01-01"]);
  assert.ok(log["2026-01-95"]);
});

test("getLastExerciseLog encuentra la última sesión previa a la fecha", () => {
  const setLog = {
    "2026-11-01": {
      d1: {
        d1b1: [
          { reps: 10, load: "35 kg" },
          { reps: 10, load: "35 kg" },
        ],
      },
    },
    "2026-11-08": {
      d1: {
        d1b1: [
          { reps: 10, load: "40 kg" },
          { reps: 8, load: "40 kg" },
        ],
      },
    },
    "2026-11-12": {
      d1: {
        d1b1: [{ reps: 6, load: "42 kg" }],
      },
    },
  };

  // Buscando antes del 12 nov
  const last = getLastExerciseLog(setLog, "d1b1", "2026-11-12", "d1");
  assert.ok(last);
  assert.equal(last.date, "2026-11-08");
  assert.equal(last.load, "40 kg");
  assert.equal(last.repsSummary, "10, 8 reps");

  // Si no hay datos antes de una fecha
  const none = getLastExerciseLog(setLog, "d1b1", "2026-11-01", "d1");
  assert.equal(none, null);
});

test("resolveDefaultSet precarga de serie previa o sesión anterior", () => {
  // Caso 1: serie previa en la misma sesión
  const series = [{ reps: 6, load: "40 kg" }];
  const s1 = resolveDefaultSet({
    series,
    setIndex: 1,
    exReps: "4–6",
    currentLoad: "20 kg",
    lastLog: null,
  });
  assert.deepEqual(s1, { reps: 6, load: "40 kg" });

  // Caso 2: primera serie, con sesión anterior
  const lastLog = {
    date: "2026-11-08",
    series: [{ reps: 8, load: "35 kg" }, { reps: 7, load: "35 kg" }],
    load: "35 kg",
  };
  const s0WithLast = resolveDefaultSet({
    series: [],
    setIndex: 0,
    exReps: "6–8",
    currentLoad: "",
    lastLog,
  });
  assert.deepEqual(s0WithLast, { reps: 8, load: "35 kg" });

  // Caso 3: primera serie sin historial, usa exReps y currentLoad
  const s0Fresh = resolveDefaultSet({
    series: [],
    setIndex: 0,
    exReps: "8–10",
    currentLoad: "15 kg",
    lastLog: null,
  });
  assert.deepEqual(s0Fresh, { reps: 10, load: "15 kg" });
});

test("updateExerciseLoad actualiza la carga de series existentes", () => {
  let log = {
    "2026-11-10": {
      d1: {
        d1b1: [
          { reps: 10, load: "35 kg" },
          { reps: 8, load: "35 kg" },
        ],
      },
    },
  };
  log = updateExerciseLoad({
    setLog: log,
    date: "2026-11-10",
    routineId: "d1",
    exerciseId: "d1b1",
    load: "40 kg",
  });
  assert.deepEqual(log["2026-11-10"]["d1"]["d1b1"], [
    { reps: 10, load: "40 kg" },
    { reps: 8, load: "40 kg" },
  ]);
});
