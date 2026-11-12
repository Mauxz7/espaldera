import { useState, useRef } from "react";
import { X, Check, ChevronDown, Info, ArrowLeftRight, Undo2, History, Pencil, TrendingUp } from "lucide-react";
import { fmtShort } from "../lib/dates.js";
import { EQ, effSets, effRir } from "../data/program.js";
import { SUB_KIND, SUBS } from "../data/subs.js";
import { parseTargetReps } from "../lib/setLog.js";
import { suggestProgression } from "../lib/progression.js";
import { Chip } from "./ui.jsx";

export function SwapModal({ ex, week, current, onPick, onClose }) {
  const alts = SUBS[ex.id] || [];
  const row = (item, isOriginal) => {
    const active = isOriginal ? !current : current === item.id;
    const rirOrig = effRir(ex, week);
    const rirNew = effRir({ rir: item.rir }, week);
    return (
      <button key={isOriginal ? "original" : item.id} onClick={() => onPick(isOriginal ? null : item.id)} aria-pressed={active}
        className={`w-full rounded-2xl border p-3 text-left transition ${active ? "border-accent bg-accent/10" : "border-line bg-surface2 hover:border-muted"}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {isOriginal ? <Chip>Original</Chip> : <Chip tone={item.kind === "eq" ? "good" : "cool"}>{SUB_KIND[item.kind]}</Chip>}
          {active && <Chip tone="accent"><Check size={11} />En uso</Chip>}
        </div>
        <div className="mt-1.5 text-[15px] font-semibold leading-snug">{item.name}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">{item.eq.map((e) => <Chip key={e}>{EQ[e]}</Chip>)}</div>
        <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-surface px-3 py-1.5 text-center font-mono text-xs">
          <div><div className="text-[10px] uppercase tracking-widest text-muted">Reps</div><div className={!isOriginal && item.reps !== ex.reps ? "text-accent" : ""}>{item.reps}</div></div>
          <div><div className="text-[10px] uppercase tracking-widest text-muted">Tempo</div><div className={!isOriginal && item.tempo !== ex.tempo ? "text-accent" : ""}>{item.tempo}</div></div>
          <div><div className="text-[10px] uppercase tracking-widest text-muted">RIR</div><div className={!isOriginal && rirNew !== rirOrig ? "text-accent" : ""}>{isOriginal ? rirOrig : rirNew}</div></div>
        </div>
        {!isOriginal && <p className="mt-2 text-xs text-muted">{item.why}</p>}
      </button>
    );
  };
  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="sheet max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 md:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Sustituir ejercicio">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Sustituir / Alternativa · {ex.block}</div>
            <h2 className="font-display text-2xl font-semibold uppercase leading-none">{ex.name}</h2>
            <p className="mt-1 text-xs text-muted">Las series se mantienen ({effSets(ex, week)}). Reps, tempo y RIR se ajustan solos.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:text-fg" aria-label="Cerrar"><X size={22} /></button>
        </div>
        <div className="space-y-2">
          {row(ex, true)}
          {alts.map((a) => row(a, false))}
        </div>
      </div>
    </div>
  );
}

export function ExerciseCard({
  ex: original,
  alt,
  week,
  done = [],
  onToggle,
  onSwap,
  onRevert,
  load,
  onLoad,
  last,
  series = [],
  onSaveSet,
}) {
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editReps, setEditReps] = useState("");
  const [editLoad, setEditLoad] = useState("");

  const pressTimer = useRef(null);
  const didLongPress = useRef(false);

  const ex = alt ? { ...original, name: alt.name, eq: alt.eq, reps: alt.reps, tempo: alt.tempo, rir: alt.rir, tips: [alt.why, ...original.tips.slice(0, 1)] } : original;
  const n = effSets(original, week);
  const count = done.filter(Boolean).length;
  const complete = count >= n;
  const progression = suggestProgression(last, ex.reps, n);

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
    <article className={`rounded-2xl border bg-surface p-4 transition-colors ${complete ? "border-good/40" : alt ? "border-cool/40" : "border-line"}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-display text-base font-semibold ${complete ? "bg-good/15 text-good" : "bg-surface2 text-accent"}`}>{ex.block}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug">{ex.name}</h3>
          {alt && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-cool">
              <span>Sustituye a: {original.name}</span>
              <button onClick={onRevert} className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-fg hover:underline"><Undo2 size={12} />Volver al original</button>
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">{ex.eq.map((e) => <Chip key={e}>{EQ[e]}</Chip>)}</div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[0.8fr_1.6fr_0.6fr_1.2fr] gap-2 rounded-xl bg-surface2 px-3 py-2 text-center">
        <div><dt className="text-[10px] uppercase tracking-widest text-muted">Series</dt><dd className="font-mono text-sm tabular-nums">{n}</dd></div>
        <div className="min-w-0"><dt className="text-[10px] uppercase tracking-widest text-muted">Reps</dt><dd className="truncate font-mono text-sm" title={ex.reps}>{ex.reps}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-widest text-muted">RIR</dt><dd className="font-mono text-sm tabular-nums">{effRir(ex, week)}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-widest text-muted">Tempo</dt><dd className="whitespace-nowrap font-mono text-sm">{ex.tempo}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={onSwap} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-3 py-1.5 text-xs font-medium hover:border-cool hover:text-cool">
          <ArrowLeftRight size={14} />Sustituir / Alternativa
        </button>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          Carga
          <input value={load || ""} onChange={(e) => onLoad(e.target.value)} placeholder="ej. 40 kg" maxLength={24}
            className="w-24 rounded-lg border border-line bg-surface2 px-2 py-1.5 font-mono text-xs text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none" />
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
            {last.v && <span className="font-mono text-fg">{last.v}</span>}
            {last.reps && <span className="text-muted">({last.reps})</span>}
            {last.v && " · usar"}
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <History size={13} />
            Última vez ({fmtShort(last.d)}):{" "}
            {last.v && <span className="font-mono text-fg">{last.v}</span>}
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
            className={`grid h-10 w-10 select-none place-items-center rounded-full border font-mono text-sm transition ${
              done[i]
                ? "border-accent bg-accent text-accentInk"
                : "border-line bg-surface2 text-muted hover:border-accent/60"
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
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition ${
            editingIndex != null
              ? "border-accent bg-accent/15 text-accent"
              : "border-line bg-surface2 text-muted hover:text-fg"
          }`}
          aria-label="Editar repeticiones o carga de la serie"
          title="Ajustar repeticiones y carga"
        >
          <Pencil size={12} />
          <span>Editar</span>
        </button>
        <span className="ml-auto text-xs text-muted">{ex.emom ? "EMOM" : ex.rest ? `Desc. ${ex.rest}s` : "Sin descanso"}</span>
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
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] transition ${
                  editingIndex === i
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line bg-surface2 text-muted hover:border-accent hover:text-fg"
                }`}
                title={`Serie ${i + 1}: ${s.reps} reps${s.load ? ` · ${s.load}` : ""}. Toca para editar.`}
              >
                <span className="text-[10px] text-muted">S{i + 1}:</span>
                <span className="font-semibold text-fg">{s.reps}</span>
                {s.load && <span className="text-accent">({s.load})</span>}
              </button>
            );
          })}
        </div>
      )}

      {editingIndex !== null && (
        <div className="mt-2.5 rounded-xl border border-accent/40 bg-surface2 p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                Serie {editingIndex + 1} de {n}
              </span>
              {done[editingIndex] && (
                <span className="rounded bg-good/15 px-1.5 py-0.5 text-[10px] font-medium text-good">
                  Registrada
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditingIndex(null)}
              className="rounded p-0.5 text-muted hover:text-fg"
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
                className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface font-mono text-sm hover:border-accent active:scale-95"
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
                className="w-14 rounded-lg border border-line bg-surface py-1 text-center font-mono text-sm text-fg focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => adjustReps(1)}
                className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface font-mono text-sm hover:border-accent active:scale-95"
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
                className="w-24 rounded-lg border border-line bg-surface px-2 py-1 font-mono text-xs text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="ml-auto rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accentInk hover:opacity-90 active:scale-95"
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
    </article>
  );
}
