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
