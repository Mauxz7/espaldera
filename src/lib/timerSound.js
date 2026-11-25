// Sonido del temporizador de descanso con Web Audio API puro (100 % offline, sin archivos MP3).
// Diseñado para Safari iOS / PWA: desbloquea el audio dentro del gesto del usuario con un buffer
// silencioso de 1 muestra y sintetiza una campana triple limpia con envolvente suave sin clicks.

export const TIMER_SOUND_KEY = "fitpanel:timerSound";
export const REST_TIMER_STORAGE_KEY = "fitpanel:restTimer";
export const DEFAULT_FINISH_GRACE_MS = 10_000;
export const DEFAULT_VIBRATE_PATTERN = [180, 90, 240];

// Campana triple ascendente (A5 → C#6 → E6), audible en gimnasio y suave al oído (~0.82 s total).
const CHIME_NOTES = [
  { offset: 0.0, freq: 880.0, duration: 0.24, peak: 0.28 },
  { offset: 0.22, freq: 1108.73, duration: 0.24, peak: 0.3 },
  { offset: 0.44, freq: 1318.51, duration: 0.38, peak: 0.34 },
];

const PREVIEW_NOTE = { offset: 0.0, freq: 1046.5, duration: 0.2, peak: 0.22 };

let audioCtx = null;
const soundListeners = new Set();

function resolveAudioContextCtor() {
  try {
    if (typeof window !== "undefined") {
      if (typeof window.AudioContext === "function") return window.AudioContext;
      if (typeof window.webkitAudioContext === "function") return window.webkitAudioContext;
    }
    if (typeof globalThis !== "undefined") {
      if (typeof globalThis.AudioContext === "function") return globalThis.AudioContext;
      if (typeof globalThis.webkitAudioContext === "function") return globalThis.webkitAudioContext;
    }
  } catch (e) {}
  return null;
}

