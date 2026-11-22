import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_MUSCLE_ORDER,
  buildExerciseCatalog,
  filterExerciseCatalog,
  resolveFreeExercise,
  createCustomExercise,
  getFreeExIds,
  addExercisesToFreeSession,
  removeExerciseFromFreeSession,
  moveExerciseInFreeSession,
  setFreeExerciseSeries,
  removeFreeExerciseFromSetLog,
  getLastFreeExerciseLog,
  buildFreeWorkoutSummary,
} from "../src/lib/freeWorkout.js";
import { MUSCLE_GROUPS } from "../src/lib/metrics.js";

test("FREE_MUSCLE_ORDER cubre los 11 grupos musculares requeridos", () => {
  assert.equal(FREE_MUSCLE_ORDER.length, 11);
  assert.equal(new Set(FREE_MUSCLE_ORDER).size, 11);
  for (const g of FREE_MUSCLE_ORDER) assert.ok(MUSCLE_GROUPS[g], `grupo desconocido ${g}`);
});

test("buildExerciseCatalog combina personalizados, biblioteca y rutinas sin duplicados por nombre", () => {
  const custom = [
    { id: "cus_100", name: "Curl araña", primaryGroup: "biceps", secondaryGroups: [] },
  ];
  const catalog = buildExerciseCatalog(custom);
  assert.equal(catalog[0].id, "cus_100");
  assert.equal(catalog[0].custom, true);

  // Incluye ejercicios propios de rutinas que no están en EXERCISE_LIBRARY
  assert.ok(catalog.some((e) => e.id === "d2a"), "debe incluir Sentadilla (barra o kettlebell) de Día 2");
  assert.ok(catalog.some((e) => e.id === "d3e"), "debe incluir elevaciones de talón de Día 3");

  // Un ejercicio presente en biblioteca y en rutina queda deduplicado y conserva aliasIds
  const pullup = catalog.find((e) => e.id === "lib_pullup_prona");
  assert.ok(pullup);
  assert.ok(pullup.aliasIds.includes("d1a1"), "conserva alias de Día 1 para historial");
});

test("filterExerciseCatalog filtra por texto sin tildes y por grupo muscular", () => {
  const catalog = buildExerciseCatalog([]);
  const bicepsOnly = filterExerciseCatalog(catalog, { group: "biceps" });
  assert.ok(bicepsOnly.some((e) => e.id === "lib_trx_curl"));
  assert.ok(!bicepsOnly.some((e) => e.id === "lib_trx_triceps"), "extensión de tríceps no debe salir en Bíceps");

  const tricepsOnly = filterExerciseCatalog(catalog, { group: "triceps" });
  assert.ok(tricepsOnly.some((e) => e.id === "lib_trx_triceps"));
  assert.ok(!tricepsOnly.some((e) => e.id === "lib_trx_curl"), "curl de bíceps no debe salir en Tríceps");

  const searchBiceps = filterExerciseCatalog(catalog, { query: "biceps" });
  assert.ok(searchBiceps.some((e) => e.id === "lib_trx_curl"));
});

test("createCustomExercise genera cus_<ts>, evita colisiones y valida campos", () => {
  assert.ok(createCustomExercise([], { name: "   ", primaryGroup: "biceps" }).error);
  assert.ok(createCustomExercise([], { name: "Curl", primaryGroup: "invalido" }).error);

  const r1 = createCustomExercise([], {
    name: "  Curl en barra Z  ",
    primaryGroup: "biceps",
    secondaryGroups: ["biceps", "upperBack", "upperBack"],
  }, 1700000123);
  assert.equal(r1.exercise.id, "cus_1700000123");
  assert.equal(r1.exercise.name, "Curl en barra Z");
  assert.deepEqual(r1.exercise.secondaryGroups, ["upperBack"]);
  assert.deepEqual(r1.exercise.muscles, { biceps: 1, upperBack: 0.5 });

  const r2 = createCustomExercise(r1.list, { name: "Otro", primaryGroup: "triceps" }, 1700000123);
  assert.equal(r2.exercise.id, "cus_1700000123_1");
  assert.equal(resolveFreeExercise("cus_1700000123", r2.list).name, "Curl en barra Z");
});

