import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  SCOPES,
  METRICS_SCOPE,
  toWorkout,
  sinceDate,
  main,
  toSleep,
  applySleep,
  extractSleepWindows,
  computeHrDip,
  fetchVitals,
  applyVitals,
} from "../scripts/google-health.mjs";
import { FITBIT_SCOPES, CALENDAR_SCOPES } from "../scripts/google-health-auth.mjs";

// Forma tomada del ejemplo oficial de la Google Health API.
const walk = {
  name: "users/1/dataTypes/exercise/dataPoints/88",
  dataSource: { recordingMethod: "MANUAL", platform: "FITBIT" },
  exercise: {
    interval: { startTime: "2026-11-12T12:40:00Z", startUtcOffset: "-21600s", endTime: "2026-11-12T13:15:00Z", endUtcOffset: "-21600s" },
    exerciseType: "WALKING",
    metricsSummary: { caloriesKcal: 120, distanceMillimiters: 3218688, steps: "4100" },
    displayName: "Walk",
    activeDuration: "1920s",
  },
};
const lift = { exercise: { interval: { startTime: "2026-11-11T23:00:00Z", endTime: "2026-11-11T23:45:00Z" }, exerciseType: "WEIGHTLIFTING", displayName: "Weights" } };

test("toWorkout traduce un entreno de Google Health al formato de la app y extrae métricas enriquecidas", () => {
  assert.deepEqual(toWorkout(walk), {
    id: "2026-11-12T12:40-walk",
    type: "Caminata",
    kind: "walk",
    start: "2026-11-12T12:40:00.000Z",
    end: "2026-11-12T13:15:00.000Z",
    min: 32,
    source: "google",
    km: 3.22,
    kcal: 120,
  });
  const w = toWorkout(lift);
  assert.deepEqual([w.kind, w.type, w.min, "km" in w, "avgHr" in w, "zones" in w], ["strength", "Pesas", 45, false, false, false]);
  assert.equal(toWorkout({ exercise: { interval: { startTime: "2026-11-10T12:00:00Z" }, exerciseType: "INDOOR_BIKING" } }).kind, "bike");
  assert.equal(toWorkout({ exercise: { interval: { startTime: "2026-11-10T12:00:00Z" }, exerciseType: "TREADMILL_RUNNING" } }).kind, "run");
  assert.equal(toWorkout({ exercise: { interval: {} } }), null);
  assert.equal(toWorkout({}), null);

  const runEnriched = {
    exercise: {
      interval: { startTime: "2026-11-21T12:40:00Z", endTime: "2026-11-21T13:18:00Z" },
      exerciseType: "RUNNING",
      activeDuration: "2280s",
      metricsSummary: {
        distanceMillimeters: 5400000,
        averageHeartRateBeatsPerMinute: "152.4",
        activeZoneMinutes: "44",
        caloriesKcal: 360.2,
        heartRateZoneDurations: {
          lightTime: "480s",
          moderateTime: "840s",
          vigorousTime: "780s",
          peakTime: "180s",
        },
      },
    },
  };
  assert.deepEqual(toWorkout(runEnriched), {
    id: "2026-11-21T12:40-run",
    type: "Correr",
    kind: "run",
    start: "2026-11-21T12:40:00.000Z",
    end: "2026-11-21T13:18:00.000Z",
    min: 38,
    source: "google",
    km: 5.4,
    avgHr: 152,
    azm: 44,
    kcal: 360,
    zones: { light: 8, moderate: 14, vigorous: 13, peak: 3 },
  });

  // Zonas en cero no se adjuntan para no engañar el cálculo de Strain.
  const zeroZones = toWorkout({
    exercise: {
      interval: { startTime: "2026-11-21T10:00:00Z", endTime: "2026-11-21T10:30:00Z" },
      exerciseType: "WALKING",
      metricsSummary: { heartRateZoneDurations: { lightTime: "0s", moderateTime: "0s" } },
    },
  });
  assert.equal("zones" in zeroZones, false);
});

