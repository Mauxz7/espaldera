// Revisión semanal y frasco de logros (D3). Lógica pura sin interfaz; pruebas en tests/review.test.mjs.
import { dkey, fromKey, addDays, mondayOf, dayDiff, pruneDays } from "./dates.js";
import { fitbitWeek, fitbitSession } from "./planner.js";
import { weekProgress } from "./home.js";
import { weekVotes, topIdentity, votesPhrase } from "./identity.js";
import { dopamineWeekStats } from "./dopamine.js";
import { SLEEP_GOAL_MIN } from "./sleep.js";

export const WINS_MAX_DAYS = 120;
export const REVIEWS_MAX_WEEKS = 26;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function weekKeys(mondayKey) {
  const base = fromKey(mondayKey);
  return Array.from({ length: 7 }, (_, i) => dkey(addDays(base, i)));
}

export function currentWeekMonday(now = new Date()) {
  return dkey(mondayOf(now));
}

export function resolveWeekTodayIdx(keys, today = dkey()) {
  if (!Array.isArray(keys) || keys.length === 0) return 0;
  if (today >= keys[keys.length - 1]) return keys.length - 1;
  if (today <= keys[0]) return 0;
  return Math.max(0, Math.min(keys.length - 1, dayDiff(today, keys[0])));
}

// Poda los logros conservando los de los últimos `maxDays` días respecto a `refDate`.
export function pruneWins(wins, maxDays = WINS_MAX_DAYS, refDate = dkey()) {
  const list = Array.isArray(wins) ? wins : [];
  return list.filter((w) => (
    w
    && typeof w.id === "string"
    && w.id
    && typeof w.date === "string"
    && DATE_RE.test(w.date)
    && typeof w.text === "string"
    && w.text.trim()
    && dayDiff(refDate, w.date) < maxDays
  ));
}

// Agrega un logro al frasco y poda los más viejos de `maxDays` días.
export function addWin(wins, text, dateKey = dkey(), now = Date.now(), maxDays = WINS_MAX_DAYS) {
  const list = Array.isArray(wins) ? wins : [];
  const clean = typeof text === "string" ? text.trim() : "";
  if (!clean) return list;
  const date = typeof dateKey === "string" && DATE_RE.test(dateKey) ? dateKey : dkey(new Date(now));
  let id = `win_${now.toString(36)}`;
  while (list.some((w) => w && w.id === id)) id += "x";
  const next = [{ id, date, text: clean }, ...list];
  const refDate = list.reduce((max, w) => (w && typeof w.date === "string" && DATE_RE.test(w.date) && w.date > max ? w.date : max), date);
  return pruneWins(next, maxDays, refDate);
}

export function removeWin(wins, id) {
  const list = Array.isArray(wins) ? wins : [];
  return list.filter((w) => w && w.id !== id);
}

export function winsForWeek(wins, keys) {
  const set = new Set(Array.isArray(keys) ? keys : []);
  return (Array.isArray(wins) ? wins : []).filter((w) => w && typeof w.text === "string" && w.text.trim() && set.has(w.date));
}

export function hasReview(reviews, mondayKey) {
  const r = reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews[mondayKey] : null;
  return Boolean(r && ((typeof r.good === "string" && r.good.trim()) || (typeof r.adjust === "string" && r.adjust.trim())));
}

// Guarda la revisión semanal por lunes (`mondayKey`) y conserva máximo `maxWeeks` semanas.
export function saveReview(reviews, mondayKey, patch = {}, now = Date.now(), maxWeeks = REVIEWS_MAX_WEEKS) {
  const base = reviews && typeof reviews === "object" && !Array.isArray(reviews) ? reviews : {};
  if (!mondayKey || !DATE_RE.test(mondayKey)) return base;
  const cur = base[mondayKey] && typeof base[mondayKey] === "object" ? base[mondayKey] : {};
  const good = typeof patch.good === "string" ? patch.good : (typeof cur.good === "string" ? cur.good : "");
  const adjust = typeof patch.adjust === "string" ? patch.adjust : (typeof cur.adjust === "string" ? cur.adjust : "");
  const next = { ...base };
  if (!good.trim() && !adjust.trim()) {
    delete next[mondayKey];
    return pruneDays(next, maxWeeks);
  }
  next[mondayKey] = { good, adjust, at: now };
  return pruneDays(next, maxWeeks);
}

