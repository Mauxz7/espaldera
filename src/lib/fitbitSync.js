// Sincronización bajo demanda y automática de Fitbit vía GitHub Actions (workflow_dispatch).
// Módulo puro + estado de cooldown en localStorage. Sin interfaz; pruebas en tests/fitbit-sync.test.mjs.
import { LS } from "./storage.js";

export const FITBIT_WORKFLOW = "google-health.yml";
export const FITBIT_REF = "main";
export const FITBIT_AUTO_COOLDOWN_MS = 15 * 60 * 1000; // 15 min entre intentos automáticos
export const FITBIT_FORBIDDEN_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 h de backoff tras 403
export const DEFAULT_POLL_INTERVAL_MS = 3500;
export const DEFAULT_TIMEOUT_MS = 75000;
export const DEFAULT_FALLBACK_WAIT_MS = 18000;
export const DISPATCH_CLOCK_SKEW_MS = 10000;

export const FITBIT_SYNC_KEYS = {
  lastAttempt: "@fitbitSync:lastAttempt",
  lastForbidden: "@fitbitSync:lastForbidden",
  lastSuccess: "@fitbitSync:lastSuccess",
};

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let activeSyncPromise = null;

function toFiniteNum(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function readFitbitSyncMeta(storage = LS) {
  return {
    lastAttemptMs: toFiniteNum(storage?.get?.(FITBIT_SYNC_KEYS.lastAttempt)),
    lastForbiddenMs: toFiniteNum(storage?.get?.(FITBIT_SYNC_KEYS.lastForbidden)),
    lastSuccessMs: toFiniteNum(storage?.get?.(FITBIT_SYNC_KEYS.lastSuccess)),
  };
}

export function markFitbitAttempt(nowMs = Date.now(), storage = LS) {
  storage?.set?.(FITBIT_SYNC_KEYS.lastAttempt, nowMs);
}

export function markFitbitForbidden(nowMs = Date.now(), storage = LS) {
  storage?.set?.(FITBIT_SYNC_KEYS.lastForbidden, nowMs);
}

export function markFitbitSuccess(nowMs = Date.now(), storage = LS) {
  storage?.set?.(FITBIT_SYNC_KEYS.lastSuccess, nowMs);
  storage?.del?.(FITBIT_SYNC_KEYS.lastForbidden);
}

export function isFitbitSyncInFlight() {
  return activeSyncPromise !== null;
}

export function getTodayFitbitStatus(todayKey, sleep, vitals) {
  if (!todayKey) return { hasSleep: false, hasVitals: false, isComplete: false };
  const s = sleep && typeof sleep === "object" ? sleep[todayKey] : null;
  const hasSleep = Boolean(s && (typeof s !== "object" || s.min == null || s.min > 0));
  const v = vitals && typeof vitals === "object" ? vitals[todayKey] : null;
  const hasVitals = Boolean(v && typeof v === "object" && (v.hrv != null || v.rhr != null));
  return { hasSleep, hasVitals, isComplete: hasSleep && hasVitals };
}

export function shouldAutoSyncFitbit({
  todayKey,
  sleep,
  vitals,
  nowMs = Date.now(),
  lastAttemptMs = null,
  lastForbiddenMs = null,
  hasSyncConfig = false,
  inFlight = false,
} = {}) {
  if (!hasSyncConfig || inFlight || !todayKey) return false;
  const { isComplete } = getTodayFitbitStatus(todayKey, sleep, vitals);
  if (isComplete) return false;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  if (typeof lastAttemptMs === "number" && Number.isFinite(lastAttemptMs) && (now - lastAttemptMs) < FITBIT_AUTO_COOLDOWN_MS) {
    return false;
  }
  if (typeof lastForbiddenMs === "number" && Number.isFinite(lastForbiddenMs) && (now - lastForbiddenMs) < FITBIT_FORBIDDEN_COOLDOWN_MS) {
    return false;
  }
  return true;
}

function isRateLimited(res) {
  if (!res) return false;
  if (res.status === 429) return true;
  const remaining = res.headers && typeof res.headers.get === "function"
    ? res.headers.get("x-ratelimit-remaining")
    : null;
  return res.status === 403 && remaining === "0";
}

function makeHeaders(token, withJson = false) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (withJson) headers["Content-Type"] = "application/json";
  return headers;
}

