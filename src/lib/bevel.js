// Motor puro de métricas estilo Bevel (Sueño, Recuperación, Strain, Target Strain y Energy Bank).
// Ciclo cerrado diario secuencial: Strain[d-1] → SleepNeed[d] → SleepScore[d] → Recovery[d] → TargetStrain[d] + EnergyBank[d].
import { dkey, fromKey, addDays, dayDiff } from "./dates.js";
import { computeBaseline, median, clamp } from "./baselines.js";
import { ROUTINES, effRir, day3Exercises } from "../data/program.js";
import { parseLoad, isTimedSpec } from "./workout.js";

export const DEFAULT_HEALTH_PREFS = Object.freeze({
  sleepBaseMin: 450,
  maxHr: null,
  age: null,
  hrvKind: "rmssd",
});

export const CARDIO_KIND_FACTORS = Object.freeze({
  run: 2.3,
  bike: 1.8,
  other: 1.7,
  strength: 1.4,
  walk: 0.75,
});

export const SLEEP_WEIGHTS = Object.freeze({
  duration: 0.40,
  deep: 0.15,
  rem: 0.15,
  efficiency: 0.12,
  hrDip: 0.10,
  continuity: 0.08,
});

export const RECOVERY_WEIGHTS = Object.freeze({
  hrv: 0.45,
  rhr: 0.35,
  sleep: 0.20,
});

const BASELINE_FLOORS = Object.freeze({
  lnHrv: 0.08,
  rhr: 2.0,
  resp: 0.6,
  spo2: 0.8,
  tempDev: 0.25,
});

// Referencias conservadoras usadas únicamente mientras una señal biométrica está en calibración (< 7 días).
const CALIBRATING_REFS = Object.freeze({
  rmssd: { center: Math.log(50), spread: 0.35, rawCenter: 50, rawLow: Math.exp(Math.log(50) - 0.35), rawHigh: Math.exp(Math.log(50) + 0.35) },
  sdnn: { center: Math.log(45), spread: 0.35, rawCenter: 45, rawLow: Math.exp(Math.log(45) - 0.35), rawHigh: Math.exp(Math.log(45) + 0.35) },
  rhr: { center: 60, spread: 6, low: 54, high: 66 },
  resp: { center: 15, spread: 1.5, low: 13.5, high: 16.5 },
  spo2: { center: 97, spread: 1.0, low: 95, high: 100 },
  tempDev: { center: 0, spread: 0.35, low: -0.35, high: 0.35 },
});

const DEFAULT_EFFICIENCY = 0.90;
const MAX_DEBT_7D_MIN = 240;
const ANTI_DOUBLE_COUNT_FACTOR = 0.65;

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isDateKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k);
const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;

// Índice estático de ejercicios (todas las rutinas y variantes) para leer RIR objetivo y formato de reps.
const EXERCISE_BY_ID = (() => {
  const map = {};
  for (const r of ROUTINES) {
    for (const ex of r.exercises || []) map[ex.id] = ex;
    for (const v of r.variants || []) {
      for (const ex of v.exercises || []) map[ex.id] = ex;
    }
  }
  for (const ex of day3Exercises(1)) map[ex.id] = ex;
  return map;
})();

/**
 * Normaliza preferencias de salud del usuario y deriva `effectiveMaxHr`.
 */
export function normalizeHealthPrefs(prefs = null) {
  const p = prefs && typeof prefs === "object" ? prefs : {};
  const sleepBaseMin = isNum(p.sleepBaseMin) && p.sleepBaseMin >= 240 && p.sleepBaseMin <= 720
    ? Math.round(p.sleepBaseMin)
    : DEFAULT_HEALTH_PREFS.sleepBaseMin;
  const age = isNum(p.age) && p.age >= 10 && p.age <= 110 ? Math.round(p.age) : null;
  const maxHr = isNum(p.maxHr) && p.maxHr >= 120 && p.maxHr <= 230 ? Math.round(p.maxHr) : null;
  const hrvKind = p.hrvKind === "sdnn" ? "sdnn" : "rmssd";
  const effectiveMaxHr = maxHr != null ? maxHr : age != null ? Math.round(208 - 0.7 * age) : 190;
  return { sleepBaseMin, maxHr, age, hrvKind, effectiveMaxHr };
}

/**
 * Convierte carga bruta diaria (TRIMP equivalente) a Strain Score logarítmico (0–100%+).
 */
export function loadToStrain(load) {
  if (!isNum(load) || load <= 0) return 0;
  return Math.round(38 * Math.log(1 + load / 22));
}

/**
 * Calcula la necesidad dinámica de sueño (`SleepNeed`) y tiempo en cama sugerido (`bedNeedMin`).
 *
 * @param {object} params
 * @param {number} [params.sleepBaseMin=450] Necesidad basal de sueño en minutos.
 * @param {number | null} [params.prevStrain=null] Strain del día anterior [0..100+].
 * @param {Array<{ asleep: number, need: number }>} [params.recentNights=[]] Últimas hasta 7 noches previas con sueño real.
 * @param {number | null} [params.avgEfficiency=null] Eficiencia histórica de sueño (0..1); por defecto 0.90.
 */
