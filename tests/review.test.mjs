import test from "node:test";
import assert from "node:assert/strict";
import {
  WINS_MAX_DAYS,
  REVIEWS_MAX_WEEKS,
  weekKeys,
  addWin,
  removeWin,
  winsForWeek,
  hasReview,
  saveReview,
  availableReviewWeeks,
  isSundayReviewPending,
  sleepWeekStats,
  buildWeekReview,
} from "../src/lib/review.js";
import { DEFAULT_IDENTITIES } from "../src/data/identities.js";
import { dkey, addDays, fromKey } from "../src/lib/dates.js";

const mk = "2026-11-09"; // lunes
const keys = weekKeys(mk); // 2026-11-09 .. 2026-11-15

test("addWin agrega logros, ignora vacíos, no duplica ids y poda a 120 días", () => {
  let wins = addWin([], "   ", "2026-11-10", 100);
  assert.equal(wins.length, 0);

  wins = addWin(wins, "  Completé la rutina de pierna  ", "2026-11-10", 100);
  wins = addWin(wins, "Leí antes de dormir", "2026-11-12", 100); // mismo timestamp -> id distinto
  assert.equal(wins.length, 2);
  assert.notEqual(wins[0].id, wins[1].id);
  assert.equal(wins[1].text, "Completé la rutina de pierna");

  // Poda a 120 días: un logro de hace 120 días se borra; uno de hace 119 se conserva
  const old = { id: "w_old", date: dkey(addDays(fromKey("2026-11-15"), -WINS_MAX_DAYS)), text: "Muy viejo" };
  const edge = { id: "w_edge", date: dkey(addDays(fromKey("2026-11-15"), -(WINS_MAX_DAYS - 1))), text: "En el límite" };
  const pruned = addWin([old, edge], "Nuevo logro", "2026-11-15", 200);
  assert.equal(pruned.some((w) => w.id === "w_old"), false);
  assert.equal(pruned.some((w) => w.id === "w_edge"), true);
  assert.equal(pruned.some((w) => w.text === "Nuevo logro"), true);

  const afterRemove = removeWin(pruned, "w_edge");
  assert.equal(afterRemove.some((w) => w.id === "w_edge"), false);
});

test("winsForWeek filtra solo los logros de lunes a domingo de esa semana", () => {
  const list = [
    { id: "1", date: "2026-11-08", text: "Domingo anterior" },
    { id: "2", date: "2026-11-09", text: "Lunes" },
    { id: "3", date: "2026-11-15", text: "Domingo" },
    { id: "4", date: "2026-11-16", text: "Lunes siguiente" },
  ];
  assert.deepEqual(winsForWeek(list, keys).map((w) => w.id), ["2", "3"]);
});

test("saveReview guarda, actualiza, limpia vacíos y recorta a 26 semanas", () => {
  let reviews = saveReview({}, mk, { good: "Constancia en hábitos", adjust: "Acostarme más temprano" }, 1000);
  assert.deepEqual(reviews[mk], { good: "Constancia en hábitos", adjust: "Acostarme más temprano", at: 1000 });
  assert.equal(hasReview(reviews, mk), true);

  // Si se borran ambos campos, elimina la entrada
  const cleared = saveReview(reviews, mk, { good: "  ", adjust: "" }, 2000);
  assert.equal(cleared[mk], undefined);
  assert.equal(hasReview(cleared, mk), false);

  // Límite de 26 semanas
  let many = {};
  for (let i = 0; i < 30; i++) {
    const monday = dkey(addDays(fromKey("2026-01-05"), i * 7));
    many = saveReview(many, monday, { good: `Semana ${i}`, adjust: "" }, i);
  }
  assert.equal(Object.keys(many).length, REVIEWS_MAX_WEEKS);
  assert.equal(many["2026-01-05"], undefined);
});

test("availableReviewWeeks y isSundayReviewPending", () => {
  const reviews = {
    "2026-10-26": { good: "Bien", adjust: "", at: 1 },
    "2026-11-02": { good: "   ", adjust: "", at: 2 }, // vacía: se ignora
    "2026-11-09": { good: "", adjust: "Menos pantallas", at: 3 },
    "2026-11-16": { good: "Semana actual", adjust: "", at: 4 },
  };
  assert.deepEqual(availableReviewWeeks(reviews, "2026-11-16"), ["2026-10-26", "2026-11-09", "2026-11-16"]);

  // Domingo 2026-11-15 (semana del lunes 2026-11-09)
  const sunday = new Date(2026, 10, 15, 19, 0);
  assert.equal(isSundayReviewPending({ "2026-11-09": { good: "", adjust: "" } }, sunday), true);
  assert.equal(isSundayReviewPending({ "2026-11-09": { good: "Listo", adjust: "" } }, sunday), false);
  // Lunes 2026-11-16: no es domingo
  const monday = new Date(2026, 10, 16, 9, 0);
  assert.equal(isSundayReviewPending({}, monday), false);
});

