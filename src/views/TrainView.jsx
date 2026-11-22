import { useState, useEffect, useRef } from "react";
import { Check, Zap, BatteryLow, Trophy, Watch, Play, Flag } from "lucide-react";
import { dkey, pruneDays } from "../lib/dates.js";
import { usePersisted } from "../lib/storage.js";
import { getLastExerciseLog, resolveDefaultSet, recordSet, removeSet, updateExerciseLoad } from "../lib/setLog.js";
import { DEFAULT_RUN_LEVEL, getDisplayRunLevel, undoRunSession, hasInactivityDecay, applyInactivityDecay, recordRunSession } from "../lib/runProgress.js";
import { MAX_RUN_LEVEL, getRunLevel } from "../data/runPlan.js";
import { ROUTINES, BLOCK_WEEKS, effSets, routineById, variantsFor } from "../data/program.js";
import { altFor } from "../data/subs.js";
import { resolveVariantId, setRoutineVariant, toggleSkipExercise, computeRoutineProgress } from "../lib/routines.js";
import { ProgressBar } from "../components/ui.jsx";
import { SwapModal, ExerciseCard, withAlt } from "../components/ExerciseCard.jsx";
import { WorkoutMode } from "../components/WorkoutMode.jsx";
import { WorkoutSummary } from "../components/WorkoutSummary.jsx";
import { touchSession, finishSession, buildWorkoutSummary, nextPendingExercise } from "../lib/workout.js";
import { useFitbitShortcut, buildFitbitShortcutUrl } from "../components/FitbitShortcutCard.jsx";