export function computeSleepNeed({ sleepBaseMin = DEFAULT_HEALTH_PREFS.sleepBaseMin, prevStrain = null, recentNights = [], avgEfficiency = null } = {}) {
  const base = isNum(sleepBaseMin) && sleepBaseMin > 0 ? Math.round(sleepBaseMin) : DEFAULT_HEALTH_PREFS.sleepBaseMin;

  let rawDebt = 0;
  for (const n of Array.isArray(recentNights) ? recentNights.slice(-7) : []) {
    if (!n || !isNum(n.asleep) || n.asleep <= 0) continue;
    const need = isNum(n.need) && n.need > 0 ? n.need : base;
    rawDebt += Math.max(0, need - n.asleep) - 0.5 * Math.max(0, n.asleep - need);
  }
  const debt7dMin = clamp(rawDebt, 0, MAX_DEBT_7D_MIN);
  const debtDelta = debt7dMin / 4;

  const strainDelta = isNum(prevStrain) ? clamp(0.6 * (prevStrain - 50), 0, 45) : 0;
  const needMin = clamp(Math.round(base + strainDelta + debtDelta), base - 30, base + 120);

  let eff = DEFAULT_EFFICIENCY;
  if (isNum(avgEfficiency) && avgEfficiency > 0) {
    const normalized = avgEfficiency > 1 ? avgEfficiency / 100 : avgEfficiency;
    eff = clamp(normalized, 0.70, 0.99);
  }
  const bedNeedMin = Math.round(needMin / eff);

  return {
    baseMin: base,
    strainDeltaMin: Math.round(strainDelta),
    debt7dMin: Math.round(debt7dMin),
    debtDeltaMin: Math.round(debtDelta),
    needMin,
    bedNeedMin,
    efficiencyUsed: round3(eff),
  };
}

function resolveNightEfficiency(night) {
  if (!night || typeof night !== "object") return null;
  if (isNum(night.eff) && night.eff > 0) {
    return clamp(night.eff > 1 ? night.eff / 100 : night.eff, 0, 1);
  }
  if (isNum(night.inBedMin) && night.inBedMin > 0 && isNum(night.min) && night.min > 0) {
    return clamp(night.min / night.inBedMin, 0, 1);
  }
  if (isNum(night.awakeMin) && night.awakeMin >= 0 && isNum(night.min) && night.min > 0) {
    return clamp(night.min / (night.min + night.awakeMin), 0, 1);
  }
  return null;
}

/**
 * Calcula Sleep Score (0–100%) con 6 variables ponderadas y renormalización automática si faltan señales.
 */
export function computeSleepScore(night, { needMin = DEFAULT_HEALTH_PREFS.sleepBaseMin, hrDip = null } = {}) {
  const targetNeed = isNum(needMin) && needMin > 0 ? needMin : DEFAULT_HEALTH_PREFS.sleepBaseMin;
  const emptyComponents = {
    duration: { score: null, weight: SLEEP_WEIGHTS.duration, present: false, value: null, target: targetNeed },
    deep: { score: null, weight: SLEEP_WEIGHTS.deep, present: false, value: null, target: Math.round(0.18 * targetNeed) },
    rem: { score: null, weight: SLEEP_WEIGHTS.rem, present: false, value: null, target: Math.round(0.22 * targetNeed) },
    efficiency: { score: null, weight: SLEEP_WEIGHTS.efficiency, present: false, value: null, target: 0.92 },
    hrDip: { score: null, weight: SLEEP_WEIGHTS.hrDip, present: false, value: null, target: 10 },
    continuity: { score: null, weight: SLEEP_WEIGHTS.continuity, present: false, value: null },
  };

  if (!night || typeof night !== "object" || !isNum(night.min) || night.min <= 0) {
    return { score: null, coverage: 0, presentCount: 0, totalCount: 6, components: emptyComponents };
  }

  // 1. Duración vs. Sleep Need
  const ratio = night.min / targetNeed;
  const oversleepPenalty = ratio > 1.25 ? Math.min(15, ((ratio - 1.25) / 0.25) * 15) : 0;
  const durationScore = clamp(100 * Math.min(1, ratio) - oversleepPenalty, 0, 100);

  // 2 & 3. Fases Deep y REM
  const stageTotal = (isNum(night.deepMin) ? night.deepMin : 0) + (isNum(night.remMin) ? night.remMin : 0) + (isNum(night.lightMin) ? night.lightMin : 0);
  const hasDeep = isNum(night.deepMin) && night.deepMin >= 0 && (night.deepMin > 0 || stageTotal > 0);
  const hasRem = isNum(night.remMin) && night.remMin >= 0 && (night.remMin > 0 || stageTotal > 0);
  const deepTarget = 0.18 * targetNeed;
  const remTarget = 0.22 * targetNeed;
  const deepScore = hasDeep ? clamp(100 * Math.min(1, night.deepMin / deepTarget), 0, 100) : null;
  const remScore = hasRem ? clamp(100 * Math.min(1, night.remMin / remTarget), 0, 100) : null;

  // 4. Eficiencia
  const eff = resolveNightEfficiency(night);
  const hasEff = eff != null;
  const effScore = hasEff ? clamp(((eff - 0.70) / (0.92 - 0.70)) * 100, 0, 100) : null;

  // 5. Heart Rate Dip (%)
  const dipVal = isNum(hrDip) ? hrDip : isNum(night.hrDip) ? night.hrDip : null;
  const hasDip = dipVal != null;
  let dipScore = null;
  if (hasDip) {
    if (dipVal >= 10) dipScore = 100;
    else if (dipVal >= 0) dipScore = 25 + (dipVal / 10) * 75;
    else dipScore = 0;
  }

  // 6. Continuidad / interrupciones
  const hasAwakenings = isNum(night.awakenings) && night.awakenings >= 0;
  const hasAwakeMin = isNum(night.awakeMin) && night.awakeMin >= 0;
  const hasContinuity = hasAwakenings || hasAwakeMin;
  const awakenings = hasAwakenings ? night.awakenings : 0;
  const awakeMin = hasAwakeMin ? night.awakeMin : 0;
  const continuityScore = hasContinuity
    ? clamp(100 - 8 * Math.max(0, awakenings - 1) - 1.5 * Math.max(0, awakeMin - 15), 0, 100)
    : null;

  const components = {
    duration: { score: Math.round(durationScore), weight: SLEEP_WEIGHTS.duration, present: true, value: night.min, target: targetNeed },
    deep: { score: deepScore != null ? Math.round(deepScore) : null, weight: SLEEP_WEIGHTS.deep, present: hasDeep, value: hasDeep ? night.deepMin : null, target: Math.round(deepTarget) },
    rem: { score: remScore != null ? Math.round(remScore) : null, weight: SLEEP_WEIGHTS.rem, present: hasRem, value: hasRem ? night.remMin : null, target: Math.round(remTarget) },
    efficiency: { score: effScore != null ? Math.round(effScore) : null, weight: SLEEP_WEIGHTS.efficiency, present: hasEff, value: hasEff ? round3(eff) : null, target: 0.92 },
    hrDip: { score: dipScore != null ? Math.round(dipScore) : null, weight: SLEEP_WEIGHTS.hrDip, present: hasDip, value: hasDip ? round1(dipVal) : null, target: 10 },
    continuity: { score: continuityScore != null ? Math.round(continuityScore) : null, weight: SLEEP_WEIGHTS.continuity, present: hasContinuity, value: hasContinuity ? { awakenings, awakeMin } : null },
  };

  const pairs = [
    [SLEEP_WEIGHTS.duration, durationScore, true],
    [SLEEP_WEIGHTS.deep, deepScore, hasDeep],
    [SLEEP_WEIGHTS.rem, remScore, hasRem],
    [SLEEP_WEIGHTS.efficiency, effScore, hasEff],
    [SLEEP_WEIGHTS.hrDip, dipScore, hasDip],
    [SLEEP_WEIGHTS.continuity, continuityScore, hasContinuity],
  ];

  let weightSum = 0;
  let weighted = 0;
  let presentCount = 0;
  for (const [w, s, ok] of pairs) {
    if (!ok || s == null) continue;
    weightSum += w;
    weighted += w * s;
    presentCount += 1;
  }

  return {
    score: weightSum > 0 ? clamp(Math.round(weighted / weightSum), 0, 100) : null,
    coverage: round2(weightSum),
    presentCount,
    totalCount: 6,
    components,
  };
}

