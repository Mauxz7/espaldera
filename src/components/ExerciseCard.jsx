import { useState, useRef, useEffect, useId, useMemo } from "react";
import { X, Check, ChevronDown, Info, ArrowLeftRight, Undo2, History, Pencil, TrendingUp, Maximize2, SkipForward, RotateCcw, Timer } from "lucide-react";
import { fmtShort } from "../lib/dates.js";
import { EQ, effSets, effRir } from "../data/program.js";
import { SUB_KIND, PATTERNS } from "../data/subs.js";
import { getAlternativesForExercise } from "../lib/routines.js";
import { parseTargetReps } from "../lib/setLog.js";
import { suggestProgression } from "../lib/progression.js";
import { Card, Chip, StatusDot } from "./ui.jsx";

export function SwapModal({ ex, week, current, skipped = false, onPick, onSkip, onClose }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [tab, setTab] = useState("suggested");
  const defaultPattern = ex.pattern && PATTERNS[ex.pattern] ? ex.pattern : "all";
  const [patternFilter, setPatternFilter] = useState(defaultPattern);

  const { suggested, samePattern, otherPatterns } = useMemo(() => getAlternativesForExercise(ex), [ex]);
  const patternKeys = useMemo(() => {
    const keys = [];
    if (ex.pattern && PATTERNS[ex.pattern] && samePattern.length) keys.push(ex.pattern);
    for (const k of Object.keys(otherPatterns)) keys.push(k);
    return keys;
  }, [ex.pattern, samePattern.length, otherPatterns]);

  useEffect(() => {
    setTab("suggested");
    setPatternFilter(ex.pattern && PATTERNS[ex.pattern] ? ex.pattern : "all");
  }, [ex.id, ex.pattern]);

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

  const handleTabKeyDown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = tab === "suggested" ? "library" : "suggested";
    setTab(next);
    const btn = e.currentTarget.querySelector(`[data-swap-tab="${next}"]`);
    if (btn) btn.focus();
  };

  const row = (item, isOriginal, badgeText = null) => {
    const active = isOriginal ? !current : current === item.id;
    const rirOrig = effRir(ex, week);
    const rirNew = effRir({ rir: item.rir }, week);
    return (
      <button key={isOriginal ? "original" : item.id} type="button" onClick={() => onPick(isOriginal ? null : item.id)} aria-pressed={active}
        className={`w-full rounded-2xl p-3.5 text-left transition ${active ? "bg-accent/12 ring-1 ring-inset ring-accent/50" : "bg-white/[0.05] hover:bg-white/[0.09]"}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {isOriginal ? <Chip>Original</Chip> : <Chip tone={item.kind === "eq" ? "good" : "cool"}>{badgeText || SUB_KIND[item.kind]}</Chip>}
          {active && <Chip tone="accent"><Check size={11} />En uso</Chip>}
        </div>
        <div className="mt-1.5 text-[15px] font-semibold leading-snug">{item.name}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">{item.eq.map((e) => <Chip key={e}>{EQ[e]}</Chip>)}</div>
        <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-white/[0.05] px-3 py-2 text-center font-mono text-xs font-bold">
          <div><div className="font-sans text-[11px] font-medium text-muted">Reps</div><div className={!isOriginal && item.reps !== ex.reps ? "text-accent" : ""}>{item.reps}</div></div>
          <div><div className="font-sans text-[11px] font-medium text-muted">Tempo</div><div className={!isOriginal && item.tempo !== ex.tempo ? "text-accent" : ""}>{item.tempo}</div></div>
          <div><div className="font-sans text-[11px] font-medium text-muted">RIR</div><div className={!isOriginal && rirNew !== rirOrig ? "text-accent" : ""}>{isOriginal ? rirOrig : rirNew}</div></div>
        </div>
        {!isOriginal && <p className="mt-2 text-xs text-muted">{item.why}</p>}
      </button>
    );
  };

  const libraryItems = useMemo(() => {
    if (patternFilter === "all") {
      const groups = [];
      if (samePattern.length && ex.pattern) groups.push({ key: ex.pattern, label: PATTERNS[ex.pattern], list: samePattern });
      for (const k of Object.keys(otherPatterns)) groups.push({ key: k, label: PATTERNS[k], list: otherPatterns[k] });
      return groups;
    }
    if (patternFilter === ex.pattern) {
      return samePattern.length ? [{ key: ex.pattern, label: PATTERNS[ex.pattern], list: samePattern }] : [];
    }
    const list = otherPatterns[patternFilter] || [];
    return list.length ? [{ key: patternFilter, label: PATTERNS[patternFilter], list }] : [];
  }, [patternFilter, samePattern, otherPatterns, ex.pattern]);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="sheet-dialog sheet">
      <div className="flex min-h-0 flex-1 flex-col p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-accent">Sustituir / Alternativa · {ex.block}</div>
            <h2 id={titleId} className="mt-0.5 text-2xl font-bold leading-tight tracking-tight">{ex.name}</h2>
            <p className="mt-1 text-xs text-muted">Las series se mantienen ({effSets(ex, week)}). Reps, tempo y RIR se ajustan solos.</p>
          </div>
          <button type="button" onClick={() => dialogRef.current?.close()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg" aria-label="Cerrar"><X size={20} /></button>
        </div>

        <div role="tablist" aria-label="Opciones de sustitución" onKeyDown={handleTabKeyDown} className="mb-3 flex shrink-0 gap-2 border-b border-line pb-2">
          <button type="button" role="tab" id="swap-tab-suggested" data-swap-tab="suggested" aria-selected={tab === "suggested"} tabIndex={tab === "suggested" ? 0 : -1} onClick={() => setTab("suggested")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === "suggested" ? "text-accent" : "text-muted hover:text-fg"}`}>
            Sugeridas ({suggested.length})
          </button>
          <button type="button" role="tab" id="swap-tab-library" data-swap-tab="library" aria-selected={tab === "library"} tabIndex={tab === "library" ? 0 : -1} onClick={() => setTab("library")}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${tab === "library" ? "text-accent" : "text-muted hover:text-fg"}`}>
            Biblioteca por patrón
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <div role="tabpanel" aria-labelledby="swap-tab-suggested" hidden={tab !== "suggested"} className="space-y-2">
            {row(ex, true)}
            {suggested.map((a) => row(a, false))}
          </div>

          <div role="tabpanel" aria-labelledby="swap-tab-library" hidden={tab !== "library"}>
            <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1">
              {patternKeys.map((k) => (
                <button key={k} type="button" onClick={() => setPatternFilter(k)} aria-pressed={patternFilter === k}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${patternFilter === k ? "bg-accent/15 text-accent" : "bg-white/[0.07] text-muted hover:text-fg"}`}>
                  {PATTERNS[k]}
                </button>
              ))}
              <button type="button" onClick={() => setPatternFilter("all")} aria-pressed={patternFilter === "all"}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition ${patternFilter === "all" ? "bg-accent/15 text-accent" : "bg-white/[0.07] text-muted hover:text-fg"}`}>
                Todos
              </button>
            </div>
            <div className="space-y-3">
              {libraryItems.length ? libraryItems.map((group) => (
                <div key={group.key} className="space-y-2">
                  <div className="text-[13px] font-medium text-muted">{group.label}</div>
                  {group.list.map((item) => row(item, false, PATTERNS[item.pattern]))}
                </div>
              )) : (
                <p className="py-4 text-center text-xs text-muted">No hay opciones adicionales en este patrón fuera de las sugeridas.</p>
              )}
            </div>
          </div>
        </div>

        {onSkip && (
          <div className="mt-3 shrink-0 border-t border-line pt-3">
            <button type="button" onClick={() => { onSkip(); dialogRef.current?.close(); }}
              className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${skipped ? "bg-accent/15 text-accent hover:bg-accent/25" : "bg-white/[0.07] text-muted hover:bg-warn/15 hover:text-warn"}`}>
              {skipped ? <><RotateCcw size={14} />Restaurar este bloque hoy</> : <><SkipForward size={14} />Saltar este bloque hoy</>}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

