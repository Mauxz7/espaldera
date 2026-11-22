// Lógica pura del entreno libre estilo Hevy: catálogo, ejercicios personalizados,
// orden por fecha (`freeSessions`), registro en `setLog[fecha].free`, historial y resumen.
import { pruneDays } from "./dates.js";
import { ROUTINES, EQ, day3Exercises } from "../data/program.js";
import { EXERCISE_LIBRARY, SUBS } from "../data/subs.js";
import { MUSCLE_GROUPS, PATTERN_MUSCLES, hasFreeWorkout } from "./metrics.js";
import { seriesVolume, exerciseRecord, isTimedSpec, sessionDuration } from "./workout.js";

export const FREE_MUSCLE_ORDER = Object.freeze([
  "chest",
  "lats",
  "shoulders",
  "biceps",
  "triceps",
  "core",
  "quads",
  "glutes",
  "hamstrings",
  "calves",
  "upperBack",
]);

export const FREE_GROUP_TO_PATTERN = Object.freeze({
  chest: "push_h",
  lats: "pull_v",
  upperBack: "pull_h",
  shoulders: "push_v",
  biceps: "arms",
  triceps: "arms",
  core: "core",
  quads: "squat",
  glutes: "hinge",
  hamstrings: "hinge",
  calves: "run",
});

const normText = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const validGroup = (g) => Boolean(g && MUSCLE_GROUPS[g]);

export function exerciseMuscleInfo(ex) {
  if (!ex || typeof ex !== "object") return { primary: [], secondary: [], all: [] };

  if (validGroup(ex.primaryGroup)) {
    const primary = [ex.primaryGroup];
    const secondary = [];
    for (const g of Array.isArray(ex.secondaryGroups) ? ex.secondaryGroups : []) {
      if (validGroup(g) && g !== ex.primaryGroup && !secondary.includes(g)) secondary.push(g);
    }
    return { primary, secondary, all: [...primary, ...secondary] };
  }

  if (ex.muscles && typeof ex.muscles === "object") {
    const entries = Object.entries(ex.muscles).filter(([g, w]) => validGroup(g) && typeof w === "number" && w > 0);
    if (entries.length) {
      const maxW = Math.max(...entries.map(([, w]) => w));
      const threshold = maxW >= 0.8 ? 0.8 : maxW;
      const primary = entries.filter(([, w]) => w >= threshold).map(([g]) => g);
      const secondary = entries.filter(([g, w]) => w < threshold && !primary.includes(g)).map(([g]) => g);
      return { primary, secondary, all: [...primary, ...secondary] };
    }
  }

  const name = normText(ex.name);
  const pattern = ex.pattern || null;

  if (pattern === "arms") {
    const isBiceps = /\b(biceps|curl|martillo)\b/.test(name);
    const isTriceps = /\b(triceps|frances|fondo|extension)\b/.test(name);
    if (isBiceps && !isTriceps) return { primary: ["biceps"], secondary: [], all: ["biceps"] };
    if (isTriceps && !isBiceps) return { primary: ["triceps"], secondary: [], all: ["triceps"] };
    return { primary: ["biceps", "triceps"], secondary: [], all: ["biceps", "triceps"] };
  }

  if (pattern === "run") {
    if (/\b(talon|gemelo|tibial)\b/.test(name)) {
      return { primary: ["calves"], secondary: [], all: ["calves"] };
    }
    return { primary: ["calves", "quads"], secondary: [], all: ["calves", "quads"] };
  }

  if (pattern === "hinge") {
    if (/\b(hip thrust|puente de gluteo)\b/.test(name)) {
      return { primary: ["glutes"], secondary: ["hamstrings"], all: ["glutes", "hamstrings"] };
    }
    return { primary: ["hamstrings", "glutes"], secondary: [], all: ["hamstrings", "glutes"] };
  }

  const weights = PATTERN_MUSCLES[pattern] || {};
  const entries = Object.entries(weights).filter(([g, w]) => validGroup(g) && w > 0);
  if (!entries.length) return { primary: [], secondary: [], all: [] };
  const hasFull = entries.some(([, w]) => w >= 1);
  const primary = (hasFull ? entries.filter(([, w]) => w >= 1) : entries).map(([g]) => g);
  const secondary = hasFull ? entries.filter(([, w]) => w < 1).map(([g]) => g) : [];
  return { primary, secondary, all: [...primary, ...secondary] };
}

