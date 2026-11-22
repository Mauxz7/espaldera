import { useMemo, useState } from "react";
import { Flame, Dumbbell, HeartPulse, ShieldCheck } from "lucide-react";
import { trainingLoads, cardioFocus, muscleFreshness } from "../lib/metrics.js";
import { fmtShort } from "../lib/dates.js";
import { Card, SectionTitle, StatusDot } from "./ui.jsx";
import { LOAD_STATUS_META, TrainingLoadSheet } from "./TrainingLoadSheet.jsx";

function semiPoint(cx, cy, r, frac) {
  const theta = Math.PI * (1 - frac);
  return {
    x: cx + r * Math.cos(theta),
    y: cy - r * Math.sin(theta),
  };
}

function semiArcPath(cx, cy, r, f1, f2) {
  const a = semiPoint(cx, cy, r, f1);
  const b = semiPoint(cx, cy, r, f2);
  return `M ${a.x.toFixed(2)},${a.y.toFixed(2)} A ${r},${r} 0 0,1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
}

function SemiGaugeCard({ title, icon: Icon, load, onClick }) {
  const meta = LOAD_STATUS_META[load.status] || LOAD_STATUS_META.calibrating;
  const optMin = load.optimal?.min ?? 0;
  const optMax = load.optimal?.max ?? 0;
  const hasOpt = load.status !== "calibrating" && optMax > optMin;

  const scaleMax = Math.max(optMax / 0.72, (load.value || 0) * 1.1, 10);
  const fVal = Math.max(0, Math.min(1, (load.value || 0) / scaleMax));
  const fOptMin = Math.max(0, Math.min(1, optMin / scaleMax));
  const fOptMax = Math.max(fOptMin, Math.min(1, optMax / scaleMax));

  const cx = 70;
  const cy = 72;
  const r = 52;
  const marker = semiPoint(cx, cy, r, fVal);
  const optSub = load.status === "calibrating"
    ? "Calibrando (<14 d)"
    : `Óptimo ${optMin}–${optMax}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="card flex min-w-0 flex-col items-center justify-between p-3.5 text-center transition hover:bg-white/[0.09] active:scale-[0.99]"
    >
      <div className="flex w-full items-center justify-between gap-1 text-[13px] font-medium text-muted">
        <span className="truncate">{title}</span>
        <Icon size={15} className={`shrink-0 ${meta.textCls}`} aria-hidden="true" />
      </div>

      <div className="relative mt-1.5 w-full max-w-[152px]">
        <svg viewBox="0 0 140 84" className="block w-full" aria-hidden="true">
          <path
            d={semiArcPath(cx, cy, r, 0, 1)}
            fill="none"
            stroke="rgb(255 255 255 / 0.08)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {hasOpt && fOptMax - fOptMin > 0.005 && (
            <>
              <path
                d={semiArcPath(cx, cy, r, fOptMin, fOptMax)}
                fill="none"
                stroke="rgb(var(--c-good) / 0.28)"
                strokeWidth="10"
              />
              <path
                d={semiArcPath(cx, cy, r + 8, fOptMin, fOptMax)}
                fill="none"
                stroke="rgb(var(--c-good) / 0.85)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </>
          )}
          {fVal > 0.01 && (
            <path
              d={semiArcPath(cx, cy, r, 0, fVal)}
              fill="none"
              stroke={meta.stroke}
              strokeWidth="10"
              strokeLinecap="round"
            />
          )}
          {fVal > 0 && (
            <circle
              cx={marker.x}
              cy={marker.y}
              r="5"
              fill={meta.stroke}
              stroke="rgb(var(--c-surface))"
              strokeWidth="2"
            />
          )}
        </svg>

        <div className="absolute inset-x-0 bottom-0.5 flex flex-col items-center">
          <span className="font-mono text-3xl font-bold leading-none text-fg tabular-nums">
            {load.value}
          </span>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="font-mono text-[11px] text-muted tabular-nums">{optSub}</div>
        <StatusDot tone={meta.tone === "plain" ? "muted" : meta.tone}>{meta.label}</StatusDot>
      </div>
    </button>
  );
}

function freshnessColors(pct) {
  if (pct >= 80) return { bar: "bg-good", text: "text-good" };
  if (pct >= 50) return { bar: "bg-accent", text: "text-accent" };
  return { bar: "bg-warn", text: "text-warn" };
}

/**
 * Sección Fitness dentro de Salud: Carga cardio, Carga muscular, Cardio Focus y Frescura muscular.
 */
