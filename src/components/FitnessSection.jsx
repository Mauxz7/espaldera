import { useMemo, useState } from "react";
import { Flame, Dumbbell, HeartPulse, ChevronRight } from "lucide-react";
import { trainingLoads, cardioFocus, muscleGroups, FRESH_STATUS } from "../lib/metrics.js";
import { Card, SectionTitle, StatusDot } from "./ui.jsx";
import { LOAD_STATUS_META, TrainingLoadSheet } from "./TrainingLoadSheet.jsx";
import { MuscleGroupsSheet } from "./MuscleGroupsSheet.jsx";
import { BodyMap, TONE_RGB } from "./BodyMap.jsx";

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

/**
 * Sección Fitness dentro de Salud: Carga cardio, Carga muscular, Cardio Focus y Frescura muscular.
 */
export function FitnessSection({ bevelHistory, workouts, setLog, log, customExercises = [], soreness = {}, setSoreness = null, selectedDate, todayKey }) {
  const [openLoad, setOpenLoad] = useState(null); // null | "cardio" | "muscular"
  const [openMuscles, setOpenMuscles] = useState(false);

  const loads = useMemo(
    () => trainingLoads(bevelHistory, selectedDate),
    [bevelHistory, selectedDate],
  );
  const focus = useMemo(
    () => cardioFocus(workouts, selectedDate, { days: 30 }),
    [workouts, selectedDate],
  );
  const muscles = useMemo(
    () => muscleGroups(setLog, selectedDate, { log, workouts, customExercises, soreness }),
    [setLog, log, workouts, customExercises, soreness, selectedDate],
  );
  const tiredest = muscles.groups.filter((g) => g.status !== "recovered").sort((a, b) => a.pct - b.pct).slice(0, 3);
  const previewColor = (group) => {
    const g = muscles.groups.find((x) => x.group === group);
    if (!g) return null;
    if (!g.trained && !g.manual) return { fill: "rgb(255 255 255)", opacity: 0.1 };
    return { fill: TONE_RGB[FRESH_STATUS[g.status].tone], opacity: 0.35 + 0.6 * (g.pct / 100) };
  };

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

      {/* Grupos musculares: vista previa que abre la hoja con mapa corporal */}
      <div>
        <SectionTitle aside="Toca para ver el detalle">Grupos musculares</SectionTitle>
        <Card as="button" type="button" onClick={() => setOpenMuscles(true)} className="block w-full min-w-0 text-left transition active:scale-[0.99]" aria-label="Abrir grupos musculares">
          <div className="flex items-center gap-4">
            <BodyMap colorFor={previewColor} className="w-[148px] shrink-0 [&_figcaption]:hidden" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="space-y-1">
                <StatusDot tone="good">{muscles.counts.recovered} recuperados</StatusDot>
                <div><StatusDot tone="accent">{muscles.counts.fatigued} fatigados</StatusDot></div>
                <div><StatusDot tone="warn">{muscles.counts.depleted} agotados</StatusDot></div>
              </div>
              {tiredest.length > 0 ? (
                <div className="border-t border-line pt-2 text-xs text-muted">
                  {tiredest.map((g) => (
                    <div key={g.group} className="flex justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <span className="truncate">{g.label}</span>
                        {g.manual && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" title="Marcado como cargado" />}
                      </span>
                      <span className="font-mono font-bold text-fg">{g.pct} %</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="border-t border-line pt-2 text-xs text-muted">Todo listo para entrenar.</p>
              )}
              <div className="inline-flex items-center gap-0.5 text-xs font-semibold text-accent">Ver grupos<ChevronRight size={14} /></div>
            </div>
          </div>
        </Card>
      </div>

      {openMuscles && (
        <MuscleGroupsSheet
          setLog={setLog}
          log={log}
          workouts={workouts}
          customExercises={customExercises}
          soreness={soreness}
          setSoreness={setSoreness}
          initialDate={selectedDate}
          todayKey={todayKey}
          onClose={() => setOpenMuscles(false)}
        />
      )}

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