function rawRoutineExercises() {
  const list = [];
  for (const r of ROUTINES) {
    for (const ex of r.exercises || []) list.push(ex);
    for (const v of r.variants || []) {
      for (const ex of v.exercises || []) list.push(ex);
    }
  }
  for (const ex of day3Exercises(1)) list.push(ex);
  return list;
}

function buildCatalogIndex(customExercises = []) {
  const aliasByNorm = new Map();
  const baseSource = [...EXERCISE_LIBRARY, ...rawRoutineExercises()];

  for (const ex of baseSource) {
    if (!ex || !ex.id || !ex.name) continue;
    const key = normText(ex.name);
    if (!aliasByNorm.has(key)) aliasByNorm.set(key, []);
    const arr = aliasByNorm.get(key);
    if (!arr.includes(ex.id)) arr.push(ex.id);
  }

  const catalog = [];
  const seenCustomIds = new Set();
  for (const c of Array.isArray(customExercises) ? customExercises : []) {
    if (!c || !c.id || !c.name || seenCustomIds.has(c.id)) continue;
    seenCustomIds.add(c.id);
    const info = exerciseMuscleInfo(c);
    const pattern = c.pattern || FREE_GROUP_TO_PATTERN[info.primary[0]] || null;
    catalog.push({
      id: c.id,
      name: c.name,
      eq: Array.isArray(c.eq) ? c.eq : [],
      reps: c.reps || "8–12",
      pattern,
      primaryGroup: c.primaryGroup || info.primary[0] || null,
      secondaryGroups: Array.isArray(c.secondaryGroups) ? c.secondaryGroups : info.secondary,
      muscles: c.muscles || null,
      primaryGroups: info.primary,
      secondaryGroupsResolved: info.secondary,
      groups: info.all,
      custom: true,
      aliasIds: [c.id],
    });
  }

  const seenNames = new Set();
  const seenIds = new Set();
  for (const ex of baseSource) {
    if (!ex || !ex.id || !ex.name || seenIds.has(ex.id)) continue;
    const key = normText(ex.name);
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    seenIds.add(ex.id);
    const info = exerciseMuscleInfo(ex);
    const aliases = (aliasByNorm.get(key) || [ex.id]).filter((id) => id !== ex.id);
    catalog.push({
      id: ex.id,
      name: ex.name,
      eq: Array.isArray(ex.eq) ? ex.eq : [],
      reps: ex.reps || "8–12",
      pattern: ex.pattern || null,
      muscles: ex.muscles || null,
      primaryGroups: info.primary,
      secondaryGroupsResolved: info.secondary,
      groups: info.all,
      custom: false,
      aliasIds: [ex.id, ...aliases],
    });
  }

  return catalog;
}

/** Catálogo completo de ejercicios: personalizados primero + EXERCISE_LIBRARY + rutinas (deduplicados por nombre). */
export function buildExerciseCatalog(customExercises = []) {
  return buildCatalogIndex(customExercises);
}

/** Filtra y ordena el catálogo por texto de búsqueda y grupo muscular. */
export function filterExerciseCatalog(catalog, { query = "", group = "all" } = {}) {
  const list = Array.isArray(catalog) ? catalog : [];
  const q = normText(query);

  const filtered = list.filter((ex) => {
    if (!ex) return false;
    if (group && group !== "all" && !(ex.groups || []).includes(group)) return false;
    if (!q) return true;
    const hay = [
      ex.name,
      ...(ex.groups || []).map((g) => MUSCLE_GROUPS[g] || g),
      ...(ex.eq || []).map((e) => EQ[e] || e),
    ].map(normText).join(" ");
    return hay.includes(q);
  });

  if (group && group !== "all") {
    return filtered.slice().sort((a, b) => {
      const aPrim = (a.primaryGroups || []).includes(group) ? 1 : 0;
      const bPrim = (b.primaryGroups || []).includes(group) ? 1 : 0;
      if (aPrim !== bPrim) return bPrim - aPrim;
      const aCus = a.custom ? 1 : 0;
      const bCus = b.custom ? 1 : 0;
      return bCus - aCus;
    });
  }

  return filtered;
}

