import test from "node:test";
import assert from "node:assert/strict";
import {
  TIMER_SOUND_KEY,
  DEFAULT_FINISH_GRACE_MS,
  DEFAULT_VIBRATE_PATTERN,
  unlockTimerAudio,
  playTimerDoneChime,
  playTimerPreviewPing,
  isTimerSoundEnabled,
  setTimerSoundEnabled,
  subscribeTimerSound,
  shouldFireTimerFinish,
  sanitizeRestoredTimer,
  _resetTimerSoundForTest,
} from "../src/lib/timerSound.js";

function createFakeAudioEnv({ initialState = "suspended", useWebkit = false } = {}) {
  const instances = [];

  class FakeAudioContext {
    constructor() {
      this.state = initialState;
      this.currentTime = 1.5;
      this.destination = { kind: "destination" };
      this.resumeCalls = 0;
      this.buffers = [];
      this.bufferSources = [];
      this.oscillators = [];
      this.gains = [];
      instances.push(this);
    }

    resume() {
      this.resumeCalls += 1;
      this.state = "running";
      return Promise.resolve();
    }

    createBuffer(channels, length, sampleRate) {
      const buf = { channels, length, sampleRate };
      this.buffers.push(buf);
      return buf;
    }

    createBufferSource() {
      const src = {
        buffer: null,
        connectedTo: null,
        startedAt: null,
        connect(dest) { this.connectedTo = dest; },
        start(when) { this.startedAt = when; },
      };
      this.bufferSources.push(src);
      return src;
    }

    createOscillator() {
      const osc = {
        type: "sine",
        frequency: {
          value: 440,
          events: [],
          setValueAtTime(val, at) {
            this.value = val;
            this.events.push({ val, at });
          },
        },
        connectedTo: null,
        startedAt: null,
        stoppedAt: null,
        connect(dest) { this.connectedTo = dest; },
        start(when) { this.startedAt = when; },
        stop(when) { this.stoppedAt = when; },
      };
      this.oscillators.push(osc);
      return osc;
    }

    createGain() {
      const gain = {
        connectedTo: null,
        gain: {
          events: [],
          setValueAtTime(val, at) { this.events.push({ fn: "set", val, at }); },
          linearRampToValueAtTime(val, at) { this.events.push({ fn: "linear", val, at }); },
          exponentialRampToValueAtTime(val, at) { this.events.push({ fn: "exp", val, at }); },
        },
        connect(dest) { this.connectedTo = dest; },
      };
      this.gains.push(gain);
      return gain;
    }
  }

  const prevWindow = globalThis.window;
  const prevAudioCtx = globalThis.AudioContext;
  const prevWebkitCtx = globalThis.webkitAudioContext;
  const prevNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  const vibrateCalls = [];
  const fakeWindow = useWebkit
    ? { webkitAudioContext: FakeAudioContext }
    : { AudioContext: FakeAudioContext };

  globalThis.window = fakeWindow;
  delete globalThis.AudioContext;
  delete globalThis.webkitAudioContext;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { vibrate(pattern) { vibrateCalls.push(pattern); return true; } },
  });

  const cleanup = () => {
    _resetTimerSoundForTest();
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
    if (prevAudioCtx === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = prevAudioCtx;
    if (prevWebkitCtx === undefined) delete globalThis.webkitAudioContext;
    else globalThis.webkitAudioContext = prevWebkitCtx;
    if (prevNavigator) Object.defineProperty(globalThis, "navigator", prevNavigator);
    else delete globalThis.navigator;
  };

  return { instances, vibrateCalls, cleanup };
}

function createFakeStorage() {
  const map = new Map();
  const prev = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
  };
  return {
    map,
    cleanup() {
      if (prev === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = prev;
    },
  };
}

test("unlockTimerAudio crea singleton AudioContext, reanuda y reproduce buffer silencioso de 1 muestra", () => {
  const env = createFakeAudioEnv({ initialState: "suspended" });
  try {
    assert.equal(unlockTimerAudio(), true);
    assert.equal(env.instances.length, 1);

    const ctx = env.instances[0];
    assert.equal(ctx.resumeCalls, 1);
    assert.equal(ctx.state, "running");
    assert.equal(ctx.buffers.length, 1);
    assert.deepEqual(ctx.buffers[0], { channels: 1, length: 1, sampleRate: 22050 });
    assert.equal(ctx.bufferSources.length, 1);
    assert.equal(ctx.bufferSources[0].connectedTo, ctx.destination);
    assert.equal(ctx.bufferSources[0].startedAt, 0);

    // Segunda llamada reutiliza el mismo singleton.
    assert.equal(unlockTimerAudio(), true);
    assert.equal(env.instances.length, 1);
    assert.equal(ctx.bufferSources.length, 2);
  } finally {
    env.cleanup();
  }
});

