import { useState, useEffect, useRef } from "react";
import { X, Check, ChevronLeft, ChevronRight, ArrowLeftRight, History, TrendingUp, Info, ChevronDown, Minus, Plus, Timer, Flag, Trash2 } from "lucide-react";
import { fmtShort } from "../lib/dates.js";
import { effRir } from "../data/program.js";
import { nextPendingSet, nextPendingExercise, suggestSet, formatClock } from "../lib/workout.js";

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
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Reps</div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => step(-1)} className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-surface2 active:scale-95" aria-label="Menos repeticiones"><Minus size={20} /></button>
            <input value={reps} onChange={(e) => setReps(e.target.value)} inputMode="numeric" aria-label="Repeticiones"
              className="h-12 w-14 rounded-xl border border-line bg-surface2 text-center font-mono text-xl tabular-nums text-fg focus:border-accent focus:outline-none" />
            <button type="button" onClick={() => step(1)} className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-surface2 active:scale-95" aria-label="Más repeticiones"><Plus size={20} /></button>
          </div>
        </div>
        <label className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted">Carga</div>
          <input value={load} onChange={(e) => setLoad(e.target.value)} placeholder="ej. 40 kg" maxLength={24}
            className="h-12 w-full rounded-xl border border-line bg-surface2 px-3 font-mono text-lg text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none" />
        </label>
      </div>
      <button type="button" onClick={save} className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-accent font-display text-2xl font-semibold uppercase tracking-wide text-accentInk shadow-lg active:scale-[0.99]">
        <Check size={26} strokeWidth={3} />{isDone ? `Guardar serie ${setIndex + 1}` : "Serie hecha"}
      </button>
      {isDone && (
        <button type="button" onClick={onRemove} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm text-muted hover:bg-surface2 hover:text-warn">
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
export function WorkoutMode({ routine, week, items, startIndex = 0, session, onSaveSet, onRemoveSet, onSwap, onClose, onFinish }) {
  const [idx, setIdx] = useState(() => Math.min(Math.max(0, startIndex), items.length - 1));
  const [picked, setPicked] = useState(null); // serie elegida a mano; null = la primera pendiente
  const [rest, setRest] = useState(null); // { endAt, total } solo para mostrar; el temporizador global suena
  const [tips, setTips] = useState(false);
  const [now, setNow] = useState(Date.now());
  const stripRef = useRef(null);

  // La lista de abajo no se desplaza mientras el modo está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    // Escape cierra el modo (salvo que esté abierta la hoja de sustituir o el resumen encima).
    const onKey = (e) => { if (e.key === "Escape" && document.querySelectorAll('[role="dialog"]').length === 1) closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => { clearInterval(id); window.removeEventListener("keydown", onKey); };
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
  const restLeft = rest ? rest.endAt - now : 0;
  const goTo = (i) => { setIdx(i); setPicked(null); setTips(false); };
  const elapsedMs = session && session.startAt ? Math.max(0, (session.endAt || now) - session.startAt) : null;
  const restSec = ex.emom ? 60 : ex.rest || 0;
  const target = suggestSet({ series, setIndex: exerciseDone ? n - 1 : setIndex, exReps: view.reps, currentLoad: item.currentLoad, lastLog: item.lastLog, last, sets: n });

  const save = (reps, load) => {
    const wasDone = !!done[setIndex];
    onSaveSet(item, setIndex, reps, load);
    setPicked(null);
    if (!wasDone && restSec) setRest({ endAt: Date.now() + restSec * 1000, total: restSec * 1000 });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] pt-[max(12px,env(safe-area-inset-top))]" role="dialog" aria-modal="true" aria-label={`Modo entreno: ${routine.name}`}>
      <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col">
        {/* Encabezado */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-muted hover:text-fg" aria-label="Cerrar modo entreno"><X size={22} /></button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{routine.short} · {routine.name}</div>
            <div className="font-mono text-lg tabular-nums">{elapsedMs != null ? formatClock(elapsedMs) : "—"}</div>
          </div>
          <button type="button" onClick={onFinish} className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-good/50 px-3 text-sm font-semibold text-good hover:bg-good/10"><Flag size={16} />Terminar</button>
        </div>

        {/* Tira de ejercicios */}
        <div ref={stripRef} className="no-scrollbar -mx-1 mt-3 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1">
          {items.map((it, i) => {
            const complete = nextPendingSet(it.done) < 0;
            return (
              <button key={it.ex.id} type="button" onClick={() => goTo(i)} aria-current={i === idx ? "step" : undefined} aria-label={`${it.view.name}${complete ? " (completo)" : ""}`}
                className={`grid h-12 min-w-12 shrink-0 place-items-center rounded-xl border px-2.5 font-display text-base font-semibold ${i === idx ? "border-accent bg-accent/15 text-accent" : complete ? "border-good/40 bg-good/10 text-good" : "border-line bg-surface text-muted"}`}>
                {complete ? <span className="inline-flex items-center gap-0.5"><Check size={13} strokeWidth={3} />{it.ex.block}</span> : it.ex.block}
              </button>
            );
          })}
        </div>

        {/* Ejercicio actual */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-4 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Ejercicio {idx + 1} de {items.length} · {ex.block}</div>
          <h2 className="font-display text-3xl font-semibold uppercase leading-[0.95]">{view.name}</h2>
          {alt && <div className="mt-1 text-xs text-cool">Sustituye a: {ex.name}</div>}

          <div className={`mt-3 font-display text-2xl font-semibold uppercase ${exerciseDone ? "text-good" : ""}`}>
            {exerciseDone ? "Ejercicio completo" : `Serie ${setIndex + 1} de ${n}`}
          </div>

          <dl className="mt-2 grid grid-cols-3 gap-2 rounded-2xl bg-surface p-3 text-center">
            <div className="min-w-0"><dt className="text-[10px] uppercase tracking-widest text-muted">Reps</dt><dd className="truncate font-mono text-lg" title={view.reps}>{target.reps}</dd></div>
            <div className="min-w-0"><dt className="text-[10px] uppercase tracking-widest text-muted">Carga</dt><dd className="truncate font-mono text-lg">{target.load || "—"}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-widest text-muted">RIR</dt><dd className="font-mono text-lg tabular-nums">{effRir(view, week)}</dd></div>
          </dl>
          <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted">
            <span>Rango {view.reps}</span><span>Tempo {view.tempo}</span><span>{ex.emom ? "EMOM" : restSec ? `Descanso ${restSec} s` : "Sin descanso"}</span>
          </div>
          {target.progression && (
            <div className={`mt-2 flex items-start gap-1.5 text-sm ${target.progression.type === "load" ? "text-good" : target.progression.type === "reps" ? "text-accent" : "text-warn"}`}>
              <TrendingUp size={15} className="mt-0.5 shrink-0" /><span>{target.progression.text}</span>
            </div>
          )}
          {last && (last.v || last.reps) && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
              <History size={13} className="mt-px shrink-0" />
              <span>Última vez ({fmtShort(last.d)}): {last.v && <span className="font-mono text-fg">{last.v}</span>} {last.reps && `(${last.reps})`}</span>
            </div>
          )}

          {/* Series de este ejercicio */}
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: n }).map((_, i) => {
              const s = series[i];
              const sel = i === setIndex;
              return (
                <button key={i} type="button" onClick={() => setPicked(i)} aria-pressed={sel} aria-label={`Serie ${i + 1}${done[i] ? ", hecha" : ""}`}
                  className={`flex h-12 min-w-12 items-center justify-center gap-1 rounded-xl border px-3 font-mono text-sm ${done[i] ? "border-accent bg-accent text-accentInk" : "border-line bg-surface text-muted"} ${sel ? "ring-2 ring-fg ring-offset-2 ring-offset-bg" : ""}`}>
                  {done[i] ? <><Check size={15} strokeWidth={3} />{s && s.reps != null ? s.reps : ""}{s && s.load ? <span className="text-[11px] opacity-80">·{s.load}</span> : null}</> : i + 1}
                </button>
              );
            })}
          </div>

          {rest && (
            <div className={`mt-3 rounded-2xl border p-3 ${restLeft > 0 ? "border-cool/40 bg-cool/10" : "border-good/40 bg-good/10"}`} aria-live="polite">
              {restLeft > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-cool"><Timer size={16} />Descanso</span>
                    <span className="font-mono text-3xl tabular-nums">{formatClock(restLeft + 999)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-cool" style={{ width: `${Math.max(0, Math.min(100, (restLeft / rest.total) * 100))}%` }} /></div>
                </>
              ) : (
                <div className="text-sm font-semibold text-good">Descanso terminado. {exerciseDone ? "Pasa al siguiente ejercicio." : "A la siguiente serie."}</div>
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onSwap(ex.id)} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-sm font-medium hover:border-cool hover:text-cool"><ArrowLeftRight size={16} />Sustituir</button>
            <button type="button" onClick={() => setTips((t) => !t)} aria-expanded={tips} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-sm font-medium hover:text-fg"><Info size={16} />Tips<ChevronDown size={16} className={`transition-transform ${tips ? "rotate-180" : ""}`} /></button>
          </div>
          {tips && <ul className="mt-2 space-y-1.5 text-sm text-muted">{view.tips.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />{t}</li>)}</ul>}
        </div>

        {/* Acciones al alcance del pulgar */}
        <div className="shrink-0 border-t border-line pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          {exerciseDone ? (
            <button type="button" onClick={() => (nextIdx >= 0 ? goTo(nextIdx) : onFinish())} className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-accent font-display text-2xl font-semibold uppercase tracking-wide text-accentInk shadow-lg">
              {nextIdx >= 0 ? <>Siguiente ejercicio<ChevronRight size={26} /></> : <><Flag size={22} />Ver resumen</>}
            </button>
          ) : (
            <SetEditor key={`${ex.id}:${view.name}:${setIndex}:${done[setIndex] ? 1 : 0}`} item={item} setIndex={setIndex} isDone={!!done[setIndex]}
              onSave={save} onRemove={() => { onRemoveSet(item, setIndex); setPicked(null); }} />
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => goTo(idx - 1)} disabled={idx === 0} className="inline-flex h-12 items-center justify-center gap-1 rounded-xl border border-line bg-surface text-sm font-medium disabled:opacity-40"><ChevronLeft size={18} />Anterior</button>
            <button type="button" onClick={() => goTo(idx + 1)} disabled={idx >= items.length - 1} className="inline-flex h-12 items-center justify-center gap-1 rounded-xl border border-line bg-surface text-sm font-medium disabled:opacity-40">Siguiente ejercicio<ChevronRight size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