/** Resuelve cualquier id de ejercicio (cus_*, biblioteca, rutinas o sustitutos) para mostrar y calcular métricas. */
export function resolveFreeExercise(exId, customExercises = []) {
  const catalog = buildCatalogIndex(customExercises);
  const direct = catalog.find((ex) => ex.id === exId || (ex.aliasIds || []).includes(exId));
  if (direct) {
    return {
      ...direct,
      id: exId,
      aliasIds: direct.id === exId ? direct.aliasIds : [exId, ...direct.aliasIds.filter((a) => a !== exId)],
    };
  }
  for (const [baseId, alts] of Object.entries(SUBS || {})) {
    const found = (Array.isArray(alts) ? alts : []).find((a) => a && a.id === exId);
    if (found) {
      const base = catalog.find((ex) => ex.id === baseId);
      const pattern = found.pattern || base?.pattern || null;
      const info = exerciseMuscleInfo({ ...found, pattern });
      return {
        id: found.id,
        name: found.name,
        eq: Array.isArray(found.eq) ? found.eq : [],
        reps: found.reps || "8–12",
        pattern,
        muscles: found.muscles || null,
        primaryGroups: info.primary,
        secondaryGroupsResolved: info.secondary,
        groups: info.all,
        custom: false,
        aliasIds: [found.id],
      };
    }
  }
  return {
    id: exId,
    name: exId,
    eq: [],
    reps: "8–12",
    pattern: null,
    muscles: null,
    primaryGroups: [],
    secondaryGroupsResolved: [],
    groups: [],
    custom: String(exId || "").startsWith("cus_"),
    aliasIds: [exId],
  };
}

/** Crea un ejercicio personalizado con id `cus_<timestamp>` y actualiza la lista de forma inmutable. */
export function createCustomExercise(customExercises, { name, primaryGroup, secondaryGroups = [] } = {}, now = Date.now()) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return { error: "Escribe el nombre del ejercicio." };
  if (!validGroup(primaryGroup)) return { error: "Elige un grupo muscular principal." };

  const list = Array.isArray(customExercises) ? customExercises : [];
  const sec = [];
  for (const g of Array.isArray(secondaryGroups) ? secondaryGroups : []) {
    if (validGroup(g) && g !== primaryGroup && !sec.includes(g)) sec.push(g);
  }

  const baseId = `cus_${Math.floor(Number(now) || Date.now())}`;
  let id = baseId;
  let suffix = 1;
  while (list.some((c) => c && c.id === id)) {
    id = `${baseId}_${suffix}`;
    suffix += 1;
  }

  const muscles = { [primaryGroup]: 1 };
  for (const g of sec) muscles[g] = 0.5;

  const exercise = {
    id,
    name: cleanName,
    primaryGroup,
    secondaryGroups: sec,
    pattern: FREE_GROUP_TO_PATTERN[primaryGroup] || "arms",
    muscles,
    createdAt: Math.floor(Number(now) || Date.now()),
  };

  return { exercise, list: [exercise, ...list] };
}

// ───────────────────────── Gestión de freeSessions y setLog.free ─────────────────────────

