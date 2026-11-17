// Lógica pura de dopamina buena y barata (sin interfaz, con pruebas en tests/dopamine.test.mjs).
import { DEFAULT_DOPAMINE_DEFS } from "../data/dopamine.js";
import { pruneDays } from "./dates.js";

// Entero >= 0 a partir de un número o texto; si falta o no es válido devuelve `fallback`.
// El 0 es un valor válido: límite 0 = tolerancia cero; meta 0 = sin meta.
export function parseDopamineCount(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Normaliza la lista de definiciones: descarta entradas sin id, evita duplicados
// y conserva solo los campos propios de cada tipo (`limit` en cheap; `identity` y `goal` en good).
// Sin `limit` vale 1 y sin `goal` vale 0, así los datos guardados antes siguen igual.
export function normalizeDopamineDefs(list) {
  if (!Array.isArray(list)) return DEFAULT_DOPAMINE_DEFS;
  const seen = new Set();
  const out = [];
  for (const it of list) {
    if (!it || typeof it.id !== "string" || !it.id || seen.has(it.id)) continue;
    seen.add(it.id);
    const label = typeof it.label === "string" && it.label.trim() ? it.label.trim() : "Elemento";
    const kind = it.kind === "cheap" ? "cheap" : "good";
    if (kind === "cheap") {
      out.push({ id: it.id, label, kind, limit: parseDopamineCount(it.limit, 1) });
    } else {
      const identity = typeof it.identity === "string" && it.identity ? it.identity : null;
      out.push({ id: it.id, label, kind, identity, goal: parseDopamineCount(it.goal, 0) });
    }
  }
  return out;
}

// Conteo de un elemento en una fecha dada.
export function dopamineDayCount(dopamine, dateKey, id) {
  if (!dopamine || !dateKey || !id) return 0;
  const n = Number((dopamine[dateKey] || {})[id]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// Indica si un elemento de dopamina barata pasó su límite diario (con límite 0, un solo registro).
export function isOverLimit(def, count) {
  if (!def || def.kind !== "cheap") return false;
  return count > parseDopamineCount(def.limit, 1);
}

// Dopamina barata con límite 0: marcarla una vez falla el día.
export function isZeroTolerance(def) {
  return !!def && def.kind === "cheap" && parseDopamineCount(def.limit, 1) === 0;
}

// Dopamina buena: cumple el día con `goal` registros (meta 0 = sin meta: basta con 1).
export function isGoalMet(def, count) {
  if (!def || def.kind !== "good") return false;
  return count >= Math.max(1, parseDopamineCount(def.goal, 0));
}

// Elementos de tolerancia cero marcados en `dateKey` (lista vacía si el día no está fallado).
export function dopamineDayFailures(dopamine, dateKey, dopamineDefs) {
  return normalizeDopamineDefs(dopamineDefs).filter(
    (def) => isZeroTolerance(def) && dopamineDayCount(dopamine, dateKey, def.id) > 0,
  );
}

// Registra +delta (por defecto +1 o -1 para deshacer) en `dateKey` y poda a `maxDays` días.
export function recordDopamine(dopamine, dateKey, id, delta = 1, maxDays = 60) {
  const base = dopamine && typeof dopamine === "object" ? dopamine : {};
  if (!dateKey || !id) return base;
  const curDay = base[dateKey] && typeof base[dateKey] === "object" ? base[dateKey] : {};
  const nextCount = Math.max(0, dopamineDayCount(base, dateKey, id) + delta);
  const nextDay = { ...curDay };
  if (nextCount > 0) nextDay[id] = nextCount;
  else delete nextDay[id];

  const next = { ...base };
  if (Object.keys(nextDay).length > 0) next[dateKey] = nextDay;
  else delete next[dateKey];
  return pruneDays(next, maxDays);
}

// Resumen de la semana (lunes a hoy) por elemento y totales (buenos vs baratos),
// más los días fallados por dopamina de tolerancia cero (`failedDays`) y los elementos que fallan hoy (`failedToday`).
export function dopamineWeekStats({ keys, todayIdx, dopamine, dopamineDefs }) {
  const defs = normalizeDopamineDefs(dopamineDefs);
  const week = Array.isArray(keys) ? keys : [];
  const last = week.length ? Math.min(week.length - 1, Number.isFinite(todayIdx) ? todayIdx : week.length - 1) : -1;
  const todayKey = last >= 0 ? week[last] : null;

  let goodWeek = 0;
  let cheapWeek = 0;
  const items = defs.map((def) => {
    const today = todayKey ? dopamineDayCount(dopamine, todayKey, def.id) : 0;
    let weekTotal = 0;
    for (let i = 0; i <= last; i++) {
      weekTotal += dopamineDayCount(dopamine, week[i], def.id);
    }
    if (def.kind === "cheap") cheapWeek += weekTotal;
    else goodWeek += weekTotal;
    return {
      ...def,
      today,
      week: weekTotal,
      overLimit: isOverLimit(def, today),
      zeroTolerance: isZeroTolerance(def),
      goalMet: isGoalMet(def, today),
    };
  });

  let failedDays = 0;
  for (let i = 0; i <= last; i++) {
    if (dopamineDayFailures(dopamine, week[i], defs).length > 0) failedDays += 1;
  }
  const failedToday = items.filter((it) => it.zeroTolerance && it.today > 0);

  return { items, goodWeek, cheapWeek, failedDays, failedToday };
}

// Elemento nuevo para el editor en Ajustes.
export function newDopamineItem(defs, kind = "good", now = Date.now()) {
  const list = Array.isArray(defs) ? defs : [];
  let id = `d_${now.toString(36)}`;
  while (list.some((it) => it && it.id === id)) id += "x";
  return kind === "cheap"
    ? { id, label: "Nuevo elemento", kind: "cheap", limit: 1 }
    : { id, label: "Nuevo elemento", kind: "good", identity: null, goal: 0 };
}
