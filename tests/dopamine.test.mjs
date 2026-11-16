import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOPAMINE_DEFS } from "../src/data/dopamine.js";
import {
  normalizeDopamineDefs,
  dopamineDayCount,
  isOverLimit,
  recordDopamine,
  dopamineWeekStats,
  newDopamineItem,
} from "../src/lib/dopamine.js";

const keys = Array.from({ length: 7 }, (_, i) => `2026-11-${String(9 + i).padStart(2, "0")}`);

test("definiciones iniciales de dopamina buena y barata", () => {
  const cheap = DEFAULT_DOPAMINE_DEFS.filter((d) => d.kind === "cheap");
  const good = DEFAULT_DOPAMINE_DEFS.filter((d) => d.kind === "good");
  assert.equal(cheap.length, 3);
  assert.equal(good.length, 4);
  assert.deepEqual(
    cheap.map((d) => [d.id, d.limit]),
    [["d_social", 2], ["d_shorts", 1], ["d_binge", 1]],
  );
  assert.deepEqual(
    good.map((d) => [d.id, d.identity]),
    [["d_walk", "descanso"], ["d_study", "estudiante"], ["d_read", "lector"], ["d_sport", "atleta"]],
  );
});

test("normalizeDopamineDefs valida, evita duplicados y limpia campos", () => {
  assert.equal(normalizeDopamineDefs(undefined), DEFAULT_DOPAMINE_DEFS);
  assert.deepEqual(normalizeDopamineDefs([]), []);
  const norm = normalizeDopamineDefs([
    null,
    { label: "Sin id" },
    { id: "a", label: "  Redes  ", kind: "cheap", limit: 3, identity: "atleta" },
    { id: "a", label: "Duplicado", kind: "good" },
    { id: "b", label: "", kind: "cheap", limit: 0 },
    { id: "c", label: "Leer", kind: "good", limit: 5, identity: "lector" },
    { id: "d", label: "Otro", kind: "desconocido" },
  ]);
  assert.deepEqual(norm, [
    { id: "a", label: "Redes", kind: "cheap", limit: 3 },
    { id: "b", label: "Elemento", kind: "cheap", limit: 1 },
    { id: "c", label: "Leer", kind: "good", identity: "lector" },
    { id: "d", label: "Otro", kind: "good", identity: null },
  ]);
});

test("recordDopamine suma, deshace (-1), limpia ceros y poda a 60 días", () => {
  let state = {};
  state = recordDopamine(state, "2026-11-09", "d_social", 1);
  state = recordDopamine(state, "2026-11-09", "d_social", 1);
  assert.equal(dopamineDayCount(state, "2026-11-09", "d_social"), 2);

  // Deshacer (-1)
  state = recordDopamine(state, "2026-11-09", "d_social", -1);
  assert.equal(dopamineDayCount(state, "2026-11-09", "d_social"), 1);

  // Deshacer hasta 0 borra la entrada y la fecha vacía
  state = recordDopamine(state, "2026-11-09", "d_social", -1);
  assert.equal(dopamineDayCount(state, "2026-11-09", "d_social"), 0);
  assert.deepEqual(state, {});

  // No baja de 0
  state = recordDopamine(state, "2026-11-09", "d_social", -1);
  assert.deepEqual(state, {});

  // Poda a 60 días por defecto
  let many = {};
  for (let i = 0; i < 65; i++) {
    const d = new Date(2026, 0, 1 + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    many = recordDopamine(many, k, "d_walk", 1);
  }
  assert.equal(Object.keys(many).length, 60);
  assert.equal(many["2026-01-01"], undefined);
  assert.equal(many["2026-01-05"], undefined);
  assert.deepEqual(many["2026-01-06"], { d_walk: 1 });
});

test("isOverLimit marca solo cuando el conteo supera el límite", () => {
  const cheap = { id: "d_social", kind: "cheap", limit: 2 };
  const good = { id: "d_walk", kind: "good", identity: "descanso" };
  assert.equal(isOverLimit(cheap, 0), false);
  assert.equal(isOverLimit(cheap, 2), false);
  assert.equal(isOverLimit(cheap, 3), true);
  assert.equal(isOverLimit(good, 10), false);
});

test("dopamineWeekStats calcula conteo de hoy, semana por elemento y totales", () => {
  const dopamine = {
    "2026-11-02": { d_social: 5, d_walk: 4 }, // semana anterior: no cuenta
    "2026-11-09": { d_social: 1, d_study: 2, d_walk: 1 },
    "2026-11-10": { d_social: 2, d_shorts: 2, d_read: 3 },
    "2026-11-11": { d_social: 3, d_binge: 1, d_sport: 1 }, // miércoles (hoy)
    "2026-11-12": { d_social: 4, d_walk: 2 }, // jueves: después de hoy, no cuenta
  };
  const stats = dopamineWeekStats({ keys, todayIdx: 2, dopamine });
  const byId = Object.fromEntries(stats.items.map((it) => [it.id, it]));

  assert.equal(byId.d_social.today, 3);
  assert.equal(byId.d_social.week, 6);
  assert.equal(byId.d_social.overLimit, true); // 3 > límite 2

  assert.equal(byId.d_binge.today, 1);
  assert.equal(byId.d_binge.overLimit, false); // 1 == límite 1, aún no pasa

  assert.equal(byId.d_shorts.today, 0);
  assert.equal(byId.d_shorts.week, 2);

  assert.equal(byId.d_walk.today, 0);
  assert.equal(byId.d_walk.week, 1);
  assert.equal(byId.d_read.week, 3);

  assert.equal(stats.goodWeek, 7); // 1 + 2 + 3 + 1
  assert.equal(stats.cheapWeek, 9); // 6 + 2 + 1
});

test("dopamineWeekStats tolera datos vacíos y newDopamineItem genera id único", () => {
  const stats = dopamineWeekStats({ keys: undefined, todayIdx: 0 });
  assert.equal(stats.goodWeek, 0);
  assert.equal(stats.cheapWeek, 0);
  assert.equal(stats.items.length, DEFAULT_DOPAMINE_DEFS.length);

  const item = newDopamineItem([{ id: "d_a" }], "cheap", 10);
  assert.equal(item.id, "d_ax");
  assert.equal(item.kind, "cheap");
  assert.equal(item.limit, 1);
});