test("sinceDate usa el último entreno de Google con margen, o 60 días la primera vez", () => {
  const now = new Date("2026-11-12T20:00:00Z");
  assert.equal(sinceDate([], now), "2026-09-13");
  assert.equal(sinceDate([{ start: "2026-11-11T00:00:00.000Z", source: "google" }, { start: "2026-11-12T00:00:00.000Z" }], now), "2026-11-08");
});

function fakeFetch({ pages = [[walk, lift]], tokenOk = true } = {}) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url.includes("oauth2.googleapis.com")) {
      return tokenOk
        ? { ok: true, json: async () => ({ access_token: "acc" }) }
        : { ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) };
    }
    const tok = new URL(url).searchParams.get("pageToken");
    const i = tok ? Number(tok) : 0;
    return { ok: true, json: async () => ({ dataPoints: pages[i] || [], nextPageToken: i + 1 < pages.length ? String(i + 1) : "" }) };
  };
  fn.calls = calls;
  return fn;
}

const env = { GOOGLE_HEALTH_CLIENT_ID: "id", GOOGLE_HEALTH_CLIENT_SECRET: "s", GOOGLE_HEALTH_REFRESH_TOKEN: "r" };

test("main pagina, fusiona en data.json sin tocar otras claves y no duplica", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-gh-"));
  fs.writeFileSync(path.join(root, "data.json"), JSON.stringify({ habits: { v: {}, at: 1 } }));
  const now = new Date("2026-11-12T20:00:00Z");
  const f = fakeFetch({ pages: [[walk], [lift]] });
  const res = await main({ root, now, env, fetchImpl: f });
  assert.deepEqual([res.points, res.added, res.total], [2, 2, 2]);
  const api = f.calls.filter((c) => c.url.includes("/dataTypes/exercise/"));
  assert.equal(api.length, 2);
  assert.equal(api[0].opts.headers.Authorization, "Bearer acc");
  assert.match(new URL(api[0].url).searchParams.get("filter"), /^exercise\.interval\.civil_start_time >= "2026-09-13"$/);
  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.deepEqual(data.habits, { v: {}, at: 1 });
  assert.equal(data.workouts.v.length, 2);
  const again = await main({ root, now, env, fetchImpl: fakeFetch() });
  assert.deepEqual([again.added, again.total], [0, 2]);
});

test("main explica cómo reautorizar si Google rechaza el token, y sale tranquilo sin secretos", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-gh-"));
  await assert.rejects(main({ root, env, fetchImpl: fakeFetch({ tokenOk: false }) }), /google-health-auth\.mjs/);
  assert.deepEqual(await main({ root, env: {} }), { skipped: true });
});

const night = (o = {}) => ({
  sleep: {
    interval: {
      startTime: "2026-11-15T04:40:00Z", endTime: "2026-11-15T12:10:00Z", startUtcOffset: "-21600s", endUtcOffset: "-21600s",
      civilStartTime: { date: { year: 2026, month: 11, day: 14 }, time: { hours: 22, minutes: 40 } },
      civilEndTime: { date: { year: 2026, month: 11, day: 15 }, time: { hours: 6, minutes: 10 } },
    },
    summary: { minutesAsleep: "418" },
    metadata: { mainSleep: true },
    ...o,
  },
});

test("toSleep usa el día en que despertaste, la hora civil y descarta siestas", () => {
  assert.deepEqual(toSleep(night()), { date: "2026-11-15", min: 418, bed: "22:40", wake: "06:10" });
  assert.equal(toSleep(night({ metadata: { nap: true } })), null);
  assert.equal(toSleep({ exercise: {} }), null);
  const noCivil = night();
  delete noCivil.sleep.interval.civilStartTime;
  delete noCivil.sleep.interval.civilEndTime;
  assert.deepEqual(toSleep(noCivil), { date: "2026-11-15", min: 418, bed: "22:40", wake: "06:10" });
});

