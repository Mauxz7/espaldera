import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOPAMINE_DEFS } from "../src/data/dopamine.js";
import {
  normalizeDopamineDefs,
  dopamineDayCount,
  isOverLimit,
  isZeroTolerance,
  isGoalMet,
  parseDopamineCount,
  dopamineDayFailures,
  recordDopamine,
  dopamineWeekStats,
  newDopamineItem,
} from "../src/lib/dopamine.js";
import { weekVotes } from "../src/lib/identity.js";

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
    { id: "b", label: "", kind: "cheap", limit: -2 },
    { id: "c", label: "Leer", kind: "good", limit: 5, identity: "lector" },
    { id: "d", label: "Otro", kind: "desconocido" },
  ]);
  assert.deepEqual(norm, [
    { id: "a", label: "Redes", kind: "cheap", limit: 3 },
    { id: "b", label: "Elemento", kind: "cheap", limit: 1 },
    { id: "c", label: "Leer", kind: "good", identity: "lector", goal: 0 },
    { id: "d", label: "Otro", kind: "good", identity: null, goal: 0 },
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

test("parseDopamineCount acepta 0 y usa el valor por defecto si falta o no es válido", () => {
  assert.equal(parseDopamineCount(0, 1), 0);
  assert.equal(parseDopamineCount("0", 1), 0);
  assert.equal(parseDopamineCount("3", 1), 3);
  assert.equal(parseDopamineCount(2.9, 1), 2);
  assert.equal(parseDopamineCount(undefined, 1), 1);
  assert.equal(parseDopamineCount(null, 1), 1);
  assert.equal(parseDopamineCount("", 1), 1);
  assert.equal(parseDopamineCount("abc", 0), 0);
  assert.equal(parseDopamineCount(-1, 1), 1);
});

test("límite 0 en dopamina barata y meta 0 en buena se conservan; datos viejos no cambian", () => {
  const norm = normalizeDopamineDefs([
    { id: "z", label: "Comida chatarra", kind: "cheap", limit: 0 },
    { id: "s", label: "Pasarme de 1 h de redes", kind: "cheap", limit: "0" },
    { id: "v", label: "Redes viejas", kind: "cheap" }, // sin límite guardado: 1, como antes
    { id: "g", label: "Leer", kind: "good", identity: "lector", goal: 0 },
    { id: "h", label: "Caminar", kind: "good", identity: "descanso", goal: 2 },
  ]);
  assert.deepEqual(norm.map((d) => [d.id, d.limit ?? d.goal]), [["z", 0], ["s", 0], ["v", 1], ["g", 0], ["h", 2]]);
  // Las definiciones iniciales (sin `goal`) quedan con meta 0.
  assert.ok(normalizeDopamineDefs(DEFAULT_DOPAMINE_DEFS).filter((d) => d.kind === "good").every((d) => d.goal === 0));
});

test("límite 0: un solo registro supera el límite y es tolerancia cero", () => {
  const zero = { id: "z", kind: "cheap", limit: 0 };
  assert.equal(isZeroTolerance(zero), true);
  assert.equal(isZeroTolerance({ id: "x", kind: "cheap", limit: 1 }), false);
  assert.equal(isZeroTolerance({ id: "x", kind: "cheap" }), false); // sin límite = 1
  assert.equal(isZeroTolerance({ id: "g", kind: "good", goal: 0 }), false);
  assert.equal(isOverLimit(zero, 0), false);
  assert.equal(isOverLimit(zero, 1), true);
});

test("meta de dopamina buena: 0 = basta 1 registro; N = hace falta llegar a N", () => {
  const noGoal = { id: "g", kind: "good", goal: 0 };
  const legacy = { id: "g", kind: "good" };
  const goal2 = { id: "g", kind: "good", goal: 2 };
  assert.equal(isGoalMet(noGoal, 0), false);
  assert.equal(isGoalMet(noGoal, 1), true);
  assert.equal(isGoalMet(legacy, 1), true);
  assert.equal(isGoalMet(goal2, 1), false);
  assert.equal(isGoalMet(goal2, 2), true);
  assert.equal(isGoalMet({ id: "c", kind: "cheap", limit: 0 }, 5), false);
});

test("marcar un elemento con límite 0 falla el día; deshacer lo recupera", () => {
  const defs = [
    { id: "junk", label: "Comida chatarra", kind: "cheap", limit: 0 },
    { id: "soc", label: "Redes", kind: "cheap", limit: 1 },
    { id: "read", label: "Leer", kind: "good", identity: null },
  ];
  let dopamine = {};
  // Pasarse de un límite >= 1 avisa pero no falla el día.
  dopamine = recordDopamine(dopamine, keys[0], "soc", 3);
  assert.deepEqual(dopamineDayFailures(dopamine, keys[0], defs), []);

  dopamine = recordDopamine(dopamine, keys[1], "junk", 1);
  assert.deepEqual(dopamineDayFailures(dopamine, keys[1], defs).map((d) => d.id), ["junk"]);

  dopamine = recordDopamine(dopamine, keys[2], "junk", 1);
  let stats = dopamineWeekStats({ keys, todayIdx: 2, dopamine, dopamineDefs: defs });
  assert.equal(stats.failedDays, 2);
  assert.deepEqual(stats.failedToday.map((it) => it.id), ["junk"]);
  const junk = stats.items.find((it) => it.id === "junk");
  assert.equal(junk.zeroTolerance, true);
  assert.equal(junk.overLimit, true);

  // Deshacer (-1) hoy: el día deja de estar fallado.
  dopamine = recordDopamine(dopamine, keys[2], "junk", -1);
  stats = dopamineWeekStats({ keys, todayIdx: 2, dopamine, dopamineDefs: defs });
  assert.equal(stats.failedDays, 1);
  assert.deepEqual(stats.failedToday, []);

  // Las definiciones iniciales no tienen límite 0: nunca fallan el día.
  const legacy = dopamineWeekStats({ keys, todayIdx: 2, dopamine: { [keys[2]]: { d_social: 9 } } });
  assert.equal(legacy.failedDays, 0);
});

test("la dopamina buena vota solo al cumplir su meta (meta 0 = con un registro)", () => {
  const identities = [{ id: "lector", label: "Lector", emoji: "", color: "accent" }];
  const vote = (goal, count) =>
    weekVotes({
      keys,
      todayIdx: 0,
      habits: {},
      habitDefs: [],
      identities,
      dopamine: { [keys[0]]: { read: count } },
      dopamineDefs: [{ id: "read", label: "Leer", kind: "good", identity: "lector", goal }],
    })[0].votes;
  assert.equal(vote(0, 1), 1);
  assert.equal(vote(undefined, 1), 1); // datos viejos sin meta
  assert.equal(vote(2, 1), 0);
  assert.equal(vote(2, 2), 1);
});
