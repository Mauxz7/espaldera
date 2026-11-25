import test from "node:test";
import assert from "node:assert/strict";
import {
  FITBIT_AUTO_COOLDOWN_MS,
  FITBIT_FORBIDDEN_COOLDOWN_MS,
  FITBIT_SYNC_KEYS,
  shouldAutoSyncFitbit,
  triggerFitbitSync,
  readFitbitSyncMeta,
  getTodayFitbitStatus,
} from "../src/lib/fitbitSync.js";

function makeMemStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get: (k) => (map.has(k) ? map.get(k) : undefined),
    set: (k, v) => { map.set(k, v); },
    del: (k) => { map.delete(k); },
    dump: () => Object.fromEntries(map.entries()),
  };
}

function makeResponse(status, body = null, headersObj = {}) {
  const lower = Object.fromEntries(Object.entries(headersObj).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => (k.toLowerCase() in lower ? lower[k.toLowerCase()] : null) },
    json: async () => {
      if (status === 204) throw new Error("No se debe llamar json() sobre 204 No Content");
      return body;
    },
  };
}

test("shouldAutoSyncFitbit: dispara cuando faltan datos de hoy y no hay cooldown ni corrida en vuelo", () => {
  const todayKey = "2026-11-24";
  const nowMs = Date.parse("2026-11-24T14:00:00Z");

  // Faltan ambos
  assert.equal(shouldAutoSyncFitbit({
    todayKey,
    sleep: {},
    vitals: {},
    nowMs,
    lastAttemptMs: null,
    lastForbiddenMs: null,
    hasSyncConfig: true,
    inFlight: false,
  }), true);

  // Falta vitals (hrv/rhr) aunque exista sleep
  assert.equal(shouldAutoSyncFitbit({
    todayKey,
    sleep: { [todayKey]: { min: 430, bed: "23:00", wake: "06:30" } },
    vitals: { [todayKey]: { spo2: 97 } },
    nowMs,
    hasSyncConfig: true,
    inFlight: false,
  }), true);

  // Falta sleep aunque exista vitals
  assert.equal(shouldAutoSyncFitbit({
    todayKey,
    sleep: {},
    vitals: { [todayKey]: { rhr: 54 } },
    nowMs,
    hasSyncConfig: true,
    inFlight: false,
  }), true);
});

test("shouldAutoSyncFitbit: no dispara si ya existen sueño y vitals (hrv o rhr) de hoy", () => {
  const todayKey = "2026-11-24";
  const nowMs = Date.parse("2026-11-24T14:00:00Z");

  assert.equal(shouldAutoSyncFitbit({
    todayKey,
    sleep: { [todayKey]: { min: 440 } },
    vitals: { [todayKey]: { hrv: 62 } },
    nowMs,
    hasSyncConfig: true,
    inFlight: false,
  }), false);

  assert.equal(shouldAutoSyncFitbit({
    todayKey,
    sleep: { [todayKey]: { min: 440 } },
    vitals: { [todayKey]: { rhr: 52 } },
    nowMs,
    hasSyncConfig: true,
    inFlight: false,
  }), false);

  assert.deepEqual(
    getTodayFitbitStatus(todayKey, { [todayKey]: { min: 440 } }, { [todayKey]: { hrv: 62 } }),
    { hasSleep: true, hasVitals: true, isComplete: true },
  );
});

test("shouldAutoSyncFitbit: respeta cooldown de 15 min, backoff de 6 h tras 403, sin config y en vuelo", () => {
  const todayKey = "2026-11-24";
  const nowMs = 1_700_000_000_000;
  const base = { todayKey, sleep: {}, vitals: {}, nowMs, hasSyncConfig: true, inFlight: false };

  // Sin config
  assert.equal(shouldAutoSyncFitbit({ ...base, hasSyncConfig: false }), false);

  // En vuelo
  assert.equal(shouldAutoSyncFitbit({ ...base, inFlight: true }), false);

  // Cooldown 15 min
  assert.equal(shouldAutoSyncFitbit({ ...base, lastAttemptMs: nowMs - FITBIT_AUTO_COOLDOWN_MS + 1 }), false);
  assert.equal(shouldAutoSyncFitbit({ ...base, lastAttemptMs: nowMs - FITBIT_AUTO_COOLDOWN_MS }), true);

  // Backoff 6 h tras 403
  assert.equal(shouldAutoSyncFitbit({ ...base, lastForbiddenMs: nowMs - FITBIT_FORBIDDEN_COOLDOWN_MS + 1 }), false);
  assert.equal(shouldAutoSyncFitbit({ ...base, lastForbiddenMs: nowMs - FITBIT_FORBIDDEN_COOLDOWN_MS }), true);
});

