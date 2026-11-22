import test from "node:test";
import assert from "node:assert/strict";
import { dkey, fromKey, addDays } from "../src/lib/dates.js";
import { computeBaseline, median, mad, zScore } from "../src/lib/baselines.js";
import {
  DEFAULT_HEALTH_PREFS,
  normalizeHealthPrefs,
  loadToStrain,
  computeSleepNeed,
  computeSleepScore,
  computeRecovery,
  computeStrain,
  computeTargetStrain,
  computeEnergyBank,
  computeBevelHistory,
  getBevelDay,
} from "../src/lib/bevel.js";

const dateSeq = (startKey, count) =>
  Array.from({ length: count }, (_, i) => dkey(addDays(fromKey(startKey), i)));

// ===========================
// 1. baselines.js
// ===========================

test("baselines: ventana estrictamente previa [d-windowDays, d-1], nunca incluye d ni días más viejos", () => {
  const series = {};
  // 65 días antes de 2026-11-21 → solo los últimos 60 previos deben entrar.
  const target = "2026-11-21";
  for (let offset = 65; offset >= 1; offset--) {
    const k = dkey(addDays(fromKey(target), -offset));
    series[k] = offset > 60 ? 500 : 54;
  }
  series[target] = 999; // día d: jamás debe contaminar la línea base
  series["2026-11-22"] = 999; // futuro: jamás debe entrar

  const bl = computeBaseline(series, target, { windowDays: 60, minFloor: 2.0 });
  assert.equal(bl.n, 60);
  assert.equal(bl.status, "ready");
  assert.equal(bl.ready, true);
  assert.equal(bl.center, 54);
  assert.equal(bl.spread, 2.0); // MAD = 0 → piso minFloor
  assert.equal(bl.low, 52);
  assert.equal(bl.high, 56);
});

test("baselines: estados de calibración (<7 calibrating, 7..20 provisional, >=21 ready)", () => {
  const mkSeries = (n) => {
    const out = {};
    for (let i = 1; i <= n; i++) out[dkey(addDays(fromKey("2026-11-21"), -i))] = 55 + (i % 3);
    return out;
  };

  assert.equal(computeBaseline(mkSeries(0), "2026-11-21").status, "calibrating");
  assert.equal(computeBaseline(mkSeries(6), "2026-11-21").status, "calibrating");
  assert.equal(computeBaseline(mkSeries(6), "2026-11-21").ready, false);

  const prov7 = computeBaseline(mkSeries(7), "2026-11-21");
  assert.equal(prov7.status, "provisional");
  assert.equal(prov7.ready, true);
  assert.equal(computeBaseline(mkSeries(20), "2026-11-21").status, "provisional");

  const ready21 = computeBaseline(mkSeries(21), "2026-11-21");
  assert.equal(ready21.status, "ready");
  assert.equal(ready21.ready, true);
});

test("baselines: mediana y MAD resisten picos aislados (p. ej. 2 días de gripe)", () => {
  const target = "2026-11-21";
  const series = {};
  for (let i = 1; i <= 25; i++) {
    const k = dkey(addDays(fromKey(target), -i));
    series[k] = i <= 2 ? 95 : 54; // 2 días extremos vs 23 normales
  }
  const bl = computeBaseline(series, target, { windowDays: 60, minFloor: 2.0 });
  assert.equal(bl.center, 54);
  assert.equal(bl.mad, 0);
  assert.equal(bl.spread, 2.0);
  assert.equal(median([1, 3, 5, 7]), 4);
  assert.equal(mad([10, 10, 12, 14]), 1);
});

test("baselines: separa estrictamente hrvKind rmssd vs sdnn y soporta transform Math.log", () => {
  const target = "2026-11-21";
  const series = {};
  for (let i = 1; i <= 25; i++) {
    const k = dkey(addDays(fromKey(target), -i));
    // 22 días RMSSD ~60 ms, 3 días SDNN ~110 ms
    series[k] = i <= 3 ? { value: 110, kind: "sdnn" } : { value: 60, kind: "rmssd" };
  }

  const rmssd = computeBaseline(series, target, {
    windowDays: 60,
    minFloor: 0.08,
    transform: Math.log,
    filterKind: "rmssd",
  });
  const sdnn = computeBaseline(series, target, {
    windowDays: 60,
    minFloor: 0.08,
    transform: Math.log,
    filterKind: "sdnn",
  });

  assert.equal(rmssd.n, 22);
  assert.equal(rmssd.status, "ready");
  assert.ok(Math.abs(rmssd.rawCenter - 60) < 0.01);
  assert.equal(sdnn.n, 3);
  assert.equal(sdnn.status, "calibrating");
  assert.ok(Math.abs(sdnn.rawCenter - 110) < 0.01);
  assert.ok(Math.abs(zScore(60, rmssd, Math.log)) < 1e-9);
});