export function FitnessSection({ bevelHistory, workouts, setLog, selectedDate, todayKey }) {
  const [openLoad, setOpenLoad] = useState(null); // null | "cardio" | "muscular"

  const loads = useMemo(
    () => trainingLoads(bevelHistory, selectedDate),
    [bevelHistory, selectedDate],
  );
  const focus = useMemo(
    () => cardioFocus(workouts, selectedDate, { days: 30 }),
    [workouts, selectedDate],
  );
  const freshness = useMemo(
    () => muscleFreshness(setLog, selectedDate),
    [setLog, selectedDate],
  );

  const focusTotalMin = focus
    ? Math.round((focus.minutes.light || 0) + (focus.minutes.moderate || 0) + (focus.minutes.vigorous || 0) + (focus.minutes.peak || 0))
    : 0;

  const focusBuckets = focus
    ? [
        { key: "low", label: "Aeróbico bajo", pct: focus.focus.lowAerobic, min: Math.round((focus.minutes.light || 0) + (focus.minutes.moderate || 0)), barCls: "bg-cool", dotCls: "bg-cool", textCls: "text-cool" },
        { key: "high", label: "Aeróbico alto", pct: focus.focus.highAerobic, min: Math.round(focus.minutes.vigorous || 0), barCls: "bg-good", dotCls: "bg-good", textCls: "text-good" },
        { key: "ana", label: "Anaeróbico", pct: focus.focus.anaerobic, min: Math.round(focus.minutes.peak || 0), barCls: "bg-strain", dotCls: "bg-strain", textCls: "text-strain" },
      ]
    : [];

  return (
    <section className="space-y-5">
      <div>
        <SectionTitle aside="Toca una carga para ver historial 30 d">Fitness</SectionTitle>

        {/* Dos medidores semicirculares */}
        <div className="grid grid-cols-2 gap-3">
          <SemiGaugeCard
            title="Carga cardio"
            icon={Flame}
            load={loads.cardio}
            onClick={() => setOpenLoad("cardio")}
          />
          <SemiGaugeCard
            title="Carga muscular"
            icon={Dumbbell}
            load={loads.muscular}
            onClick={() => setOpenLoad("muscular")}
          />
        </div>
      </div>

      {/* Tarjeta Cardio Focus */}
      <div>
        <SectionTitle aside={focus ? `${focusTotalMin} min · últimos 30 d` : null}>Cardio Focus</SectionTitle>
        <Card className="min-w-0">
          {focus === null ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted">
                <HeartPulse size={16} className="text-cool" aria-hidden="true" />
                <span>Sin datos de pulso de los entrenos</span>
              </div>
              <p className="text-xs text-muted/80">
                Cuando tus entrenos incluyan minutos por zona cardíaca, verás el reparto entre aeróbico bajo, alto y anaeróbico.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
                {focusBuckets.map((b) => b.pct > 0 && (
                  <div
                    key={b.key}
                    className={b.barCls}
                    style={{ width: `${b.pct}%` }}
                    title={`${b.label}: ${b.pct}%`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {focusBuckets.map((b) => (
                  <div key={b.key} className="flex min-w-0 flex-col justify-between rounded-2xl bg-white/[0.05] p-3">
                    <div className="flex items-start gap-1.5 text-[11px] leading-tight text-muted">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${b.dotCls}`} aria-hidden="true" />
                      <span>{b.label}</span>
                    </div>
                    <div className="mt-2">
                      <div className={`font-mono text-2xl font-bold leading-none tabular-nums ${b.textCls}`}>
                        {b.pct}%
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted tabular-nums">{b.min} min</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted tabular-nums">
                <span>Ligera: {Math.round(focus.minutes.light || 0)} min</span>
                <span>Moderada: {Math.round(focus.minutes.moderate || 0)} min</span>
                <span>Vigorosa: {Math.round(focus.minutes.vigorous || 0)} min</span>
                <span>Pico: {Math.round(focus.minutes.peak || 0)} min</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Tarjeta Frescura muscular (11 grupos) */}
      <div>
        <SectionTitle>Frescura muscular</SectionTitle>
        <Card className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <ShieldCheck size={15} className="text-good" aria-hidden="true" />
              <span>Recuperación por grupo</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-good" />≥80%</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" />50–79%</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warn" />&lt;50%</span>
            </div>
          </div>

          <ul className="divide-y divide-line sm:grid sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
            {freshness.map((g) => {
              const colors = freshnessColors(g.pct);
              return (
                <li key={g.group} className="min-w-0 py-2.5 first:pt-0 last:pb-0 sm:border-b sm:border-line sm:py-2.5 sm:first:pt-2.5 sm:last:pb-2.5">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-fg">{g.label}</span>
                    <div className="flex shrink-0 items-baseline gap-2 font-mono tabular-nums">
                      {g.sets > 0 && (
                        <span className="text-[11px] text-muted">
                          {g.sets} ser.{g.lastDate ? ` · ${fmtShort(g.lastDate)}` : ""}
                        </span>
                      )}
                      <span className={`font-bold ${colors.text}`}>{g.pct}%</span>
                    </div>
                  </div>
                  <div
                    className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.07]"
                    role="progressbar"
                    aria-label={`${g.label}: ${g.pct}% recuperado`}
                    aria-valuenow={g.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${colors.bar}`}
                      style={{ width: `${g.pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {openLoad && (
        <TrainingLoadSheet
          kind={openLoad}
          load={openLoad === "cardio" ? loads.cardio : loads.muscular}
          selectedDate={selectedDate}
          todayKey={todayKey}
          onClose={() => setOpenLoad(null)}
        />
      )}
    </section>
  );
}
