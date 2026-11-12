import { useState } from "react";
import { X, Check, ChevronDown, Info, ArrowLeftRight, Undo2, History } from "lucide-react";
import { fmtShort } from "../lib/dates.js";
import { EQ, effSets, effRir } from "../data/program.js";
import { SUB_KIND, SUBS } from "../data/subs.js";
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

export function ExerciseCard({ ex: original, alt, week, done, onToggle, onSwap, onRevert, load, onLoad, last }) {
  const [open, setOpen] = useState(false);
  const ex = alt ? { ...original, name: alt.name, eq: alt.eq, reps: alt.reps, tempo: alt.tempo, rir: alt.rir, tips: [alt.why, ...original.tips.slice(0, 1)] } : original;
  const n = effSets(original, week);
  const count = done.filter(Boolean).length;
  const complete = count >= n;
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
      {last && last.v && !load && (
        <button onClick={() => onLoad(last.v)} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent">
          <History size={13} />Última vez ({fmtShort(last.d)}): <span className="font-mono text-fg">{last.v}</span> · usar
        </button>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {Array.from({ length: n }).map((_, i) => (
          <button key={i} onClick={() => onToggle(i, n)} aria-pressed={!!done[i]} aria-label={`Serie ${i + 1}`}
            className={`grid h-10 w-10 place-items-center rounded-full border font-mono text-sm transition ${done[i] ? "border-accent bg-accent text-accentInk" : "border-line bg-surface2 text-muted hover:border-accent/60"}`}>
            {done[i] ? <Check size={16} strokeWidth={3} /> : i + 1}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">{ex.emom ? "EMOM" : ex.rest ? `Desc. ${ex.rest}s` : "Sin descanso"}</span>
      </div>
      <button onClick={() => setOpen((o) => !o)} className="mt-3 flex w-full items-center justify-between text-xs font-medium text-muted hover:text-fg" aria-expanded={open}>
        <span className="inline-flex items-center gap-1"><Info size={13} />Tips técnicos</span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <ul className="mt-2 space-y-1.5 border-t border-line pt-2 text-sm text-muted">{ex.tips.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />{t}</li>)}</ul>}
    </article>
  );
}