// ===========================
// 2. Preferencias, Sleep Need y Sleep Score
// ===========================

test("normalizeHealthPrefs aplica defaults y calcula effectiveMaxHr desde edad o maxHr", () => {
  assert.deepEqual(normalizeHealthPrefs(), { ...DEFAULT_HEALTH_PREFS, effectiveMaxHr: 190 });
  assert.equal(normalizeHealthPrefs({ age: 30 }).effectiveMaxHr, 187);
  assert.equal(normalizeHealthPrefs({ age: 30, maxHr: 196 }).effectiveMaxHr, 196);
  assert.equal(normalizeHealthPrefs({ hrvKind: "sdnn", sleepBaseMin: 480 }).hrvKind, "sdnn");
});

test("computeSleepNeed combina base + Strain[d-1] + deuda móvil 7d/4 con topes y bedNeedMin", () => {
  // Sin deuda ni strain alto: queda en base (450) y bedNeed = 450 / 0.90 = 500
  const calm = computeSleepNeed({ sleepBaseMin: 450, prevStrain: 40, recentNights: [] });
  assert.equal(calm.strainDeltaMin, 0);
  assert.equal(calm.debt7dMin, 0);
  assert.equal(calm.needMin, 450);
  assert.equal(calm.bedNeedMin, 500);

  // Strain alto ayer (90 → 0.6 * 40 = +24 min) + 4 noches con déficit de 40 min cada una (160 min / 4 = +40 min)
  const heavy = computeSleepNeed({
    sleepBaseMin: 450,
    prevStrain: 90,
    recentNights: Array(4).fill({ asleep: 410, need: 450 }),
    avgEfficiency: 0.92,
  });
  assert.equal(heavy.strainDeltaMin, 24);
  assert.equal(heavy.debt7dMin, 160);
  assert.equal(heavy.debtDeltaMin, 40);
  assert.equal(heavy.needMin, 514);
  assert.equal(heavy.bedNeedMin, Math.round(514 / 0.92));

  // Tope de deuda (240 min → +60) y tope de strain (+45)
  const capped = computeSleepNeed({
    sleepBaseMin: 450,
    prevStrain: 140,
    recentNights: Array(7).fill({ asleep: 300, need: 450 }),
  });
  assert.equal(capped.strainDeltaMin, 45);
  assert.equal(capped.debt7dMin, 240);
  assert.equal(capped.needMin, 555);
});

test("computeSleepScore renormaliza automáticamente según señales disponibles y calcula coverage", () => {
  // Solo duración (esquema legado): coverage = 0.40
  const durOnly = computeSleepScore({ min: 450, bed: "22:45", wake: "06:15" }, { needMin: 450 });
  assert.equal(durOnly.score, 100);
  assert.equal(durOnly.coverage, 0.4);
  assert.equal(durOnly.presentCount, 1);

  // Con fases, eficiencia y continuidad (sin HR Dip): coverage = 0.90
  const fiveSignals = computeSleepScore({
    min: 450,
    inBedMin: 480,
    awakeMin: 12,
    deepMin: 81,
    remMin: 99,
    lightMin: 270,
    awakenings: 1,
    eff: 0.938,
  }, { needMin: 450 });
  assert.equal(fiveSignals.coverage, 0.9);
  assert.equal(fiveSignals.score, 100);

  // Completo con las 6 señales incluyendo HR Dip
  const full = computeSleepScore({
    min: 450,
    inBedMin: 480,
    awakeMin: 12,
    deepMin: 81,
    remMin: 99,
    lightMin: 270,
    awakenings: 1,
    eff: 0.938,
  }, { needMin: 450, hrDip: 12 });
  assert.equal(full.coverage, 1);
  assert.equal(full.presentCount, 6);
  assert.equal(full.score, 100);

  // HR Dip negativo y exceso de sueño (>1.25x) penalizan
  const poorDip = computeSleepScore({ min: 650 }, { needMin: 450, hrDip: -2 });
  assert.equal(poorDip.components.hrDip.score, 0);
  assert.ok(poorDip.components.duration.score < 100);
});

