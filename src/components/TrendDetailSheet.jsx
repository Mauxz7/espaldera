import { useId } from "react";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TREND_WINDOWS } from "../lib/metrics.js";
import { fmtShort } from "../lib/dates.js";
import { StatusDot } from "./ui.jsx";
import { SheetDialog } from "./SheetDialog.jsx";
import { RangeMiniBar, trendPill, deltaClass } from "./TrendSparkline.jsx";
import { formatDayLabel } from "./HealthRings.jsx";

const TOOLTIP_STYLE = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--fg)", fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--fg)" },
  cursor: { stroke: "var(--line)" },
};

const AXIS_TICK = { fill: "var(--muted)", fontSize: 11 };

const WINDOW_LABELS = Object.freeze({
  3: "3 días",
  7: "7 días",
  14: "14 días",
  30: "30 días",
  90: "90 días",
});

/**
 * Hoja modal de detalle de tendencia: valor actual, banda normal, sparkline (30 o 90 d)
 * y tabla de cambios 3/7/14/30/90 días (`trendCard`).
 */
export function TrendDetailSheet({
  metric,
  card,
  selectedDate,
  todayKey,
  windowDays = 30,
  onClose,
}) {
  const changesTitleId = useId();
  if (!metric || !card) return null;

  const isSleep = metric.kind === "sleep";
  const pill = trendPill(card.status, metric.polarity);
  const lineStroke = metric.stroke || "var(--accent)";

  const chartData = (card.spark || []).map((pt) => {
    const hasVal = typeof pt?.value === "number" && Number.isFinite(pt.value);
    return {
      date: pt?.date || "",
      label: pt?.date ? fmtShort(pt.date) : "",
      raw: hasVal ? pt.value : null,
      plot: hasVal ? (isSleep ? +(pt.value / 60).toFixed(2) : pt.value) : null,
    };
  });

  const hasChartPoints = chartData.some((d) => d.plot != null);

  const hasRange = card.range
    && typeof card.range.low === "number" && Number.isFinite(card.range.low)
    && typeof card.range.high === "number" && Number.isFinite(card.range.high);

  const bandLow = hasRange ? (isSleep ? +(card.range.low / 60).toFixed(2) : card.range.low) : null;
  const bandHigh = hasRange ? (isSleep ? +(card.range.high / 60).toFixed(2) : card.range.high) : null;

  const yDomain = (() => {
    const vals = [];
    for (const d of chartData) if (d.plot != null) vals.push(d.plot);
    if (bandLow != null && bandHigh != null) vals.push(bandLow, bandHigh);
    if (!vals.length) return [0, 100];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const minPad = isSleep ? 0.5 : metric.id === "tempDev" ? 0.2 : 1;
    const pad = Math.max((max - min) * 0.18, minPad);
    const lo = metric.allowNegative ? min - pad : Math.max(0, min - pad);
    const hi = max + pad;
    return [Number(lo.toFixed(2)), Number(hi.toFixed(2))];
  })();

  const formatYAxis = (v) => {
    if (isSleep) return `${Math.round(v * 10) / 10}h`;
    if (metric.id === "tempDev") return `${v >= 0 ? "+" : ""}${Number(v).toFixed(1)}`;
    return String(Math.round(v * 10) / 10);
  };

  const rangeText = hasRange
    ? `Rango normal (${windowDays} d): ${metric.fmtRange(card.range)}`
    : "Calibrando: se necesitan al menos 7 días previos";

  return (
    <SheetDialog
      eyebrow={`Tendencia · ${windowDays} días`}
      icon={metric.icon}
      accent={metric.accent || "text-accent"}
      title={metric.fullLabel || metric.label}
      subtitle={formatDayLabel(selectedDate, todayKey)}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Valor actual, estado y minibarra de rango */}
        <section className="rounded-2xl bg-white/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-4xl font-bold leading-none text-fg tabular-nums">
                {metric.fmtValue(card.value)}
              </span>
              {card.value != null && metric.unit && (
                <span className="text-xs font-medium text-muted">{metric.unit}</span>
              )}
            </div>
            <StatusDot tone={pill.tone === "plain" ? "muted" : pill.tone}>{pill.text}</StatusDot>
          </div>
          <div className="mt-3">
            <RangeMiniBar
              value={card.value}
              range={card.range}
              status={card.status}
              polarity={metric.polarity}
              tall
            />
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">{rangeText}</p>
        </section>

        {/* Sparkline con banda normal */}
        <section className="rounded-2xl bg-white/[0.05] p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold tracking-tight text-fg">
              Últimos {windowDays} días
            </h3>
            {hasRange && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                <span className="h-2.5 w-3 rounded-sm border border-good/50 bg-good/20" />
                Banda normal
              </span>
            )}
          </div>
          {hasChartPoints ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    domain={yDomain}
                    tickFormatter={formatYAxis}
                  />
                  {bandLow != null && bandHigh != null && (
                    <ReferenceArea
                      y1={bandLow}
                      y2={bandHigh}
                      fill="var(--good)"
                      fillOpacity={0.14}
                      stroke="var(--good)"
                      strokeOpacity={0.35}
                      strokeDasharray="3 3"
                    />
                  )}
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    labelFormatter={(_lbl, payload) => {
                      const d = payload?.[0]?.payload?.date;
                      return d ? formatDayLabel(d, todayKey) : "";
                    }}
                    formatter={(_v, _n, item) => {
                      const raw = item?.payload?.raw;
                      const formatted = raw != null
                        ? `${metric.fmtValue(raw)}${metric.unit ? ` ${metric.unit}` : ""}`
                        : "—";
                      return [formatted, metric.label];
                    }}
                  />
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="plot"
                    name={metric.label}
                    stroke={lineStroke}
                    strokeWidth={2.5}
                    dot={windowDays <= 35 ? { r: 2, fill: lineStroke } : false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted">
              Sin lecturas en los últimos {windowDays} días.
            </p>
          )}
        </section>

        {/* Tabla de cambios 3 / 7 / 14 / 30 / 90 días */}
        <section className="rounded-2xl bg-white/[0.05] p-4">
          <h3 id={changesTitleId} className="mb-2 text-[15px] font-bold tracking-tight text-fg">
            Cambios del promedio móvil (7 d)
          </h3>
          <div tabIndex={0} role="region" aria-labelledby={changesTitleId} className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-[13px] font-medium text-muted">
                  <th scope="col" className="py-2 text-left font-medium">Ventana</th>
                  <th scope="col" className="py-2 text-right font-medium">Cambio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {TREND_WINDOWS.map((n) => {
                  const delta = card.changes ? card.changes[`d${n}`] : null;
                  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
                  const cls = deltaClass(delta, metric.polarity);
                  const Icon = !hasDelta || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
                  return (
                    <tr key={n}>
                      <th scope="row" className="py-2.5 text-left font-medium text-fg">
                        {WINDOW_LABELS[n] || `${n} días`}
                      </th>
                      <td className="py-2.5 text-right font-mono tabular-nums">
                        {hasDelta ? (
                          <span className={`inline-flex items-center justify-end gap-1 font-semibold ${cls}`}>
                            <Icon size={13} aria-hidden="true" />
                            <span>{metric.fmtDelta(delta)}</span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Diferencia del promedio móvil de los últimos 7 días frente al de hace 3, 7, 14, 30 y 90 días.
          </p>
        </section>
      </div>
    </SheetDialog>
  );
}
