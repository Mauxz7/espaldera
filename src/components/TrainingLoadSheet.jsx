import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Flame, Dumbbell } from "lucide-react";
import { LOAD_STATUS } from "../lib/metrics.js";
import { fmtShort } from "../lib/dates.js";
import { StatusDot } from "./ui.jsx";
import { SheetDialog } from "./SheetDialog.jsx";
import { formatDayLabel } from "./HealthRings.jsx";

export const LOAD_STATUS_META = Object.freeze({
  calibrating: { label: "Calibrando", tone: "plain", barCls: "bg-muted", dotCls: "bg-muted", stroke: "var(--muted)", textCls: "text-muted" },
  detraining: { label: "Desentrenando", tone: "cool", barCls: "bg-cool/70", dotCls: "bg-cool/70", stroke: "var(--cool)", textCls: "text-cool" },
  maintaining: { label: "Manteniendo", tone: "cool", barCls: "bg-cool", dotCls: "bg-cool", stroke: "var(--cool)", textCls: "text-cool" },
  productive: { label: "Productivo", tone: "good", barCls: "bg-good", dotCls: "bg-good", stroke: "var(--good)", textCls: "text-good" },
  peaking: { label: "En pico", tone: "good", barCls: "bg-good/80", dotCls: "bg-good/80", stroke: "var(--good)", textCls: "text-good" },
  fatigued: { label: "Fatigado", tone: "accent", barCls: "bg-accent", dotCls: "bg-accent", stroke: "var(--accent)", textCls: "text-accent" },
  overtraining: { label: "Sobreentrenando", tone: "warn", barCls: "bg-warn", dotCls: "bg-warn", stroke: "var(--warn)", textCls: "text-warn" },
});

const AXIS_TICK = { fill: "var(--muted)", fontSize: 11 };

function LoadTooltip({ active, payload, todayKey }) {
  if (!active || !payload || !payload.length) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;
  const st = LOAD_STATUS_META[pt.status] || LOAD_STATUS_META.calibrating;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-[11px] text-muted">{formatDayLabel(pt.date, todayKey)}</div>
      <div className="mt-1 font-mono font-semibold text-fg tabular-nums">Carga 7 d: {pt.value}</div>
      <div className="font-mono text-[11px] text-good tabular-nums">Óptimo: {pt.low}–{pt.high}</div>
      <div className={`mt-0.5 text-[11px] font-medium ${st.textCls}`}>{st.label}</div>
    </div>
  );
}

/**
 * Hoja modal con la evolución de 30 días (carga aguda + banda óptima) y desglose de días por estado.
 */
export function TrainingLoadSheet({ kind, load, selectedDate, todayKey, onClose }) {
  if (!load) return null;
  const isCardio = kind === "cardio";
  const meta = LOAD_STATUS_META[load.status] || LOAD_STATUS_META.calibrating;
  const Icon = isCardio ? Flame : Dumbbell;
  const title = isCardio ? "Carga cardio" : "Carga muscular";

  const chartData = (load.history || []).map((h) => ({
    ...h,
    label: fmtShort(h.date),
    bandBase: h.low,
    bandSpan: Math.max(0, +(h.high - h.low).toFixed(1)),
  }));

  const maxVal = chartData.reduce((m, d) => Math.max(m, d.value || 0, d.high || 0), 10);
  const yMax = Math.ceil(maxVal * 1.15);

  const breakdown = load.breakdown || {};
  const totalDays = LOAD_STATUS.reduce((sum, k) => sum + (breakdown[k] || 0), 0) || 30;
  const optimalText = load.status === "calibrating"
    ? "Calibrando (requiere ≥14 días)"
    : `Rango óptimo: ${load.optimal?.min ?? 0}–${load.optimal?.max ?? 0}`;

  return (
    <SheetDialog
      eyebrow="Fitness · últimos 30 días"
      icon={Icon}
      accent={isCardio ? "text-strain" : "text-accent"}
      title={title}
      subtitle={formatDayLabel(selectedDate, todayKey)}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Resumen de carga actual */}
        <section className="rounded-2xl bg-white/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[13px] font-medium text-muted">
                Carga aguda (7 d)
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`font-mono text-4xl font-bold leading-none tabular-nums ${meta.textCls}`}>
                  {load.value}
                </span>
                {load.ratio != null && (
                  <span className="font-mono text-xs text-muted tabular-nums">
                    Razón {load.ratio.toFixed(2)}×
                  </span>
                )}
              </div>
            </div>
            <StatusDot tone={meta.tone === "plain" ? "muted" : meta.tone}>{meta.label}</StatusDot>
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">{optimalText}</p>
        </section>

        {/* Gráfico de 30 días: línea + banda óptima */}
        <section className="rounded-2xl bg-white/[0.05] p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold tracking-tight text-fg">
              Evolución 30 días
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-3 rounded-sm border border-good/50 bg-good/20" />
                Óptimo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${meta.dotCls}`} />
                Carga 7 d
              </span>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
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
                  domain={[0, yMax]}
                />
                <Tooltip content={<LoadTooltip todayKey={todayKey} />} />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="bandBase"
                  stackId="opt"
                  stroke="none"
                  fill="transparent"
                  activeDot={false}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="bandSpan"
                  stackId="opt"
                  stroke="var(--good)"
                  strokeOpacity={0.45}
                  strokeDasharray="3 3"
                  fill="var(--good)"
                  fillOpacity={0.18}
                  activeDot={false}
                />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="value"
                  stroke={meta.stroke}
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: meta.stroke }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Desglose de días por estado */}
        <section className="rounded-2xl bg-white/[0.05] p-4">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-bold tracking-tight text-fg">
              Días por estado
            </h3>
            <span className="font-mono text-[11px] text-muted">{totalDays} días</span>
          </div>

          <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
            {LOAD_STATUS.map((key) => {
              const days = breakdown[key] || 0;
              if (days <= 0) return null;
              const itemMeta = LOAD_STATUS_META[key];
              return (
                <div
                  key={key}
                  className={itemMeta.barCls}
                  style={{ width: `${(days / totalDays) * 100}%` }}
                  title={`${itemMeta.label}: ${days} d`}
                />
              );
            })}
          </div>

          <ul className="mt-3 space-y-2">
            {LOAD_STATUS.map((key) => {
              const days = breakdown[key] || 0;
              const pct = Math.round((days / totalDays) * 100);
              const itemMeta = LOAD_STATUS_META[key];
              return (
                <li key={key} className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${itemMeta.dotCls}`} aria-hidden="true" />
                    <span className="truncate text-fg">{itemMeta.label}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
                    <div
                      className={`h-full rounded-full ${itemMeta.barCls}`}
                      style={{ width: `${(days / totalDays) * 100}%` }}
                    />
                  </div>
                  <span className="min-w-[3.75rem] text-right font-mono text-[11px] text-muted tabular-nums">
                    {days} d <span className="text-muted/70">({pct}%)</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </SheetDialog>
  );
}
