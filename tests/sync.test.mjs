import test from "node:test";
import assert from "node:assert/strict";

// "GitHub" simulado: un archivo con sha; escribir con un sha viejo devuelve 409.
const remote = { content: null, sha: null, n: 0 };
globalThis.fetch = async (url, opt) => {
  if (opt.headers.Authorization !== "Bearer tok") return { status: 401, ok: false };
  if (opt.method === "GET") {
    if (!remote.sha) return { status: 404, ok: false };
    return { status: 200, ok: true, json: async () => ({ sha: remote.sha, content: remote.content }) };
  }
  const b = JSON.parse(opt.body);
  if ((b.sha || null) !== remote.sha) return { status: 409, ok: false };
  remote.content = b.content; remote.sha = "sha" + ++remote.n;
  return { status: 200, ok: true, json: async () => ({ content: { sha: remote.sha } }) };
};

// Cada "dispositivo" es una copia aparte del módulo con su propio almacenamiento.
async function device(tag, token = "tok") {
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const mod = await import(`../src/lib/storage.js?${tag}`);
  const use = async (fn) => { globalThis.localStorage = ls; return fn(mod); };
  await use((m) => m.LS.set("@gh", { token, repo: "x/y" }));
  return {
    write: (k, v, at) => use((m) => { m.LS.set(k, v); m.LS.set("@at:" + k, at); }),
    read: (k) => use((m) => m.LS.get(k)),
    sync: () => use((m) => m.Sync.run()),
    pullNow: () => use((m) => m.Sync.pullNow()),
    status: () => use((m) => m.Sync.status),
  };
}

test("dos dispositivos se mezclan y resuelven conflictos", async () => {
  const a = await device("a");
  const b = await device("b");
  await a.write("habits", { d: { agua: true } }, 100);
  await a.sync();
  await b.sync();
  assert.deepEqual(await b.read("habits"), { d: { agua: true } });

  await a.write("block", { week: 2 }, 400);
  await b.write("swaps", { x: 1 }, 500);
  await a.write("runLevel", { level: 3, lastDone: "2026-10-01", history: [{ date: "2026-10-01", done: true }] }, 450);
  await b.sync(); await a.sync(); await b.sync(); // a tenía un sha viejo: debe releer y reintentar
  assert.deepEqual(await b.read("block"), { week: 2 });
  assert.deepEqual(await b.read("runLevel"), { level: 3, lastDone: "2026-10-01", history: [{ date: "2026-10-01", done: true }] });
  assert.deepEqual(await a.read("swaps"), { x: 1 });
  assert.equal((await a.status()).state, "ok");
});

test("gana el cambio más reciente de cada clave", async () => {
  const a = await device("c");
  const b = await device("d");
  await a.write("log", { v: "viejo" }, 1000);
  await b.write("log", { v: "nuevo" }, 2000);
  await a.sync(); await b.sync(); await a.sync();
  assert.deepEqual(await a.read("log"), { v: "nuevo" });
});

test("una clave inválida se reporta como error 401", async () => {
  const c = await device("e", "mala");
  await c.sync();
  const st = await c.status();
  assert.equal(st.state, "error");
  assert.equal(st.code, 401);
});

test("dopamineDefs y dopamine se sincronizan entre dispositivos", async () => {
  const a = await device("f");
  const b = await device("g");
  await a.write("dopamineDefs", [{ id: "d_read", label: "Leer", kind: "good", identity: "lector" }], 3000);
  await a.write("dopamine", { "2026-11-15": { d_read: 2 } }, 3000);
  await a.sync();
  await b.sync();
  assert.deepEqual(await b.read("dopamineDefs"), [{ id: "d_read", label: "Leer", kind: "good", identity: "lector" }]);
  assert.deepEqual(await b.read("dopamine"), { "2026-11-15": { d_read: 2 } });
});

test("wins y reviews se sincronizan entre dispositivos", async () => {
  const a = await device("h");
  const b = await device("i");
  await a.write("wins", [{ id: "win_1", date: "2026-11-16", text: "Primer logro" }], 4000);
  await a.write("reviews", { "2026-11-16": { good: "Buen inicio", adjust: "Dormir antes", at: 4000 } }, 4000);
  await a.sync();
  await b.sync();
  assert.deepEqual(await b.read("wins"), [{ id: "win_1", date: "2026-11-16", text: "Primer logro" }]);
  assert.deepEqual(await b.read("reviews"), { "2026-11-16": { good: "Buen inicio", adjust: "Dormir antes", at: 4000 } });
});