export function TrainView({ sets, setSets, seriesLog: seriesLogProp, setSeriesLog: setSeriesLogProp, log, setLog, block, swaps, setSwaps, loads, setLoads, lastLoads, setLastLoads, routineVariants, setRoutineVariants, skips, setSkips, startTimer, openWarmup, wp, initialRid }) {
  const today = dkey();
  const [rid, setRid] = useState(() => initialRid || log[dkey()]?.r || wp.arr[wp.todayIdx] || wp.nextRid || "d1");
  const [swapFor, setSwapFor] = useState(null);
  const [localSeriesLog, setLocalSeriesLog] = usePersisted("setLog", {});
  const seriesLog = seriesLogProp !== undefined ? seriesLogProp : localSeriesLog;
  const setSeriesLog = setSeriesLogProp || setLocalSeriesLog;
  const [runLevel, setRunLevel] = usePersisted("runLevel", DEFAULT_RUN_LEVEL);
  const [fitbitShortcut] = useFitbitShortcut();
  // Hora de inicio y fin del entreno de hoy (solo en este dispositivo, para la duración del resumen).
  const [session, setSession] = usePersisted("trainSession", null);
  const [mode, setMode] = useState(null); // modo entreno abierto: { start: índice del ejercicio }
  const [summaryOpen, setSummaryOpen] = useState(false);
  const activeRunLevel = getDisplayRunLevel(runLevel, today);
  const runPlan = getRunLevel(activeRunLevel);
  const variants = variantsFor(rid);
  const activeVariantId = resolveVariantId(rid, routineVariants);
  const routine = routineById(rid, activeRunLevel, activeVariantId);
  const week = block.week || 1;
  const daySets = (sets[today] || {})[rid] || {};
  const daySwaps = (swaps[today] || {})[rid] || {};
  const dayLoads = (loads[today] || {})[rid] || {};
  const daySetLog = (seriesLog[today] || {})[rid] || {};
  const daySkips = ((skips || {})[today] || {})[rid] || {};

  const pickVariant = (variantId) => {
    if (!setRoutineVariants) return;
    setRoutineVariants((prev) => setRoutineVariant(prev, rid, variantId));
  };

  const handleVariantKeyDown = (e) => {
    if (!variants.length) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const curIdx = Math.max(0, variants.findIndex((v) => v.id === activeVariantId));
    let nextIdx = curIdx;
    if (e.key === "ArrowRight") nextIdx = (curIdx + 1) % variants.length;
    else if (e.key === "ArrowLeft") nextIdx = (curIdx - 1 + variants.length) % variants.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = variants.length - 1;
    const target = variants[nextIdx];
    pickVariant(target.id);
    const btn = e.currentTarget.querySelector(`[data-variant-id="${target.id}"]`);
    if (btn) btn.focus();
  };

  const toggleSkip = (exId) => {
    if (!setSkips) return;
    setSkips((all) => toggleSkipExercise(all, { date: today, rid, exId, maxDays: 21 }));
  };

  const setSwap = (exId, altId) => setSwaps((all) => {
    const day = { ...(all[today] || {}) };
    const r = { ...(day[rid] || {}) };
    if (altId) r[exId] = altId; else delete r[exId];
    day[rid] = r;
    return pruneDays({ ...all, [today]: day }, 21);
  });
  // Última carga usada en un día anterior, por ejercicio (o por su sustituto si hay uno activo).
  const loadKey = (exId) => (daySwaps[exId] ? `${exId}:${daySwaps[exId]}` : exId);
  const lastFor = (exId) => {
    const hist = getLastExerciseLog(seriesLog, exId, today, rid);
    if (hist && (hist.load || hist.repsSummary)) {
      return { d: hist.date, v: hist.load, reps: hist.repsSummary, series: hist.series };
    }
    const l = (lastLoads || {})[loadKey(exId)];
    return l && l.d !== today ? l : (l && l.prev) || null;
  };
  const rememberLoad = (exId, v) => setLastLoads((all) => {
    const k = loadKey(exId);
    const cur = (all || {})[k];
    const prev = cur && cur.d !== today ? { v: cur.v, d: cur.d } : (cur && cur.prev) || null;
    const next = { ...(all || {}) };
    if (v) next[k] = { v, d: today, prev }; else if (prev) next[k] = prev; else delete next[k];
    return next;
  });
  const setLoad = (exId, v) => {
    rememberLoad(exId, v);
    setLoadRaw(exId, v);
    setSeriesLog((all) => updateExerciseLoad({
      setLog: all,
      date: today,
      routineId: rid,
      exerciseId: exId,
      load: v,
      maxDays: 90,
    }));
  };
  const setLoadRaw = (exId, v) => setLoads((all) => {
    const day = { ...(all[today] || {}) };
    const r = { ...(day[rid] || {}) };
    if (v) r[exId] = v; else delete r[exId];
    day[rid] = r;
    return pruneDays({ ...all, [today]: day }, 21);
  });
  const swapEx = swapFor ? routine.exercises.find((e) => e.id === swapFor) : null;

  const { activeExercises, done, total, progress } = computeRoutineProgress(routine.exercises, {
    daySetLog,
    daySets,
    daySkips,
    week,
  });
  const skippedCount = routine.exercises.length - activeExercises.length;
  const logged = log[today];
  const todaySession = session && session.date === today && session.rid === rid ? session : null;
  const touch = () => setSession((s) => touchSession(s, { date: today, routineId: rid, now: Date.now() }));
  const registerSession = () => setLog((l) => ({
    ...l,
    [today]: { r: rid, ...(activeVariantId ? { v: activeVariantId } : {}), at: Date.now() },
  }));

  // Cada ejercicio con lo que necesitan la tarjeta, el modo entreno y el resumen.
  const items = routine.exercises.map((ex) => {
    const n = effSets(ex, week);
    const series = daySetLog[ex.id] || [];
    const boxes = daySets[ex.id] || [];
    const alt = altFor(ex.id, daySwaps[ex.id]);
    return {
      ex, alt, n, series,
      skipped: !!daySkips[ex.id],
      view: withAlt(ex, alt),
      done: Array.from({ length: n }, (_, i) => !!series[i] || !!boxes[i]),
      currentLoad: dayLoads[ex.id] || (series.slice().reverse().find((s) => s && s.load)?.load) || "",
      last: lastFor(ex.id),
      lastLog: getLastExerciseLog(seriesLog, ex.id, today, rid),
    };
  });
  const activeItems = items.filter((it) => !it.skipped);

  const openMode = (startExId = null) => {
    if (!activeItems.length) return;
    touch();
    if (startExId != null) {
      const targetIdx = activeItems.findIndex((it) => it.ex.id === startExId);
      setMode({ start: Math.max(0, targetIdx) });
      return;
    }
    const first = nextPendingExercise(activeItems.map((it) => it.done), 0);
    setMode({ start: Math.max(0, first) });
  };
  const finish = () => {
    setSession((s) => finishSession(s, { date: today, routineId: rid, now: Date.now() }));
    setSummaryOpen(true);
  };
  // Al completar la última serie (aquí mismo, no por sincronización) se abre el resumen.
  const prevProgress = useRef({ rid, vid: activeVariantId, progress });
  useEffect(() => {
    const prev = prevProgress.current;
    prevProgress.current = { rid, vid: activeVariantId, progress };
    if (prev.rid === rid && prev.vid === activeVariantId && total > 0 && prev.progress < 1 && progress >= 1 && todaySession) finish();
  }, [rid, activeVariantId, total, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasInactivityDecay(runLevel, today)) {
      setRunLevel((prev) => applyInactivityDecay(prev, today));
    }
  }, [runLevel, today, setRunLevel]);

  useEffect(() => {
    if (total > 0 && progress >= 1 && (!logged || logged.r !== rid || logged.v !== activeVariantId)) {
      setLog((l) => ({
        ...l,
        [today]: { r: rid, ...(activeVariantId ? { v: activeVariantId } : {}), at: Date.now() },
      }));
    }
  }, [total, progress, logged, rid, activeVariantId, today, setLog]);

  useEffect(() => {
    if (logged && logged.r === "d3") {
      setRunLevel((prev) => recordRunSession(prev, { date: today, done: true }));
    }
  }, [logged, today, setRunLevel]);

  const toggle = (ex, i, n) => {
    const exSeries = daySetLog[ex.id] || [];
    const was = !!exSeries[i] || !!(daySets[ex.id] || [])[i];

    if (was) {
      setSeriesLog((all) => removeSet({
        setLog: all,
        date: today,
        routineId: rid,
        exerciseId: ex.id,
        setIndex: i,
        maxDays: 90,
      }));
      setSets((all) => {
        const day = { ...(all[today] || {}) };
        const r = { ...(day[rid] || {}) };
        const arr = Array.from({ length: n }, (_, k) => !!(r[ex.id] || [])[k]);
        arr[i] = false;
        r[ex.id] = arr;
        day[rid] = r;
        const next = { ...all, [today]: day };
        const keep = Object.keys(next).sort().slice(-21);
        return Object.fromEntries(keep.map((k) => [k, next[k]]));
      });
    } else {
      touch();
      const lastSession = getLastExerciseLog(seriesLog, ex.id, today, rid);
      const resolved = resolveDefaultSet({
        series: exSeries,
        setIndex: i,
        exReps: ex.reps,
        currentLoad: dayLoads[ex.id] || (exSeries.slice().reverse().find((s) => s && s.load)?.load) || "",
        lastLog: lastSession,
      });
      setSeriesLog((all) => recordSet({
        setLog: all,
        date: today,
        routineId: rid,
        exerciseId: ex.id,
        setIndex: i,
        reps: resolved.reps,
        load: resolved.load,
        maxDays: 90,
      }));
      if (resolved.load && !dayLoads[ex.id]) {
        rememberLoad(ex.id, resolved.load);
        setLoadRaw(ex.id, resolved.load);
      }
      setSets((all) => {
        const day = { ...(all[today] || {}) };
        const r = { ...(day[rid] || {}) };
        const arr = Array.from({ length: n }, (_, k) => !!(r[ex.id] || [])[k]);
        arr[i] = true;
        r[ex.id] = arr;
        day[rid] = r;
        const next = { ...all, [today]: day };
        const keep = Object.keys(next).sort().slice(-21);
        return Object.fromEntries(keep.map((k) => [k, next[k]]));
      });
      if (ex.rest) startTimer(ex.rest);
      if (ex.emom) startTimer(60);
    }
  };

  const saveSet = (ex, i, reps, load, n) => {
    const exSeries = daySetLog[ex.id] || [];
    const was = !!exSeries[i] || !!(daySets[ex.id] || [])[i];

    touch();
    setSeriesLog((all) => recordSet({
      setLog: all,
      date: today,
      routineId: rid,
      exerciseId: ex.id,
      setIndex: i,
      reps,
      load,
      maxDays: 90,
    }));
    if (load) {
      rememberLoad(ex.id, load);
      setLoadRaw(ex.id, load);
    }
    setSets((all) => {
      const day = { ...(all[today] || {}) };
      const r = { ...(day[rid] || {}) };
      const arr = Array.from({ length: n }, (_, k) => !!(r[ex.id] || [])[k]);
      arr[i] = true;
      r[ex.id] = arr;
      day[rid] = r;
      const next = { ...all, [today]: day };
      const keep = Object.keys(next).sort().slice(-21);
      return Object.fromEntries(keep.map((k) => [k, next[k]]));
    });
    if (!was && ex.rest) startTimer(ex.rest);
    if (!was && ex.emom) startTimer(60);
  };

  const bw = BLOCK_WEEKS[week - 1];
  // La rutina elegida siempre queda a la vista en la tira de rutinas (en el teléfono se sale por la derecha).
  useEffect(() => {
    const el = document.querySelector('[data-routine-chip][aria-pressed="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "center" });
  }, [rid]);

  useEffect(() => {
    const el = document.querySelector('[data-variant-id][aria-selected="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [rid, activeVariantId]);

  return (
    <div>
      <div className="min-w-0 space-y-4">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {ROUTINES.map((r) => {
            const chipRoutine = routineById(r.id, activeRunLevel, resolveVariantId(r.id, routineVariants));
            return (
              <button key={r.id} data-routine-chip onClick={() => setRid(r.id)} aria-pressed={r.id === rid}
                className={`shrink-0 rounded-xl border px-3.5 py-2 text-left transition ${r.id === rid ? (r.low ? "border-cool bg-cool/15" : "border-accent bg-accent/15") : "border-line bg-surface hover:border-muted"}`}>
                <div className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest ${r.id === rid ? (r.low ? "text-cool" : "text-accent") : "text-muted"}`}>{r.low && <BatteryLow size={12} />}{r.short}{log[today]?.r === r.id && <Check size={12} />}</div>
                <div className="whitespace-nowrap text-sm font-medium">{r.low ? (chipRoutine.variantId === "trx_upper" ? "Torso Correas · 20 min" : "Baja energía · 20 min") : chipRoutine.name}</div>
              </button>
            );
          })}
        </div>

        <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{routine.short} · ~{routine.minutes} min · Semana {week} {bw.label}</div>
              <h1 className="font-display text-3xl font-semibold uppercase leading-[0.95] md:text-4xl">{routine.name}</h1>
              <p className="mt-1 max-w-prose text-sm text-muted">{routine.focus}</p>
              {rid === "d3" && (
                <p className="mt-1.5 text-xs font-medium text-accent">
                  Nivel {runPlan.level} de {MAX_RUN_LEVEL} · {runPlan.reps} × {runPlan.runMin} min trote + {runPlan.walkMin} min caminata
                </p>
              )}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <button onClick={() => openMode()} disabled={!activeItems.length} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk shadow-lg disabled:opacity-40 sm:w-auto">
                <Play size={16} />Modo entreno
              </button>
              {!fitbitShortcut.hidden && (
                <a
                  href={buildFitbitShortcutUrl(fitbitShortcut.name)}
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-sm font-semibold text-fg transition hover:border-accent hover:text-accent"
                >
                  <Watch size={16} className="text-accent" />
                  Empezar con Fitbit
                </a>
              )}
              <button onClick={openWarmup} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-sm font-semibold text-fg transition hover:border-accent hover:text-accent"><Zap size={16} className="text-accent" />Modo Arranque (5 min)</button>
            </div>
          </div>

          {variants.length > 1 && (
            <div role="tablist" aria-label="Variantes de rutina" onKeyDown={handleVariantKeyDown} className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
              {variants.map((v) => {
                const active = v.id === activeVariantId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    data-variant-id={v.id}
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    onClick={() => pickVariant(v.id)}
                    className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition ${
                      active
                        ? "border-accent/60 bg-accent/15 text-fg"
                        : "border-line bg-surface2 text-muted hover:text-fg"
                    }`}
                  >
                    <div className={`whitespace-nowrap font-semibold ${active ? "text-accent" : ""}`}>{v.label}</div>
                    <div className="whitespace-nowrap text-[11px] text-muted">~{v.minutes} min</div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <ProgressBar value={progress} />
            <span className="shrink-0 font-mono text-sm tabular-nums">{done}/{total}</span>
          </div>
          {skippedCount > 0 && (
            <div className="mt-1.5 text-xs text-muted">
              {skippedCount === 1 ? "1 bloque saltado hoy." : `${skippedCount} bloques saltados hoy.`}
            </div>
          )}
          {done > 0 && (
            <button onClick={finish} className="mt-2 mr-2 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent">
              <Flag size={14} />Terminar y ver resumen
            </button>
          )}
          {logged ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-good"><Trophy size={14} />Sesión registrada hoy: {routineById(logged.r, undefined, logged.v).name}</span>
              <button onClick={() => { if (logged.r === "d3") setRunLevel((prev) => undoRunSession(prev, today)); setLog((l) => { const n = { ...l }; delete n[today]; return n; }); }} className="rounded-lg px-2 py-1 text-muted hover:bg-surface2 hover:text-fg">Quitar registro</button>
            </div>
          ) : (
            <button onClick={registerSession} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-good/40 px-3 py-1.5 text-xs text-good hover:bg-good/10">
              <Check size={14} />Ya la hice: registrar sesión de hoy
            </button>
          )}
        </section>

        <div className="grid gap-3 2xl:grid-cols-2">
          {items.map(({ ex, alt, done: doneArr, series: exSeries, currentLoad, last, skipped }) => (
            <ExerciseCard
              key={ex.id + week}
              ex={ex}
              alt={alt}
              week={week}
              done={doneArr}
              skipped={skipped}
              series={exSeries}
              onToggle={(i, count) => toggle(ex, i, count)}
              onSaveSet={(i, reps, load, count) => saveSet(ex, i, reps, load, count)}
              onSwap={() => setSwapFor(ex.id)}
              onRevert={() => setSwap(ex.id, null)}
              onSkip={() => toggleSkip(ex.id)}
              load={currentLoad}
              onLoad={(v) => setLoad(ex.id, v)}
              last={last}
              onFocus={() => openMode(ex.id)}
            />
          ))}
        </div>
        {mode && activeItems.length > 0 && (
          <WorkoutMode
            key={`${rid}:${activeVariantId || "base"}`}
            routine={routine}
            week={week}
            items={activeItems}
            startIndex={mode.start}
            session={todaySession}
            onSaveSet={(it, i, reps, load) => saveSet(it.ex, i, reps, load, it.n)}
            onRemoveSet={(it, i) => toggle(it.ex, i, it.n)}
            onSwap={(exId) => setSwapFor(exId)}
            onSkip={(exId) => toggleSkip(exId)}
            onClose={() => setMode(null)}
            onFinish={finish}
          />
        )}
        {summaryOpen && (
          <WorkoutSummary
            routine={routine}
            summary={buildWorkoutSummary({
              exercises: activeItems.map((it) => ({ id: it.ex.id, name: it.view.name, reps: it.view.reps, sets: it.n })),
              setLog: seriesLog, sets, loads, date: today, routineId: rid, session, now: Date.now(),
            })}
            logged={!!logged && logged.r === rid}
            skippedCount={skippedCount}
            onRegister={registerSession}
            onContinue={() => { setSummaryOpen(false); if (!mode) openMode(); }}
            onClose={() => setSummaryOpen(false)}
            onDone={() => { setSummaryOpen(false); setMode(null); }}
          />
        )}
        {swapEx && (
          <SwapModal
            ex={swapEx}
            week={week}
            current={daySwaps[swapEx.id]}
            skipped={!!daySkips[swapEx.id]}
            onPick={(altId) => { setSwap(swapEx.id, altId); setSwapFor(null); }}
            onSkip={() => toggleSkip(swapEx.id)}
            onClose={() => setSwapFor(null)}
          />
        )}
      </div>

    </div>
  );
}
