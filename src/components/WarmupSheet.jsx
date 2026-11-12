import { useState, useEffect } from "react";
import { Play, Pause, X, Check, Plus, Minus } from "lucide-react";
import { pad } from "../lib/dates.js";
import { WARMUP } from "../data/program.js";
import { unlockAudio, beep } from "../lib/audio.js";

export function WarmupSheet({ onClose }) {
  const [idx, setIdx] = useState(0);
  const [endAt, setEndAt] = useState(null);
  const [left, setLeft] = useState(60000);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!endAt) return;
    const id = setInterval(() => {
      const l = endAt - Date.now();
      if (l <= 0) {
        beep();
        if (idx < WARMUP.length - 1) { setIdx((i) => i + 1); setEndAt(Date.now() + 60000); setLeft(60000); }
        else { setEndAt(null); setFinished(true); setLeft(0); }
      } else setLeft(l);
    }, 200);
    return () => clearInterval(id);
  }, [endAt, idx]);

  const run = () => { unlockAudio(); if (endAt) { setEndAt(null); } else { setEndAt(Date.now() + left); } };
  const step = WARMUP[idx];
  const s = Math.ceil(left / 1000);

  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="sheet w-full max-w-lg rounded-t-3xl border border-line bg-surface p-5 md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Modo Arranque · 5 min</div>
            <h2 className="font-display text-3xl font-semibold uppercase leading-none">Rompe la inercia</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:text-fg" aria-label="Cerrar"><X size={22} /></button>
        </div>
        <div className="mb-4 flex gap-1.5">
          {WARMUP.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i < idx || finished ? "bg-accent" : i === idx ? "bg-accent/50" : "bg-surface2"}`} />)}
        </div>
        {finished ? (
          <div className="py-6 text-center">
            <Check size={40} className="mx-auto mb-2 text-good" />
            <div className="font-display text-2xl font-semibold uppercase">Cuerpo encendido</div>
            <p className="mt-1 text-sm text-muted">Ve directo al bloque A de tu rutina.</p>
            <button onClick={onClose} className="mt-4 rounded-xl bg-accent px-5 py-2.5 font-semibold text-accentInk">Empezar rutina</button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-surface2 p-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted"><span>Ejercicio {idx + 1} de {WARMUP.length}</span><span>{step.eq}</span></div>
              <div className="text-lg font-semibold">{step.name}</div>
              <p className="mt-1 text-sm text-muted">{step.detail}</p>
            </div>
            <div className="my-5 text-center font-mono text-6xl tabular-nums">0:{pad(s)}</div>
            <div className="flex gap-2">
              <button onClick={() => { if (idx > 0) { setIdx(idx - 1); setLeft(60000); setEndAt(endAt ? Date.now() + 60000 : null); } }} className="rounded-xl bg-surface2 px-4 py-3 text-sm" aria-label="Anterior"><Minus size={16} /></button>
              <button onClick={run} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-accentInk">{endAt ? <Pause size={18} /> : <Play size={18} />}{endAt ? "Pausa" : idx === 0 && left === 60000 ? "Arrancar" : "Seguir"}</button>
              <button onClick={() => { if (idx < WARMUP.length - 1) { setIdx(idx + 1); setLeft(60000); setEndAt(endAt ? Date.now() + 60000 : null); } else { setFinished(true); setEndAt(null); } }} className="rounded-xl bg-surface2 px-4 py-3 text-sm" aria-label="Siguiente"><Plus size={16} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