function classifyZone(score) {
  if (!isNum(score)) return { zone: null, label: "Sin datos" };
  if (score >= 67) return { zone: "high", label: "Alta" };
  if (score >= 34) return { zone: "mid", label: "Media" };
  return { zone: "low", label: "Baja" };
}

function biomarkerStatus(value, low, high) {
  if (!isNum(value)) return "missing";
  if (!isNum(low) || !isNum(high)) return "normal";
  if (value > high) return "high";
  if (value < low) return "low";
  return "normal";
}

function formatBaselineRange(bl, fallback, { useRaw = false } = {}) {
  if (bl && bl.ready) {
    const center = useRaw ? bl.rawCenter : bl.center;
    const low = useRaw ? bl.rawLow : bl.low;
    const high = useRaw ? bl.rawHigh : bl.high;
    return {
      center: center != null ? round1(center) : null,
      low: low != null ? round1(low) : null,
      high: high != null ? round1(high) : null,
      status: bl.status,
      n: bl.n,
      ...(bl.kind ? { kind: bl.kind } : {}),
    };
  }
  return {
    center: fallback ? round1(useRaw ? fallback.rawCenter : fallback.center) : null,
    low: fallback ? round1(useRaw ? fallback.rawLow : fallback.low) : null,
    high: fallback ? round1(useRaw ? fallback.rawHigh : fallback.high) : null,
    status: (bl && bl.status) || "calibrating",
    n: (bl && bl.n) || 0,
    ...(bl && bl.kind ? { kind: bl.kind } : {}),
  };
}

/**
 * Calcula Recovery Score (1–100%), penalizaciones secundarias, biomarcadores y degradación elegante.
 */