test("toSleep soporta fases STAGES, registros CLASSIC y calcula eff en 0..1", () => {
  // STAGES (arreglo oficial v4)
  const stages = night({
    type: "STAGES",
    summary: {
      minutesAsleep: "432",
      minutesInSleepPeriod: "453",
      minutesAwake: "21",
      stagesSummary: [
        { type: "AWAKE", minutes: "21", count: "2" },
        { type: "LIGHT", minutes: "244", count: "18" },
        { type: "DEEP", minutes: "86", count: "6" },
        { type: "REM", minutes: "102", count: "8" },
      ],
    },
  });
  assert.deepEqual(toSleep(stages), {
    date: "2026-11-15",
    min: 432,
    bed: "22:40",
    wake: "06:10",
    inBedMin: 453,
    eff: 0.954,
    awakeMin: 21,
    deepMin: 86,
    remMin: 102,
    lightMin: 244,
    awakenings: 2,
  });

  // STAGES en forma objeto + fallback de awakenings desde stages[]
  const stagesObj = night({
    summary: {
      minutesAsleep: 400,
      minutesInSleepPeriod: 440,
      stagesSummary: { deep: 80, rem: 95, light: 225, awake: 40 },
    },
    stages: [{ type: "LIGHT" }, { type: "AWAKE" }, { type: "REM" }, { type: "AWAKE" }, { type: "DEEP" }],
  });
  assert.deepEqual(toSleep(stagesObj), {
    date: "2026-11-15",
    min: 400,
    bed: "22:40",
    wake: "06:10",
    inBedMin: 440,
    eff: 0.909,
    awakeMin: 40,
    deepMin: 80,
    remMin: 95,
    lightMin: 225,
    awakenings: 2,
  });

  // CLASSIC (sin deep/rem/light, pero conserva inBedMin, awakeMin, awakenings y eff)
  const classic = night({
    type: "CLASSIC",
    summary: {
      minutesAsleep: "390",
      minutesInSleepPeriod: "420",
      minutesAwake: "30",
      stagesSummary: [
        { type: "ASLEEP", minutes: "390", count: "4" },
        { type: "AWAKE", minutes: "18", count: "3" },
        { type: "RESTLESS", minutes: "12", count: "5" },
      ],
    },
  });
  const c = toSleep(classic);
  assert.deepEqual(c, {
    date: "2026-11-15",
    min: 390,
    bed: "22:40",
    wake: "06:10",
    inBedMin: 420,
    eff: 0.929,
    awakeMin: 30,
    awakenings: 3,
  });
  assert.equal("deepMin" in c, false);
  assert.equal("remMin" in c, false);
  assert.equal("lightMin" in c, false);
});

test("applySleep guarda la noche más larga por día, poda a 60 días y solo reescribe data.json si cambió", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-sl-"));
  fs.writeFileSync(path.join(root, "data.json"), JSON.stringify({ habits: { v: {}, at: 1 } }));
  const now = new Date("2026-11-16T12:00:00Z");
  const r = applySleep({ root, now, incoming: [
    { date: "2026-11-15", min: 300, bed: "01:00", wake: "06:00" },
    { date: "2026-11-15", min: 418, bed: "22:40", wake: "06:10" },
    { date: "2026-08-01", min: 400, bed: "22:00", wake: "05:00" },
  ] });
  assert.deepEqual(r, { nights: 1, changed: true });
  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.deepEqual(data.sleep.v, { "2026-11-15": { min: 418, bed: "22:40", wake: "06:10" } });
  assert.deepEqual(data.habits, { v: {}, at: 1 });
  assert.equal(applySleep({ root, now: new Date("2026-11-16T13:00:00Z"), incoming: [] }).changed, false);
});

test("main sigue con los entrenos si Google niega el permiso de sueño", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-gh-"));
  const base = fakeFetch({ pages: [[walk]] });
  const f = async (url, opts) => (url.includes("/dataTypes/sleep/")
    ? { ok: false, status: 403, text: async () => "PERMISSION_DENIED" }
    : base(url, opts));
  const res = await main({ root, now: new Date("2026-11-12T20:00:00Z"), env, fetchImpl: f });
  assert.equal(res.added, 1);
  assert.equal(res.sleep, null);
});

