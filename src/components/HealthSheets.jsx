import { useEffect, useId, useMemo, useRef } from "react";
import { ResponsiveContainer, ComposedChart, LineChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";
import { X, ChevronLeft, ChevronRight, AlertTriangle, Moon, HeartPulse, Flame, Activity, Dumbbell, Bike, Footprints } from "lucide-react";
import { dkey, fromKey, addDays, fmtShort, fmtSleep } from "../lib/dates.js";
import { Chip, StatusDot } from "./ui.jsx";
import { formatDayLabel, recoveryTone } from "./HealthRings.jsx";

const TOOLTIP_STYLE = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--fg)", fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--fg)" },
  cursor: { fill: "var(--surface-2)" },
};

const AXIS_TICK = { fill: "var(--muted)", fontSize: 11 };

const WORKOUT_ICON = {
  run: Flame,
  bike: Bike,
  walk: Footprints,
  strength: Dumbbell,
  other: Activity,
};

const METHOD_LABEL = {
  zones: "Zonas FC",
  trimp: "FC media",
  fallback: "Estimado",
};

function last14Keys(endDate) {
  const base = fromKey(endDate || dkey());
  return Array.from({ length: 14 }, (_, i) => dkey(addDays(base, i - 13)));
}

function fmtHMShort(min) {
  if (typeof min !== "number" || !Number.isFinite(min) || min <= 0) return "—";
  const t = Math.round(min);
  const h = Math.floor(t / 60);
  const m = t % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function pillForBiomarker(status, higherIsBetter) {
  if (status === "missing") return { text: "Sin dato", tone: "plain" };
  if (status === "normal") return { text: "Normal", tone: "good" };
  if (status === "high") {
    if (higherIsBetter === true) return { text: "Por encima", tone: "good" };
    if (higherIsBetter === false) return { text: "Por encima", tone: "warn" };
    return { text: "Por encima", tone: "cool" };
  }
  if (status === "low") {
    if (higherIsBetter === false) return { text: "Bajo", tone: "good" };
    return { text: "Bajo", tone: "warn" };
  }
  return { text: "Normal", tone: "plain" };
}

function fmtTemp(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)} °C`;
}

function SleepSheetBody({ day, series14 }) {
  const sleep = day?.sleep || {};
  const need = sleep.need || {};
  const score = typeof sleep.score === "number" ? sleep.score : null;
  const coveragePct = typeof sleep.coverage === "number" ? Math.round(sleep.coverage * 100) : 0;

  const deepMin = typeof sleep.deepMin === "number" ? sleep.deepMin : 0;
  const remMin = typeof sleep.remMin === "number" ? sleep.remMin : 0;
  const lightMin = typeof sleep.lightMin === "number" ? sleep.lightMin : 0;
  const awakeMin = typeof sleep.awakeMin === "number" ? sleep.awakeMin : 0;
  const stageSum = deepMin + remMin + lightMin + awakeMin;
  const hasStages = (deepMin + remMin + lightMin) > 0;

  const stages = [
    { key: "deep", label: "Profundo", min: deepMin, cls: "bg-sleep", dot: "bg-sleep" },
    { key: "rem", label: "REM", min: remMin, cls: "bg-good", dot: "bg-good" },
    { key: "light", label: "Ligero", min: lightMin, cls: "bg-cool/70", dot: "bg-cool/70" },
    { key: "awake", label: "Despierto", min: awakeMin, cls: "bg-warn/80", dot: "bg-warn/80" },
  ];

  const effText = sleep.eff != null ? `${Math.round(sleep.eff * 100)}%` : "—";
  const contText = sleep.awakenings != null || sleep.awakeMin != null
    ? `${sleep.awakenings ?? 0} desp.`
    : "—";
  const contSub = sleep.awakeMin != null ? `${Math.round(sleep.awakeMin)} min despierto` : "≤ 1 desp. ideal";
  const dipText = sleep.hrDip != null ? `${sleep.hrDip.toFixed(1)}%` : "—";

  return (
    <div className="space-y-4">
      {/* Score y cobertura */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.06] p-4">
        <div>
          <div className="text-[13px] font-medium text-muted">Sleep Score</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold leading-none text-sleep tabular-nums">
              {score != null ? `${score}%` : "—"}
            </span>
            {sleep.min > 0 && (
              <span className="font-mono text-xs font-semibold text-fg tabular-nums">{fmtSleep(sleep.min)}</span>
            )}
          </div>
          {sleep.bed && sleep.wake && (
            <div className="mt-1 font-mono text-[11px] text-muted">{sleep.bed} – {sleep.wake}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Chip>{sleep.presentCount || 0}/{sleep.totalCount || 6} señales</Chip>
          <span className="font-mono text-[11px] text-muted">Cobertura {coveragePct}%</span>
        </div>
      </div>

      {/* Desglose de Sleep Need */}
      <section className="rounded-2xl bg-white/[0.05] p-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-bold tracking-tight text-fg">Necesidad de sueño</h3>
          <span className="font-mono text-sm font-bold text-accent tabular-nums">
            {need.needMin ? fmtSleep(need.needMin) : "—"}
          </span>
        </div>
        <dl className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Meta base personal</dt>
            <dd className="font-mono font-semibold tabular-nums text-fg">{need.baseMin ? fmtHMShort(need.baseMin) : "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Ajuste por Strain de ayer</dt>
            <dd className="font-mono font-semibold tabular-nums text-fg">+{need.strainDeltaMin || 0} min</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Deuda 7d ÷ 4 ({need.debt7dMin || 0} min acum.)</dt>
            <dd className="font-mono font-semibold tabular-nums text-fg">+{need.debtDeltaMin || 0} min</dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line pt-1.5">
            <dt className="text-muted">
              Tiempo en cama sugerido ({Math.round((need.efficiencyUsed || 0.9) * 100)}% ef.)
            </dt>
            <dd className="font-mono font-bold tabular-nums text-sleep">
              {need.bedNeedMin ? fmtHMShort(need.bedNeedMin) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Fases de sueño */}
      <section className="rounded-2xl bg-white/[0.05] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-bold tracking-tight text-fg">Fases de sueño</h3>
          {hasStages && <span className="font-mono text-[11px] text-muted">{fmtHMShort(stageSum)} total</span>}
        </div>
        {hasStages && stageSum > 0 ? (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.08]">
              {stages.map((st) => st.min > 0 && (
                <div
                  key={st.key}
                  className={st.cls}
                  style={{ width: `${(st.min / stageSum) * 100}%` }}
                  title={`${st.label}: ${fmtHMShort(st.min)}`}
                />
              ))}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {stages.map((st) => (
                <div key={st.key} className="rounded-xl bg-white/[0.05] px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                    {st.label}
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-bold tabular-nums text-fg">
                    {st.min > 0 ? fmtHMShort(st.min) : "0m"}
                    <span className="ml-1 text-[10px] font-normal text-muted">
                      {stageSum > 0 ? `${Math.round((st.min / stageSum) * 100)}%` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted">
            Sin desglose de fases para esta noche. Cuando Fitbit reporte sueño con fases, verás aquí Profundo, REM, Ligero y Despierto.
          </p>
        )}
      </section>

      {/* Eficiencia, Interrupciones y HR Dip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-2xl bg-white/[0.05] p-3">
          <div className="text-xs font-medium text-muted">Eficiencia</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-fg">{effText}</div>
          <div className="text-[11px] text-muted">Meta ≥ 92%</div>
        </div>
        <div className="min-w-0 rounded-2xl bg-white/[0.05] p-3">
          <div className="text-xs font-medium text-muted">Interrup.</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-fg">{contText}</div>
          <div className="truncate text-[11px] text-muted">{contSub}</div>
        </div>
        <div className="min-w-0 rounded-2xl bg-white/[0.05] p-3">
          <div className="text-xs font-medium text-muted">HR Dip</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-fg">{dipText}</div>
          <div className="text-[11px] text-muted">Ópt. 10–15%</div>
        </div>
      </div>

      {/* Gráfica 14 noches */}
      <section className="rounded-2xl bg-white/[0.05] p-4">
        <div className="mb-2 text-[13px] font-medium text-muted">
          Últimas 14 noches · Dormido vs. necesidad
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series14} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, 10]} ticks={[0, 4, 6, 8, 10]} tickFormatter={(v) => `${v}h`} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v, name) => (v != null ? [fmtSleep(Math.round(v * 60)), name] : ["—", name])}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar isAnimationActive={false} dataKey="sleepH" name="Dormido" fill="rgb(var(--c-sleep))" radius={[4, 4, 0, 0]} />
              <Line isAnimationActive={false} type="monotone" dataKey="needH" name="Necesidad" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function RecoverySheetBody({ day, series14 }) {
  const rec = day?.recovery || {};
  const score = typeof rec.score === "number" ? rec.score : null;
  const tone = recoveryTone(score);
  const toneTextCls = tone === "good" ? "text-good" : tone === "accent" ? "text-accent" : tone === "warn" ? "text-warn" : "text-muted";
  const bm = rec.biomarkers || {};

  const modeChip = rec.mode === "biometric"
    ? { label: "Biométrica", tone: "good" }
    : rec.mode === "estimated"
      ? { label: "Estimada", tone: "accent" }
      : { label: "Sin datos", tone: "plain" };

  const calLabel = rec.mode === "estimated"
    ? "Sueño + fatiga ATL/CTL"
    : rec.calibration === "ready"
      ? "Base personal 60d"
      : rec.calibration === "provisional"
        ? "Base provisional (7–20d)"
        : "Calibrando (<7d)";

  const hrvKindLabel = bm.hrv?.kind === "sdnn" ? "HRV SDNN" : "HRV RMSSD";
  const rows = [
    {
      id: "hrv",
      label: hrvKindLabel,
      value: bm.hrv?.value != null ? `${bm.hrv.value} ms` : "—",
      range: bm.hrv?.baseline?.low != null ? `${bm.hrv.baseline.low}–${bm.hrv.baseline.high} ms` : "—",
      meta: bm.hrv?.baseline,
      status: bm.hrv?.status || "missing",
      higherIsBetter: true,
    },
    {
      id: "rhr",
      label: "RHR (FC reposo)",
      value: bm.rhr?.value != null ? `${bm.rhr.value} lpm` : "—",
      range: bm.rhr?.baseline?.low != null ? `${bm.rhr.baseline.low}–${bm.rhr.baseline.high} lpm` : "—",
      meta: bm.rhr?.baseline,
      status: bm.rhr?.status || "missing",
      higherIsBetter: false,
    },
    {
      id: "sleep",
      label: "Sueño",
      value: bm.sleep?.value != null ? `${bm.sleep.value}%` : "—",
      range: "60–90%",
      meta: null,
      status: bm.sleep?.status || "missing",
      higherIsBetter: true,
    },
    {
      id: "resp",
      label: "Frecuencia resp.",
      value: bm.resp?.value != null ? `${bm.resp.value} rpm` : "—",
      range: bm.resp?.baseline?.low != null ? `${bm.resp.baseline.low}–${bm.resp.baseline.high} rpm` : "—",
      meta: bm.resp?.baseline,
      status: bm.resp?.status || "missing",
      higherIsBetter: false,
    },
    {
      id: "spo2",
      label: "SpO₂",
      value: bm.spo2?.value != null ? `${bm.spo2.value}%` : "—",
      range: bm.spo2?.baseline?.low != null ? `${bm.spo2.baseline.low}–${bm.spo2.baseline.high}%` : "—",
      meta: bm.spo2?.baseline,
      status: bm.spo2?.status || "missing",
      higherIsBetter: null,
    },
    {
      id: "tempDev",
      label: "Temp. cutánea",
      value: fmtTemp(bm.tempDev?.value),
      range: bm.tempDev?.baseline?.low != null
        ? `${bm.tempDev.baseline.low >= 0 ? "+" : ""}${bm.tempDev.baseline.low} a ${bm.tempDev.baseline.high >= 0 ? "+" : ""}${bm.tempDev.baseline.high} °C`
        : "—",
      meta: bm.tempDev?.baseline,
      status: bm.tempDev?.status || "missing",
      higherIsBetter: false,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Score + modo + calibración */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.06] p-4">
        <div>
          <div className="text-[13px] font-medium text-muted">Recovery Score</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-mono text-4xl font-bold leading-none tabular-nums ${toneTextCls}`}>
              {score != null ? `${score}%` : "—"}
            </span>
            <span className="text-xs font-medium text-muted">{rec.label || "Sin datos"}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusDot tone={modeChip.tone === "plain" ? "muted" : modeChip.tone}>{modeChip.label}</StatusDot>
          <span className="text-[11px] text-muted">{calLabel}</span>
        </div>
      </div>

      {/* Aviso alertReasons */}
      {rec.alert === "biometrics_off" && Array.isArray(rec.alertReasons) && rec.alertReasons.length > 0 && (
        <div role="alert" className="rounded-2xl border border-warn/35 bg-warn/10 p-3.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-warn">
            <AlertTriangle size={14} />
            Señales fuera de rango (penalización −{rec.penalty} pts)
          </div>
          <ul className="mt-1 space-y-0.5 text-fg/90">
            {rec.alertReasons.map((r) => <li key={r}>· {r}</li>)}
          </ul>
        </div>
      )}

      {/* Health Monitor: 6 biomarcadores */}
      <section className="rounded-2xl bg-white/[0.05] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-bold tracking-tight text-fg">Monitor biométrico</h3>
          <span className="text-[11px] text-muted">Rango personal 60d</span>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const pill = pillForBiomarker(row.status, row.higherIsBetter);
            const refTag = row.meta && row.meta.status === "calibrating" ? "Ref. " : "";
            return (
              <li key={row.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-fg">{row.label}</div>
                  <div className="font-mono text-[11px] text-muted tabular-nums">
                    {refTag}{row.range}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="font-mono text-sm font-bold tabular-nums text-fg">{row.value}</span>
                  <StatusDot tone={pill.tone === "plain" ? "muted" : pill.tone}>{pill.text}</StatusDot>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Gráfica 14 días */}
      <section className="rounded-2xl bg-white/[0.05] p-4">
        <div className="mb-2 text-[13px] font-medium text-muted">
          Tendencia de 14 días
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series14} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 33, 67, 100]} tickFormatter={(v) => `${v}%`} />
              <ReferenceLine y={67} stroke="var(--good)" strokeOpacity={0.35} strokeDasharray="3 3" />
              <ReferenceLine y={33} stroke="var(--warn)" strokeOpacity={0.35} strokeDasharray="3 3" />
              <Tooltip {...TOOLTIP_STYLE} cursor={{ stroke: "var(--line)" }} formatter={(v) => (v != null ? [`${v}%`, "Recuperación"] : ["—", "Recuperación"])} />
              <Line isAnimationActive={false} type="monotone" dataKey="recovery" name="Recuperación" stroke="var(--good)" strokeWidth={2.5} dot={{ r: 2.5, fill: "var(--good)" }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function StrainSheetBody({ day, series14 }) {
  const strain = day?.strain || {};
  const score = typeof strain.score === "number" ? strain.score : 0;
  const target = strain.target || { min: 35, max: 60, zone: "mid", label: "Moderado" };
  const scaleMax = Math.max(100, score + 10);
  const pct = (v) => `${Math.min(100, Math.max(0, (v / scaleMax) * 100))}%`;

  const statusMsg = score < target.min
    ? `Te faltan ~${target.min - score} pts para entrar en tu rango objetivo (${target.min}–${target.max}%).`
    : score <= target.max
      ? `Dentro de tu rango objetivo (${target.min}–${target.max}% · ${target.label}).`
      : `Por encima de la meta de hoy (${target.min}–${target.max}%): prioriza descanso y sueño esta noche.`;

  const zones = strain.zones || { light: 0, moderate: 0, vigorous: 0, peak: 0 };
  const zoneTotal = (zones.light || 0) + (zones.moderate || 0) + (zones.vigorous || 0) + (zones.peak || 0);
  const zoneRows = [
    { key: "light", label: "Ligera", min: Math.round(zones.light || 0), cls: "bg-cool" },
    { key: "moderate", label: "Moderada", min: Math.round(zones.moderate || 0), cls: "bg-good" },
    { key: "vigorous", label: "Vigorosa", min: Math.round(zones.vigorous || 0), cls: "bg-strain" },
    { key: "peak", label: "Pico", min: Math.round(zones.peak || 0), cls: "bg-bad" },
  ];

  const workouts = Array.isArray(strain.workouts) ? strain.workouts : [];

  return (
    <div className="space-y-4">
      {/* Strain vs. barra de Target Strain */}
      <section className="rounded-2xl bg-white/[0.06] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[13px] font-medium text-muted">Strain diario</div>
            <div className="mt-1 font-mono text-4xl font-bold leading-none text-strain tabular-nums">
              {score}%
            </div>
          </div>
          <StatusDot tone="good">Meta {target.min}–{target.max}% · {target.label}</StatusDot>
        </div>

        <div className="relative mt-3 h-3.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="absolute inset-y-0 border-x border-good/70 bg-good/25"
            style={{ left: pct(target.min), width: pct(Math.max(0, target.max - target.min)) }}
            title={`Meta ${target.min}–${target.max}%`}
          />
          <div
            className="relative h-full rounded-full bg-strain transition-all duration-500"
            style={{ width: pct(score) }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">{statusMsg}</p>
      </section>

      {/* Desglose Cardio + Muscular + Pasivo */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="min-w-0 rounded-2xl bg-white/[0.05] p-3">
            <div className="text-xs font-medium text-muted">Cardio</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-fg">{strain.cardioLoad ?? 0}</div>
            <div className="text-[11px] text-muted">{workouts.length} {workouts.length === 1 ? "entreno" : "entrenos"}</div>
          </div>
          <div className="min-w-0 rounded-2xl bg-white/[0.05] p-3">
            <div className="text-xs font-medium text-muted">Muscular</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-fg">{strain.muscularLoad ?? 0}</div>
            <div className="text-[11px] text-muted">{strain.setsCount || 0} series</div>
          </div>
          <div className="min-w-0 rounded-2xl bg-white/[0.05] p-3">
            <div className="text-xs font-medium text-muted">Pasivo</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-fg">{strain.passiveLoad ?? 0}</div>
            <div className="text-[11px] text-muted">Pasos / AZM</div>
          </div>
        </div>
        {strain.antiDoubleCount && (
          <p className="rounded-2xl bg-cool/10 px-3.5 py-2.5 text-xs text-cool">
            Anti-doble conteo aplicado: tu carga muscular de Shift ({strain.rawMuscularLoad} u) se pondera al 65% ({strain.muscularLoad} u) porque Fitbit ya registró un entreno de fuerza hoy.
          </p>
        )}
      </div>

      {/* Zonas de FC */}
      <section className="rounded-2xl bg-white/[0.05] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-bold tracking-tight text-fg">Zonas de frecuencia cardiaca</h3>
          {zoneTotal > 0 && <span className="font-mono text-[11px] text-muted">{Math.round(zoneTotal)} min</span>}
        </div>
        {zoneTotal > 0 ? (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.08]">
              {zoneRows.map((z) => z.min > 0 && (
                <div key={z.key} className={z.cls} style={{ width: `${(z.min / zoneTotal) * 100}%` }} title={`${z.label}: ${z.min} min`} />
              ))}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {zoneRows.map((z) => (
                <div key={z.key} className="rounded-xl bg-white/[0.05] px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className={`h-2 w-2 rounded-full ${z.cls}`} />
                    {z.label}
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-bold tabular-nums text-fg">{z.min} min</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted">Sin minutos por zona de FC registrados este día.</p>
        )}
      </section>

      {/* Entrenos del día */}
      <section className="rounded-2xl bg-white/[0.05] p-4">
        <h3 className="mb-2 text-[15px] font-bold tracking-tight text-fg">Entrenos del día</h3>
        {workouts.length > 0 ? (
          <ul className="divide-y divide-line">
            {workouts.map((w, idx) => {
              const Icon = WORKOUT_ICON[w.kind] || Activity;
              return (
                <li key={w.id || `${w.type}-${idx}`} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-strain">
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-fg">{w.type}</div>
                      <div className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted">
                        <span>{w.min} min</span>
                        {w.avgHr != null && <span>{w.avgHr} lpm</span>}
                        {w.kcal != null && <span>{w.kcal} kcal</span>}
                        <span>{METHOD_LABEL[w.method] || w.method}</span>
                      </div>
                    </div>
                  </div>
                  <Chip tone="warn">{w.strainPct}%</Chip>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted">
            {strain.setsCount > 0
              ? `Solo registro de fuerza en Shift (${strain.setsCount} series completadas).`
              : "Sin entrenos registrados este día."}
          </p>
        )}
      </section>

      {/* ComposedChart 14 días: Strain (barras) + Recovery (línea) */}
      <section className="rounded-2xl bg-white/[0.05] p-4">
        <div className="mb-2 text-[13px] font-medium text-muted">
          Últimos 14 días · Strain vs. Recuperación
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series14} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, (max) => Math.max(100, Math.ceil(max / 10) * 10)]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(v, name) => (v != null ? [`${v}%`, name] : ["—", name])}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar isAnimationActive={false} dataKey="strain" name="Strain" fill="rgb(var(--c-strain))" radius={[4, 4, 0, 0]} />
              <Line isAnimationActive={false} type="monotone" dataKey="recovery" name="Recuperación" stroke="var(--good)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--good)" }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

const SHEET_META = {
  sleep: { title: "Sueño", eyebrow: "Descanso", icon: Moon, accent: "text-sleep" },
  recovery: { title: "Recuperación", eyebrow: "Biometría", icon: HeartPulse, accent: "text-good" },
  strain: { title: "Strain", eyebrow: "Carga diaria", icon: Flame, accent: "text-strain" },
};

export function HealthSheets({
  activeSheet,
  onClose,
  bevelHistory,
  day,
  selectedDate,
  todayKey,
  canPrev,
  canNext,
  onPrev,
  onNext,
}) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.setAttribute("closedby", "any");
    if (!dialog.open) dialog.showModal();
    const onNativeClose = () => onCloseRef.current();
    dialog.addEventListener("close", onNativeClose);

    let cleanupFallback;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const outside = (e) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      const onDown = (e) => { pressedOutside = outside(e); };
      const onUp = (e) => { if (pressedOutside && outside(e)) dialog.close(); };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      cleanupFallback = () => {
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", onNativeClose);
      if (cleanupFallback) cleanupFallback();
      if (dialog.open) dialog.close();
    };
  }, []);

  const series14 = useMemo(() => {
    const byDate = (bevelHistory && bevelHistory.byDate) || {};
    return last14Keys(selectedDate).map((k) => {
      const d = byDate[k];
      const sleepMin = d?.sleep?.min;
      const needMin = d?.sleep?.need?.needMin;
      return {
        date: k,
        label: fmtShort(k),
        sleepH: typeof sleepMin === "number" && sleepMin > 0 ? +(sleepMin / 60).toFixed(2) : null,
        needH: typeof needMin === "number" && needMin > 0 ? +(needMin / 60).toFixed(2) : null,
        recovery: typeof d?.recovery?.score === "number" ? d.recovery.score : null,
        strain: typeof d?.strain?.score === "number" ? d.strain.score : 0,
      };
    });
  }, [bevelHistory, selectedDate]);

  const meta = SHEET_META[activeSheet] || SHEET_META.recovery;
  const Icon = meta.icon;

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="sheet-dialog sheet">
      <div className="flex min-h-0 flex-1 flex-col p-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:p-5">
        <div className="mb-3 flex shrink-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${meta.accent}`}>
              <Icon size={13} />{meta.eyebrow}
            </div>
            <h2 id={titleId} className="mt-0.5 text-2xl font-bold leading-tight tracking-tight">{meta.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              aria-label="Día anterior"
              className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg disabled:opacity-30"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="px-1 font-mono text-[11px] font-semibold text-muted">{formatDayLabel(selectedDate, todayKey)}</span>
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              aria-label="Día siguiente"
              className="grid h-8 w-8 place-items-center rounded-xl bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="ml-1 grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          {activeSheet === "sleep" && <SleepSheetBody day={day} series14={series14} />}
          {activeSheet === "recovery" && <RecoverySheetBody day={day} series14={series14} />}
          {activeSheet === "strain" && <StrainSheetBody day={day} series14={series14} />}
        </div>
      </div>
    </dialog>
  );
}