export function computeRecovery({
  vitals = null,
  sleepScore = null,
  baselines = {},
  atl3 = 0,
  ctl21 = 0,
  hrvKind = "rmssd",
} = {}) {
  const v = vitals && typeof vitals === "object" ? vitals : {};
  const kind = v.hrvKind === "sdnn" ? "sdnn" : v.hrvKind === "rmssd" ? "rmssd" : (hrvKind === "sdnn" ? "sdnn" : "rmssd");

  const hrvVal = isNum(v.hrv) && v.hrv > 0 ? v.hrv : null;
  const rhrVal = isNum(v.rhr) && v.rhr > 0 ? v.rhr : null;
  const respVal = isNum(v.resp) && v.resp > 0 ? v.resp : null;
  const spo2Val = isNum(v.spo2) && v.spo2 > 0 ? v.spo2 : null;
  const tempVal = isNum(v.tempDev) ? v.tempDev : null;
  const sleepVal = isNum(sleepScore) ? sleepScore : null;

  const blHrv = baselines.hrv || null;
  const blRhr = baselines.rhr || null;
  const blResp = baselines.resp || null;
  const blSpo2 = baselines.spo2 || null;
  const blTemp = baselines.tempDev || null;

  const hrvRef = blHrv && blHrv.ready ? blHrv : CALIBRATING_REFS[kind];
  const rhrRef = blRhr && blRhr.ready ? blRhr : CALIBRATING_REFS.rhr;
  const respRef = blResp && blResp.ready ? blResp : CALIBRATING_REFS.resp;
  const spo2Ref = blSpo2 && blSpo2.ready ? blSpo2 : CALIBRATING_REFS.spo2;
  const tempRef = blTemp && blTemp.ready ? blTemp : CALIBRATING_REFS.tempDev;

  const hrvRange = formatBaselineRange(blHrv, CALIBRATING_REFS[kind], { useRaw: true });
  const rhrRange = formatBaselineRange(blRhr, CALIBRATING_REFS.rhr);
  const respRange = formatBaselineRange(blResp, CALIBRATING_REFS.resp);
  const spo2Range = formatBaselineRange(blSpo2, CALIBRATING_REFS.spo2);
  const tempRange = formatBaselineRange(blTemp, CALIBRATING_REFS.tempDev);

  // Penalizaciones asimétricas por señales secundarias (tope -20 pts).
  let penTemp = 0;
  let penSpo2 = 0;
  let penResp = 0;
  const alertReasons = [];

  if (tempVal != null) {
    const dTemp = tempVal - tempRef.center;
    if (dTemp > 0.4) {
      penTemp = clamp(((dTemp - 0.4) / 0.8) * 12, 0, 12);
      alertReasons.push("Temperatura cutánea por encima de tu línea base");
    }
  }
  if (spo2Val != null) {
    const drop = spo2Ref.center - spo2Val;
    if (spo2Val < 95 || drop > 2) {
      const below95 = spo2Val < 95 ? ((95 - spo2Val) / 3) * 10 : 0;
      const belowBase = drop > 2 ? ((drop - 2) / 2) * 10 : 0;
      penSpo2 = clamp(Math.max(below95, belowBase), 0, 10);
      alertReasons.push("Saturación de oxígeno (SpO₂) más baja de lo normal");
    }
  }
  if (respVal != null) {
    const dResp = respVal - respRef.center;
    if (dResp > 1.5) {
      penResp = clamp(((dResp - 1.5) / 2.5) * 8, 0, 8);
      alertReasons.push("Frecuencia respiratoria elevada");
    }
  }

  const rawPenalty = penTemp + penSpo2 + penResp;
  const penalty = rawPenalty > 0 ? Math.min(20, Math.max(1, Math.round(rawPenalty))) : 0;
  const alert = penalty > 0 ? "biometrics_off" : null;

  const biomarkers = {
    hrv: {
      value: hrvVal != null ? round1(hrvVal) : null,
      kind,
      baseline: hrvRange,
      status: biomarkerStatus(hrvVal, hrvRange.low, hrvRange.high),
    },
    rhr: {
      value: rhrVal != null ? round1(rhrVal) : null,
      baseline: rhrRange,
      status: biomarkerStatus(rhrVal, rhrRange.low, rhrRange.high),
    },
    sleep: {
      value: sleepVal != null ? Math.round(sleepVal) : null,
      baseline: { center: 75, low: 60, high: 90, status: "ready", n: sleepVal != null ? 1 : 0 },
      status: biomarkerStatus(sleepVal, 60, 90),
    },
    tempDev: {
      value: tempVal != null ? round2(tempVal) : null,
      baseline: tempRange,
      status: biomarkerStatus(tempVal, tempRange.low, tempRange.high),
      penalty: penTemp > 0 ? Math.max(1, Math.round(penTemp)) : 0,
    },
    spo2: {
      value: spo2Val != null ? round1(spo2Val) : null,
      baseline: spo2Range,
      status: biomarkerStatus(spo2Val, spo2Range.low, spo2Range.high),
      penalty: penSpo2 > 0 ? Math.max(1, Math.round(penSpo2)) : 0,
    },
    resp: {
      value: respVal != null ? round1(respVal) : null,
      baseline: respRange,
      status: biomarkerStatus(respVal, respRange.low, respRange.high),
      penalty: penResp > 0 ? Math.max(1, Math.round(penResp)) : 0,
    },
  };

  // Modo biométrico: hay al menos HRV o RHR.
  if (hrvVal != null || rhrVal != null) {
    let wSum = 0;
    let zSum = 0;

    if (hrvVal != null) {
      const zHrv = (Math.log(hrvVal) - hrvRef.center) / hrvRef.spread;
      wSum += RECOVERY_WEIGHTS.hrv;
      zSum += RECOVERY_WEIGHTS.hrv * zHrv;
      biomarkers.hrv.z = round2(zHrv);
    }
    if (rhrVal != null) {
      const zRhr = -(rhrVal - rhrRef.center) / rhrRef.spread;
      wSum += RECOVERY_WEIGHTS.rhr;
      zSum += RECOVERY_WEIGHTS.rhr * zRhr;
      biomarkers.rhr.z = round2(zRhr);
    }
    if (sleepVal != null) {
      const zSleep = (sleepVal - 75) / 15;
      wSum += RECOVERY_WEIGHTS.sleep;
      zSum += RECOVERY_WEIGHTS.sleep * zSleep;
      biomarkers.sleep.z = round2(zSleep);
    }

    const Z = clamp(zSum / wSum, -2.5, 2.5);
    const baseScore = Math.round(1 + 99 / (1 + Math.exp(-1.15 * (Z + 0.6))));
    const score = clamp(baseScore - penalty, 1, 100);
    const { zone, label } = classifyZone(score);

    const activeStatuses = [];
    if (hrvVal != null) activeStatuses.push((blHrv && blHrv.status) || "calibrating");
    if (rhrVal != null) activeStatuses.push((blRhr && blRhr.status) || "calibrating");
    const calibration = activeStatuses.includes("calibrating")
      ? "calibrating"
      : activeStatuses.includes("provisional")
        ? "provisional"
        : "ready";

    return {
      score,
      baseScore,
      zone,
      label,
      mode: "biometric",
      calibration,
      zScore: round2(Z),
      penalty,
      alert,
      alertReasons,
      biomarkers,
      atl3: round1(atl3),
      ctl21: round1(ctl21),
    };
  }

  // Modo degradado (sin HRV ni RHR): SleepScore (65%) + fatiga residual ATL3/CTL21 (35%).
  const hasLoadHistory = (isNum(atl3) && atl3 > 0) || (isNum(ctl21) && ctl21 > 0);
  if (sleepVal == null && !hasLoadHistory && penalty === 0) {
    return {
      score: null,
      baseScore: null,
      zone: null,
      label: "Sin datos",
      mode: "missing",
      calibration: "calibrating",
      zScore: null,
      penalty: 0,
      alert: null,
      alertReasons: [],
      biomarkers,
      atl3: 0,
      ctl21: 0,
    };
  }

  const a3 = isNum(atl3) && atl3 > 0 ? atl3 : 0;
  const c21 = isNum(ctl21) && ctl21 > 0 ? ctl21 : 0;
  const fatigueScore = c21 >= 10
    ? clamp(70 - ((a3 / c21) - 1.0) * 80, 15, 95)
    : clamp(90 - a3 * 0.75, 20, 95);

  const baseScore = sleepVal != null
    ? Math.round(0.65 * sleepVal + 0.35 * fatigueScore)
    : Math.round(fatigueScore);
  const score = clamp(baseScore - penalty, 1, 100);
  const { zone, label } = classifyZone(score);

  return {
    score,
    baseScore,
    zone,
    label,
    mode: "estimated",
    calibration: "estimated",
    zScore: null,
    penalty,
    alert,
    alertReasons,
    biomarkers,
    atl3: round1(a3),
    ctl21: round1(c21),
  };
}