test("main guarda el sueño en data.json", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-gh-"));
  const base = fakeFetch({ pages: [[walk]] });
  const calls = [];
  const f = async (url, opts) => (calls.push(url), url.includes("/dataTypes/sleep/")
    ? { ok: true, json: async () => ({ dataPoints: [night()] }) }
    : base(url, opts));
  const res = await main({ root, now: new Date("2026-11-16T12:00:00Z"), env, fetchImpl: f });
  assert.deepEqual(res.sleep, { nights: 1, changed: true });
  const sleepCall = calls.find((u) => u.includes("/dataTypes/sleep/"));
  assert.equal(new URL(sleepCall).searchParams.get("filter"), 'sleep.interval.civil_end_time >= "2026-11-02"'); // civil_start_time da 400 en sueño
  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.equal(data.sleep.v["2026-11-15"].min, 418);
});

test("computeHrDip calcula sleepHr, awakeHr y hrDip excluyendo sueño adyacente", () => {
  const sleep15 = night(); // 2026-11-14 22:40 -> 2026-11-15 06:10 (-6h) => 04:40Z -> 12:10Z
  const sleep16 = night({
    interval: {
      startTime: "2026-11-16T04:30:00Z", endTime: "2026-11-16T12:00:00Z", startUtcOffset: "-21600s", endUtcOffset: "-21600s",
      civilStartTime: { date: { year: 2026, month: 11, day: 15 }, time: { hours: 22, minutes: 30 } },
      civilEndTime: { date: { year: 2026, month: 11, day: 16 }, time: { hours: 6, minutes: 0 } },
    },
  });
  const windows = extractSleepWindows([sleep15, sleep16]);
  const hrPoints = [
    // Durante sueño del 15 (promedio 51.4)
    { startTime: "2026-11-15T06:00:00Z", endTime: "2026-11-15T06:15:00Z", heartRate: { beatsPerMinuteAvg: 50.8 } },
    { startTime: "2026-11-15T09:00:00Z", endTime: "2026-11-15T09:15:00Z", heartRate: { beatsPerMinuteAvg: 52.0 } },
    // Durante vigilia del 15 (promedio 63.8)
    { heartRate: { sampleTime: "2026-11-15T15:00:00Z", beatsPerMinute: "61.6" } },
    { heartRate: { sampleTime: "2026-11-15T20:00:00Z", beatsPerMinute: "66.0" } },
    // Ya durmiendo la noche del 16 (23:00 local del 15 = 05:00Z del 16): NO debe contaminar awakeHr del 15
    { heartRate: { sampleTime: "2026-11-16T05:00:00Z", beatsPerMinute: "48" } },
  ];
  const dips = computeHrDip(hrPoints, windows);
  assert.deepEqual(dips["2026-11-15"], {
    sleepHr: 51.4,
    awakeHr: 63.8,
    hrDip: 19.4,
  });
  // El 16 no tiene muestras de vigilia todavía: no inventa hrDip.
  assert.equal("2026-11-16" in dips, false);
});

