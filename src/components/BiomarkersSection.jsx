import { useMemo, useState } from "react";
import { Scale, Activity, HeartPulse, ChevronRight } from "lucide-react";
import { trendCard, seriesOf } from "../lib/metrics.js";
import { fmtShort } from "../lib/dates.js";
import { Card, SectionTitle, StatusDot } from "./ui.jsx";
import { MiniSparkline, trendPill } from "./TrendSparkline.jsx";
import { TrendDetailSheet } from "./TrendDetailSheet.jsx";

function fmtSigned(v, decimals = 1, unit = "") {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

const BIOMARKER_DEFS = {
  hrv: {
    id: "hrv90",
    label: "HRV",
    fullLabel: "Línea base HRV (90 d)",
    unit: "ms",
    polarity: "higherGood",
    icon: Activity,
    accent: "text-good",
    stroke: "var(--good)",
    fmtValue: (v) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "—"),
    fmtRange: (r) => (r ? `${r.low}–${r.high} ms` : "—"),
    fmtDelta: (d) => fmtSigned(d, 1, "ms"),
  },
  rhr: {
    id: "rhr90",
    label: "FC en reposo",
    fullLabel: "Línea base FC en reposo (90 d)",
    unit: "lpm",
    polarity: "lowerGood",
    icon: HeartPulse,
    accent: "text-warn",
    stroke: "var(--warn)",
    fmtValue: (v) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "—"),
    fmtRange: (r) => (r ? `${r.low}–${r.high} lpm` : "—"),
    fmtDelta: (d) => fmtSigned(d, 1, "lpm"),
  },
};

function findLatestWeight(vitals, health, selectedDate) {
  const vitalEntries = Object.entries(vitals || {})
    .filter(([k, v]) => (!selectedDate || k <= selectedDate) && v && typeof v === "object")
    .sort(([a], [b]) => b.localeCompare(a));

  for (const [date, v] of vitalEntries) {
    const raw = typeof v.weightKg === "number" && Number.isFinite(v.weightKg) && v.weightKg > 0
      ? v.weightKg
      : (typeof v.weight === "number" && Number.isFinite(v.weight) && v.weight > 0 ? v.weight : null);
    if (raw != null) return { value: raw, date, source: "vitals" };
  }

  const healthEntries = (Array.isArray(health) ? health : [])
    .filter((w) => w && !w.hidden && typeof w.weightKg === "number" && Number.isFinite(w.weightKg) && w.weightKg > 0)
    .sort((a, b) => String(b.weekStart || "").localeCompare(String(a.weekStart || "")));

  for (const w of healthEntries) {
    if (!selectedDate || !w.weekStart || w.weekStart <= selectedDate) {
      return { value: w.weightKg, date: w.weekStart || null, source: "health" };
    }
  }
  return null;
}

/**
 * Sección Biomarcadores: Peso y líneas base a 90 días (HRV y FC en reposo).
 */
export function BiomarkersSection({ vitals, health, selectedDate, todayKey }) {
  const [openDetail, setOpenDetail] = useState(null); // null | { metric, card }

  const hrv90 = useMemo(
    () => trendCard(seriesOf(vitals, "hrv"), selectedDate, { baselineDays: 90, sparkDays: 90 }),
    [vitals, selectedDate],
  );
  const rhr90 = useMemo(
    () => trendCard(seriesOf(vitals, "rhr"), selectedDate, { baselineDays: 90, sparkDays: 90 }),
    [vitals, selectedDate],
  );
  const latestWeight = useMemo(
    () => findLatestWeight(vitals, health, selectedDate),
    [vitals, health, selectedDate],
  );

  const baselineRows = [
    {
      key: "hrv",
      title: "Línea base HRV",
      metric: BIOMARKER_DEFS.hrv,
      card: hrv90,
      iconBg: "text-good",
    },
    {
      key: "rhr",
      title: "Línea base FC en reposo",
      metric: BIOMARKER_DEFS.rhr,
      card: rhr90,
      iconBg: "text-warn",
    },
  ];

  return (
    <div>
      <SectionTitle aside="Ventana de 90 días">Biomarcadores</SectionTitle>
      <Card className="min-w-0">
        <ul className="divide-y divide-line">
          {/* Peso */}
          <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-accent">
                <Scale size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-fg">Peso</div>
                <div className="text-[11px] text-muted">
                  {latestWeight
                    ? (latestWeight.date
                      ? `${latestWeight.source === "health" ? "Sem. " : ""}${fmtShort(latestWeight.date)}`
                      : "Último registro")
                    : "Sin datos"}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <span className="font-mono text-sm font-bold text-fg tabular-nums">
                {latestWeight ? `${latestWeight.value.toFixed(1)} kg` : "—"}
              </span>
              <StatusDot tone={latestWeight ? "good" : "muted"}>
                {latestWeight ? "Registrado" : "Sin datos"}
              </StatusDot>
            </div>
          </li>

          {/* Líneas base 90 días: HRV y FC en reposo */}
          {baselineRows.map(({ key, title, metric, card, iconBg }) => {
            const Icon = metric.icon;
            const pill = trendPill(card.status, metric.polarity);
            const hasVal = typeof card.value === "number" && Number.isFinite(card.value);
            const rangeText = card.range
              ? `Rango 90 d: ${metric.fmtRange(card.range)}`
              : card.status === "calibrating"
                ? "Calibrando (<7 d)"
                : "Sin línea base 90 d";

            return (
              <li key={key} className="py-2.5 last:pb-0">
                <button
                  type="button"
                  onClick={() => setOpenDetail({ metric, card })}
                  className="flex w-full min-w-0 flex-col gap-2 rounded-xl px-1 py-1 text-left transition hover:bg-white/[0.05] sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2 sm:flex-1">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.07] ${iconBg}`}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-fg">{title}</div>
                        <div className="truncate font-mono text-[11px] text-muted tabular-nums">
                          {rangeText}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
                      <span className="font-mono text-sm font-bold text-fg tabular-nums">
                        {hasVal ? `${metric.fmtValue(card.value)} ${metric.unit}` : "—"}
                      </span>
                      <ChevronRight size={15} className="text-muted" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:shrink-0">
                    <div className="min-w-0 flex-1 sm:w-32 sm:flex-none">
                      <MiniSparkline
                        spark={card.spark}
                        range={card.range}
                        stroke={metric.stroke}
                        height={30}
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="hidden font-mono text-sm font-bold text-fg tabular-nums sm:inline">
                        {hasVal ? `${metric.fmtValue(card.value)} ${metric.unit}` : "—"}
                      </span>
                      <StatusDot tone={pill.tone === "plain" ? "muted" : pill.tone}>{pill.text}</StatusDot>
                      <ChevronRight size={15} className="hidden text-muted sm:inline" aria-hidden="true" />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {openDetail && (
          <TrendDetailSheet
            metric={openDetail.metric}
            card={openDetail.card}
            selectedDate={selectedDate}
            todayKey={todayKey}
            windowDays={90}
            onClose={() => setOpenDetail(null)}
          />
        )}
      </Card>
    </div>
  );
}