/**
 * Prescribe Target Strain diario según Recovery Score y alerta biométrica.
 */
export function computeTargetStrain(recoveryScore, { alert = null } = {}) {
  if (alert === "biometrics_off") {
    return { min: 15, max: 35, zone: "low", label: "Suave" };
  }
  if (!isNum(recoveryScore)) {
    return { min: 35, max: 60, zone: "mid", label: "Moderado" };
  }
  if (recoveryScore >= 67) {
    return { min: 60, max: 85, zone: "high", label: "Óptimo" };
  }
  if (recoveryScore >= 34) {
    return { min: 35, max: 60, zone: "mid", label: "Moderado" };
  }
  return { min: 15, max: 35, zone: "low", label: "Suave" };
}

/**
 * Calcula Energy Bank derivado: inicio = Recovery, actual = clamp(round(start - 0.65 * strain), 5, 100).
 */
export function computeEnergyBank(recoveryScore, strainScore = 0) {
  if (!isNum(recoveryScore)) return { start: null, now: null };
  const start = clamp(Math.round(recoveryScore), 1, 100);
  const strain = isNum(strainScore) && strainScore > 0 ? strainScore : 0;
  const now = clamp(Math.round(start - 0.65 * strain), 5, 100);
  return { start, now };
}

function workoutCardioLoad(w, { rhr, maxHr }) {
  const zones = w && w.zones && typeof w.zones === "object" ? w.zones : null;
  if (zones) {
    const light = isNum(zones.light) && zones.light > 0 ? zones.light : 0;
    const moderate = isNum(zones.moderate) && zones.moderate > 0 ? zones.moderate : 0;
    const vigorous = isNum(zones.vigorous) && zones.vigorous > 0 ? zones.vigorous : 0;
    const peak = isNum(zones.peak) && zones.peak > 0 ? zones.peak : 0;
    const totalZones = light + moderate + vigorous + peak;
    if (totalZones > 0) {
      return {
        load: 1.0 * light + 2.0 * moderate + 3.5 * vigorous + 5.0 * peak,
        method: "zones",
        zones: { light, moderate, vigorous, peak },
      };
    }
  }

  const min = isNum(w && w.min) && w.min > 0 ? w.min : 0;
  if (isNum(w && w.avgHr) && w.avgHr > 0 && min > 0) {
    const restHr = isNum(rhr) && rhr > 0 ? rhr : 60;
    const topHr = isNum(maxHr) && maxHr > restHr ? maxHr : restHr + 40;
    const hrr = clamp((w.avgHr - restHr) / (topHr - restHr), 0, 1);
    const trimp = min * hrr * 0.64 * Math.exp(1.92 * hrr) * 1.6;
    return { load: trimp, method: "trimp", zones: null };
  }

  const kind = w && w.kind ? w.kind : "other";
  const k = CARDIO_KIND_FACTORS[kind] ?? CARDIO_KIND_FACTORS.other;
  return { load: min * k, method: "fallback", zones: null };
}