// ===========================
// 3. Recovery Score, penalizaciones y degradación
// ===========================

test("computeRecovery reproduce la curva sigmoide sobre z-scores de 60 días y clasifica biomarcadores", () => {
  const blHrv = { ready: true, status: "ready", n: 30, center: Math.log(60), spread: 0.12, rawCenter: 60, rawLow: Math.exp(Math.log(60) - 0.12), rawHigh: Math.exp(Math.log(60) + 0.12), kind: "rmssd" };
  const blRhr = { ready: true, status: "ready", n: 30, center: 54, spread: 2.0, low: 52, high: 56 };

  // En baseline exacto (Z = 0) → 67%
  const atBase = computeRecovery({
    vitals: { hrv: 60, hrvKind: "rmssd", rhr: 54 },
    sleepScore: 75,
    baselines: { hrv: blHrv, rhr: blRhr },
  });
  assert.equal(atBase.mode, "biometric");
  assert.equal(atBase.calibration, "ready");
  assert.equal(atBase.score, 67);
  assert.equal(atBase.zone, "high");
  assert.equal(atBase.biomarkers.hrv.status, "normal");
  assert.equal(atBase.biomarkers.rhr.status, "normal");
  assert.equal(atBase.biomarkers.tempDev.status, "missing");

  // HRV alta + RHR baja + gran sueño → recuperación muy alta
  const strong = computeRecovery({
    vitals: { hrv: 78, hrvKind: "rmssd", rhr: 50 },
    sleepScore: 95,
    baselines: { hrv: blHrv, rhr: blRhr },
  });
  assert.ok(strong.score >= 88, `esperaba >= 88, dio ${strong.score}`);
  assert.equal(strong.biomarkers.hrv.status, "high");
  assert.equal(strong.biomarkers.rhr.status, "low");

  // HRV baja + RHR alta + mal sueño → recuperación baja
  const depleted = computeRecovery({
    vitals: { hrv: 42, hrvKind: "rmssd", rhr: 60 },
    sleepScore: 45,
    baselines: { hrv: blHrv, rhr: blRhr },
  });
  assert.ok(depleted.score <= 33, `esperaba <= 33, dio ${depleted.score}`);
  assert.equal(depleted.zone, "low");
});

test("computeRecovery aplica penalizaciones asimétricas (tope -20) y bandera biometrics_off", () => {
  const blHrv = { ready: true, status: "ready", n: 30, center: Math.log(60), spread: 0.12, rawCenter: 60, rawLow: 53, rawHigh: 68, kind: "rmssd" };
  const blRhr = { ready: true, status: "ready", n: 30, center: 54, spread: 2.0, low: 52, high: 56 };
  const blTemp = { ready: true, status: "ready", n: 30, center: 0, spread: 0.25, low: -0.25, high: 0.25 };
  const blSpo2 = { ready: true, status: "ready", n: 30, center: 97.5, spread: 0.8, low: 96.7, high: 98.3 };
  const blResp = { ready: true, status: "ready", n: 30, center: 14.5, spread: 0.6, low: 13.9, high: 15.1 };

  // Valores normales o favorables (temp más baja, SpO2 más alta, resp más baja) = 0 penalización
  const normal = computeRecovery({
    vitals: { hrv: 60, rhr: 54, tempDev: -0.3, spo2: 99, resp: 13.5 },
    sleepScore: 75,
    baselines: { hrv: blHrv, rhr: blRhr, tempDev: blTemp, spo2: blSpo2, resp: blResp },
  });
  assert.equal(normal.penalty, 0);
  assert.equal(normal.alert, null);

  // Las tres señales disparadas en extremo → penalización tope de -20 pts y alert "biometrics_off"
  const sick = computeRecovery({
    vitals: { hrv: 60, rhr: 54, tempDev: 1.5, spo2: 91, resp: 19.5 },
    sleepScore: 75,
    baselines: { hrv: blHrv, rhr: blRhr, tempDev: blTemp, spo2: blSpo2, resp: blResp },
  });
  assert.equal(sick.penalty, 20);
  assert.equal(sick.score, sick.baseScore - 20);
  assert.equal(sick.alert, "biometrics_off");
  assert.equal(sick.alertReasons.length, 3);
});