test("routineVariants y skips se sincronizan entre dispositivos", async () => {
  const a = await device("j");
  const b = await device("k");
  await a.write("routineVariants", { d1: "trx", d4: "express" }, 5000);
  await a.write("skips", { "2026-11-21": { d4: { d4c1: true } } }, 5000);
  await a.sync();
  await b.sync();
  assert.deepEqual(await b.read("routineVariants"), { d1: "trx", d4: "express" });
  assert.deepEqual(await b.read("skips"), { "2026-11-21": { d4: { d4c1: true } } });
});

test("SYNC_KEYS incluye vitals y healthPrefs con retrocompatibilidad cuando faltan", async () => {
  const { SYNC_KEYS } = await import("../src/lib/storage.js");
  assert.ok(SYNC_KEYS.includes("vitals"));
  assert.ok(SYNC_KEYS.includes("healthPrefs"));

  // Retrocompatibilidad: un dispositivo sincroniza un data.json previo sin vitals ni healthPrefs
  const oldDev = await device("l");
  await oldDev.sync();
  assert.equal(await oldDev.read("vitals"), undefined);
  assert.equal(await oldDev.read("healthPrefs"), undefined);
  assert.equal((await oldDev.status()).state, "ok");

  // Sincronización de vitals y healthPrefs entre dispositivos
  const a = await device("m");
  const b = await device("n");
  const vitalsSample = {
    "2026-11-21": { rhr: 53, hrv: 64.2, hrvKind: "rmssd", resp: 14.1, spo2: 97.5, tempDev: 0.1, src: "google" },
  };
  const prefsSample = { sleepBaseMin: 450, maxHr: null, age: null, hrvKind: "rmssd" };
  await a.write("vitals", vitalsSample, 6000);
  await a.write("healthPrefs", prefsSample, 6000);
  await a.sync();
  await b.sync();
  assert.deepEqual(await b.read("vitals"), vitalsSample);
  assert.deepEqual(await b.read("healthPrefs"), prefsSample);
});

test("SYNC_KEYS incluye customExercises y freeSessions y se sincronizan con retrocompatibilidad", async () => {
  const { SYNC_KEYS } = await import("../src/lib/storage.js");
  assert.ok(SYNC_KEYS.includes("customExercises"));
  assert.ok(SYNC_KEYS.includes("freeSessions"));

  const oldDev = await device("o");
  await oldDev.sync();
  assert.equal(await oldDev.read("customExercises"), undefined);
  assert.equal(await oldDev.read("freeSessions"), undefined);

  const a = await device("p");
  const b = await device("q");
  const customSample = [{ id: "cus_1", name: "Curl barra", primaryGroup: "biceps", secondaryGroups: [] }];
  const freeSample = { "2026-11-22": { exIds: ["cus_1"] } };
  await a.write("customExercises", customSample, 7000);
  await a.write("freeSessions", freeSample, 7000);
  await a.sync();
  await b.sync();
  assert.deepEqual(await b.read("customExercises"), customSample);
  assert.deepEqual(await b.read("freeSessions"), freeSample);
});

test("SYNC_KEYS incluye soreness y se sincroniza con retrocompatibilidad", async () => {
  const { SYNC_KEYS } = await import("../src/lib/storage.js");
  assert.ok(SYNC_KEYS.includes("soreness"));

  const oldDev = await device("r");
  await oldDev.sync();
  assert.equal(await oldDev.read("soreness"), undefined);

  const a = await device("s");
  const b = await device("t");
  const sample = { "2026-11-22": { calves: true } };
  await a.write("soreness", sample, 8000);
  await a.sync();
  await b.sync();
  assert.deepEqual(await b.read("soreness"), sample);
});

test("Sync.pullNow recarga datos nuevos de Fitbit desde GitHub sin perder ediciones locales", async () => {
  const workflow = await device("u");
  const phone = await device("v");

  // El teléfono tiene un hábito editado localmente
  await phone.write("habits", { "2026-11-24": { agua: true } }, 9000);

  // GitHub Actions escribe sleep y vitals frescos en data.json
  await workflow.write("sleep", { "2026-11-24": { min: 445, bed: "23:10", wake: "06:40" } }, 9500);
  await workflow.write("vitals", { "2026-11-24": { hrv: 65, rhr: 52 } }, 9500);
  await workflow.sync();

  // El teléfono hace pullNow tras completar el workflow
  const res = await phone.pullNow();
  assert.equal(res.ok, true);
  assert.deepEqual(await phone.read("sleep"), { "2026-11-24": { min: 445, bed: "23:10", wake: "06:40" } });
  assert.deepEqual(await phone.read("vitals"), { "2026-11-24": { hrv: 65, rhr: 52 } });
  assert.deepEqual(await phone.read("habits"), { "2026-11-24": { agua: true } });
});