test("fetchVitals extrae todas las señales, usa fallbacks y nunca incluye series crudas de FC", async () => {
  const sleepPts = [night()];
  const now = new Date("2026-11-16T02:00:00Z");
  const f = async (url, opts = {}) => {
    if (url.includes("/daily-heart-rate-variability/")) {
      return { ok: true, json: async () => ({ dataPoints: [
        { dailyHeartRateVariability: { date: { year: 2026, month: 11, day: 15 }, averageHeartRateVariabilityMilliseconds: 64.24 } },
      ] }) };
    }
    if (url.includes("/daily-resting-heart-rate/")) {
      return { ok: true, json: async () => ({ dataPoints: [
        { dailyRestingHeartRate: { date: { year: 2026, month: 11, day: 15 }, beatsPerMinute: "53" } },
      ] }) };
    }
    if (url.includes("/daily-respiratory-rate/")) {
      return { ok: false, status: 404, text: async () => "NOT_FOUND" };
    }
    if (url.includes("/respiratory-rate-sleep-summary/")) {
      return { ok: true, json: async () => ({ dataPoints: [
        { respiratoryRateSleepSummary: { sampleTime: "2026-11-15T12:10:00Z", sampleUtcOffset: "-21600s", fullSleepSummary: { breathsPerMinute: 14.12 } } },
      ] }) };
    }
    if (url.includes("/daily-oxygen-saturation/")) {
      return { ok: true, json: async () => ({ dataPoints: [
        { dailyOxygenSaturation: { date: { year: 2026, month: 11, day: 15 }, averagePercentage: 97.5 } },
      ] }) };
    }
    if (url.includes("/daily-sleep-temperature-derivations/")) {
      return { ok: true, json: async () => ({ dataPoints: [
        { dailySleepTemperatureDerivations: { date: { year: 2026, month: 11, day: 15 }, nightlyTemperatureCelsius: 34.05, baselineTemperatureCelsius: 33.95 } },
        { dailySleepTemperatureDerivations: { date: { year: 2026, month: 11, day: 14 }, relativeTemperatureCelsius: -0.25 } },
      ] }) };
    }
    if (url.includes("/steps/dataPoints:dailyRollUp")) {
      return { ok: true, json: async () => ({ rollupDataPoints: [
        { civilStartTime: { date: { year: 2026, month: 11, day: 15 } }, steps: { countSum: "8420" } },
      ] }) };
    }
    if (url.includes("/active-zone-minutes/dataPoints:dailyRollUp")) {
      // Simula fallback a GET /dataPoints agregando por día civil
      return { ok: false, status: 404, text: async () => "NOT_FOUND" };
    }
    if (url.includes("/active-zone-minutes/dataPoints?")) {
      return { ok: true, json: async () => ({ dataPoints: [
        { activeZoneMinutes: { interval: { civilStartTime: { date: { year: 2026, month: 11, day: 15 } } }, activeZoneMinutes: "20" } },
        { activeZoneMinutes: { interval: { civilStartTime: { date: { year: 2026, month: 11, day: 15 } } }, activeZoneMinutes: "26" } },
      ] }) };
    }
    if (url.includes("/heart-rate/dataPoints:rollUp")) {
      return { ok: true, json: async () => ({ rollupDataPoints: [
        { startTime: "2026-11-15T06:00:00Z", endTime: "2026-11-15T06:15:00Z", heartRate: { beatsPerMinuteAvg: 51.4 } },
        { startTime: "2026-11-15T18:00:00Z", endTime: "2026-11-15T18:15:00Z", heartRate: { beatsPerMinuteAvg: 63.8 } },
      ] }) };
    }
    return { ok: true, json: async () => ({ dataPoints: [] }) };
  };

  const { vitals, warnings } = await fetchVitals(f, "acc", "2026-11-02", { now, sleepPoints: sleepPts });
  assert.equal(warnings.length, 0);
  assert.deepEqual(vitals["2026-11-15"], {
    hrv: 64.2,
    hrvKind: "rmssd",
    rhr: 53,
    resp: 14.1,
    spo2: 97.5,
    tempDev: 0.1,
    steps: 8420,
    azm: 46,
    sleepHr: 51.4,
    awakeHr: 63.8,
    hrDip: 19.4,
    src: "google",
  });
  assert.deepEqual(vitals["2026-11-14"], { tempDev: -0.25, src: "google" });
  // Ninguna serie cruda intradía debe existir en el resultado.
  assert.equal("samples" in vitals["2026-11-15"], false);
  assert.equal("heartRate" in vitals["2026-11-15"], false);
});

