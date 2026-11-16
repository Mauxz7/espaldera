// Votos por identidad (sin interfaz, con pruebas en tests/identity.test.mjs).
// Cada hábito cumplido es un voto para la identidad del hábito; cada sesión
// registrada en `log` (o cubierta por un entreno de Fitbit) es un voto para «Atleta».
import { DEFAULT_HABIT_DEFS, isHabitDone } from "../data/habits.js";
import { DEFAULT_IDENTITIES, IDENTITY_COLORS, ATHLETE_ID, habitIdentity } from "../data/identities.js";

// Lista de identidades válida: descarta entradas sin id y completa campos faltantes.
// Si no hay ninguna guardada usa las iniciales.
export function normalizeIdentities(list) {
  if (!Array.isArray(list)) return DEFAULT_IDENTITIES;
  const seen = new Set();
  const out = [];
  list.forEach((it, i) => {
    if (!it || typeof it.id !== "string" || !it.id || seen.has(it.id)) return;
    seen.add(it.id);
    out.push({
      id: it.id,
      label: typeof it.label === "string" && it.label.trim() ? it.label : "Identidad",
      emoji: typeof it.emoji === "string" ? it.emoji : "",
      color: IDENTITY_COLORS.includes(it.color) ? it.color : IDENTITY_COLORS[i % IDENTITY_COLORS.length],
    });
  });
  return out;
}

// Votos de la semana (lunes a hoy) por identidad, en el orden de `identities`.
// - keys: las 7 fechas (AAAA-MM-DD) de la semana; todayIdx: índice de hoy (0 = lunes).
// - votes: hábitos cumplidos + sesiones registradas; days: días con al menos un voto.
// Los hábitos archivados, sin identidad o con una identidad que ya no existe no votan.
export function weekVotes({ keys, todayIdx, habits, habitDefs, identities, log, fromFitbit }) {
  const ids = normalizeIdentities(identities);
  const defs = (Array.isArray(habitDefs) ? habitDefs : DEFAULT_HABIT_DEFS).filter((d) => d && d.id && !d.archived);
  const rows = ids.map((it) => ({ id: it.id, label: it.label, emoji: it.emoji, color: it.color, votes: 0, days: 0 }));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const week = Array.isArray(keys) ? keys : [];
  const last = Math.min(week.length - 1, Number.isFinite(todayIdx) ? todayIdx : week.length - 1);
  for (let i = 0; i <= last; i++) {
    const k = week[i];
    const dayVotes = new Map();
    const add = (id) => { if (byId.has(id)) dayVotes.set(id, (dayVotes.get(id) || 0) + 1); };
    const h = (habits || {})[k] || {};
    defs.forEach((d) => { if (isHabitDone(d, h[d.id])) add(habitIdentity(d)); });
    if ((log && log[k]) || (fromFitbit && fromFitbit[i])) add(ATHLETE_ID); // sesión hecha en Shift o registrada solo con Fitbit
    dayVotes.forEach((n, id) => { const r = byId.get(id); r.votes += n; r.days += 1; });
  }
  return rows;
}

// Identidad con más votos (la primera en caso de empate) o null si nadie tiene votos.
export function topIdentity(rows) {
  let best = null;
  (rows || []).forEach((r) => { if (r && r.votes > 0 && (!best || r.votes > best.votes)) best = r; });
  return best;
}

// «Esta semana votaste 9 veces por ser Atleta».
export function votesPhrase(row) {
  if (!row || !(row.votes > 0)) return "Aún no hay votos esta semana: cada hábito cumplido cuenta.";
  return `Esta semana votaste ${row.votes} ${row.votes === 1 ? "vez" : "veces"} por ser ${row.label}`;
}

// Identidad nueva para el editor: id único y el siguiente color de la rotación.
export function newIdentity(identities, now = Date.now()) {
  const list = Array.isArray(identities) ? identities : [];
  let id = `id_${now.toString(36)}`;
  while (list.some((it) => it && it.id === id)) id += "x";
  return { id, label: "Nueva identidad", emoji: "⭐", color: IDENTITY_COLORS[list.length % IDENTITY_COLORS.length] };
}

// Último carácter visible de lo escrito (un emoji puede ocupar varios puntos de código):
// así, al escribir sobre el emoji actual, queda el nuevo.
export function lastGrapheme(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    let last = "";
    for (const { segment } of new Intl.Segmenter("es", { granularity: "grapheme" }).segment(s)) last = segment;
    return last;
  }
  return Array.from(s).slice(-1).join("");
}