export function getFreeExIds(freeSessions, setLog, date) {
  const stored = Array.isArray(freeSessions?.[date]?.exIds) ? freeSessions[date].exIds : [];
  const loggedIds = Object.keys(setLog?.[date]?.free || {});
  const out = [];
  for (const id of [...stored, ...loggedIds]) {
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export function addExercisesToFreeSession(freeSessions, { date, exIds = [], maxDays = 90 } = {}) {
  const base = freeSessions && typeof freeSessions === "object" ? { ...freeSessions } : {};
  const cur = Array.isArray(base[date]?.exIds) ? base[date].exIds : [];
  const nextIds = [...cur];
  for (const id of Array.isArray(exIds) ? exIds : []) {
    if (id && !nextIds.includes(id)) nextIds.push(id);
  }
  if (!nextIds.length) {
    delete base[date];
    return pruneDays(base, maxDays);
  }
  base[date] = { ...(base[date] || {}), exIds: nextIds };
  return pruneDays(base, maxDays);
}

export function removeExerciseFromFreeSession(freeSessions, { date, exId, maxDays = 90 } = {}) {
  if (!freeSessions || !freeSessions[date]) return freeSessions || {};
  const base = { ...freeSessions };
  const nextIds = (Array.isArray(base[date].exIds) ? base[date].exIds : []).filter((id) => id !== exId);
  if (!nextIds.length) delete base[date];
  else base[date] = { ...base[date], exIds: nextIds };
  return pruneDays(base, maxDays);
}

export function moveExerciseInFreeSession(freeSessions, { date, exId, direction, fallbackExIds = [], maxDays = 90 } = {}) {
  const cur = Array.isArray(freeSessions?.[date]?.exIds) ? [...freeSessions[date].exIds] : [...fallbackExIds];
  for (const id of fallbackExIds) if (id && !cur.includes(id)) cur.push(id);
  const idx = cur.indexOf(exId);
  if (idx < 0) return freeSessions || {};
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= cur.length) return freeSessions || {};
  [cur[idx], cur[target]] = [cur[target], cur[idx]];
  const base = freeSessions && typeof freeSessions === "object" ? { ...freeSessions } : {};
  base[date] = { ...(base[date] || {}), exIds: cur };
  return pruneDays(base, maxDays);
}

function normalizeFreeSeriesList(series) {
  const out = [];
  for (const s of Array.isArray(series) ? series : []) {
    if (!s || typeof s !== "object") continue;
    const rawReps = s.reps;
    if (rawReps === "" || rawReps == null) continue;
    const num = Number(rawReps);
    if (!Number.isFinite(num) || num <= 0) continue;
    out.push({
      reps: num,
      load: typeof s.load === "string" ? s.load.trim() : String(s.load || "").trim(),
    });
  }
  return out;
}

/** Reemplaza la lista de series válidas de un ejercicio en `setLog[date].free[exerciseId]`. */
export function setFreeExerciseSeries({ setLog = {}, date, exerciseId, series = [], maxDays = 90 } = {}) {
  const clean = normalizeFreeSeriesList(series);
  const next = setLog && typeof setLog === "object" ? { ...setLog } : {};
  const day = { ...(next[date] || {}) };
  const free = { ...(day.free || {}) };

  if (!clean.length) delete free[exerciseId];
  else free[exerciseId] = clean;

  if (!Object.keys(free).length) delete day.free;
  else day.free = free;

  if (!Object.keys(day).length) delete next[date];
  else next[date] = day;

  return pruneDays(next, maxDays);
}

export function removeFreeExerciseFromSetLog({ setLog = {}, date, exerciseId, maxDays = 90 } = {}) {
  if (!setLog?.[date]?.free?.[exerciseId]) return setLog || {};
  return setFreeExerciseSeries({ setLog, date, exerciseId, series: [], maxDays });
}

// ───────────────────────── Historial y resumen libre ─────────────────────────

/** Busca la última sesión anterior a `beforeDate` para un ejercicio (o alguno de sus alias). */
export function getLastFreeExerciseLog(setLog, exId, beforeDate, aliasIds = []) {
  if (!setLog || typeof setLog !== "object") return null;
  const ids = [exId, ...(Array.isArray(aliasIds) ? aliasIds : [])].filter(Boolean);
  const dates = Object.keys(setLog).sort().reverse();

  for (const d of dates) {
    if (beforeDate && d >= beforeDate) continue;
    const day = setLog[d];
    if (!day || typeof day !== "object") continue;

    // Prioriza el entreno libre si hubo en la misma fecha, luego cualquier rutina.
    const routines = day.free
      ? [day.free, ...Object.entries(day).filter(([k]) => k !== "free").map(([, v]) => v)]
      : Object.values(day);

    for (const r of routines) {
      if (!r || typeof r !== "object") continue;
      for (const id of ids) {
        if (!Array.isArray(r[id])) continue;
        const series = r[id].filter((s) => s && s.reps != null && s.reps !== "");
        if (!series.length) continue;
        let lastLoad = "";
        for (let i = series.length - 1; i >= 0; i--) {
          if (series[i].load) {
            lastLoad = series[i].load;
            break;
          }
        }
        const repsList = series.map((s) => s.reps).filter((v) => v != null && v !== "");
        const repsSummary = repsList.length ? `${repsList.join(", ")} reps` : "";
        const loads = series.map((s) => String(s.load || "").trim());
        const nonEmptyLoads = loads.filter(Boolean);
        const allSameLoad = nonEmptyLoads.length === series.length && new Set(nonEmptyLoads).size === 1;

        let summaryText = "";
        if (allSameLoad) {
          summaryText = `${nonEmptyLoads[0]} · ${repsList.join(", ")} reps`;
        } else if (nonEmptyLoads.length) {
          summaryText = series
            .map((s) => (s.load ? `${s.reps} × ${String(s.load).trim()}` : `${s.reps} reps`))
            .join(" · ");
        } else {
          summaryText = repsSummary;
        }

        return {
          date: d,
          series,
          load: lastLoad,
          repsSummary,
          summaryText,
        };
      }
    }
  }
  return null;
}

/** Resumen al terminar el entreno libre: duración, series, carga total, marcas y grupos trabajados. */
export function buildFreeWorkoutSummary({ exIds = [], customExercises = [], setLog = {}, date, session = null, now = Date.now() } = {}) {
  const freeDay = setLog?.[date]?.free || {};
  const ids = exIds.length ? exIds : Object.keys(freeDay);
  const groupAcc = {};
  const records = [];
  const rows = [];
  let setsDone = 0;
  let exercisesDone = 0;
  let volume = 0;

  for (const id of ids) {
    const ex = resolveFreeExercise(id, customExercises);
    const series = (Array.isArray(freeDay[id]) ? freeDay[id] : []).filter((s) => s && s.reps != null && s.reps > 0);
    if (!series.length) continue;

    exercisesDone += 1;
    setsDone += series.length;
    const timed = isTimedSpec(ex.reps);
    const vol = seriesVolume(series, { timed });
    volume += vol;
    rows.push({ id, name: ex.name, done: series.length, total: series.length, volume: vol });

    const weights = ex.muscles
      || (ex.primaryGroups?.length
        ? Object.fromEntries([
            ...ex.primaryGroups.map((g) => [g, 1]),
            ...(ex.secondaryGroupsResolved || []).map((g) => [g, 0.5]),
          ])
        : PATTERN_MUSCLES[ex.pattern] || {});

    for (const [g, w] of Object.entries(weights)) {
      if (MUSCLE_GROUPS[g] && w > 0) groupAcc[g] = (groupAcc[g] || 0) + series.length * w;
    }

    const last = getLastFreeExerciseLog(setLog, id, date, ex.aliasIds);
    const rec = last ? exerciseRecord(series, last.series, { timed }) : null;
    if (rec) records.push({ exerciseId: id, name: ex.name, ...rec });
  }

  const workedGroups = Object.entries(groupAcc)
    .map(([group, sets]) => ({
      group,
      label: MUSCLE_GROUPS[group],
      sets: Math.round(sets * 10) / 10,
    }))
    .sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label));

  return {
    durationMs: sessionDuration(session, { date, routineId: "free", now }),
    setsDone,
    setsTotal: setsDone,
    exercisesDone,
    volume: Math.round(volume * 10) / 10,
    exercises: rows,
    workedGroups,
    records,
    complete: hasFreeWorkout(setLog, date),
  };
}
