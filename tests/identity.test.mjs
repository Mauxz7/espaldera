import test from "node:test";
import assert from "node:assert/strict";
import { weekVotes, topIdentity, votesPhrase, normalizeIdentities, newIdentity, lastGrapheme } from "../src/lib/identity.js";
import { DEFAULT_IDENTITIES, DEFAULT_HABIT_IDENTITY, habitIdentity } from "../src/data/identities.js";
import { DEFAULT_HABIT_DEFS } from "../src/data/habits.js";

const keys = Array.from({ length: 7 }, (_, i) => `2026-11-${String(9 + i).padStart(2, "0")}`);
const ids = [
  { id: "atleta", label: "Atleta", emoji: "A", color: "accent" },
  { id: "lector", label: "Lector", emoji: "L", color: "good" },
  { id: "estudiante", label: "Estudiante", emoji: "E", color: "warn" },
];

test("identidades iniciales y asignación por defecto de los hábitos", () => {
  assert.deepEqual(DEFAULT_IDENTITIES.map((i) => i.id), ["atleta", "estudiante", "lector", "descanso"]);
  for (const it of DEFAULT_IDENTITIES) assert.ok(["accent", "good", "cool", "warn"].includes(it.color));
  for (const d of DEFAULT_HABIT_DEFS) assert.equal(d.identity, DEFAULT_HABIT_IDENTITY[d.id]);
  assert.ok(!Object.values(DEFAULT_HABIT_IDENTITY).includes("estudiante"));
});

test("habitIdentity usa el campo, luego el mapa por id; los nuevos sin identidad no votan", () => {
  assert.equal(habitIdentity({ id: "o_creatine" }), "atleta"); // guardado antes de esta función
  assert.equal(habitIdentity({ id: "f_read" }), "lector");
  assert.equal(habitIdentity({ id: "o_creatine", identity: "estudiante" }), "estudiante");
  assert.equal(habitIdentity({ id: "o_creatine", identity: null }), null); // quitada a propósito
  assert.equal(habitIdentity({ id: "o_nuevo" }), null);
  assert.equal(habitIdentity(null), null);
});

test("weekVotes cuenta hábitos cumplidos y sesiones solo hasta hoy", () => {
  const defs = [
    { id: "a", kind: "check", identity: "atleta" },
    { id: "w", kind: "count", target: 2, identity: "atleta" },
    { id: "r", kind: "check", identity: "lector" },
    { id: "n", kind: "check" }, // nuevo sin identidad: no vota
    { id: "z", kind: "check", identity: "lector", archived: true },
    { id: "g", kind: "check", identity: "borrada" },
  ];
  const habits = {
    "2026-11-09": { a: true, w: 2, r: true, n: true, z: true, g: true }, // 2 atleta, 1 lector
    "2026-11-10": { a: true, w: 1 }, // 1 atleta (agua incompleta)
    "2026-11-11": { r: true }, // 1 lector
    "2026-11-13": { a: true, r: true }, // viernes: después de hoy, no cuenta
    "2026-11-02": { a: true }, // semana anterior
  };
  const log = { "2026-11-09": { r: "d1" }, "2026-11-12": { r: "d2" }, "2026-11-14": { r: "d3" }, "2026-11-03": { r: "d4" } };
  const rows = weekVotes({ keys, todayIdx: 3, habits, habitDefs: defs, identities: ids, log });
  assert.deepEqual(rows.map((r) => [r.id, r.label, r.votes, r.days]), [
    ["atleta", "Atleta", 5, 3], // lunes 2+1 sesión, martes 1, jueves sesión
    ["lector", "Lector", 2, 2],
    ["estudiante", "Estudiante", 0, 0],
  ]);
});

test("weekVotes usa el mapa por id para hábitos guardados sin identidad", () => {
  const saved = [{ id: "o_creatine", kind: "check" }, { id: "f_read", kind: "check" }, { id: "o_screens", kind: "check" }];
  const rows = weekVotes({
    keys, todayIdx: 6, habitDefs: saved, identities: DEFAULT_IDENTITIES,
    habits: { "2026-11-10": { o_creatine: true, f_read: true, o_screens: true } },
  });
  const v = Object.fromEntries(rows.map((r) => [r.id, r.votes]));
  assert.deepEqual(v, { atleta: 1, estudiante: 0, lector: 1, descanso: 1 });
});

test("weekVotes tolera datos vacíos", () => {
  const rows = weekVotes({ keys, todayIdx: 0 });
  assert.equal(rows.length, DEFAULT_IDENTITIES.length);
  assert.ok(rows.every((r) => r.votes === 0 && r.days === 0));
  assert.deepEqual(weekVotes({ keys: undefined, todayIdx: 2, identities: ids }).map((r) => r.votes), [0, 0, 0]);
});