test("triggerFitbitSync: 204 sin res.json() + polling hasta completed/success y guarda cooldown", async () => {
  let clock = Date.parse("2026-11-24T15:00:00Z");
  const storage = makeMemStorage({ [FITBIT_SYNC_KEYS.lastForbidden]: clock - 1000 });
  const statuses = [];
  const calls = [];

  const responses = [
    makeResponse(204),
    makeResponse(200, {
      workflow_runs: [
        // Corrida vieja anterior a dispatchedAt - 10s: debe ignorarse
        { status: "completed", conclusion: "failure", created_at: "2026-11-24T14:58:00Z", html_url: "https://github.com/old" },
        // Corrida nueva todavía en curso
        { status: "in_progress", conclusion: null, created_at: "2026-11-24T15:00:01Z", html_url: "https://github.com/u/r/actions/runs/123" },
      ],
    }),
    makeResponse(200, {
      workflow_runs: [
        { status: "completed", conclusion: "success", created_at: "2026-11-24T15:00:01Z", html_url: "https://github.com/u/r/actions/runs/123" },
      ],
    }),
  ];

  const fetchImpl = async (url, opt) => {
    calls.push({ url, opt });
    return responses.shift();
  };

  const res = await triggerFitbitSync({
    repo: "owner/data-repo",
    token: "tok_test",
    fetchImpl,
    onStatus: (s) => statuses.push(s),
    pollIntervalMs: 3500,
    timeoutMs: 75000,
    sleepFn: async (ms) => { clock += ms; },
    nowFn: () => clock,
    storage,
  });

  assert.equal(res.ok, true);
  assert.equal(res.conclusion, "success");
  assert.equal(res.runUrl, "https://github.com/u/r/actions/runs/123");
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://api.github.com/repos/owner/data-repo/actions/workflows/google-health.yml/dispatches");
  assert.equal(calls[0].opt.method, "POST");
  assert.equal(calls[0].opt.headers.Authorization, "Bearer tok_test");
  assert.equal(calls[0].opt.headers["X-GitHub-Api-Version"], "2022-11-28");
  assert.deepEqual(JSON.parse(calls[0].opt.body), { ref: "main" });
  assert.equal(calls[1].url, "https://api.github.com/repos/owner/data-repo/actions/workflows/google-health.yml/runs?event=workflow_dispatch&per_page=3");
  assert.deepEqual(statuses.map((s) => s.text), ["Enviando…", "Trayendo datos de Fitbit…"]);

  const meta = readFitbitSyncMeta(storage);
  assert.equal(meta.lastAttemptMs, clock);
  assert.equal(meta.lastSuccessMs, clock);
  assert.equal(meta.lastForbiddenMs, null);
});

test("triggerFitbitSync: devuelve workflow_failed cuando la corrida termina en failure", async () => {
  let clock = Date.parse("2026-11-24T15:00:00Z");
  const storage = makeMemStorage();
  const responses = [
    makeResponse(204),
    makeResponse(200, {
      workflow_runs: [
        { status: "completed", conclusion: "failure", created_at: "2026-11-24T15:00:02Z", html_url: "https://github.com/u/r/actions/runs/456" },
      ],
    }),
  ];

  const res = await triggerFitbitSync({
    repo: "owner/data-repo",
    token: "tok_test",
    fetchImpl: async () => responses.shift(),
    pollIntervalMs: 3500,
    timeoutMs: 75000,
    sleepFn: async (ms) => { clock += ms; },
    nowFn: () => clock,
    storage,
  });

  assert.equal(res.ok, false);
  assert.equal(res.code, "workflow_failed");
  assert.equal(res.conclusion, "failure");
  assert.equal(res.runUrl, "https://github.com/u/r/actions/runs/456");
  assert.match(res.message, /--solo-fitbit/);
});

test("triggerFitbitSync: 403 en dispatch aplica backoff de 6 horas y mensaje claro", async () => {
  const clock = Date.parse("2026-11-24T15:00:00Z");
  const storage = makeMemStorage();

  const res = await triggerFitbitSync({
    repo: "owner/data-repo",
    token: "tok_test",
    fetchImpl: async () => makeResponse(403),
    nowFn: () => clock,
    storage,
  });

  assert.equal(res.ok, false);
  assert.equal(res.code, "forbidden");
  assert.equal(
    res.message,
    "Tu token de GitHub necesita el permiso «Actions: Read and write» en tu repo de datos para sincronizar Fitbit desde la app.",
  );

  const meta = readFitbitSyncMeta(storage);
  assert.equal(meta.lastForbiddenMs, clock);
  assert.equal(shouldAutoSyncFitbit({
    todayKey: "2026-11-24",
    sleep: {},
    vitals: {},
    nowMs: clock + 5 * 3600_000,
    lastAttemptMs: meta.lastAttemptMs,
    lastForbiddenMs: meta.lastForbiddenMs,
    hasSyncConfig: true,
    inFlight: false,
  }), false);
});