test("computeRecovery degrada a mode 'estimated' (SleepScore 65% + ATL3/CTL21 35%) cuando faltan HRV y RHR", () => {
  const fresh = computeRecovery({ vitals: {}, sleepScore: 85, atl3: 30, ctl21: 45 });
  assert.equal(fresh.mode, "estimated");
  assert.equal(fresh.biomarkers.hrv.status, "missing");
  assert.equal(fresh.biomarkers.rhr.status, "missing");
  assert.ok(fresh.score >= 70);

  const fatigued = computeRecovery({ vitals: {}, sleepScore: 50, atl3: 80, ctl21: 45 });
  assert.equal(fatigued.mode, "estimated");
  assert.ok(fatigued.score < fresh.score);

  const empty = computeRecovery({ vitals: {}, sleepScore: null, atl3: 0, ctl21: 0 });
  assert.equal(empty.score, null);
  assert.equal(empty.mode, "missing");
});

test("computeRecovery no adivina con la carga sola cuando aún no llega el sueño de la noche", () => {
  const pending = computeRecovery({ vitals: { steps: 64 }, sleepScore: null, atl3: 80, ctl21: 45 });
  assert.equal(pending.score, null);
  assert.equal(pending.mode, "missing");
  assert.equal(pending.zone, null);
});

// ===========================
// 4. Strain Score (3 niveles cardio, muscular, anti-doble conteo, pasivo, >100%)
// ===========================

test("computeStrain soporta los 3 niveles de cardio (zones → TRIMP → fallback) y pasivo", () => {
  const z = computeStrain({
    workouts: [{ id: "w1", type: "Correr", kind: "run", min: 38, zones: { light: 8, moderate: 14, vigorous: 13, peak: 3 } }],
  });
  // 8*1 + 14*2 + 13*3.5 + 3*5 = 8 + 28 + 45.5 + 15 = 96.5
  assert.equal(z.cardioLoad, 96.5);
  assert.equal(z.workouts[0].method, "zones");

  const trimp = computeStrain({
    workouts: [{ id: "w2", type: "Correr", kind: "run", min: 40, avgHr: 155 }],
    vitalsDay: { rhr: 55 },
    prefs: { maxHr: 195 },
  });
  assert.equal(trimp.workouts[0].method, "trimp");
  assert.ok(trimp.cardioLoad > 40);

  const fb = computeStrain({
    workouts: [{ id: "w3", type: "Correr", kind: "run", min: 30 }],
  });
  assert.equal(fb.workouts[0].method, "fallback");
  assert.equal(fb.cardioLoad, 69); // 30 * 2.3

  // Passive strain: steps + AZM fuera de entrenos, acotado a 35
  const passive = computeStrain({
    workouts: [{ id: "w4", type: "Caminata", kind: "walk", min: 10, azm: 10 }],
    vitalsDay: { steps: 12500, azm: 30 },
  });
  // (12500 - 2500)*0.0025 = 25; (30 - 10)*0.8 = 16; min(35, 41) = 35
  assert.equal(passive.passiveLoad, 35);
});

test("computeStrain calcula carga muscular desde setLog/sets con effRir y aplica anti-doble conteo 0.65 con Fitbit strength", () => {
  const setLogDay = {
    d1: {
      d1a1: [{ reps: 5, load: "" }, { reps: 5, load: "" }, { reps: 5, load: "" }, { reps: 5, load: "" }],
      d1b1: [{ reps: 10, load: "40 kg" }, { reps: 10, load: "40 kg" }, { reps: 10, load: "40 kg" }],
    },
  };

  const onlyApp = computeStrain({ setLogDay, blockWeek: 2 });
  assert.equal(onlyApp.antiDoubleCount, false);
  assert.equal(onlyApp.setsCount, 7);
  assert.ok(onlyApp.muscularLoad > 14);

  // Semana de descarga (blockWeek=4, RIR+2) produce menos carga muscular que sobrecarga (blockWeek=3, RIR-1)
  const overload = computeStrain({ setLogDay, blockWeek: 3 });
  const deload = computeStrain({ setLogDay, blockWeek: 4 });
  assert.ok(overload.muscularLoad > deload.muscularLoad);

  // Con entreno Fitbit kind === "strength" ese día: muscular se multiplica por 0.65
  const withFitbit = computeStrain({
    workouts: [{ id: "s1", type: "Fuerza", kind: "strength", min: 42, avgHr: 118 }],
    setLogDay,
    blockWeek: 2,
  });
  assert.equal(withFitbit.antiDoubleCount, true);
  assert.ok(Math.abs(withFitbit.muscularLoad - Math.round(withFitbit.rawMuscularLoad * 0.65 * 10) / 10) <= 0.2);
});