async function runFitbitSync({
  repo,
  token,
  workflow = FITBIT_WORKFLOW,
  ref = FITBIT_REF,
  fetchImpl = globalThis.fetch,
  onStatus = null,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fallbackWaitMs = DEFAULT_FALLBACK_WAIT_MS,
  sleepFn = defaultSleep,
  nowFn = () => Date.now(),
  storage = LS,
} = {}) {
  if (!repo || !token) {
    return {
      ok: false,
      code: "no_config",
      message: "Conecta primero tu repositorio privado de GitHub en Ajustes para sincronizar Fitbit.",
    };
  }
  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      code: "network",
      message: "No se pudo conectar con GitHub. Revisa tu conexión e inténtalo de nuevo.",
    };
  }

  const emitStatus = (stage, text) => {
    if (typeof onStatus === "function") {
      try { onStatus({ stage, text }); } catch (e) {}
    }
  };

  emitStatus("dispatching", "Enviando…");
  const dispatchedAt = nowFn();
  const encodedWorkflow = encodeURIComponent(workflow);
  const dispatchUrl = `https://api.github.com/repos/${repo}/actions/workflows/${encodedWorkflow}/dispatches`;

  let dispatchRes;
  try {
    dispatchRes = await fetchImpl(dispatchUrl, {
      method: "POST",
      cache: "no-store",
      headers: makeHeaders(token, true),
      body: JSON.stringify({ ref }),
    });
  } catch (e) {
    markFitbitAttempt(nowFn(), storage);
    return {
      ok: false,
      code: "network",
      message: "No se pudo conectar con GitHub. Revisa tu conexión e inténtalo de nuevo.",
    };
  }

  if (isRateLimited(dispatchRes)) {
    markFitbitAttempt(nowFn(), storage);
    return {
      ok: false,
      code: "rate_limit",
      message: "GitHub limitó temporalmente las peticiones. Espera unos minutos e inténtalo de nuevo.",
    };
  }

  if (dispatchRes.status === 403) {
    const now = nowFn();
    markFitbitAttempt(now, storage);
    markFitbitForbidden(now, storage);
    return {
      ok: false,
      code: "forbidden",
      message: "Tu token de GitHub necesita el permiso «Actions: Read and write» en tu repo de datos para sincronizar Fitbit desde la app.",
    };
  }

  if (dispatchRes.status === 401) {
    markFitbitAttempt(nowFn(), storage);
    return {
      ok: false,
      code: "unauthorized",
      message: "Tu token de GitHub venció o no es válido. Actualízalo en Ajustes.",
    };
  }

  if (dispatchRes.status === 404) {
    markFitbitAttempt(nowFn(), storage);
    return {
      ok: false,
      code: "not_found",
      message: "No se encontró el repositorio o el workflow de Fitbit en GitHub.",
    };
  }

  if (dispatchRes.status !== 204 && !dispatchRes.ok) {
    markFitbitAttempt(nowFn(), storage);
    return {
      ok: false,
      code: "http_error",
      status: dispatchRes.status,
      message: `GitHub respondió con el error ${dispatchRes.status} al sincronizar Fitbit.`,
    };
  }

  // 204 No Content: no intentamos parsear JSON.
  markFitbitAttempt(nowFn(), storage);
  emitStatus("running", "Trayendo datos de Fitbit…");

  const runsUrl = `https://api.github.com/repos/${repo}/actions/workflows/${encodedWorkflow}/runs?event=workflow_dispatch&per_page=3`;
  const stepMs = Math.max(1, Number(pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS);
  const maxMs = Math.max(stepMs, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
  const fallbackMs = Math.max(0, Number(fallbackWaitMs) || DEFAULT_FALLBACK_WAIT_MS);
  let logicalElapsed = 0;

  const fallbackAfterRunsFailure = async (code) => {
    emitStatus("waiting", "Trayendo datos de Fitbit…");
    const remainingWait = Math.max(0, fallbackMs - logicalElapsed);
    if (remainingWait > 0) await sleepFn(remainingWait);
    markFitbitAttempt(nowFn(), storage);
    return {
      ok: true,
      code,
      fallback: true,
      shouldReload: true,
      message: "Sincronización enviada. Recargando datos…",
    };
  };

  while (logicalElapsed < maxMs && (nowFn() - dispatchedAt) < maxMs) {
    const waitMs = Math.min(stepMs, maxMs - logicalElapsed);
    await sleepFn(waitMs);
    logicalElapsed += waitMs;

    let runsRes;
    try {
      runsRes = await fetchImpl(runsUrl, {
        method: "GET",
        cache: "no-store",
        headers: makeHeaders(token, false),
      });
    } catch (e) {
      return fallbackAfterRunsFailure("runs_error_fallback");
    }

    if (runsRes.status === 403) {
      return fallbackAfterRunsFailure("runs_forbidden_fallback");
    }
    if (!runsRes.ok) {
      return fallbackAfterRunsFailure("runs_error_fallback");
    }

    let payload;
    try {
      payload = await runsRes.json();
    } catch (e) {
      return fallbackAfterRunsFailure("runs_error_fallback");
    }

    const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
    const match = runs.find((r) => {
      const created = Date.parse(r?.created_at || "");
      return Number.isFinite(created) && created >= dispatchedAt - DISPATCH_CLOCK_SKEW_MS;
    });

    if (match && match.status === "completed") {
      const runUrl = match.html_url || null;
      const conclusion = match.conclusion || "unknown";
      const finishedAt = nowFn();
      markFitbitAttempt(finishedAt, storage);
      if (conclusion === "success") {
        markFitbitSuccess(finishedAt, storage);
        return {
          ok: true,
          code: "success",
          conclusion: "success",
          runUrl,
          shouldReload: true,
          message: "Actualizado",
        };
      }
      return {
        ok: false,
        code: "workflow_failed",
        conclusion,
        runUrl,
        message: "Falló la corrida en GitHub Actions (revisa si venció el permiso de 7 días de Fitbit con --solo-fitbit).",
      };
    }
  }

  markFitbitAttempt(nowFn(), storage);
  return {
    ok: true,
    code: "timeout",
    pending: true,
    shouldReload: true,
    message: "Sincronización en curso en GitHub; actualiza en unos segundos.",
  };
}

export function triggerFitbitSync(opts = {}) {
  if (activeSyncPromise) return activeSyncPromise;
  const run = runFitbitSync(opts).finally(() => {
    if (activeSyncPromise === run) activeSyncPromise = null;
  });
  activeSyncPromise = run;
  return run;
}