function computeMuscularLoadForDay({ setLogDay, setsDay, loadsDay, blockWeek = 1, exerciseVolMedians = {} }) {
  const sl = setLogDay && typeof setLogDay === "object" ? setLogDay : {};
  const sb = setsDay && typeof setsDay === "object" ? setsDay : {};
  const ld = loadsDay && typeof loadsDay === "object" ? loadsDay : {};

  const routineIds = new Set([...Object.keys(sl), ...Object.keys(sb)]);
  let rawLoad = 0;
  let setsCount = 0;
  const setVolumesByEx = {};

  for (const rid of routineIds) {
    const rLog = sl[rid] && typeof sl[rid] === "object" ? sl[rid] : {};
    const rBoxes = sb[rid] && typeof sb[rid] === "object" ? sb[rid] : {};
    const rLoads = ld[rid] && typeof ld[rid] === "object" ? ld[rid] : {};
    const exIds = new Set([...Object.keys(rLog), ...Object.keys(rBoxes)]);

    for (const exId of exIds) {
      const series = Array.isArray(rLog[exId]) ? rLog[exId] : [];
      const boxes = Array.isArray(rBoxes[exId]) ? rBoxes[exId] : [];
      const count = Math.max(series.length, boxes.length);
      if (count === 0) continue;

      const ex = EXERCISE_BY_ID[exId] || { rir: 2, reps: "" };
      const rir = effRir(ex, blockWeek || 1);
      const fRir = clamp(1.25 - 0.12 * rir, 0.65, 1.25);
      const timed = isTimedSpec(ex.reps);
      const fallbackLoad = rLoads[exId] || "";
      const refMed = exerciseVolMedians && isNum(exerciseVolMedians[exId]) && exerciseVolMedians[exId] > 0
        ? exerciseVolMedians[exId]
        : null;

      for (let i = 0; i < count; i++) {
        const s = series[i];
        const done = Boolean(s) || Boolean(boxes[i]);
        if (!done) continue;
        setsCount += 1;

        let factorVol = 1.0;
        if (!timed && s && typeof s === "object") {
          const reps = s.reps !== "" && s.reps != null && Number.isFinite(Number(s.reps)) ? Number(s.reps) : null;
          const kg = parseLoad(s.load || fallbackLoad);
          if (reps && reps > 0 && kg && kg > 0) {
            const setVol = reps * kg;
            if (!setVolumesByEx[exId]) setVolumesByEx[exId] = [];
            setVolumesByEx[exId].push(setVol);
            if (refMed) {
              factorVol = clamp(setVol / refMed, 0.7, 1.4);
            }
          }
        }
        rawLoad += 2.2 * fRir * factorVol;
      }
    }
  }

  return { rawLoad, setsCount, setVolumesByEx };
}

/**
 * Calcula Strain diario (Cardio en 3 niveles + Muscular con anti-doble conteo + Pasivo + curva logarítmica).
 */
export function computeStrain({
  workouts = [],
  setLogDay = null,
  setsDay = null,
  loadsDay = null,
  vitalsDay = null,
  blockWeek = 1,
  prefs = null,
  exerciseVolMedians = null,
  rhrBaseline = null,
} = {}) {
  const normPrefs = normalizeHealthPrefs(prefs);
  const v = vitalsDay && typeof vitalsDay === "object" ? vitalsDay : {};
  const rhr = isNum(v.rhr) && v.rhr > 0 ? v.rhr : (isNum(rhrBaseline) && rhrBaseline > 0 ? rhrBaseline : 60);

  let cardioLoad = 0;
  let workoutAzm = 0;
  let hasFitbitStrength = false;
  const totalZones = { light: 0, moderate: 0, vigorous: 0, peak: 0 };
  const workoutBreakdown = [];

  for (const w of Array.isArray(workouts) ? workouts : []) {
    if (!w || typeof w !== "object") continue;
    const kind = w.kind || "other";
    if (kind === "strength") hasFitbitStrength = true;
    const res = workoutCardioLoad(w, { rhr, maxHr: normPrefs.effectiveMaxHr });
    cardioLoad += res.load;
    if (isNum(w.azm) && w.azm > 0) workoutAzm += w.azm;
    if (res.zones) {
      totalZones.light += res.zones.light;
      totalZones.moderate += res.zones.moderate;
      totalZones.vigorous += res.zones.vigorous;
      totalZones.peak += res.zones.peak;
    }
    workoutBreakdown.push({
      id: w.id || null,
      type: w.type || "Entreno",
      kind,
      min: isNum(w.min) ? Math.round(w.min) : 0,
      avgHr: isNum(w.avgHr) ? Math.round(w.avgHr) : null,
      azm: isNum(w.azm) ? Math.round(w.azm) : null,
      kcal: isNum(w.kcal) ? Math.round(w.kcal) : null,
      zones: res.zones,
      method: res.method,
      load: round1(res.load),
      strainPct: loadToStrain(res.load),
    });
  }

  const musc = computeMuscularLoadForDay({
    setLogDay,
    setsDay,
    loadsDay,
    blockWeek,
    exerciseVolMedians: exerciseVolMedians || {},
  });
  const antiDoubleCount = hasFitbitStrength && musc.rawLoad > 0;
  const muscularLoad = antiDoubleCount ? musc.rawLoad * ANTI_DOUBLE_COUNT_FACTOR : musc.rawLoad;

  const steps = isNum(v.steps) && v.steps > 0 ? v.steps : 0;
  const dayAzm = isNum(v.azm) && v.azm > 0 ? v.azm : 0;
  const passiveLoad = Math.min(
    35,
    Math.max(0, steps - 2500) * 0.0025 + Math.max(0, dayAzm - workoutAzm) * 0.8,
  );

  const totalLoad = cardioLoad + muscularLoad + passiveLoad;
  const score = loadToStrain(totalLoad);

  return {
    score,
    totalLoad: round1(totalLoad),
    cardioLoad: round1(cardioLoad),
    muscularLoad: round1(muscularLoad),
    rawMuscularLoad: round1(musc.rawLoad),
    passiveLoad: round1(passiveLoad),
    setsCount: musc.setsCount,
    antiDoubleCount,
    zones: totalZones,
    workouts: workoutBreakdown,
    _setVolumesByEx: musc.setVolumesByEx,
  };
}