test("freeSessions y setLog.free: añadir, reordenar, guardar series, quitar y podar", () => {
  let fs = addExercisesToFreeSession({}, { date: "2026-11-22", exIds: ["lib_trx_curl", "lib_trx_triceps", "lib_trx_curl"] });
  assert.deepEqual(fs["2026-11-22"].exIds, ["lib_trx_curl", "lib_trx_triceps"]);

  fs = moveExerciseInFreeSession(fs, { date: "2026-11-22", exId: "lib_trx_triceps", direction: "up" });
  assert.deepEqual(fs["2026-11-22"].exIds, ["lib_trx_triceps", "lib_trx_curl"]);

  let setLog = setFreeExerciseSeries({
    setLog: {},
    date: "2026-11-22",
    exerciseId: "lib_trx_curl",
    series: [{ reps: "12", load: " 10 kg " }, { reps: "", load: "10 kg" }, { reps: "10", load: "12 kg" }],
  });
  assert.deepEqual(setLog["2026-11-22"].free.lib_trx_curl, [
    { reps: 12, load: "10 kg" },
    { reps: 10, load: "12 kg" },
  ]);

  assert.deepEqual(getFreeExIds(fs, setLog, "2026-11-22"), ["lib_trx_triceps", "lib_trx_curl"]);

  fs = removeExerciseFromFreeSession(fs, { date: "2026-11-22", exId: "lib_trx_curl" });
  setLog = removeFreeExerciseFromSetLog({ setLog, date: "2026-11-22", exerciseId: "lib_trx_curl" });
  assert.equal(setLog["2026-11-22"], undefined);
  assert.deepEqual(fs["2026-11-22"].exIds, ["lib_trx_triceps"]);

  // Poda a 90 días
  let many = {};
  for (let i = 1; i <= 95; i++) {
    many = addExercisesToFreeSession(many, { date: `2026-01-${String(i).padStart(2, "0")}`, exIds: ["lib_trx_curl"], maxDays: 90 });
  }
  assert.equal(Object.keys(many).length, 90);
});

test("getLastFreeExerciseLog busca hacia atrás incluyendo alias de rutinas", () => {
  const setLog = {
    "2026-11-10": {
      d1: {
        d1a1: [{ reps: 6, load: "BW" }, { reps: 5, load: "BW" }],
      },
    },
    "2026-11-18": {
      free: {
        lib_trx_curl: [{ reps: 12, load: "10 kg" }, { reps: 11, load: "10 kg" }],
      },
    },
    "2026-11-22": {
      free: {
        lib_trx_curl: [{ reps: 14, load: "10 kg" }],
      },
    },
  };
  const lastCurl = getLastFreeExerciseLog(setLog, "lib_trx_curl", "2026-11-22");
  assert.equal(lastCurl.date, "2026-11-18");
  assert.equal(lastCurl.summaryText, "10 kg · 12, 11 reps");

  const pullup = resolveFreeExercise("lib_pullup_prona");
  const lastPullup = getLastFreeExerciseLog(setLog, pullup.id, "2026-11-22", pullup.aliasIds);
  assert.equal(lastPullup.date, "2026-11-10");
  assert.equal(lastPullup.summaryText, "BW · 6, 5 reps");
});

test("buildFreeWorkoutSummary calcula series, volumen, grupos trabajados y marcas", () => {
  const custom = [{ id: "cus_1", name: "Curl pesado", primaryGroup: "biceps", secondaryGroups: [] }];
  const setLog = {
    "2026-11-15": {
      free: {
        cus_1: [{ reps: 10, load: "10 kg" }],
      },
    },
    "2026-11-22": {
      free: {
        cus_1: [{ reps: 10, load: "12 kg" }, { reps: 10, load: "12 kg" }],
      },
    },
  };
  const session = { date: "2026-11-22", rid: "free", startAt: 1000, lastAt: 1000, endAt: 1000 + 25 * 60000 };
  const s = buildFreeWorkoutSummary({
    exIds: ["cus_1"],
    customExercises: custom,
    setLog,
    date: "2026-11-22",
    session,
    now: 99999999,
  });
  assert.equal(s.setsDone, 2);
  assert.equal(s.exercisesDone, 1);
  assert.equal(s.volume, 240);
  assert.equal(s.durationMs, 25 * 60000);
  assert.equal(s.complete, true);
  assert.deepEqual(s.workedGroups, [{ group: "biceps", label: "Bíceps", sets: 2 }]);
  assert.equal(s.records.length, 1);
  assert.equal(s.records[0].type, "load");
});
