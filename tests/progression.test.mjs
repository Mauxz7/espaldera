import test from "node:test";
import assert from "node:assert/strict";
import { parseRepRange, suggestProgression } from "../src/lib/progression.js";

test("parseRepRange interpreta rangos, valores fijos, segundos y lados", () => {
  assert.deepEqual(parseRepRange("4–6"), {
    min: 4,
    max: 6,
    unit: "reps",
    perSide: null,
  });
  assert.deepEqual(parseRepRange("8-10 / lado"), {
    min: 8,
    max: 10,
    unit: "reps",
    perSide: "lado",
  });
  assert.deepEqual(parseRepRange("6–8 / pierna"), {
    min: 6,
    max: 8,
    unit: "reps",
    perSide: "pierna",
  });
  assert.deepEqual(parseRepRange("10–20 s"), {
    min: 10,
    max: 20,
    unit: "s",
    perSide: null,
  });
  assert.deepEqual(parseRepRange("10"), {
    min: 10,
    max: 10,
    unit: "reps",
    perSide: null,
  });
  assert.deepEqual(parseRepRange("8 / pierna"), {
    min: 8,
    max: 8,
    unit: "reps",
    perSide: "pierna",
  });
  assert.deepEqual(parseRepRange(12), {
    min: 12,
    max: 12,
    unit: "reps",
    perSide: null,
  });

  // No progresables por reps simples
  assert.equal(parseRepRange("Máx. / pierna"), null);
  assert.equal(parseRepRange("4 min"), null);
  assert.equal(parseRepRange("12 + 30 s / pierna"), null);
  assert.equal(parseRepRange("1 ronda (20 reps)"), null);
  assert.equal(parseRepRange(null), null);
});

test("suggestProgression sugiere subir 1 repetición cuando se completa dentro del rango sin llegar al tope", () => {
  const history = [
    { reps: 8, load: "40 kg" },
    { reps: 8, load: "40 kg" },
    { reps: 8, load: "40 kg" },
  ];

  const res = suggestProgression(history, "8–10", 3);
  assert.ok(res);
  assert.equal(res.type, "reps");
  assert.equal(res.targetReps, 9);
  assert.equal(res.targetSets, 3);
  assert.equal(res.load, "40 kg");
  assert.match(res.text, /3 × 9 reps/);
  assert.match(res.text, /\+1 rep/);
});

test("suggestProgression sugiere subir carga al llegar al tope del rango en todas las series", () => {
  const history = {
    d: "2026-11-08",
    v: "40 kg",
    series: [
      { reps: 10, load: "40 kg" },
      { reps: 10, load: "40 kg" },
      { reps: 10, load: "40 kg" },
    ],
  };

  const res = suggestProgression(history, "8–10", 3);
  assert.ok(res);
  assert.equal(res.type, "load");
  assert.equal(res.targetReps, 8);
  assert.equal(res.targetSets, 3);
  assert.equal(res.load, "40 kg");
  assert.match(res.text, /sube carga/i);
  assert.match(res.text, /3 × 8 reps/);
});

test("suggestProgression sugiere repetir cuando faltaron series por completar", () => {
  const history = [
    { reps: 9, load: "40 kg" },
    { reps: 9, load: "40 kg" },
  ];

  const res = suggestProgression(history, "8–10", 3);
  assert.ok(res);
  assert.equal(res.type, "repeat");
  assert.equal(res.targetReps, 9);
  assert.equal(res.targetSets, 3);
  assert.equal(res.load, "40 kg");
  assert.match(res.text, /repite 3 × 9 reps/i);
});

test("suggestProgression sugiere repetir el mínimo del rango si alguna serie quedó por debajo", () => {
  const history = [
    { reps: 8, load: "40 kg" },
    { reps: 8, load: "40 kg" },
    { reps: 6, load: "40 kg" },
  ];

  const res = suggestProgression(history, "8–10", 3);
  assert.ok(res);
  assert.equal(res.type, "repeat");
  assert.equal(res.targetReps, 8);
  assert.equal(res.targetSets, 3);
  assert.match(res.text, /repite 3 × 8 reps/i);
});

test("suggestProgression funciona con objeto de opciones y setLog completo", () => {
  const setLog = {
    "2026-11-08": {
      d1: {
        d1a1: [
          { reps: 5, load: "" },
          { reps: 5, load: "" },
          { reps: 5, load: "" },
          { reps: 5, load: "" },
        ],
      },
    },
  };

  const res = suggestProgression({
    setLog,
    exerciseId: "d1a1",
    routineId: "d1",
    beforeDate: "2026-11-12",
    reps: "4–6",
    targetSets: 4,
  });

  assert.ok(res);
  assert.equal(res.type, "reps");
  assert.equal(res.targetReps, 6);
  assert.equal(res.targetSets, 4);
  assert.equal(res.load, "");
});

test("suggestProgression devuelve null cuando no hay historial o el rango no es numérico", () => {
  assert.equal(suggestProgression(null, "8–10", 3), null);
  assert.equal(suggestProgression([], "8–10", 3), null);
  assert.equal(
    suggestProgression([{ reps: 8, load: "" }], "Máx. / pierna", 3),
    null
  );
});

test("suggestProgression sin carga registrada sugiere lastre o variante en vez de subir carga", () => {
  const res = suggestProgression([{ reps: 6 }, { reps: 6 }, { reps: 6 }, { reps: 6 }], "4–6", 4);
  assert.equal(res.type, "load");
  assert.match(res.text, /lastre o variante/);
  assert.doesNotMatch(res.text, /sube carga/);
});