// Semanas anteriores con revisión guardada + la semana actual, en orden cronológico.
export function availableReviewWeeks(reviews, currentMondayKey) {
  const prev = Object.keys(reviews && typeof reviews === "object" ? reviews : {})
    .filter((k) => DATE_RE.test(k) && k < currentMondayKey && hasReview(reviews, k))
    .sort();
  return [...prev, currentMondayKey];
}

export function isSundayReviewPending(reviews, now = new Date()) {
  return now.getDay() === 0 && !hasReview(reviews, currentWeekMonday(now));
}

export function sleepWeekStats(sleep, keys, todayIdx = 6) {
  const week = Array.isArray(keys) ? keys : [];
  const last = week.length ? Math.min(week.length - 1, Number.isFinite(todayIdx) ? todayIdx : week.length - 1) : -1;
  let nights = 0;
  let nights7h = 0;
  let totalMin = 0;
  for (let i = 0; i <= last; i++) {
    const n = sleep && typeof sleep === "object" ? sleep[week[i]] : null;
    if (n && Number(n.min) > 0) {
      const min = Math.round(Number(n.min));
      nights++;
      totalMin += min;
      if (min >= SLEEP_GOAL_MIN) nights7h++;
    }
  }
  return {
    nights,
    nights7h,
    avgMin: nights > 0 ? Math.round(totalMin / nights) : null,
  };
}

function weekSessionCoverage(keys, todayIdx, log, workouts, weekPlan) {
  const last = keys.length ? Math.min(keys.length - 1, Number.isFinite(todayIdx) ? todayIdx : keys.length - 1) : -1;
  const fixed = {};
  for (let i = 0; i <= last; i++) {
    const k = keys[i];
    if (log && log[k] && log[k].r) fixed[i] = log[k].r;
  }
  const fit = fitbitWeek(workouts, keys);
  const mk = keys[0];
  const storedPlan = weekPlan && weekPlan[mk] && Array.isArray(weekPlan[mk].plan) ? weekPlan[mk].plan : null;
  const fromFitbit = {};
  for (let i = 0; i <= last; i++) {
    const f = fit[i];
    if (!f || !f.session || fixed[i]) continue;
    const planned = storedPlan ? storedPlan[i] : null;
    const r = fitbitSession(f.session.kind, planned, Object.values(fixed));
    if (r) {
      fixed[i] = r;
      fromFitbit[i] = r;
    }
  }
  return { fixed, fromFitbit };
}

// Resumen completo de una semana para la vista «Revisión semanal».
export function buildWeekReview({
  mondayKey,
  today,
  todayIdx,
  habits,
  habitDefs,
  identities,
  log,
  setLog,
  fixed,
  fromFitbit,
  workouts,
  weekPlan,
  dopamine,
  dopamineDefs,
  sleep,
  wins,
  reviews,
} = {}) {
  const mk = mondayKey || currentWeekMonday();
  const keys = weekKeys(mk);
  const idx = Number.isFinite(todayIdx) ? todayIdx : resolveWeekTodayIdx(keys, today || dkey());
  const derived = fixed && fromFitbit ? null : weekSessionCoverage(keys, idx, log, workouts, weekPlan);
  const resolvedFixed = fixed || derived.fixed;
  const resolvedFromFitbit = fromFitbit || derived.fromFitbit;

  const votes = weekVotes({
    keys,
    todayIdx: idx,
    habits,
    habitDefs,
    identities,
    log,
    setLog,
    fromFitbit: resolvedFromFitbit,
    dopamine,
    dopamineDefs,
    sleep,
  });
  const top = topIdentity(votes);
  const progress = weekProgress({ keys, todayIdx: idx, fixed: resolvedFixed, habits, habitDefs, workouts, setLog });
  const dopa = dopamineWeekStats({ keys, todayIdx: idx, dopamine, dopamineDefs });
  const sleepStats = sleepWeekStats(sleep, keys, idx);
  const weekWins = winsForWeek(wins, keys);

  return {
    mondayKey: mk,
    keys,
    todayIdx: idx,
    votes,
    topIdentity: top,
    votesPhrase: votesPhrase(top),
    sessions: progress.sessions,
    minutes: progress.minutes,
    habits: progress.habits,
    dopamine: { good: dopa.goodWeek, cheap: dopa.cheapWeek, failedDays: dopa.failedDays, items: dopa.items },
    sleep: sleepStats,
    wins: weekWins,
    review: (reviews && reviews[mk]) || null,
    hasReview: hasReview(reviews, mk),
  };
}