test("fetchVitals y main degradan con elegancia ante 403/404 sin romper entrenos ni sueño", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-vit-"));
  const now = new Date("2026-11-16T12:00:00Z");
  const f = async (url) => {
    if (url.includes("oauth2.googleapis.com")) return { ok: true, json: async () => ({ access_token: "acc" }) };
    if (url.includes("/dataTypes/exercise/")) return { ok: true, json: async () => ({ dataPoints: [walk] }) };
    if (url.includes("/dataTypes/sleep/")) return { ok: true, json: async () => ({ dataPoints: [night()] }) };
    if (url.includes("/steps/dataPoints:dailyRollUp")) {
      return { ok: true, json: async () => ({ rollupDataPoints: [
        { civilStartTime: { date: { year: 2026, month: 11, day: 15 } }, steps: { countSum: "7100" } },
      ] }) };
    }
    if (url.includes("/active-zone-minutes/")) return { ok: false, status: 404, text: async () => "NOT_FOUND" };
    // Todos los endpoints de health_metrics devuelven 403 (aún no se otorga el scope nuevo)
    return { ok: false, status: 403, text: async () => "PERMISSION_DENIED" };
  };

  const res = await main({ root, now, env, fetchImpl: f });
  assert.equal(res.added, 1);
  assert.equal(res.sleep.nights, 1);
  assert.equal(res.vitals.days, 1);
  assert.ok(res.vitals.warnings.some((w) => w.status === 403));
  assert.ok(res.vitals.warnings.some((w) => w.status === 404));

  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.equal(data.workouts.v.length, 1);
  assert.equal(data.sleep.v["2026-11-15"].min, 418);
  assert.deepEqual(data.vitals.v["2026-11-15"], { steps: 7100, src: "google" });

  // Verifica que health/vitals.json existe y no guarda crudos intradía.
  const storedVitals = JSON.parse(fs.readFileSync(path.join(root, "health", "vitals.json"), "utf8"));
  assert.deepEqual(storedVitals, { "2026-11-15": { steps: 7100, src: "google" } });
});

test("applyVitals mezcla por campo sin borrar previos, poda a 90 días y omite reescritura sin cambios", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-v90-"));
  const now = new Date("2026-11-21T12:00:00Z");
  const r1 = applyVitals({
    root,
    now,
    incoming: {
      "2026-11-20": { hrv: 60.5, hrvKind: "rmssd", rhr: 54, src: "google" },
      "2026-07-01": { rhr: 58, src: "google" }, // > 90 días atrás: debe podarse
    },
  });
  assert.deepEqual(r1, { days: 1, changed: true });

  // Actualización parcial solo con steps conserva hrv y rhr previos
  const r2 = applyVitals({
    root,
    now,
    incoming: {
      "2026-11-20": { steps: 9100, src: "google" },
    },
  });
  assert.deepEqual(r2, { days: 1, changed: true });
  const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
  assert.deepEqual(data.vitals.v["2026-11-20"], {
    hrv: 60.5,
    hrvKind: "rmssd",
    rhr: 54,
    steps: 9100,
    src: "google",
  });
  assert.equal("2026-07-01" in data.vitals.v, false);

  // Sin cambios: no reescribe data.json
  const r3 = applyVitals({ root, now, incoming: { "2026-11-20": { steps: 9100, src: "google" } } });
  assert.deepEqual(r3, { days: 1, changed: false });
});

test("main con --dry-run no escribe health/*.json ni data.json", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-dry-"));
  const now = new Date("2026-11-16T12:00:00Z");
  const base = fakeFetch({ pages: [[walk]] });
  const f = async (url, opts) => (url.includes("/dataTypes/sleep/")
    ? { ok: true, json: async () => ({ dataPoints: [night()] }) }
    : base(url, opts));
  const res = await main({ root, now, env, fetchImpl: f, argv: ["--dry-run"] });
  assert.equal(res.dryRun, true);
  assert.equal(res.points, 1);
  assert.equal(res.sleep.nights, 1);
  assert.equal(fs.existsSync(path.join(root, "data.json")), false);
  assert.equal(fs.existsSync(path.join(root, "health", "workouts.json")), false);
  assert.equal(fs.existsSync(path.join(root, "health", "sleep.json")), false);
  assert.equal(fs.existsSync(path.join(root, "health", "vitals.json")), false);
});

test("google-health-auth incluye el scope de vitals en Fitbit y mantiene Calendar separado", () => {
  assert.equal(METRICS_SCOPE, "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly");
  assert.equal(FITBIT_SCOPES, SCOPES);
  const fitbit = FITBIT_SCOPES.split(" ");
  const cal = CALENDAR_SCOPES.split(" ");
  assert.ok(fitbit.includes("https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly"));
  assert.ok(fitbit.includes("https://www.googleapis.com/auth/googlehealth.sleep.readonly"));
  assert.ok(fitbit.includes(METRICS_SCOPE));
  assert.ok(fitbit.every((s) => !s.includes("calendar")));
  assert.ok(cal.every((s) => !s.includes("googlehealth")));
});
