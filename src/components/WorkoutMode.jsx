import { useState, useEffect, useRef } from "react";
import { X, Check, ChevronLeft, ChevronRight, ArrowLeftRight, History, TrendingUp, Info, ChevronDown, Minus, Plus, Timer, Flag, Trash2, SkipForward, Volume2, VolumeX, BellRing } from "lucide-react";
import { fmtShort } from "../lib/dates.js";
import { effRir } from "../data/program.js";
import { nextPendingSet, nextPendingExercise, suggestSet, formatClock } from "../lib/workout.js";
import {
  unlockTimerAudio,
  playTimerDoneChime,
  playTimerPreviewPing,
  isTimerSoundEnabled,
  setTimerSoundEnabled,
  subscribeTimerSound,
} from "../lib/timerSound.js";
import { btnCls } from "./ui.jsx";

// Editor de la serie actual: reps con − / + y carga. Se reinicia (por `key`) al cambiar de serie o de ejercicio.
function SetEditor({ item, setIndex, isDone, onSave, onRemove }) {
  const { view, n, series, currentLoad, last, lastLog } = item;
  const sug = suggestSet({ series, setIndex, exReps: view.reps, currentLoad, lastLog, last, sets: n });
  const [reps, setReps] = useState(sug.reps != null ? String(sug.reps) : "");
  const [load, setLoad] = useState(sug.load || "");
  const step = (d) => setReps((r) => String(Math.max(0, Number(String(r).match(/\d+/)?.[0] || 0) + d)));
  const save = () => onSave(reps !== "" && !isNaN(Number(reps)) ? Number(reps) : reps, load);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="shrink-0">
          <div className="mb-1 text-[13px] font-medium text-muted">Reps</div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => step(-1)} className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.08] text-fg hover:bg-white/[0.14] active:scale-95" aria-label="Menos repeticiones"><Minus size={20} /></button>
            <input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" aria-label="Repeticiones"
              className="h-12 w-14 rounded-2xl border border-line bg-white/[0.06] text-center font-mono text-xl font-bold tabular-nums text-fg focus:border-accent focus:outline-none" />
            <button type="button" onClick={() => step(1)} className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.08] text-fg hover:bg-white/[0.14] active:scale-95" aria-label="Más repeticiones"><Plus size={20} /></button>
          </div>
        </div>
        <label className="min-w-0 flex-1">
          <div className="mb-1 text-[13px] font-medium text-muted">Carga</div>
          <input value={load} onChange={(e) => setLoad(e.target.value)} placeholder="ej. 40 kg" maxLength={24}
            className="h-12 w-full rounded-2xl border border-line bg-white/[0.06] px-3 font-mono text-lg font-bold text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none" />
        </label>
      </div>
      <button type="button" onClick={save} className={btnCls("primary", "h-16 w-full text-lg font-bold")}>
        <Check size={24} strokeWidth={3} />{isDone ? `Guardar serie ${setIndex + 1}` : "Serie hecha"}
      </button>
      {isDone && (
        <button type="button" onClick={onRemove} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-medium text-muted hover:bg-warn/15 hover:text-warn">
          <Trash2 size={16} />Quitar serie {setIndex + 1}
        </button>
      )}
    </div>
  );
}

/**
 * Modo entreno a pantalla completa: un ejercicio a la vez.
 * items: [{ ex, view, alt, n, done, series, currentLoad, last, lastLog }] (calculados en TrainView).
 */