test("unlockTimerAudio soporta webkitAudioContext (Safari iOS)", () => {
  const env = createFakeAudioEnv({ initialState: "interrupted", useWebkit: true });
  try {
    assert.equal(unlockTimerAudio(), true);
    assert.equal(env.instances.length, 1);
    assert.equal(env.instances[0].resumeCalls, 1);
    assert.equal(env.instances[0].bufferSources.length, 1);
  } finally {
    env.cleanup();
  }
});

test("playTimerDoneChime sintetiza triple campana suave (~0.82 s) y vibra cuando está activo", () => {
  const env = createFakeAudioEnv({ initialState: "running" });
  try {
    const played = playTimerDoneChime({ enabled: true });
    assert.equal(played, true);
    assert.equal(env.instances.length, 1);

    const ctx = env.instances[0];
    assert.equal(ctx.oscillators.length, 3);
    assert.equal(ctx.gains.length, 3);

    // Verifica progresión temporal sin clicks (ataque + caída suave) y duración total ~0.7-0.9 s.
    const firstStart = ctx.oscillators[0].startedAt;
    const lastStop = ctx.oscillators[2].stoppedAt;
    const totalDuration = lastStop - firstStart;
    assert.ok(totalDuration >= 0.7 && totalDuration <= 0.95, `duración inesperada: ${totalDuration}`);

    for (let i = 0; i < 3; i++) {
      const osc = ctx.oscillators[i];
      const gain = ctx.gains[i];
      assert.equal(osc.connectedTo, gain);
      assert.equal(gain.connectedTo, ctx.destination);
      assert.ok(gain.gain.events.length >= 3);
      assert.equal(gain.gain.events[0].fn, "set");
      assert.ok(gain.gain.events[0].val <= 0.001);
      assert.equal(gain.gain.events[1].fn, "linear");
      assert.equal(gain.gain.events[2].fn, "exp");
    }

    assert.equal(env.vibrateCalls.length, 1);
    assert.deepEqual(env.vibrateCalls[0], DEFAULT_VIBRATE_PATTERN);
  } finally {
    env.cleanup();
  }
});

test("playTimerDoneChime respeta el modo silenciado (enabled: false) y no suena ni vibra", () => {
  const env = createFakeAudioEnv({ initialState: "running" });
  try {
    const played = playTimerDoneChime({ enabled: false });
    assert.equal(played, false);
    assert.equal(env.instances.length, 0);
    assert.equal(env.vibrateCalls.length, 0);
  } finally {
    env.cleanup();
  }
});

test("playTimerPreviewPing reproduce un tono breve de confirmación", () => {
  const env = createFakeAudioEnv({ initialState: "running" });
  try {
    assert.equal(playTimerPreviewPing(), true);
    assert.equal(env.instances[0].oscillators.length, 1);
    assert.equal(env.vibrateCalls.length, 0);
  } finally {
    env.cleanup();
  }
});

test("degradación segura sin AudioContext ni navigator.vibrate (no lanza errores)", () => {
  const prevWindow = globalThis.window;
  const prevAudio = globalThis.AudioContext;
  const prevWebkit = globalThis.webkitAudioContext;
  const prevNav = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  try {
    _resetTimerSoundForTest();
    globalThis.window = {};
    delete globalThis.AudioContext;
    delete globalThis.webkitAudioContext;
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });

    assert.equal(unlockTimerAudio(), false);
    assert.equal(playTimerDoneChime({ enabled: true }), false);
    assert.equal(playTimerPreviewPing(), false);
  } finally {
    _resetTimerSoundForTest();
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
    if (prevAudio === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = prevAudio;
    if (prevWebkit === undefined) delete globalThis.webkitAudioContext;
    else globalThis.webkitAudioContext = prevWebkit;
    if (prevNav) Object.defineProperty(globalThis, "navigator", prevNav);
    else delete globalThis.navigator;
  }
});

