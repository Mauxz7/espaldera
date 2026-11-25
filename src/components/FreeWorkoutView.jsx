import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Dumbbell, Flag, History, Plus, Timer, Trash2, Watch, Zap } from "lucide-react";
import { fmtShort } from "../lib/dates.js";
import { parseTargetReps } from "../lib/setLog.js";
import { MUSCLE_GROUPS, hasFreeWorkout } from "../lib/metrics.js";
import { buildFreeWorkoutSummary, getLastFreeExerciseLog, resolveFreeExercise } from "../lib/freeWorkout.js";
import { unlockTimerAudio } from "../lib/timerSound.js";
import { Card, Chip, StatusDot, btnCls } from "./ui.jsx";

function buildInitialRows(savedSeries, lastLoad = "") {
  if (Array.isArray(savedSeries) && savedSeries.length > 0) {
    return savedSeries.map((s) => ({
      reps: s && s.reps != null ? String(s.reps) : "",
      load: s && s.load ? String(s.load) : "",
    }));
  }
  return [{ reps: "", load: lastLoad || "" }];
}

function FreeExerciseCard({
  ex,
  index,
  totalCount,
  savedSeries,
  last,
  onSyncSeries,
  onMove,
  onRemove,
  onStartRest,
}) {
  const [rows, setRows] = useState(() => buildInitialRows(savedSeries, last?.load || ""));

  // Sincroniza cambios externos (p. ej. al llegar por Sync de otro dispositivo) sin pisar borradores locales vacíos.
  useEffect(() => {
    const saved = Array.isArray(savedSeries) ? savedSeries : [];
    const localValid = rows
      .filter((r) => {
        const n = Number(r.reps);
        return r.reps !== "" && Number.isFinite(n) && n > 0;
      })
      .map((r) => ({ reps: Number(r.reps), load: String(r.load || "").trim() }));
    if (JSON.stringify(saved) !== JSON.stringify(localValid)) {
      if (saved.length > 0) {
        setRows(saved.map((s) => ({ reps: String(s.reps), load: s.load || "" })));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSeries]);

  const commitRows = (nextRows) => {
    setRows(nextRows);
    onSyncSeries(nextRows);
  };

  const updateRow = (i, field, val) => {
    const nextRows = rows.map((r, k) => (k === i ? { ...r, [field]: val } : r));
    commitRows(nextRows);
  };

  const addSetRow = () => {
    unlockTimerAudio();
    const prev = rows[rows.length - 1];
    const prevRepsNum = prev && prev.reps !== "" ? Number(prev.reps) : NaN;
    const nextLoad = (prev && prev.load) || last?.load || "";
    const nextReps = Number.isFinite(prevRepsNum) && prevRepsNum > 0
      ? String(prevRepsNum)
      : last?.series?.[rows.length]?.reps != null
        ? String(last.series[rows.length].reps)
        : "";
    commitRows([...rows, { reps: nextReps, load: nextLoad }]);
  };

  const deleteRow = (i) => {
    const filtered = rows.filter((_, k) => k !== i);
    commitRows(filtered.length ? filtered : [{ reps: "", load: last?.load || "" }]);
  };

  const defaultRepsHint = last?.series?.[0]?.reps != null
    ? String(last.series[0].reps)
    : String(parseTargetReps(ex.reps) || 10);

  const validCount = rows.filter((r) => {
    const n = Number(r.reps);
    return r.reps !== "" && Number.isFinite(n) && n > 0;
  }).length;

  const primaryLabels = (ex.primaryGroups || []).map((g) => MUSCLE_GROUPS[g]).filter(Boolean);
  const secondaryLabels = (ex.secondaryGroupsResolved || []).map((g) => MUSCLE_GROUPS[g]).filter(Boolean);

  return (
    <Card as="article" className={`transition-colors ${validCount > 0 ? "ring-1 ring-inset ring-good/30" : ""}`}>
      <div className="flex items-start gap-2.5">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-mono text-base font-bold ${
          validCount > 0 ? "bg-good/15 text-good" : "bg-white/[0.07] text-accent"
        }`}>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold leading-snug text-fg">{ex.name}</h3>
            {ex.custom && <Chip tone="cool">Personalizado</Chip>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {primaryLabels.map((lbl) => <Chip key={lbl} tone="accent">{lbl}</Chip>)}
            {secondaryLabels.map((lbl) => <Chip key={lbl}>{lbl}</Chip>)}
          </div>
        </div>
        <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={index === 0}
            aria-label={`Subir ${ex.name}`}
            title="Subir"
            className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-white/[0.08] hover:text-fg disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronUp size={17} />
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={index >= totalCount - 1}
            aria-label={`Bajar ${ex.name}`}
            title="Bajar"
            className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-white/[0.08] hover:text-fg disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronDown size={17} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar ${ex.name}`}
            title="Quitar ejercicio"
            className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-warn/15 hover:text-warn"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Filas de series */}
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.25fr)_2.5rem] items-center gap-2 px-1 text-[11px] font-medium text-muted">
          <span className="text-center">Serie</span>
          <span>Reps</span>
          <span>Carga</span>
          <span className="sr-only">Borrar</span>
        </div>

        {rows.map((row, i) => {
          const repsNum = Number(row.reps);
          const hasReps = row.reps !== "" && Number.isFinite(repsNum) && repsNum > 0;
          const setRepsHint = last?.series?.[i]?.reps != null ? String(last.series[i].reps) : defaultRepsHint;
          return (
            <div key={i} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.25fr)_2.5rem] items-center gap-2">
              <div className={`grid h-8 w-8 place-items-center rounded-full font-mono text-xs font-bold ${
                hasReps ? "bg-accent text-accentInk" : "bg-white/[0.07] text-muted"
              }`}>
                {i + 1}
              </div>
              <input
                type="text"
                inputMode="numeric"
                enterKeyHint="next"
                value={row.reps}
                onChange={(e) => updateRow(i, "reps", e.target.value)}
                placeholder={setRepsHint}
                aria-label={`${ex.name}, serie ${i + 1}: repeticiones`}
                className="min-h-[44px] w-full min-w-0 rounded-xl border border-line bg-white/[0.06] px-2.5 text-center font-mono text-base font-bold tabular-nums text-fg placeholder:text-muted/45 focus:border-accent focus:outline-none"
              />
              <input
                type="text"
                enterKeyHint="done"
                maxLength={24}
                value={row.load}
                onChange={(e) => updateRow(i, "load", e.target.value)}
                placeholder={last?.load || "ej. 10 kg"}
                aria-label={`${ex.name}, serie ${i + 1}: carga`}
                className="min-h-[44px] w-full min-w-0 rounded-xl border border-line bg-white/[0.06] px-2.5 font-mono text-base font-bold text-fg placeholder:text-muted/45 focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => deleteRow(i)}
                aria-label={`Borrar serie ${i + 1} de ${ex.name}`}
                title="Borrar serie"
                className="grid h-10 w-10 place-items-center rounded-xl text-muted transition hover:bg-warn/15 hover:text-warn"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addSetRow}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white/[0.07] px-3.5 py-2 text-xs font-semibold text-fg transition hover:bg-white/[0.12] hover:text-accent"
          >
            <Plus size={14} />Serie
          </button>
          {onStartRest && (
            <button
              type="button"
              onClick={() => onStartRest(ex.rest || 90)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white/[0.07] px-3 py-2 text-xs font-semibold text-muted transition hover:bg-accent/15 hover:text-accent"
              aria-label={`Iniciar descanso de ${ex.rest || 90} segundos`}
            >
              <Timer size={14} />Desc. {ex.rest || 90}s
            </button>
          )}
        </div>
        <span className="font-mono text-xs font-semibold text-muted tabular-nums">
          {validCount} {validCount === 1 ? "serie hecha" : "series hechas"}
        </span>
      </div>

      <div className="mt-2.5 flex items-start gap-1.5 border-t border-line pt-2.5 text-xs text-muted">
        <History size={13} className="mt-0.5 shrink-0" />
        {last ? (
          <span className="min-w-0">
            Última vez ({fmtShort(last.date)}): <span className="font-mono font-bold text-fg/85">{last.summaryText}</span>
          </span>
        ) : (
          <span className="text-faint">Última vez: sin registro previo</span>
        )}
      </div>
    </Card>
  );
}

/**
 * Vista principal del chip «Libre» dentro de Entreno: armado de sesión a la medida estilo Hevy.
 */
export function FreeWorkoutView({
  today,
  exIds = [],
  customExercises = [],
  seriesLog = {},
  fitbitShortcut,
  fitbitUrl,
  openWarmup,
  onOpenPicker,
  onSyncSeries,
  onMoveExercise,
  onRemoveExercise,
  onFinish,
  startTimer,
}) {
  const freeDay = seriesLog?.[today]?.free || {};
  const hasSets = hasFreeWorkout(seriesLog, today);

  const items = useMemo(() => (
    exIds.map((id) => {
      const ex = resolveFreeExercise(id, customExercises);
      return {
        ex,
        savedSeries: freeDay[id] || [],
        last: getLastFreeExerciseLog(seriesLog, id, today, ex.aliasIds),
      };
    })
  ), [exIds, customExercises, freeDay, seriesLog, today]);

  const liveSummary = useMemo(
    () => buildFreeWorkoutSummary({ exIds, customExercises, setLog: seriesLog, date: today }),
    [exIds, customExercises, seriesLog, today],
  );

  return (
    <div className="space-y-5">
      <Card glow={hasSets ? "good" : "accent"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-muted">Libre · a tu ritmo</div>
            <h1 className="mt-0.5 text-[30px] font-bold leading-tight tracking-tight sm:text-[34px]">Entreno libre</h1>
            <p className="mt-1 max-w-prose text-sm text-muted">
              Arma tu sesión de hoy eligiendo ejercicios de la biblioteca o creando los tuyos.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button type="button" onClick={onOpenPicker} className={btnCls("primary", "w-full sm:w-auto")}>
              <Plus size={18} />Añadir ejercicio
            </button>
            {fitbitShortcut && !fitbitShortcut.hidden && (
              <a
                href={fitbitUrl}
                className={btnCls("ghost", "flex-1 basis-[10.5rem] whitespace-nowrap px-3.5 text-sm sm:flex-none")}
              >
                <Watch size={16} className="text-accent" />
                Empezar con Fitbit
              </a>
            )}
            <button
              type="button"
              onClick={openWarmup}
              className={btnCls("ghost", "flex-1 basis-[10.5rem] whitespace-nowrap px-3.5 text-sm sm:flex-none")}
            >
              <Zap size={16} className="text-accent" />Modo Arranque (5 min)
            </button>
          </div>
        </div>

        {hasSets && (
          <div className="mt-4 space-y-2 border-t border-line pt-3">
            <StatusDot tone="good">
              {liveSummary.setsDone} {liveSummary.setsDone === 1 ? "serie anotada" : "series anotadas"} hoy · {liveSummary.exercisesDone} {liveSummary.exercisesDone === 1 ? "ejercicio" : "ejercicios"}
            </StatusDot>
            {liveSummary.workedGroups.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {liveSummary.workedGroups.map((g) => (
                  <Chip key={g.group} tone="accent">{g.label} · {g.sets}</Chip>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {items.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Dumbbell size={22} />
          </div>
          <h2 className="mt-3 text-lg font-bold tracking-tight">Tu entreno libre está vacío</h2>
          <p className="mt-1 text-sm text-muted">
            Toca «Añadir ejercicio» para buscar movimientos por grupo muscular o crear uno nuevo.
          </p>
          <button type="button" onClick={onOpenPicker} className={btnCls("primary", "mt-4 w-full sm:w-auto")}>
            <Plus size={18} />Añadir ejercicio
          </button>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 2xl:grid-cols-2">
            {items.map(({ ex, savedSeries, last }, i) => (
              <FreeExerciseCard
                key={ex.id}
                ex={ex}
                index={i}
                totalCount={items.length}
                savedSeries={savedSeries}
                last={last}
                onSyncSeries={(rows) => onSyncSeries(ex.id, rows)}
                onMove={(dir) => onMoveExercise(ex.id, dir)}
                onRemove={() => onRemoveExercise(ex.id)}
                onStartRest={startTimer}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button type="button" onClick={onOpenPicker} className={btnCls("ghost", "w-full sm:w-auto")}>
              <Plus size={17} />Añadir ejercicio
            </button>
            <button
              type="button"
              onClick={onFinish}
              disabled={!hasSets}
              className={btnCls("primary", "w-full flex-1")}
            >
              <Flag size={17} />Terminar entreno
            </button>
          </div>
          {!hasSets && (
            <p className="text-center text-xs text-muted">
              Anota repeticiones en al menos una serie para terminar y guardar en tus grupos musculares.
            </p>
          )}
        </>
      )}
    </div>
  );
}