// El ejercicio con los datos del sustituto (si hay uno activo): lo comparten la tarjeta y el modo entreno.
export function withAlt(original, alt) {
  return alt ? { ...original, name: alt.name, eq: alt.eq, reps: alt.reps, tempo: alt.tempo, rir: alt.rir, tips: [alt.why, ...original.tips.slice(0, 1)] } : original;
}

export function ExerciseCard({
  ex: original,
  alt,
  week,
  done = [],
  skipped = false,
  onToggle,
  onSwap,
  onRevert,
  onSkip,
  load,
  onLoad,
  last,
  series = [],
  onSaveSet,
  onFocus,
  onStartRest,
}) {
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editReps, setEditReps] = useState("");
  const [editLoad, setEditLoad] = useState("");

  const pressTimer = useRef(null);
  const didLongPress = useRef(false);

  const ex = withAlt(original, alt);
  const n = effSets(original, week);
  const count = done.filter(Boolean).length;
  const complete = count >= n;
  const progression = suggestProgression(last, ex.reps, n);

  if (skipped) {
    return (
      <Card as="article" className="opacity-70 border-dashed">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.07] font-mono text-base font-bold text-muted">{ex.block}</div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-medium text-muted line-through">{ex.name}</h3>
            <div className="text-xs text-muted">Saltado hoy · no cuenta en el progreso</div>
          </div>
          {onSkip && (
            <button type="button" onClick={onSkip} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.08] px-3 py-2 text-xs font-semibold text-fg hover:bg-white/[0.14] hover:text-accent">
              <RotateCcw size={13} />Restaurar
            </button>
          )}
        </div>
      </Card>
    );
  }

  const openEdit = (i) => {
    let initialReps;
    let initialLoad;

    if (series[i]) {
      initialReps = series[i].reps;
      initialLoad = series[i].load;
    } else {
      const prev = series.slice(0, i).reverse().find(Boolean);
      if (prev) {
        initialReps = prev.reps;
        initialLoad = prev.load || load || "";
      } else if (last && last.series && last.series[i]) {
        initialReps = last.series[i].reps;
        initialLoad = last.series[i].load || last.v || load || "";
      } else {
        initialReps = parseTargetReps(ex.reps);
        initialLoad = load || (last && last.v) || "";
      }
    }

    setEditReps(initialReps != null ? initialReps : "");
    setEditLoad(initialLoad != null ? initialLoad : "");
    setEditingIndex(i);
  };

  const adjustReps = (delta) => {
    const current = Number(String(editReps).match(/\d+/)?.[0] || 0);
    const next = Math.max(0, current + delta);
    setEditReps(next);
  };

  const handleSaveEdit = () => {
    if (editingIndex == null) return;
    const repsVal = editReps !== "" && !isNaN(Number(editReps)) ? Number(editReps) : editReps;
    if (onSaveSet) {
      onSaveSet(editingIndex, repsVal, editLoad, n);
    }
    setEditingIndex(null);
  };

  const handlePointerDown = (i) => {
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      openEdit(i);
    }, 450);
  };

  const handlePointerUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleButtonClick = (i) => {
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    onToggle(i, n);
  };

  return (
    <Card as="article" className={`transition-colors ${complete ? "ring-1 ring-inset ring-good/35" : alt ? "ring-1 ring-inset ring-cool/35" : ""}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-mono text-base font-bold ${complete ? "bg-good/15 text-good" : "bg-white/[0.07] text-accent"}`}>{ex.block}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-fg">{ex.name}</h3>
          {alt && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-cool">
              <span>Sustituye a: {original.name}</span>
              <button onClick={onRevert} className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-fg hover:underline"><Undo2 size={12} />Volver al original</button>
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">{ex.eq.map((e) => <Chip key={e}>{EQ[e]}</Chip>)}</div>
        </div>
        {onFocus && (
          <button type="button" onClick={onFocus} className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-white/[0.08] hover:text-accent" aria-label={`Abrir ${ex.name} en modo entreno`} title="Modo entreno desde aquí">
            <Maximize2 size={18} />
          </button>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-[0.75fr_1.65fr_0.6fr_1.2fr] gap-2 rounded-2xl bg-white/[0.05] px-3 py-2.5 text-center">
        <div><dt className="text-[11px] font-medium text-muted">Series</dt><dd className="font-mono text-sm font-bold text-fg tabular-nums">{n}</dd></div>
        <div className="min-w-0"><dt className="text-[11px] font-medium text-muted">Reps</dt><dd className="truncate font-mono text-sm font-bold text-fg" title={ex.reps}>{ex.reps}</dd></div>
        <div><dt className="text-[11px] font-medium text-muted">RIR</dt><dd className="font-mono text-sm font-bold text-fg tabular-nums">{effRir(ex, week)}</dd></div>
        <div><dt className="text-[11px] font-medium text-muted">Tempo</dt><dd className="whitespace-nowrap font-mono text-sm font-bold text-fg">{ex.tempo}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={onSwap} className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.07] px-3 py-2 text-xs font-medium text-fg/90 transition hover:bg-white/[0.12] hover:text-cool">
          <ArrowLeftRight size={14} />Sustituir
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.07] px-3 py-2 text-xs font-medium text-muted transition hover:bg-warn/15 hover:text-warn" title="Saltar este bloque hoy">
            <SkipForward size={14} />Saltar
          </button>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          Carga
          <input value={load || ""} onChange={(e) => onLoad(e.target.value)} placeholder="ej. 40 kg" maxLength={24}
            className="w-24 rounded-xl border border-line bg-white/[0.06] px-2.5 py-1.5 font-mono text-xs font-bold text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none" />
        </label>
      </div>
      {last && (last.v || last.reps) && (
        !load ? (
          <button
            type="button"
            onClick={() => last.v && onLoad(last.v)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent"
          >
            <History size={13} />
            Última vez ({fmtShort(last.d)}):{" "}
            {last.v && <span className="font-mono font-bold text-fg">{last.v}</span>}
            {last.reps && <span className="text-muted">({last.reps})</span>}
            {last.v && " · usar"}
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <History size={13} />
            Última vez ({fmtShort(last.d)}):{" "}
            {last.v && <span className="font-mono font-bold text-fg">{last.v}</span>}
            {last.reps && <span className="text-muted">({last.reps})</span>}
          </div>
        )
      )}
      {progression && (
        <div
          className={`mt-1.5 flex items-center gap-1.5 text-xs ${
            progression.type === "load"
              ? "text-good"
              : progression.type === "reps"
                ? "text-accent"
                : "text-warn"
          }`}
        >
          <TrendingUp size={13} className="shrink-0" />
          <span className="truncate">{progression.text}</span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {Array.from({ length: n }).map((_, i) => (
          <button
            key={i}
            type="button"
            onPointerDown={() => handlePointerDown(i)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={() => handleButtonClick(i)}
            aria-pressed={!!done[i]}
            aria-label={`Serie ${i + 1}`}
            className={`grid h-10 w-10 select-none place-items-center rounded-full font-mono text-sm font-bold transition ${
              done[i]
                ? "bg-accent text-accentInk shadow-[0_4px_14px_rgb(232_181_110/.28)]"
                : "bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg"
            }`}
          >
            {done[i] ? <Check size={16} strokeWidth={3} /> : i + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (editingIndex != null) {
              setEditingIndex(null);
            } else {
              const firstUnfinished = done.findIndex((d) => !d);
              const target = firstUnfinished >= 0 ? firstUnfinished : (done.length - 1 >= 0 ? done.length - 1 : 0);
              openEdit(target);
            }
          }}
          className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
            editingIndex != null
              ? "bg-accent/15 text-accent"
              : "bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg"
          }`}
          aria-label="Editar repeticiones o carga de la serie"
          title="Ajustar repeticiones y carga"
        >
          <Pencil size={12} />
          <span>Editar</span>
        </button>
        {onStartRest && (ex.emom || ex.rest) ? (
          <button
            type="button"
            onClick={() => onStartRest(ex.emom ? 60 : ex.rest)}
            className="ml-auto inline-flex items-center gap-1 rounded-xl bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-accent/15 hover:text-accent"
            aria-label={`Iniciar descanso de ${ex.emom ? 60 : ex.rest} segundos`}
            title="Iniciar temporizador de descanso"
          >
            <Timer size={12} />
            <span>{ex.emom ? "EMOM" : `Desc. ${ex.rest}s`}</span>
          </button>
        ) : (
          <span className="ml-auto text-xs text-muted">{ex.emom ? "EMOM" : ex.rest ? `Desc. ${ex.rest}s` : "Sin descanso"}</span>
        )}
      </div>

      {series.some(Boolean) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
          {Array.from({ length: n }).map((_, i) => {
            const s = series[i];
            if (!s) return null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => openEdit(i)}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] transition ${
                  editingIndex === i
                    ? "bg-accent/15 text-accent"
                    : "bg-white/[0.06] text-muted hover:bg-white/[0.12] hover:text-fg"
                }`}
                title={`Serie ${i + 1}: ${s.reps} reps${s.load ? ` · ${s.load}` : ""}. Toca para editar.`}
              >
                <span className="text-[10px] text-muted">S{i + 1}:</span>
                <span className="font-bold text-fg">{s.reps}</span>
                {s.load && <span className="text-accent">({s.load})</span>}
              </button>
            );
          })}
        </div>
      )}

      {editingIndex !== null && (
        <div className="mt-3 rounded-2xl border border-accent/30 bg-white/[0.06] p-3.5 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-accent">
                Serie {editingIndex + 1} de {n}
              </span>
              {done[editingIndex] && (
                <StatusDot tone="good">Registrada</StatusDot>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditingIndex(null)}
              className="rounded-lg p-1 text-muted hover:text-fg"
              aria-label="Cerrar editor"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-muted">Reps:</span>
              <button
                type="button"
                onClick={() => adjustReps(-1)}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.08] font-mono text-sm font-bold hover:bg-white/[0.14] active:scale-95"
                aria-label="Menos repeticiones"
              >
                -
              </button>
              <input
                type="text"
                value={editReps}
                onChange={(e) => setEditReps(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  else if (e.key === "Escape") setEditingIndex(null);
                }}
                className="w-14 rounded-lg border border-line bg-bg/50 py-1 text-center font-mono text-sm font-bold text-fg focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => adjustReps(1)}
                className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.08] font-mono text-sm font-bold hover:bg-white/[0.14] active:scale-95"
                aria-label="Más repeticiones"
              >
                +
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted">Carga:</span>
              <input
                type="text"
                value={editLoad}
                onChange={(e) => setEditLoad(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  else if (e.key === "Escape") setEditingIndex(null);
                }}
                placeholder="ej. 40 kg"
                maxLength={24}
                className="w-24 rounded-lg border border-line bg-bg/50 px-2 py-1 font-mono text-xs font-bold text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="ml-auto rounded-xl bg-accent px-3.5 py-1.5 text-xs font-semibold text-accentInk hover:brightness-105 active:scale-95"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} className="mt-3 flex w-full items-center justify-between text-xs font-medium text-muted hover:text-fg" aria-expanded={open}>
        <span className="inline-flex items-center gap-1"><Info size={13} />Tips técnicos</span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <ul className="mt-2 space-y-1.5 border-t border-line pt-2 text-sm text-muted">{ex.tips.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />{t}</li>)}</ul>}
    </Card>
  );
}