test("frase con la identidad que más votos tiene", () => {
  const rows = [{ id: "a", label: "Atleta", votes: 9 }, { id: "l", label: "Lector", votes: 9 }, { id: "e", label: "Estudiante", votes: 3 }];
  assert.equal(topIdentity(rows).id, "a"); // empate: la primera
  assert.equal(votesPhrase(topIdentity(rows)), "Esta semana votaste 9 veces por ser Atleta");
  assert.equal(votesPhrase({ label: "Lector", votes: 1 }), "Esta semana votaste 1 vez por ser Lector");
  assert.equal(topIdentity([{ id: "a", votes: 0 }]), null);
  assert.match(votesPhrase(null), /Aún no hay votos/);
});

test("normalizeIdentities y newIdentity", () => {
  assert.equal(normalizeIdentities(undefined), DEFAULT_IDENTITIES);
  const n = normalizeIdentities([{ id: "x", label: "" }, null, { id: "x", label: "Dup" }, { label: "sin id" }, { id: "y", label: "Y", emoji: "Y", color: "cool" }]);
  assert.deepEqual(n.map((i) => [i.id, i.label, i.color]), [["x", "Identidad", "accent"], ["y", "Y", "cool"]]);
  const nu = newIdentity([{ id: "id_a" }], 10);
  assert.equal(nu.id, "id_ax");
  assert.equal(nu.color, "good");
  assert.equal(lastGrapheme("ab  "), "b");
  assert.equal(lastGrapheme("📚😴"), "😴");
  assert.equal(lastGrapheme(""), "");
});

test("weekVotes: una sesión cubierta solo por Fitbit también vota por Atleta (sin contar doble)", () => {
  const keys = Array.from({ length: 7 }, (_, i) => `2026-11-${String(16 + i).padStart(2, "0")}`);
  const rows = weekVotes({ keys, todayIdx: 3, habits: {}, habitDefs: [], identities: undefined, log: { "2026-11-17": { r: "d1" } }, fromFitbit: { 0: "d3", 1: "d1" } });
  const atleta = rows.find((r) => r.id === "atleta");
  assert.equal(atleta.votes, 2);
  assert.equal(atleta.days, 2);
});

test("weekVotes cuenta hábitos marcados en versión de 2 minutos (_mini)", () => {
  const defs = [
    { id: "r", kind: "check", identity: "lector", mini: "1 página" },
    { id: "a", kind: "check", identity: "atleta", mini: "5 min" },
  ];
  const rows = weekVotes({
    keys,
    todayIdx: 2,
    habitDefs: defs,
    identities: ids,
    habits: {
      "2026-11-09": { _mini: { r: true } },
      "2026-11-10": { r: true, _mini: { a: true } },
    },
  });
  assert.equal(rows.find((x) => x.id === "lector").votes, 2);
  assert.equal(rows.find((x) => x.id === "atleta").votes, 1);
});

test("weekVotes suma 1 voto por día con dopamina buena (no por toque) e ignora la barata", () => {
  const defs = [
    { id: "d_social", label: "Redes", kind: "cheap", limit: 2, identity: "descanso" }, // barato: nunca vota aunque tenga identity
    { id: "d_read", label: "Leer", kind: "good", identity: "lector" },
    { id: "d_study", label: "Estudiar", kind: "good", identity: "estudiante" },
    { id: "d_none", label: "Sin identidad", kind: "good", identity: null },
  ];
  const dopamine = {
    "2026-11-02": { d_read: 2 }, // semana anterior: no cuenta
    "2026-11-09": { d_read: 4, d_social: 3, d_none: 2 }, // lunes: 4 toques de d_read = 1 voto lector
    "2026-11-10": { d_read: 1, d_study: 3 }, // martes: 1 voto lector, 1 voto estudiante
    "2026-11-12": { d_study: 5 }, // jueves (después de todayIdx 2): no cuenta
  };
  const rows = weekVotes({
    keys,
    todayIdx: 2,
    habits: {},
    habitDefs: [],
    identities: DEFAULT_IDENTITIES,
    dopamine,
    dopamineDefs: defs,
  });
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(byId.lector.votes, 2);
  assert.equal(byId.lector.days, 2);
  assert.equal(byId.estudiante.votes, 1);
  assert.equal(byId.estudiante.days, 1);
  assert.equal(byId.descanso.votes, 0);
  assert.equal(byId.atleta.votes, 0);
});

test("weekVotes cuenta entreno libre como voto de Atleta sin contar doble", () => {
  const setLog = {
    [keys[0]]: { free: { lib_trx_curl: [{ reps: 12, load: "10 kg" }] } },
    [keys[1]]: { free: { lib_trx_curl: [{ reps: 10, load: "10 kg" }] } },
  };
  const rows = weekVotes({
    keys,
    todayIdx: 2,
    habits: {},
    habitDefs: [],
    identities: ids,
    log: { [keys[0]]: { r: "d1" } },
    setLog,
  });
  const atleta = rows.find((r) => r.id === "atleta");
  assert.equal(atleta.votes, 2);
  assert.equal(atleta.days, 2);
});
