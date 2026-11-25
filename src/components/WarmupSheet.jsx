import { useState, useEffect, useRef } from "react";
import { Play, Pause, X, Check, Plus, Minus, Volume2, VolumeX } from "lucide-react";
import { pad } from "../lib/dates.js";
import { WARMUP } from "../data/program.js";
import {
  unlockTimerAudio,
  playTimerDoneChime,
  playTimerPreviewPing,
  isTimerSoundEnabled,
  setTimerSoundEnabled,
  subscribeTimerSound,
  shouldFireTimerFinish,
} from "../lib/timerSound.js";
import { btnCls } from "./ui.jsx";

export function WarmupSheet({ onClose }) {
  const [idx, setIdx] = useState(0);
  const [endAt, setEndAt] = useState(null);
  const [left, setLeft] = useState(60000);
  const [finished, setFinished] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => isTimerSoundEnabled());
  const prevLeftRef = useRef(60000);
  const firedEndAtRef = useRef(null);

  useEffect(() => subscribeTimerSound(setSoundEnabled), []);

  useEffect(() => {
    if (!endAt) return;
    prevLeftRef.current = Math.max(0, endAt - Date.now());
    const tick = () => {
      const now = Date.now();
      const l = Math.max(0, endAt - now);
      if (l <= 0) {
        const shouldFire = shouldFireTimerFinish({
          prevRemainingMs: prevLeftRef.current,
          remainingMs: 0,
          endAt,
          now,
          paused: false,
          alreadyFired: firedEndAtRef.current === endAt,
        });
        firedEndAtRef.current = endAt;
        prevLeftRef.current = 0;
        if (shouldFire) {
          playTimerDoneChime({ enabled: isTimerSoundEnabled() });
        }
        if (idx < WARMUP.length - 1) {
          const nextEnd = Date.now() + 60000;
          prevLeftRef.current = 60000;
          setIdx((i) => i + 1);
          setEndAt(nextEnd);
          setLeft(60000);
        } else {
          setEndAt(null);
          setFinished(true);
          setLeft(0);
        }
      } else {
        prevLeftRef.current = l;
        setLeft(l);
      }
    };
    const id = setInterval(tick, 200);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [endAt, idx]);

  const run = () => {
    unlockTimerAudio();
    if (endAt) {
      setEndAt(null);
    } else {
      prevLeftRef.current = left;
      setEndAt(Date.now() + left);
    }
  };

  const toggleSound = () => {
    unlockTimerAudio();
    const next = !soundEnabled;
    setTimerSoundEnabled(next);
    if (next) playTimerPreviewPing();
  };

  const step = WARMUP[idx];
  const s = Math.ceil(left / 1000);

  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div className="sheet w-full max-w-lg rounded-t-[26px] border border-line bg-surface p-5 shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium text-accent">Modo Arranque · 5 min</div>
            <h2 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">Rompe la inercia</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? "Silenciar sonido del temporizador" : "Activar sonido del temporizador"}
              className={`grid h-9 w-9 place-items-center rounded-full transition ${
                soundEnabled
                  ? "bg-accent/15 text-accent hover:bg-accent/25"
                  : "bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg"
              }`}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg" aria-label="Cerrar"><X size={20} /></button>
          </div>
        </div>
        <div className="mb-4 flex gap-1.5">
          {WARMUP.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i < idx || finished ? "bg-accent" : i === idx ? "bg-accent/50" : "bg-white/[0.08]"}`} />)}
        </div>
        {finished ? (
          <div className="py-6 text-center">
            <Check size={40} className="mx-auto mb-2 text-good" />
            <div className="text-2xl font-bold tracking-tight">Cuerpo encendido</div>
            <p className="mt-1 text-sm text-muted">Ve directo al bloque A de tu rutina.</p>
            <button onClick={onClose} className={btnCls("primary", "mt-4")}>Empezar rutina</button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-white/[0.06] p-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted"><span>Ejercicio {idx + 1} de {WARMUP.length}</span><span>{step.eq}</span></div>
              <div className="text-lg font-bold tracking-tight">{step.name}</div>
              <p className="mt-1 text-sm text-muted">{step.detail}</p>
            </div>
            <div className="my-5 text-center font-mono text-6xl font-bold tabular-nums">0:{pad(s)}</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { unlockTimerAudio(); if (idx > 0) { setIdx(idx - 1); setLeft(60000); setEndAt(endAt ? Date.now() + 60000 : null); } }} className={btnCls("ghost", "px-4")} aria-label="Anterior"><Minus size={16} /></button>
              <button type="button" onClick={run} className={btnCls("primary", "flex-1")}>{endAt ? <Pause size={18} /> : <Play size={18} />}{endAt ? "Pausa" : idx === 0 && left === 60000 ? "Arrancar" : "Seguir"}</button>
              <button type="button" onClick={() => { unlockTimerAudio(); if (idx < WARMUP.length - 1) { setIdx(idx + 1); setLeft(60000); setEndAt(endAt ? Date.now() + 60000 : null); } else { setFinished(true); setEndAt(null); } }} className={btnCls("ghost", "px-4")} aria-label="Siguiente"><Plus size={16} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