test("loadToStrain sigue curva logarítmica calibrada y permite superar 100%", () => {
  assert.equal(loadToStrain(0), 0);
  assert.equal(loadToStrain(15), 20);
  assert.equal(loadToStrain(55), 48);
  assert.equal(loadToStrain(110), 68);
  assert.equal(loadToStrain(200), 88);
  assert.ok(loadToStrain(320) > 100, `esperaba > 100%, dio ${loadToStrain(320)}`);
});

test("computeTargetStrain y computeEnergyBank respetan zonas y límites", () => {
  assert.deepEqual(computeTargetStrain(82), { min: 60, max: 85, zone: "high", label: "Óptimo" });
  assert.deepEqual(computeTargetStrain(50), { min: 35, max: 60, zone: "mid", label: "Moderado" });
  assert.deepEqual(computeTargetStrain(24), { min: 15, max: 35, zone: "low", label: "Suave" });
  assert.deepEqual(computeTargetStrain(78, { alert: "biometrics_off" }), { min: 15, max: 35, zone: "low", label: "Suave" });

  assert.deepEqual(computeEnergyBank(80, 40), { start: 80, now: 54 });
  assert.deepEqual(computeEnergyBank(30, 90), { start: 30, now: 5 });
  assert.deepEqual(computeEnergyBank(null, 50), { start: null, now: null });
});

// ===========================
// 5. Ciclo cerrado multi-día (computeBevelHistory y getBevelDay)
// ===========================

test("computeBevelHistory encadena Strain[d-1] → SleepNeed[d] → SleepScore[d] → Recovery[d] → TargetStrain + EnergyBank", () => {
  const days = dateSeq("2026-10-20", 30); // 30 días consecutivos
  const sleep = {};
  const vitals = {};
  const workouts = [];

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    sleep[d] = {
      min: i === 28 ? 330 : 450, // anteúltima noche corta genera deuda para el día 29
      inBedMin: 485,
      awakeMin: 15,
      deepMin: 82,
      remMin: 100,
      lightMin: 268,
      awakenings: 1,
      eff: 0.928,
    };
    vitals[d] = {
      rhr: i === 29 ? 50 : 54,
      hrv: i === 29 ? 74 : 60,
      hrvKind: "rmssd",
      resp: 14.5,
      spo2: 97.5,
      tempDev: 0.0,
      hrDip: 12.5,
      steps: 8000,
      azm: 20,
    };
    // Día 28 tiene un entreno fuerte (sube SleepNeed del día 29)
    if (i === 28) {
      workouts.push({
        id: "run-heavy",
        type: "Correr",
        kind: "run",
        start: `${d}T12:00:00.000Z`,
        min: 50,
        zones: { light: 5, moderate: 15, vigorous: 20, peak: 10 },
      });
    }
  }

  const lastDate = days[days.length - 1];
  const hist = computeBevelHistory({ sleep, vitals, workouts, today: lastDate });

  assert.equal(hist.dates.length, 30);
  assert.equal(hist.latestDate, lastDate);
  assert.equal(hist.today.date, lastDate);

  // Calibración progresiva en el historial
  assert.equal(hist.byDate[days[3]].recovery.calibration, "calibrating");
  assert.equal(hist.byDate[days[12]].recovery.calibration, "provisional");
  assert.equal(hist.byDate[lastDate].recovery.calibration, "ready");

  // Efecto del ciclo cerrado en el último día: Strain fuerte + noche corta del día 28 elevan SleepNeed[29]
  const d28 = hist.byDate[days[28]];
  const d29 = hist.byDate[lastDate];
  assert.ok(d28.strain.score > 70);
  assert.ok(d29.sleep.need.strainDeltaMin > 0);
  assert.ok(d29.sleep.need.debt7dMin > 0);
  assert.ok(d29.sleep.need.needMin > 450);

  // HRV alta y RHR baja en día 29 → Recovery alta y Target Strain óptimo
  assert.equal(d29.recovery.zone, "high");
  assert.deepEqual(d29.strain.target, { min: 60, max: 85, zone: "high", label: "Óptimo" });
  assert.equal(d29.energyBank.start, d29.recovery.score);
  assert.ok(d29.energyBank.now <= d29.energyBank.start);

  // getBevelDay funciona tanto con historial precalculado como con entrada cruda
  assert.deepEqual(getBevelDay(hist, lastDate), d29);
  assert.equal(getBevelDay({ sleep, vitals, workouts }, lastDate).recovery.score, d29.recovery.score);
});