function getOrCreateAudioContext() {
  try {
    if (audioCtx && audioCtx.state === "closed") {
      audioCtx = null;
    }
    if (!audioCtx) {
      const Ctor = resolveAudioContextCtor();
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

function resumeContextSafely(ctx) {
  try {
    if (!ctx || typeof ctx.resume !== "function") return;
    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      const res = ctx.resume();
      if (res && typeof res.catch === "function") {
        res.catch(() => {});
      }
    }
  } catch (e) {}
}

function scheduleBellNotes(ctx, notes) {
  const baseTime = typeof ctx.currentTime === "number" && Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0;
  let scheduled = 0;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if ("type" in osc) osc.type = "sine";
    if (osc.frequency && typeof osc.frequency.setValueAtTime === "function") {
      osc.frequency.setValueAtTime(note.freq, baseTime + note.offset);
    } else if (osc.frequency) {
      osc.frequency.value = note.freq;
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    const startAt = baseTime + note.offset;
    const attackEnd = startAt + 0.012;
    const releaseEnd = startAt + note.duration;

    if (gain.gain) {
      gain.gain.setValueAtTime(0.0001, startAt);
      if (typeof gain.gain.linearRampToValueAtTime === "function") {
        gain.gain.linearRampToValueAtTime(note.peak, attackEnd);
      } else if (typeof gain.gain.exponentialRampToValueAtTime === "function") {
        gain.gain.exponentialRampToValueAtTime(note.peak, attackEnd);
      }
      if (typeof gain.gain.exponentialRampToValueAtTime === "function") {
        gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);
      } else if (typeof gain.gain.linearRampToValueAtTime === "function") {
        gain.gain.linearRampToValueAtTime(0.0001, releaseEnd);
      }
    }

    osc.start(startAt);
    osc.stop(releaseEnd + 0.02);
    scheduled += 1;
  }
  return scheduled;
}

function triggerVibration(pattern = DEFAULT_VIBRATE_PATTERN) {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : globalThis.navigator;
    if (nav && typeof nav.vibrate === "function") {
      nav.vibrate(pattern);
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Desbloquea el audio en Safari iOS / PWA.
 * Debe llamarse sincrónicamente dentro del gesto del usuario (al arrancar un descanso,
 * elegir un preset o marcar una serie que inicia descanso).
 */
export function unlockTimerAudio() {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;
  resumeContextSafely(ctx);
  try {
    if (typeof ctx.createBuffer === "function" && typeof ctx.createBufferSource === "function") {
      const silent = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch (e) {}
  return true;
}

/**
 * Reproduce la señal sonora de fin de descanso (campana triple suave ~0.82 s)
 * y vibración opcional si el dispositivo la soporta.
 */
export function playTimerDoneChime({ enabled = true, vibrate = true } = {}) {
  if (!enabled) return false;

  let playedAudio = false;
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx && typeof ctx.createOscillator === "function" && typeof ctx.createGain === "function") {
      resumeContextSafely(ctx);
      playedAudio = scheduleBellNotes(ctx, CHIME_NOTES) > 0;
    }
  } catch (e) {}

  const vibrated = vibrate ? triggerVibration(DEFAULT_VIBRATE_PATTERN) : false;
  return playedAudio || vibrated;
}

/**
 * Pequeño ping de confirmación al reactivar el sonido del temporizador.
 */
export function playTimerPreviewPing() {
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx || typeof ctx.createOscillator !== "function" || typeof ctx.createGain !== "function") {
      return false;
    }
    resumeContextSafely(ctx);
    return scheduleBellNotes(ctx, [PREVIEW_NOTE]) > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Lee la preferencia local del sonido del temporizador (activado `true` por defecto).
 */
export function isTimerSoundEnabled() {
  try {
    const storage = typeof localStorage !== "undefined" ? localStorage : globalThis.localStorage;
    if (!storage || typeof storage.getItem !== "function") return true;
    const raw = storage.getItem(TIMER_SOUND_KEY);
    if (raw == null || raw === "") return true;
    const norm = String(raw).trim().toLowerCase();
    if (norm === "false" || norm === "0") return false;
    if (norm === "true" || norm === "1") return true;
    const parsed = JSON.parse(raw);
    return parsed !== false;
  } catch (e) {
    return true;
  }
}

/**
 * Guarda la preferencia local del sonido del temporizador y avisa a los componentes suscritos.
 */
export function setTimerSoundEnabled(enabled) {
  const next = Boolean(enabled);
  try {
    const storage = typeof localStorage !== "undefined" ? localStorage : globalThis.localStorage;
    if (storage && typeof storage.setItem === "function") {
      storage.setItem(TIMER_SOUND_KEY, next ? "true" : "false");
    }
  } catch (e) {}
  soundListeners.forEach((fn) => {
    try {
      fn(next);
    } catch (e) {}
  });
  return next;
}

/**
 * Suscribe un callback a cambios locales de la preferencia de sonido del temporizador.
 */
export function subscribeTimerSound(listener) {
  if (typeof listener !== "function") return () => {};
  soundListeners.add(listener);
  return () => {
    soundListeners.delete(listener);
  };
}

/**
 * Regla pura de transición de fin de temporizador:
 * dispara una sola vez al cruzar de `remaining > 0` a `remaining === 0`, o dentro de una
 * pequeña ventana de cortesía (`<= graceMs`, 10 s por defecto) si la pantalla se reanuda
 * justo después de terminar. Nunca dispara en bucle ni al restaurar un timer vencido hace mucho.
 */
export function shouldFireTimerFinish({
  prevRemainingMs,
  remainingMs,
  endAt,
  now,
  paused = false,
  alreadyFired = false,
  graceMs = DEFAULT_FINISH_GRACE_MS,
} = {}) {
  if (paused || alreadyFired) return false;
  if (typeof endAt !== "number" || !Number.isFinite(endAt)) return false;
  if (typeof now !== "number" || !Number.isFinite(now)) return false;

  const rem = typeof remainingMs === "number" && Number.isFinite(remainingMs)
    ? Math.max(0, remainingMs)
    : Math.max(0, endAt - now);

  if (rem > 0) return false;

  const maxGrace = typeof graceMs === "number" && Number.isFinite(graceMs) && graceMs >= 0
    ? graceMs
    : DEFAULT_FINISH_GRACE_MS;

  const overdueMs = now - endAt;
  if (overdueMs > maxGrace) return false;

  // Si ya estaba en 0 en el tick anterior, nunca volver a disparar.
  if (typeof prevRemainingMs === "number" && Number.isFinite(prevRemainingMs)) {
    return prevRemainingMs > 0;
  }

  // Si no hubo tick previo (p. ej. al reanudar o recargar justo al vencer), solo dentro de la cortesía.
  return overdueMs >= 0 && overdueMs <= maxGrace;
}

/**
 * Valida un temporizador restaurado de localStorage.
 * Conserva temporizadores activos, en pausa o vencidos dentro de la ventana de cortesía,
 * y descarta cualquiera vencido hace más tiempo (p. ej. horas atrás) para que nunca suene al recargar.
 */
export function sanitizeRestoredTimer(raw, now = Date.now(), graceMs = DEFAULT_FINISH_GRACE_MS) {
  if (!raw || typeof raw !== "object") return null;
  const duration = Number(raw.duration);
  if (!Number.isFinite(duration) || duration <= 0) return null;

  if (raw.paused) {
    const left = Number(raw.left);
    if (!Number.isFinite(left) || left <= 0) return null;
    return {
      id: Number.isFinite(Number(raw.id)) ? Number(raw.id) : now,
      paused: true,
      left,
      duration,
    };
  }

  const endAt = Number(raw.endAt);
  if (!Number.isFinite(endAt)) return null;
  const maxGrace = typeof graceMs === "number" && Number.isFinite(graceMs) && graceMs >= 0
    ? graceMs
    : DEFAULT_FINISH_GRACE_MS;

  if (now - endAt > maxGrace) return null;

  return {
    id: Number.isFinite(Number(raw.id)) ? Number(raw.id) : endAt,
    endAt,
    duration,
  };
}

/**
 * Utilidad solo para pruebas unitarias: limpia el singleton de AudioContext y listeners.
 */
export function _resetTimerSoundForTest() {
  audioCtx = null;
  soundListeners.clear();
}
