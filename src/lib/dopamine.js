// Lógica pura de dopamina buena y barata (sin interfaz, con pruebas en tests/dopamine.test.mjs).
import { DEFAULT_DOPAMINE_DEFS } from "../data/dopamine.js";
import { pruneDays } from "./dates.js";

// Normaliza la lista de definiciones: descarta entradas sin id, evita duplicados
// y conserva solo los campos propios de cada tipo (`limit` en cheap, `identity` en good).
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
      const n = Math.floor(Number(it.limit));
      out.push({ id: it.id, label, kind, limit: Number.isFinite(n) && n >= 1 ? n : 1 });
    } else {
      const identity = typeof it.identity === "string" && it.identity ? it.identity : null;
      out.push({ id: it.id, label, kind, identity });
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

// Indica si un elemento de dopamina barata pasó su límite diario.
export function isOverLimit(def, count) {
  if (!def || def.kind !== "cheap") return false;
  const limit = Number.isFinite(Number(def.limit)) && Number(def.limit) >= 1 ? Math.floor(Number(def.limit)) : 1;
  return count > limit;
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

// Resumen de la semana (lunes a hoy) por elemento y totales (buenos vs baratos).
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
    };
  });

  return { items, goodWeek, cheapWeek };
}

// Elemento nuevo para el editor en Ajustes.
export function newDopamineItem(defs, kind = "good", now = Date.now()) {
  const list = Array.isArray(defs) ? defs : [];
  let id = `d_${now.toString(36)}`;
  while (list.some((it) => it && it.id === id)) id += "x";
  return kind === "cheap"
    ? { id, label: "Nuevo elemento", kind: "cheap", limit: 1 }
    : { id, label: "Nuevo elemento", kind: "good", identity: null };
}