test("computeBevelHistory no mezcla baselines RMSSD y SDNN cuando el día actual cambia de sensor", () => {
  const days = dateSeq("2026-10-25", 25);
  const vitals = {};
  const sleep = {};
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    sleep[d] = { min: 440 };
    vitals[d] = i < 24
      ? { hrv: 60, hrvKind: "rmssd", rhr: 54 }
      : { hrv: 120, hrvKind: "sdnn", rhr: 54 };
  }
  const last = days[24];
  const hist = computeBevelHistory({ sleep, vitals, today: last });
  const day = hist.byDate[last];
  assert.equal(day.recovery.biomarkers.hrv.kind, "sdnn");
  assert.equal(day.recovery.biomarkers.hrv.baseline.n, 0);
  assert.equal(day.recovery.biomarkers.hrv.baseline.status, "calibrating");
});

test("computeBevelHistory deriva hrDip desde awakeHr/sleepHr, usa sets sin setLog y escala volumen relativo", () => {
  const days = dateSeq("2026-11-01", 5);
  const sleep = {};
  const vitals = {};
  const setLog = {};
  const sets = {};

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    sleep[d] = { min: 450, inBedMin: 480, awakeMin: 15, deepMin: 80, remMin: 95, lightMin: 275, awakenings: 1 };
    vitals[d] = { awakeHr: 64, sleepHr: 52 }; // hrDip derivado = 18.75% (>= 10% → 100 pts)
  }

  // Día 0 y 1: volumen base en d1b1 (8 reps × 40 kg = 320 por serie)
  setLog[days[0]] = { d1: { d1b1: [{ reps: 8, load: "40 kg" }, { reps: 8, load: "40 kg" }] } };
  setLog[days[1]] = { d1: { d1b1: [{ reps: 8, load: "40 kg" }, { reps: 8, load: "40 kg" }] } };
  // Día 2: mayor volumen por serie (12 reps × 40 kg = 480 → factorVol sube hasta tope 1.4)
  setLog[days[2]] = { d1: { d1b1: [{ reps: 12, load: "40 kg" }, { reps: 12, load: "40 kg" }] } };
  // Día 3: solo casillas `sets` sin `setLog`
  sets[days[3]] = { d1: { d1a1: [true, true, true, true] } };

  const hist = computeBevelHistory({ sleep, vitals, setLog, sets, today: days[4] });
  assert.equal(hist.byDate[days[0]].sleep.coverage, 1);
  assert.ok(hist.byDate[days[0]].sleep.hrDip > 18);
  assert.ok(hist.byDate[days[2]].strain.muscularLoad > hist.byDate[days[1]].strain.muscularLoad);
  assert.ok(hist.byDate[days[3]].strain.muscularLoad > 0);
  assert.equal(hist.byDate[days[3]].strain.setsCount, 4);
});

test("computeSleepNeed reduce deuda cuando hay superávit de sueño y computeRecovery funciona con una sola señal biométrica", () => {
  const mixed = computeSleepNeed({
    sleepBaseMin: 450,
    recentNights: [
      { asleep: 390, need: 450 }, // +60 deuda
      { asleep: 510, need: 450 }, // -30 recuperación (0.5 × 60)
    ],
  });
  assert.equal(mixed.debt7dMin, 30);

  // Solo RHR (sin HRV) → sigue en mode biometric con renormalización y hrv missing
  const blRhr = { ready: true, status: "ready", n: 25, center: 55, spread: 2.0, low: 53, high: 57 };
  const rhrOnly = computeRecovery({ vitals: { rhr: 53 }, sleepScore: 80, baselines: { rhr: blRhr } });
  assert.equal(rhrOnly.mode, "biometric");
  assert.equal(rhrOnly.biomarkers.hrv.status, "missing");
  assert.equal(rhrOnly.biomarkers.rhr.status, "normal");
  assert.ok(rhrOnly.score >= 70);
});