export function WorkoutMode({ routine, week, items, startIndex = 0, session, timer, startTimer, onClearTimer, onSaveSet, onRemoveSet, onSwap, onSkip, onClose, onFinish }) {
  const [idx, setIdx] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, items.length - 1)));
  const [picked, setPicked] = useState(null); // serie elegida a mano; null = la primera pendiente
  const [localRest, setLocalRest] = useState(null); // respaldo si no se pasa timer global
  const [restDoneBanner, setRestDoneBanner] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => isTimerSoundEnabled());
  const [testingSound, setTestingSound] = useState(false);
  const [tips, setTips] = useState(false);
  const [now, setNow] = useState(Date.now());
  const stripRef = useRef(null);
  const prevGlobalTimerIdRef = useRef(timer ? (timer.id ?? timer.endAt) : null);
  const dismissedGlobalRestRef = useRef(false);
  const testTimeoutRef = useRef(null);

  useEffect(() => subscribeTimerSound(setSoundEnabled), []);

  useEffect(() => () => {
    if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
  }, []);

  // Detecta cuando el temporizador global termina para mostrar «¡Listo!» dentro de Modo entreno.
  useEffect(() => {
    const curId = timer ? (timer.id ?? timer.endAt) : null;
    if (curId != null) {
      prevGlobalTimerIdRef.current = curId;
      dismissedGlobalRestRef.current = false;
      setRestDoneBanner(false);
    } else if (prevGlobalTimerIdRef.current != null) {
      prevGlobalTimerIdRef.current = null;
      if (!dismissedGlobalRestRef.current) {
        setRestDoneBanner(true);
      }
      dismissedGlobalRestRef.current = false;
    }
  }, [timer]);

  useEffect(() => {
    if (items.length === 0) {
      onClose();
      return;
    }
    if (idx >= items.length) {
      setIdx(items.length - 1);
      setPicked(null);
      setTips(false);
    }
  }, [items.length, idx, onClose]);

  // La lista de abajo no se desplaza mientras el modo está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 250);
    const onVisible = () => { if (!document.hidden) tick(); };
    // Escape cierra el modo (salvo que esté abierta la hoja de sustituir o el resumen encima).
    const onKey = (e) => { if (e.key === "Escape" && document.querySelectorAll('[role="dialog"]').length === 1) closeRef.current(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    const el = stripRef.current && stripRef.current.querySelector('[aria-current="step"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "center" });
  }, [idx]);

  const item = items[idx];
  if (!item) return null;
  const { ex, view, alt, n, done, series, last } = item;
  const pending = nextPendingSet(done);
  const setIndex = picked != null ? picked : pending;
  const exerciseDone = setIndex < 0;
  const allDone = items.map((it) => it.done);
  const nextIdx = nextPendingExercise(allDone, idx + 1);
  const usesGlobalTimer = timer !== undefined || typeof startTimer === "function";
  const activeRest = usesGlobalTimer
    ? (timer ? { endAt: timer.endAt, total: timer.duration, paused: Boolean(timer.paused), left: timer.left } : null)
    : localRest;
  const restLeft = activeRest ? (activeRest.paused ? activeRest.left : Math.max(0, activeRest.endAt - now)) : 0;
  const showRestCard = Boolean(activeRest) || restDoneBanner;
  const goTo = (i) => { setIdx(i); setPicked(null); setTips(false); setRestDoneBanner(false); };
  const elapsedMs = session && session.startAt ? Math.max(0, (session.endAt || now) - session.startAt) : null;
  const restSec = ex.emom ? 60 : ex.rest || 0;
  const target = suggestSet({ series, setIndex: exerciseDone ? n - 1 : setIndex, exReps: view.reps, currentLoad: item.currentLoad, lastLog: item.lastLog, last, sets: n });

  const toggleSound = () => {
    unlockTimerAudio();
    const next = !soundEnabled;
    setTimerSoundEnabled(next);
    if (next) playTimerPreviewPing();
  };

  const testSound = () => {
    unlockTimerAudio();
    playTimerDoneChime({ enabled: true, vibrate: true });
    setTestingSound(true);
    if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
    testTimeoutRef.current = setTimeout(() => {
      setTestingSound(false);
      testTimeoutRef.current = null;
    }, 900);
  };

  const dismissRest = () => {
    setRestDoneBanner(false);
    if (usesGlobalTimer) {
      dismissedGlobalRestRef.current = true;
      if (onClearTimer) onClearTimer();
    } else {
      setLocalRest(null);
    }
  };

  const triggerManualRest = (sec) => {
    if (!sec) return;
    unlockTimerAudio();
    setRestDoneBanner(false);
    if (typeof startTimer === "function") {
      startTimer(sec);
    } else {
      setLocalRest({ endAt: Date.now() + sec * 1000, total: sec * 1000 });
    }
  };

  const save = (reps, load) => {
    unlockTimerAudio();
    const wasDone = !!done[setIndex];
    setRestDoneBanner(false);
    onSaveSet(item, setIndex, reps, load);
    setPicked(null);
    if (!wasDone && restSec && !usesGlobalTimer) {
      setLocalRest({ endAt: Date.now() + restSec * 1000, total: restSec * 1000 });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] pt-[max(12px,env(safe-area-inset-top))]"
      style={{ background: "radial-gradient(120% 50% at 50% -8%, rgb(54 68 104 / .55) 0%, transparent 60%), linear-gradient(180deg, rgb(27 33 48) 0%, var(--bg) 60%)" }}
      role="dialog" aria-modal="true" aria-label={`Modo entreno: ${routine.name}`}>
      <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col">
        {/* Encabezado */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.08] text-muted hover:bg-white/[0.12] hover:text-fg" aria-label="Cerrar modo entreno"><X size={22} /></button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[13px] font-medium text-muted">{routine.short} · {routine.name}</div>
            <div className="font-mono text-lg font-bold tabular-nums">{elapsedMs != null ? formatClock(elapsedMs) : "—"}</div>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? "Silenciar sonido del temporizador" : "Activar sonido del temporizador"}
            title={soundEnabled ? "Sonido activo" : "Sonido silenciado"}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition ${
              soundEnabled
                ? "bg-accent/15 text-accent hover:bg-accent/25"
                : "bg-white/[0.08] text-muted hover:bg-white/[0.12] hover:text-fg"
            }`}
          >
            {soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <button type="button" onClick={onFinish} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-good/15 px-3.5 text-sm font-semibold text-good hover:bg-good/25"><Flag size={16} />Terminar</button>
        </div>

        {/* Tira de ejercicios */}
        <div ref={stripRef} className="no-scrollbar -mx-1 mt-3 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1">
          {items.map((it, i) => {
            const complete = nextPendingSet(it.done) < 0;
            return (
              <button key={it.ex.id} type="button" onClick={() => goTo(i)} aria-current={i === idx ? "step" : undefined} aria-label={`${it.view.name}${complete ? " (completo)" : ""}`}
                className={`grid h-12 min-w-12 shrink-0 place-items-center rounded-2xl px-2.5 font-mono text-sm font-bold transition ${i === idx ? "bg-accent/18 text-accent ring-1 ring-inset ring-accent/50" : complete ? "bg-good/15 text-good" : "bg-white/[0.06] text-muted"}`}>
                {complete ? <span className="inline-flex items-center gap-0.5"><Check size={13} strokeWidth={3} />{it.ex.block}</span> : it.ex.block}
              </button>
            );
          })}
        </div>

        {/* Ejercicio actual */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-3">
          <div className="text-[13px] font-medium text-accent">Ejercicio {idx + 1} de {items.length} · {ex.block}</div>
          <h2 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">{view.name}</h2>
          {alt && <div className="mt-1 text-xs text-cool">Sustituye a: {ex.name}</div>}

          <div className={`mt-3 text-xl font-bold tracking-tight ${exerciseDone ? "text-good" : "text-fg"}`}>
            {exerciseDone ? "Ejercicio completo" : `Serie ${setIndex + 1} de ${n}`}
          </div>

          <dl className="card mt-3 grid grid-cols-3 gap-2 p-3.5 text-center">
            <div className="min-w-0"><dt className="text-xs font-medium text-muted">Reps</dt><dd className="truncate font-mono text-xl font-bold text-fg" title={view.reps}>{target.reps}</dd></div>
            <div className="min-w-0"><dt className="text-xs font-medium text-muted">Carga</dt><dd className="truncate font-mono text-xl font-bold text-fg">{target.load || "—"}</dd></div>
            <div><dt className="text-xs font-medium text-muted">RIR</dt><dd className="font-mono text-xl font-bold text-fg tabular-nums">{effRir(view, week)}</dd></div>
          </dl>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>Rango {view.reps}</span><span>Tempo {view.tempo}</span>
            {restSec > 0 ? (
              <button
                type="button"
                onClick={() => triggerManualRest(restSec)}
                className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-muted transition hover:bg-accent/15 hover:text-accent"
                aria-label={`Iniciar descanso de ${restSec} segundos`}
              >
                <Timer size={12} />{ex.emom ? "EMOM · 60 s" : `Descanso ${restSec} s`}
              </button>
            ) : (
              <span>Sin descanso</span>
            )}
          </div>
          {target.progression && (
            <div className={`mt-2 flex items-start gap-1.5 text-sm ${target.progression.type === "load" ? "text-good" : target.progression.type === "reps" ? "text-accent" : "text-warn"}`}>
              <TrendingUp size={15} className="mt-0.5 shrink-0" /><span>{target.progression.text}</span>
            </div>
          )}
          {last && (last.v || last.reps) && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
              <History size={13} className="mt-px shrink-0" />
              <span>Última vez ({fmtShort(last.d)}): {last.v && <span className="font-mono font-bold text-fg">{last.v}</span>} {last.reps && `(${last.reps})`}</span>
            </div>
          )}

          {/* Series de este ejercicio */}
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: n }).map((_, i) => {
              const s = series[i];
              const sel = i === setIndex;
              return (
                <button key={i} type="button" onClick={() => setPicked(i)} aria-pressed={sel} aria-label={`Serie ${i + 1}${done[i] ? ", hecha" : ""}`}
                  className={`flex h-12 min-w-12 items-center justify-center gap-1 rounded-2xl px-3 font-mono text-sm font-bold transition ${done[i] ? "bg-accent text-accentInk" : "bg-white/[0.07] text-muted"} ${sel ? "ring-2 ring-fg ring-offset-2 ring-offset-bg" : ""}`}>
                  {done[i] ? <><Check size={15} strokeWidth={3} />{s && s.reps != null ? s.reps : ""}{s && s.load ? <span className="text-[11px] opacity-80">·{s.load}</span> : null}</> : i + 1}
                </button>
              );
            })}
          </div>

          {showRestCard && (
            <div className={`mt-3 rounded-2xl p-3.5 ${restLeft > 0 ? "bg-cool/12" : "bg-good/12 ring-1 ring-inset ring-good/30"}`} aria-live="polite">
              {restLeft > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-cool">
                      <Timer size={16} />{activeRest?.paused ? "Descanso en pausa" : "Descanso"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-3xl font-bold tabular-nums">{formatClock(restLeft + 999)}</span>
                      <button
                        type="button"
                        onClick={testSound}
                        aria-label="Probar sonido del temporizador"
                        title="Probar sonido"
                        className={`grid h-9 w-9 place-items-center rounded-xl transition ${
                          testingSound ? "bg-good/20 text-good" : "bg-white/[0.08] text-accent hover:bg-white/[0.14]"
                        }`}
                      >
                        <BellRing size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={dismissRest}
                        aria-label="Omitir descanso"
                        title="Omitir descanso"
                        className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.08] text-muted hover:bg-white/[0.14] hover:text-fg"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.1]">
                    <div
                      className="h-full rounded-full bg-cool"
                      style={{ width: `${Math.max(0, Math.min(100, activeRest?.total ? (restLeft / activeRest.total) * 100 : 0))}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-good">
                    ¡Listo! Descanso terminado. {exerciseDone ? "Pasa al siguiente ejercicio." : "A la siguiente serie."}
                  </div>
                  <button
                    type="button"
                    onClick={dismissRest}
                    aria-label="Cerrar aviso de descanso"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-good hover:bg-white/[0.14]"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className={`mt-3 grid gap-2 ${onSkip ? "grid-cols-3" : "grid-cols-2"}`}>
            <button type="button" onClick={() => onSwap(ex.id)} className={btnCls("ghost", "px-3 text-sm hover:text-cool")}><ArrowLeftRight size={16} />Sustituir</button>
            {onSkip && (
              <button type="button" onClick={() => onSkip(ex.id)} className={btnCls("ghost", "px-3 text-sm text-muted hover:text-warn")}><SkipForward size={16} />Saltar</button>
            )}
            <button type="button" onClick={() => setTips((t) => !t)} aria-expanded={tips} className={btnCls("ghost", "px-3 text-sm")}><Info size={16} />Tips<ChevronDown size={16} className={`transition-transform ${tips ? "rotate-180" : ""}`} /></button>
          </div>
          {tips && <ul className="mt-2 space-y-1.5 text-sm text-muted">{view.tips.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />{t}</li>)}</ul>}
        </div>

        {/* Acciones al alcance del pulgar */}
        <div className="shrink-0 border-t border-line pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          {exerciseDone ? (
            <button type="button" onClick={() => (nextIdx >= 0 ? goTo(nextIdx) : onFinish())} className={btnCls("primary", "h-16 w-full text-lg font-bold")}>
              {nextIdx >= 0 ? <>Siguiente ejercicio<ChevronRight size={24} /></> : <><Flag size={20} />Ver resumen</>}
            </button>
          ) : (
            <SetEditor key={`${ex.id}:${view.name}:${setIndex}:${done[setIndex] ? 1 : 0}`} item={item} setIndex={setIndex} isDone={!!done[setIndex]}
              onSave={save} onRemove={() => { onRemoveSet(item, setIndex); setPicked(null); }} />
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => goTo(idx - 1)} disabled={idx === 0} className={btnCls("ghost", "w-full px-3 text-sm")}><ChevronLeft size={18} />Anterior</button>
            <button type="button" onClick={() => goTo(idx + 1)} disabled={idx >= items.length - 1} className={btnCls("ghost", "w-full px-3 text-sm")}>Siguiente ejercicio<ChevronRight size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