test("triggerFitbitSync: maneja 401, 404, rate-limit y error de red con mensajes claros", async () => {
  const storage = makeMemStorage();

  const r401 = await triggerFitbitSync({
    repo: "owner/data-repo",
    token: "tok_bad",
    fetchImpl: async () => makeResponse(401),
    storage,
  });
  assert.equal(r401.ok, false);
  assert.equal(r401.code, "unauthorized");
  assert.match(r401.message, /token/i);

  const r404 = await triggerFitbitSync({
    repo: "owner/data-repo",
    token: "tok_ok",
    fetchImpl: async () => makeResponse(404),
    storage,
  });
  assert.equal(r404.ok, false);
  assert.equal(r404.code, "not_found");

  const rRate = await triggerFitbitSync({
    repo: "owner/data-repo",
    token: "tok_ok",
    fetchImpl: async () => makeResponse(403, null, { "x-ratelimit-remaining": "0" }),
    storage,
  });
  assert.equal(rRate.ok, false);
  assert.equal(rRate.code, "rate_limit");

  const rNet = await triggerFitbitSync({
    repo: "owner/data-repo",
    token: "tok_ok",
    fetchImpl: async () => { throw new TypeError("Failed to fetch"); },
    storage,
  });
  assert.equal(rNet.ok, false);
  assert.equal(rNet.code, "network");
});

test("triggerFitbitSync: devuelve timeout con pending=true cuando se agota el tiempo", async () => {
  let clock = Date.parse("2026-11-24T15:00:00Z");
  const storage = makeMemStorage();
  let polls = 0;

  const res = await triggerFitbitSync({
    repo: "owner/data-repo",
    token: "tok_test",
    fetchImpl: async (url, opt) => {
      if (opt.method === "POST") return makeResponse(204);
      polls += 1;
      return makeResponse(200, {
        workflow_runs: [{ status: "in_progress", conclusion: null, created_at: "2026-11-24T15:00:01Z" }],
      });
    },
    pollIntervalMs: 3500,
    timeoutMs: 10500,
    sleepFn: async (ms) => { clock += ms; },
    nowFn: () => clock,
    storage,
  });

  assert.equal(polls, 3);
  assert.equal(res.ok, true);
  assert.equal(res.code, "timeout");
  assert.equal(res.pending, true);
  assert.equal(res.message, "Sincronización en curso en GitHub; actualiza en unos segundos.");
});

test("triggerFitbitSync: fallback elegante esperando ~18 s si GET runs devuelve 403 o falla", async () => {
  // Caso 403 en GET runs
  let clock1 = Date.parse("2026-11-24T15:00:00Z");
  const sleeps1 = [];
  const res403 = await triggerFitbitSync({
    repo: "owner/data-repo",
    token: "tok_test",
    fetchImpl: async (url, opt) => (opt.method === "POST" ? makeResponse(204) : makeResponse(403)),
    pollIntervalMs: 3500,
    fallbackWaitMs: 18000,
    sleepFn: async (ms) => { sleeps1.push(ms); clock1 += ms; },
    nowFn: () => clock1,
    storage: makeMemStorage(),
  });

  assert.equal(res403.ok, true);
  assert.equal(res403.fallback, true);
  assert.equal(res403.shouldReload, true);
  assert.equal(sleeps1.reduce((a, b) => a + b, 0), 18000);

  // Caso error de red/500 en GET runs
  let clock2 = Date.parse("2026-11-24T15:00:00Z");
  const sleeps2 = [];
  const res500 = await triggerFitbitSync({
    repo: "owner/data-repo",
    token: "tok_test",
    fetchImpl: async (url, opt) => (opt.method === "POST" ? makeResponse(204) : makeResponse(500)),
    pollIntervalMs: 3500,
    fallbackWaitMs: 18000,
    sleepFn: async (ms) => { sleeps2.push(ms); clock2 += ms; },
    nowFn: () => clock2,
    storage: makeMemStorage(),
  });

  assert.equal(res500.ok, true);
  assert.equal(res500.fallback, true);
  assert.equal(res500.shouldReload, true);
  assert.equal(sleeps2.reduce((a, b) => a + b, 0), 18000);
});

test("triggerFitbitSync: evita corridas duplicadas en paralelo", async () => {
  let clock = Date.parse("2026-11-24T15:00:00Z");
  let postCount = 0;
  let releaseSleep;
  const sleepGate = new Promise((resolve) => { releaseSleep = resolve; });

  const fetchImpl = async (url, opt) => {
    if (opt.method === "POST") {
      postCount += 1;
      return makeResponse(204);
    }
    return makeResponse(200, {
      workflow_runs: [
        { status: "completed", conclusion: "success", created_at: "2026-11-24T15:00:01Z", html_url: "https://github.com/u/r/actions/runs/999" },
      ],
    });
  };

  const opts = {
    repo: "owner/data-repo",
    token: "tok_test",
    fetchImpl,
    pollIntervalMs: 3500,
    sleepFn: async (ms) => { await sleepGate; clock += ms; },
    nowFn: () => clock,
    storage: makeMemStorage(),
  };

  const p1 = triggerFitbitSync(opts);
  const p2 = triggerFitbitSync(opts);
  releaseSleep();
  const [r1, r2] = await Promise.all([p1, p2]);

  assert.equal(postCount, 1);
  assert.deepEqual(r1, r2);
  assert.equal(r1.ok, true);
});