test("sleepWeekStats cuenta noches >= 7 h y promedio de sueño", () => {
  const sleep = {
    "2026-11-09": { min: 450, bed: "22:30", wake: "06:00" }, // 7h30 >= 7h
    "2026-11-10": { min: 390, bed: "22:50", wake: "05:20" }, // 6h30 (< 7h aunque antes de 11 p.m.)
    "2026-11-11": { min: 420, bed: "23:30", wake: "06:30" }, // 7h exactas >= 7h
    "2026-11-13": { min: 300, bed: "01:00", wake: "06:00" }, // después de todayIdx=2 no cuenta
  };
  assert.deepEqual(sleepWeekStats(sleep, keys, 2), { nights: 3, nights7h: 2, avgMin: 420 });
  assert.deepEqual(sleepWeekStats({}, keys, 6), { nights: 0, nights7h: 0, avgMin: null });
});

test("buildWeekReview integra votos por identidad, sesiones, Fitbit, hábitos, dopamina, sueño y logros", () => {
  const habitDefs = [
    { id: "o_creatine", label: "Creatina", group: "req", kind: "check", target: 1, identity: "atleta" },
    { id: "o_screens", label: "Pantallas", group: "req", kind: "check", target: 1, identity: "descanso" },
    { id: "f_read", label: "Leer", group: "opt", kind: "check", target: 1, identity: "lector" },
  ];
  const habits = {
    "2026-11-09": { o_creatine: true, o_screens: true, f_read: true },
    "2026-11-10": { o_creatine: true, o_screens: false },
    "2026-11-11": { o_creatine: true, o_screens: true },
  };
  const log = {
    "2026-11-09": { r: "d1" },
  };
  const workouts = [
    { id: "w1", type: "Fuerza", kind: "strength", start: new Date(2026, 10, 9, 7, 0).toISOString(), min: 45 },
    { id: "w2", type: "Correr", kind: "run", start: new Date(2026, 10, 11, 7, 0).toISOString(), min: 35 }, // cubre d3 por Fitbit
  ];
  const dopamineDefs = [
    { id: "d_study", label: "Estudiar", kind: "good", identity: "estudiante" },
    { id: "d_social", label: "Redes", kind: "cheap", limit: 2 },
  ];
  const dopamine = {
    "2026-11-09": { d_study: 2, d_social: 1 },
    "2026-11-11": { d_social: 3 },
  };
  const sleep = {
    "2026-11-09": { min: 430, bed: "22:45", wake: "05:55" }, // >= 7h y rested
    "2026-11-10": { min: 390, bed: "22:55", wake: "05:25" }, // < 7h pero <= 23:00 -> rested
    "2026-11-11": { min: 360, bed: "23:45", wake: "05:45" }, // no rested
  };
  const wins = [
    { id: "win_1", date: "2026-11-10", text: "Salí a trotar sin molestias" },
    { id: "win_old", date: "2026-11-02", text: "De otra semana" },
  ];
  const reviews = {
    [mk]: { good: "Buen ritmo", adjust: "Dormir más", at: 500 },
  };

  const res = buildWeekReview({
    mondayKey: mk,
    today: "2026-11-11", // miércoles (todayIdx = 2)
    habits,
    habitDefs,
    identities: DEFAULT_IDENTITIES,
    log,
    workouts,
    dopamine,
    dopamineDefs,
    sleep,
    wins,
    reviews,
  });

  assert.equal(res.todayIdx, 2);
  assert.deepEqual(res.sessions, { value: 2, goal: 4 }); // d1 (log) + d3 (Fitbit)
  assert.deepEqual(res.minutes, { value: 80, goal: 150 });
  assert.deepEqual(res.habits, { value: 2, goal: 3 }); // lun y mié
  assert.equal(res.dopamine.good, 2);
  assert.equal(res.dopamine.cheap, 4);
  assert.deepEqual(res.sleep, { nights: 3, nights7h: 1, avgMin: 393 });
  assert.deepEqual(res.wins.map((w) => w.id), ["win_1"]);
  assert.equal(res.hasReview, true);

  const byId = Object.fromEntries(res.votes.map((r) => [r.id, r.votes]));
  // atleta: 3 hábitos + 2 sesiones (1 log + 1 Fitbit) = 5
  assert.equal(byId.atleta, 5);
  // descanso: 2 hábitos (lun, mié) + 2 noches rested (lun, mar) = 4
  assert.equal(byId.descanso, 4);
  // lector: 1 hábito (lun) = 1
  assert.equal(byId.lector, 1);
  // estudiante: 1 día con dopamina buena (lun) = 1
  assert.equal(byId.estudiante, 1);

  // Entreno libre el martes (sin log ni Fitbit ese día) suma sesión y voto de atleta
  const withFree = buildWeekReview({
    mondayKey: mk,
    today: "2026-11-11",
    habits,
    habitDefs,
    identities: DEFAULT_IDENTITIES,
    log,
    setLog: { "2026-11-10": { free: { lib_trx_curl: [{ reps: 12, load: "10 kg" }] } } },
    workouts,
    dopamine,
    dopamineDefs,
    sleep,
    wins,
    reviews,
  });
  assert.equal(withFree.sessions.value, 3);
  assert.equal(withFree.votes.find((r) => r.id === "atleta").votes, 6);
});