function workoutLocalDate(w) {
  if (!w || !w.start) return null;
  const d = new Date(w.start);
  return isNaN(d.getTime()) ? null : dkey(d);
}

/**
 * Ejecuta el motor Bevel completo día a día en ciclo cerrado.
 * Devuelve `{ byDate, dates, latestDate, today, prefs }`.
 */
export function computeBevelHistory({
  sleep = {},
  workouts = [],
  vitals = {},
  healthPrefs = null,
  setLog = {},
  sets = {},
  loads = {},
  log = {},
  block = null,
  today = dkey(),
  maxDays = 180,
} = {}) {
  const prefs = normalizeHealthPrefs(healthPrefs);
  const sleepMap = sleep && typeof sleep === "object" ? sleep : {};
  const vitalsMap = vitals && typeof vitals === "object" ? vitals : {};
  const setLogMap = setLog && typeof setLog === "object" ? setLog : {};
  const setsMap = sets && typeof sets === "object" ? sets : {};
  const loadsMap = loads && typeof loads === "object" ? loads : {};
  const logMap = log && typeof log === "object" ? log : {};
  const blockWeek = (block && isNum(block.week) && block.week >= 1 && block.week <= 4) ? block.week : 1;

  const endDate = isDateKey(today) ? today : dkey();

  // Agrupar entrenos por fecha local.
  const workoutsByDate = {};
  for (const w of Array.isArray(workouts) ? workouts : []) {
    const dk = workoutLocalDate(w);
    if (!dk) continue;
    if (!workoutsByDate[dk]) workoutsByDate[dk] = [];
    workoutsByDate[dk].push(w);
  }

  // Determinar fecha inicial desde los datos disponibles (acotada a maxDays para evitar bucles gigantes).
  const candidateDates = [
    ...Object.keys(sleepMap),
    ...Object.keys(vitalsMap),
    ...Object.keys(setLogMap),
    ...Object.keys(setsMap),
    ...Object.keys(logMap),
    ...Object.keys(workoutsByDate),
  ].filter((k) => isDateKey(k) && k <= endDate).sort();

  const earliestLimit = dkey(addDays(fromKey(endDate), -(Math.max(1, Math.round(maxDays)) - 1)));
  const startDate = candidateDates.length
    ? (candidateDates[0] < earliestLimit ? earliestLimit : candidateDates[0])
    : endDate;

  // Series por fecha para líneas base móviles (respetando separación hrvKind).
  const hrvSeries = {};
  const rhrSeries = {};
  const respSeries = {};
  const spo2Series = {};
  const tempSeries = {};

  for (const [k, v] of Object.entries(vitalsMap)) {
    if (!isDateKey(k) || !v || typeof v !== "object") continue;
    if (isNum(v.hrv) && v.hrv > 0) {
      const kind = v.hrvKind === "sdnn" ? "sdnn" : v.hrvKind === "rmssd" ? "rmssd" : prefs.hrvKind;
      hrvSeries[k] = { value: v.hrv, kind };
    }
    if (isNum(v.rhr) && v.rhr > 0) rhrSeries[k] = v.rhr;
    if (isNum(v.resp) && v.resp > 0) respSeries[k] = v.resp;
    if (isNum(v.spo2) && v.spo2 > 0) spo2Series[k] = v.spo2;
    if (isNum(v.tempDev)) tempSeries[k] = v.tempDev;
  }

  const totalSpan = Math.max(0, dayDiff(endDate, startDate));
  const dates = Array.from({ length: totalSpan + 1 }, (_, i) => dkey(addDays(fromKey(startDate), i)));
  const byDate = {};

  // Historial causal de volúmenes por ejercicio para ponderar carga muscular relativa sin fuga al futuro.
  const exVolHistory = {};

  for (let idx = 0; idx < dates.length; idx++) {
    const d = dates[idx];
    const prevDate = idx > 0 ? dates[idx - 1] : null;
    const prevStrain = prevDate && byDate[prevDate] ? byDate[prevDate].strain.score : null;

    // Últimas 7 noches previas para deuda de sueño.
    const recentNights = [];
    for (let k = Math.max(0, idx - 7); k < idx; k++) {
      const prev = byDate[dates[k]];
      if (prev && prev.sleep && isNum(prev.sleep.min) && prev.sleep.min > 0) {
        recentNights.push({ asleep: prev.sleep.min, need: prev.sleep.need.needMin });
      }
    }

    // Eficiencia promedio de los últimos 30 días previos.
    const effValues = [];
    for (let k = Math.max(0, idx - 30); k < idx; k++) {
      const eff = resolveNightEfficiency(sleepMap[dates[k]]);
      if (eff != null) effValues.push(eff);
    }
    const avgEfficiency = effValues.length
      ? effValues.reduce((a, b) => a + b, 0) / effValues.length
      : DEFAULT_EFFICIENCY;

    // 1. Sleep Need
    const sleepNeed = computeSleepNeed({
      sleepBaseMin: prefs.sleepBaseMin,
      prevStrain,
      recentNights,
      avgEfficiency,
    });

    // 2. Sleep Score
    const night = sleepMap[d] && isNum(sleepMap[d].min) && sleepMap[d].min > 0 ? sleepMap[d] : null;
    const vDay = vitalsMap[d] && typeof vitalsMap[d] === "object" ? vitalsMap[d] : null;
    let hrDip = null;
    if (vDay && isNum(vDay.hrDip)) hrDip = vDay.hrDip;
    else if (vDay && isNum(vDay.awakeHr) && vDay.awakeHr > 0 && isNum(vDay.sleepHr) && vDay.sleepHr > 0) {
      hrDip = ((vDay.awakeHr - vDay.sleepHr) / vDay.awakeHr) * 100;
    }

    const sleepScoreObj = computeSleepScore(night, { needMin: sleepNeed.needMin, hrDip });

    // 3. Líneas base estrictamente previas [d-60, d-1]
    const dayHrvKind = (vDay && (vDay.hrvKind === "sdnn" || vDay.hrvKind === "rmssd")) ? vDay.hrvKind : prefs.hrvKind;
    const blHrv = computeBaseline(hrvSeries, d, { windowDays: 60, minFloor: BASELINE_FLOORS.lnHrv, transform: Math.log, filterKind: dayHrvKind });
    const blRhr = computeBaseline(rhrSeries, d, { windowDays: 60, minFloor: BASELINE_FLOORS.rhr });
    const blResp = computeBaseline(respSeries, d, { windowDays: 60, minFloor: BASELINE_FLOORS.resp });
    const blSpo2 = computeBaseline(spo2Series, d, { windowDays: 60, minFloor: BASELINE_FLOORS.spo2 });
    const blTemp = computeBaseline(tempSeries, d, { windowDays: 60, minFloor: BASELINE_FLOORS.tempDev });

    // ATL3 y CTL21 previos [d-3..d-1] y [d-21..d-1]
    const prevStrains3 = [];
    for (let k = Math.max(0, idx - 3); k < idx; k++) {
      prevStrains3.push(byDate[dates[k]].strain.score || 0);
    }
    const prevStrains21 = [];
    for (let k = Math.max(0, idx - 21); k < idx; k++) {
      prevStrains21.push(byDate[dates[k]].strain.score || 0);
    }
    const atl3 = prevStrains3.length ? prevStrains3.reduce((a, b) => a + b, 0) / prevStrains3.length : 0;
    const ctl21 = prevStrains21.length ? prevStrains21.reduce((a, b) => a + b, 0) / prevStrains21.length : 0;

    // 4. Recovery Score
    const recovery = computeRecovery({
      vitals: vDay,
      sleepScore: sleepScoreObj.score,
      baselines: { hrv: blHrv, rhr: blRhr, resp: blResp, spo2: blSpo2, tempDev: blTemp },
      atl3,
      ctl21,
      hrvKind: dayHrvKind,
    });

    // 5. Target Strain
    const target = computeTargetStrain(recovery.score, { alert: recovery.alert });

    // 6. Strain Score (usando medianas históricas previas por ejercicio)
    const exerciseVolMedians = {};
    for (const [exId, vols] of Object.entries(exVolHistory)) {
      const m = median(vols);
      if (m != null && m > 0) exerciseVolMedians[exId] = m;
    }

    const rawStrain = computeStrain({
      workouts: workoutsByDate[d] || [],
      setLogDay: setLogMap[d] || null,
      setsDay: setsMap[d] || null,
      loadsDay: loadsMap[d] || null,
      vitalsDay: vDay,
      blockWeek,
      prefs,
      exerciseVolMedians,
      rhrBaseline: blRhr.ready ? blRhr.center : null,
    });

    // Actualizar historial causal de volúmenes con las series de hoy.
    for (const [exId, vols] of Object.entries(rawStrain._setVolumesByEx || {})) {
      if (!exVolHistory[exId]) exVolHistory[exId] = [];
      exVolHistory[exId].push(...vols);
      if (exVolHistory[exId].length > 60) exVolHistory[exId] = exVolHistory[exId].slice(-60);
    }

    const { _setVolumesByEx, ...strainPublic } = rawStrain;
    const strain = { ...strainPublic, target };

    // 7. Energy Bank
    const energyBank = computeEnergyBank(recovery.score, strain.score);

    byDate[d] = {
      date: d,
      sleep: {
        ...sleepScoreObj,
        min: night ? night.min : null,
        bed: night && night.bed ? night.bed : null,
        wake: night && night.wake ? night.wake : null,
        inBedMin: night && isNum(night.inBedMin) ? night.inBedMin : null,
        awakeMin: night && isNum(night.awakeMin) ? night.awakeMin : null,
        deepMin: night && isNum(night.deepMin) ? night.deepMin : null,
        remMin: night && isNum(night.remMin) ? night.remMin : null,
        lightMin: night && isNum(night.lightMin) ? night.lightMin : null,
        awakenings: night && isNum(night.awakenings) ? night.awakenings : null,
        eff: sleepScoreObj.components.efficiency.value,
        hrDip: hrDip != null ? round1(hrDip) : null,
        need: sleepNeed,
      },
      recovery,
      strain,
      energyBank,
      vitals: vDay,
    };
  }

  const latestDate = dates.length ? dates[dates.length - 1] : null;
  return {
    byDate,
    dates,
    latestDate,
    today: byDate[endDate] || null,
    prefs,
  };
}

/**
 * Obtiene el resumen Bevel de una fecha concreta.
 * Acepta tanto un historial ya calculado (`computeBevelHistory(...)`) como los datos crudos de entrada.
 */
export function getBevelDay(input, dateKey = null) {
  if (!input || typeof input !== "object") return null;
  if (input.byDate && typeof input.byDate === "object") {
    const key = dateKey || input.latestDate;
    return (key && input.byDate[key]) || null;
  }
  const target = isDateKey(dateKey) ? dateKey : (isDateKey(input.today) ? input.today : dkey());
  const hist = computeBevelHistory({ ...input, today: target });
  return hist.byDate[target] || null;
}