test("preferencia local isTimerSoundEnabled / setTimerSoundEnabled y suscriptores", () => {
  const storage = createFakeStorage();
  try {
    // Por defecto viene activado en true sin configurar nada.
    assert.equal(isTimerSoundEnabled(), true);

    const events = [];
    const unsub = subscribeTimerSound((v) => events.push(v));

    setTimerSoundEnabled(false);
    assert.equal(storage.map.get(TIMER_SOUND_KEY), "false");
    assert.equal(isTimerSoundEnabled(), false);

    setTimerSoundEnabled(true);
    assert.equal(storage.map.get(TIMER_SOUND_KEY), "true");
    assert.equal(isTimerSoundEnabled(), true);
    assert.deepEqual(events, [false, true]);

    unsub();
    setTimerSoundEnabled(false);
    assert.deepEqual(events, [false, true]);
  } finally {
    storage.cleanup();
    _resetTimerSoundForTest();
  }
});

test("shouldFireTimerFinish dispara una sola vez al cruzar >0 → 0 y respeta ventana de cortesía", () => {
  const endAt = 1_000_000;

  // Todavía corriendo: no dispara.
  assert.equal(
    shouldFireTimerFinish({ prevRemainingMs: 5000, remainingMs: 200, endAt, now: endAt - 200 }),
    false,
  );

  // Cruce exacto >0 → 0: dispara.
  assert.equal(
    shouldFireTimerFinish({ prevRemainingMs: 200, remainingMs: 0, endAt, now: endAt }),
    true,
  );

  // En bucle (prevRemainingMs ya era 0): NO dispara.
  assert.equal(
    shouldFireTimerFinish({ prevRemainingMs: 0, remainingMs: 0, endAt, now: endAt + 200 }),
    false,
  );

  // Ya disparado para este timer: NO dispara.
  assert.equal(
    shouldFireTimerFinish({ prevRemainingMs: 200, remainingMs: 0, endAt, now: endAt, alreadyFired: true }),
    false,
  );

  // En pausa: NO dispara.
  assert.equal(
    shouldFireTimerFinish({ prevRemainingMs: 200, remainingMs: 0, endAt, now: endAt, paused: true }),
    false,
  );

  // Pantalla reanudada dentro de la ventana de cortesía (<= 10 s): dispara una vez.
  assert.equal(
    shouldFireTimerFinish({ prevRemainingMs: 15000, remainingMs: 0, endAt, now: endAt + 4000 }),
    true,
  );
  assert.equal(
    shouldFireTimerFinish({ prevRemainingMs: null, remainingMs: 0, endAt, now: endAt + DEFAULT_FINISH_GRACE_MS }),
    true,
  );

  // Pantalla reanudada o timer recargado vencido hace más de 10 s (p. ej. horas atrás): NO dispara.
  assert.equal(
    shouldFireTimerFinish({ prevRemainingMs: 15000, remainingMs: 0, endAt, now: endAt + DEFAULT_FINISH_GRACE_MS + 1 }),
    false,
  );
  assert.equal(
    shouldFireTimerFinish({ prevRemainingMs: null, remainingMs: 0, endAt, now: endAt + 3 * 3600 * 1000 }),
    false,
  );
});

test("sanitizeRestoredTimer conserva activos/pausados/cortesía y descarta timers vencidos hace mucho", () => {
  const now = 2_000_000;

  // Activo: se conserva.
  const active = sanitizeRestoredTimer({ id: 1, endAt: now + 45_000, duration: 90_000 }, now);
  assert.deepEqual(active, { id: 1, endAt: now + 45_000, duration: 90_000 });

  // Vencido hace 3 s (dentro de cortesía de 10 s): se conserva para avisar una vez.
  const recent = sanitizeRestoredTimer({ id: 2, endAt: now - 3_000, duration: 60_000 }, now);
  assert.deepEqual(recent, { id: 2, endAt: now - 3_000, duration: 60_000 });

  // Vencido hace 2 horas: se descarta silenciosamente.
  assert.equal(sanitizeRestoredTimer({ id: 3, endAt: now - 2 * 3600 * 1000, duration: 60_000 }, now), null);

  // Pausado válido: se conserva.
  const paused = sanitizeRestoredTimer({ id: 4, paused: true, left: 30_000, duration: 60_000 }, now);
  assert.deepEqual(paused, { id: 4, paused: true, left: 30_000, duration: 60_000 });

  // Basura / inválido: null.
  assert.equal(sanitizeRestoredTimer(null, now), null);
  assert.equal(sanitizeRestoredTimer({ endAt: "x", duration: 60_000 }, now), null);
});
