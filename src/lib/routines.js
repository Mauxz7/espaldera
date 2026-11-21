// Lógica pura para variantes de rutinas, biblioteca de alternativas y salto de bloques.
import { pruneDays } from "./dates.js";
import { ROUTINES, effSets, routineById, variantsFor } from "../data/program.js";
import { SUBS, EXERCISE_LIBRARY, PATTERNS } from "../data/subs.js";

const normName = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim();

export function resolveVariantId(rid, routineVariants) {
  const list = variantsFor(rid);
  if (!list.length) return null;
  const picked = routineVariants && typeof routineVariants === "object" ? routineVariants[rid] : null;
  if (picked && list.some((v) => v.id === picked)) return picked;
  return list[0].id;
}

export function getActiveRoutine(rid, { runLevel, routineVariants } = {}) {
  const base = ROUTINES.find((r) => r.id === rid) || ROUTINES[0];
  const vid = resolveVariantId(base.id, routineVariants);
  return routineById(base.id, runLevel, vid);
}

export function setRoutineVariant(routineVariants, rid, variantId) {
  const list = variantsFor(rid);
  if (!list.length || !list.some((v) => v.id === variantId)) return routineVariants || {};
  return { ...(routineVariants || {}), [rid]: variantId };
}

export function isExerciseSkipped(skips, date, rid, exId) {
  return !!(skips && skips[date] && skips[date][rid] && skips[date][rid][exId]);
}

export function toggleSkipExercise(skips, { date, rid, exId, maxDays = 21 }) {
  const all = skips && typeof skips === "object" ? { ...skips } : {};
  const day = { ...(all[date] || {}) };
  const r = { ...(day[rid] || {}) };

  if (r[exId]) delete r[exId];
  else r[exId] = true;

  if (Object.keys(r).length === 0) delete day[rid];
  else day[rid] = r;

  if (Object.keys(day).length === 0) delete all[date];
  else all[date] = day;

  return pruneDays(all, maxDays);
}

export function computeRoutineProgress(exercises = [], { daySetLog = {}, daySets = {}, daySkips = {}, week = 1 } = {}) {
  const activeExercises = [];
  const skippedExercises = [];
  let total = 0;
  let done = 0;

  for (const ex of exercises) {
    if (daySkips && daySkips[ex.id]) {
      skippedExercises.push(ex);
      continue;
    }
    activeExercises.push(ex);
    const n = effSets(ex, week);
    total += n;
    const s = daySetLog[ex.id] || [];
    const ds = daySets[ex.id] || [];
    for (let i = 0; i < n; i++) {
      if (s[i] || ds[i]) done++;
    }
  }

  return {
    activeExercises,
    skippedExercises,
    done,
    total,
    progress: total > 0 ? done / total : 0,
  };
}

export function getAlternativesForExercise(ex) {
  const suggested = (ex && SUBS[ex.id]) || [];
  const seenIds = new Set(suggested.map((a) => a.id));
  const seenNames = new Set(suggested.map((a) => normName(a.name)));
  if (ex && ex.name) seenNames.add(normName(ex.name));

  const dedup = EXERCISE_LIBRARY.filter((item) => {
    if (seenIds.has(item.id)) return false;
    if (seenNames.has(normName(item.name))) return false;
    seenIds.add(item.id);
    seenNames.add(normName(item.name));
    return true;
  });

  const targetPattern = ex && ex.pattern;
  const samePattern = targetPattern ? dedup.filter((item) => item.pattern === targetPattern) : [];

  const otherPatterns = {};
  for (const key of Object.keys(PATTERNS)) {
    if (key === targetPattern) continue;
    const list = dedup.filter((item) => item.pattern === key);
    if (list.length) otherPatterns[key] = list;
  }

  return { suggested, samePattern, otherPatterns };
}
