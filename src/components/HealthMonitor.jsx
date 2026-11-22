import { useMemo, useState } from "react";
import { Wind, HeartPulse, Activity, Droplets, Thermometer, Moon, Zap, ChevronRight } from "lucide-react";
import { trendCard, seriesOf, dailyStress } from "../lib/metrics.js";
import { Chip } from "./ui.jsx";
import { RangeMiniBar, MiniSparkline, trendPill } from "./TrendSparkline.jsx";
import { TrendDetailSheet } from "./TrendDetailSheet.jsx";

function fmtHMShort(min) {
  if (typeof min !== "number" || !Number.isFinite(min) || min <= 0) return "—";
  const t = Math.round(min);
  const h = Math.floor(t / 60);
  const m = t % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtSleepDelta(delta) {
  if (typeof delta !== "number" || !Number.isFinite(delta)) return "—";
  const mins = Math.round(delta);
  if (mins === 0) return "0 min";
  const sign = mins > 0 ? "+" : "−";
  const abs = Math.abs(mins);
  if (abs < 60) return `${sign}${abs} min`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m ? `${sign}${h}h ${m}m` : `${sign}${h}h`;
}

function fmtSigned(v, decimals = 1, unit = "") {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

const MONITOR_METRICS = [
  {
    id: "resp",
    label: "FR",
    fullLabel: "Frecuencia respiratoria",
    unit: "rpm",
    polarity: "aboveWarn",
    icon: Wind,
    accent: "text-cool",
    stroke: "var(--cool)",
    fmtValue: (v) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(1) : "—"),
    fmtRange: (r) => (r ? `${r.low}–${r.high} rpm` : "—"),
    fmtDelta: (d) => fmtSigned(d, 1, "rpm"),
  },
  {
    id: "rhr",
    label: "FC en reposo",
    fullLabel: "FC en reposo",
    unit: "lpm",
    polarity: "lowerGood",
    icon: HeartPulse,
    accent: "text-warn",
    stroke: "var(--warn)",
    fmtValue: (v) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "—"),
    fmtRange: (r) => (r ? `${r.low}–${r.high} lpm` : "—"),
    fmtDelta: (d) => fmtSigned(d, 1, "lpm"),
  },
  {
    id: "hrv",
    label: "HRV",
    fullLabel: "Variabilidad cardíaca (HRV)",
    unit: "ms",
    polarity: "higherGood",
    icon: Activity,
    accent: "text-good",
    stroke: "var(--good)",
    fmtValue: (v) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "—"),
    fmtRange: (r) => (r ? `${r.low}–${r.high} ms` : "—"),
    fmtDelta: (d) => fmtSigned(d, 1, "ms"),
  },
  {
    id: "spo2",
    label: "SpO₂",
    fullLabel: "Saturación de oxígeno (SpO₂)",
    unit: "%",
    polarity: "higherGood",
    icon: Droplets,
    accent: "text-cool",
    stroke: "var(--cool)",
    fmtValue: (v) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(1) : "—"),
    fmtRange: (r) => (r ? `${r.low}–${r.high}%` : "—"),
    fmtDelta: (d) => `${d > 0 ? "+" : ""}${d.toFixed(1)}%`,
  },
  {
    id: "tempDev",
    label: "Temperatura",
    fullLabel: "Temperatura cutánea",
    unit: "°C",
    polarity: "aboveWarn",
    allowNegative: true,
    icon: Thermometer,
    accent: "text-accent",
    stroke: "var(--accent)",
    fmtValue: (v) => (typeof v === "number" && Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}` : "—"),
    fmtRange: (r) => (r ? `${r.low >= 0 ? "+" : ""}${r.low.toFixed(2)} a ${r.high >= 0 ? "+" : ""}${r.high.toFixed(2)} °C` : "—"),
    fmtDelta: (d) => fmtSigned(d, 2, "°C"),
  },
  {
    id: "sleep",
    label: "Sueño",
    fullLabel: "Duración de sueño",
    kind: "sleep",
    unit: "",
    polarity: "higherGood",
    icon: Moon,
    accent: "text-cool",
    stroke: "var(--cool)",
    fmtValue: fmtHMShort,
    fmtRange: (r) => (r ? `${fmtHMShort(r.low)}–${fmtHMShort(r.high)}` : "—"),
    fmtDelta: fmtSleepDelta,
  },
];

const STRESS_METRIC = {
  id: "stress",
  label: "Estrés",
  fullLabel: "Estrés diario",
  unit: "pts",
  polarity: "lowerGood",
  icon: Zap,
  accent: "text-accent",
  stroke: "var(--accent)",
  fmtValue: (v) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "—"),
  fmtRange: (r) => (r ? `${Math.round(r.low)}–${Math.round(r.high)} pts` : "—"),
  fmtDelta: (d) => fmtSigned(d, 1, "pts"),
};

const STRESS_BADGE = Object.freeze({
  low: { label: "Bajo", tone: "good", textCls: "text-good" },
  medium: { label: "Medio", tone: "accent", textCls: "text-accent" },
  high: { label: "Alto", tone: "warn", textCls: "text-warn" },
  missing: { label: "Sin datos", tone: "plain", textCls: "text-muted" },
});

/**
 * Monitor de salud (cuadrícula de 6 tarjetas de tendencia) y tarjeta de Estrés diario.
 */
export function HealthMonitor({ vitals, sleep, bevelHistory, selectedDate, todayKey }) {
  const [openDetail, setOpenDetail] = useState(null); // { metric, card } | null

  const hrvSeries = useMemo(() => seriesOf(vitals, "hrv"), [vitals]);
  const seriesMap = useMemo(() => ({
    resp: seriesOf(vitals, "resp"),
    rhr: seriesOf(vitals, "rhr"),
    hrv: hrvSeries,
    spo2: seriesOf(vitals, "spo2"),
    tempDev: seriesOf(vitals, "tempDev"),
    sleep: seriesOf(sleep, "min"),
  }), [vitals, sleep, hrvSeries]);

  const cards = useMemo(() => {
    const out = {};
    for (const m of MONITOR_METRICS) {
      out[m.id] = trendCard(seriesMap[m.id], selectedDate);
    }
    return out;
  }, [seriesMap, selectedDate]);

  const prefs = bevelHistory?.prefs || {};
  const stress = useMemo(
    () => dailyStress(vitals?.[selectedDate], {
      age: prefs.age ?? null,
      maxHr: prefs.maxHr ?? null,
      hrvRange: cards.hrv?.range || null,
    }),
    [vitals, selectedDate, prefs.age, prefs.maxHr, cards.hrv],
  );

  const stressSeries = useMemo(() => {
    const out = {};
    for (const [k, vDay] of Object.entries(vitals || {})) {
      if (!vDay || typeof vDay !== "object") continue;
      const hrvCardDay = trendCard(hrvSeries, k);
      const res = dailyStress(vDay, {
        age: prefs.age ?? null,
        maxHr: prefs.maxHr ?? null,
        hrvRange: hrvCardDay.range,
      });
      if (typeof res.score === "number" && Number.isFinite(res.score)) {
        out[k] = res.score;
      }
    }
    return out;
  }, [vitals, hrvSeries, prefs.age, prefs.maxHr]);

  const stressTrend = useMemo(
    () => trendCard(stressSeries, selectedDate),
    [stressSeries, selectedDate],
  );

  const stressLevelMeta = STRESS_BADGE[stress.level] || STRESS_BADGE.missing;
  const stressTrendPill = trendPill(stressTrend.status, "lowerGood");
  const hasStressScore = typeof stress.score === "number" && Number.isFinite(stress.score);

  return (
    <div className="space-y-4">
      {/* Monitor de salud: cuadrícula 2 columnas */}
      <section className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-fg">
            Monitor de salud
          </h2>
          <span className="text-[11px] text-muted">Toca para ver 30 d</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {MONITOR_METRICS.map((m) => {
            const Icon = m.icon;
            const card = cards[m.id];
            const pill = trendPill(card.status, m.polarity);
            const hasVal = typeof card.value === "number" && Number.isFinite(card.value);
            const rangeHint = card.range
              ? m.fmtRange(card.range)
              : card.status === "calibrating"
                ? "Calibrando (<7 d)"
                : "Sin línea base";

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setOpenDetail({ metric: m, card })}
                className="flex min-w-0 flex-col justify-between gap-2 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-accent/50 hover:bg-surface2/40 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-xs font-semibold text-muted">{m.label}</span>
                  <Icon size={15} className={`shrink-0 ${m.accent}`} aria-hidden="true" />
                </div>

                <div className="flex flex-wrap items-baseline gap-1">
                  <span className="font-display text-2xl font-semibold leading-none text-fg tabular-nums sm:text-3xl">
                    {m.fmtValue(card.value)}
                  </span>
                  {hasVal && m.unit && (
                    <span className="text-[11px] font-medium text-muted">{m.unit}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="min-w-0">
                    <Chip tone={pill.tone}>{pill.text}</Chip>
                  </div>
                  <RangeMiniBar
                    value={card.value}
                    range={card.range}
                    status={card.status}
                    polarity={m.polarity}
                  />
                  <div className="truncate font-mono text-[10px] text-muted tabular-nums">
                    {rangeHint}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Tarjeta Estrés diario */}
      <button
        type="button"
        onClick={() => setOpenDetail({ metric: STRESS_METRIC, card: stressTrend })}
        className="block w-full min-w-0 rounded-2xl border border-line bg-surface p-3.5 text-left transition hover:border-accent/50 hover:bg-surface2/40 active:scale-[0.99] sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className={stressLevelMeta.textCls} aria-hidden="true" />
            <h2 className="font-display text-base font-semibold uppercase tracking-wide text-fg">
              Estrés
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Chip tone={stressLevelMeta.tone}>{stressLevelMeta.label}</Chip>
            <ChevronRight size={15} className="text-muted" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className={`font-display text-3xl font-semibold leading-none tabular-nums ${stressLevelMeta.textCls}`}>
              {hasStressScore ? stress.score : "—"}
            </span>
            <span className="font-mono text-xs text-muted">/ 100</span>
            {typeof stress.sleepScore === "number" && Number.isFinite(stress.sleepScore) && (
              <span className="ml-2 font-mono text-[11px] text-muted tabular-nums">
                Nocturno {stress.sleepScore}
              </span>
            )}
          </div>

          <div className="w-28 shrink-0 sm:w-36">
            <MiniSparkline
              spark={stressTrend.spark}
              range={stressTrend.range}
              stroke="var(--accent)"
              height={32}
            />
          </div>
        </div>

        {/* Barra de 3 niveles: bajo (<30), medio (30-60), alto (>60) */}
        <div className="relative mt-3 flex h-2 w-full overflow-hidden rounded-full bg-surface2" aria-hidden="true">
          <div className="h-full bg-good/30" style={{ width: "30%" }} />
          <div className="h-full border-x border-surface bg-accent/30" style={{ width: "30%" }} />
          <div className="h-full bg-warn/30" style={{ width: "40%" }} />
          {hasStressScore && (
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg ring-2 ring-surface"
              style={{ left: `${Math.max(3, Math.min(97, stress.score))}%` }}
            />
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          {hasStressScore ? (
            <>
              <span>Tendencia: {stressTrendPill.text}</span>
              <span className="font-mono tabular-nums">
                {typeof stressTrend.changes?.d7 === "number" && Number.isFinite(stressTrend.changes.d7)
                  ? `7 d: ${fmtSigned(stressTrend.changes.d7, 1, "pts")}`
                  : "Bandas <30 bajo · 30–60 medio · >60 alto"}
              </span>
            </>
          ) : (
            <span>Necesita FC despierto y FC en reposo de Fitbit para calcular el puntaje diario.</span>
          )}
        </div>
      </button>

      {openDetail && (
        <TrendDetailSheet
          metric={openDetail.metric}
          card={openDetail.card}
          selectedDate={selectedDate}
          todayKey={todayKey}
          windowDays={30}
          onClose={() => setOpenDetail(null)}
        />
      )}
    </div>
  );
}
