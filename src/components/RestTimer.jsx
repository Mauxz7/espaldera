import { useState, useEffect, useRef } from "react";
import { Timer, Play, Pause, RotateCcw, X } from "lucide-react";
import { pad } from "../lib/dates.js";
import { unlockAudio, beep } from "../lib/audio.js";

export function RestTimer({ timer, setTimer }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [doneFlash, setDoneFlash] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!timer || timer.paused) return;
    fired.current = false;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timer]);

  const remaining = timer ? (timer.paused ? timer.left : Math.max(0, timer.endAt - now)) : 0;
  useEffect(() => {
    if (timer && !timer.paused && remaining <= 0 && !fired.current) {
      fired.current = true;
      beep();
      setDoneFlash(true);
      setTimer(null);
      setTimeout(() => setDoneFlash(false), 6000);
    }
  }, [remaining, timer, setTimer]);

  const start = (sec) => { unlockAudio(); setDoneFlash(false); setNow(Date.now()); setTimer({ endAt: Date.now() + sec * 1000, duration: sec * 1000 }); };
  const togglePause = () => {
    if (!timer) return;
    if (timer.paused) setTimer({ endAt: Date.now() + timer.left, duration: timer.duration });
    else setTimer({ ...timer, paused: true, left: remaining });
  };
  const secs = Math.ceil(remaining / 1000);
  const frac = timer ? remaining / timer.duration : 0;
  const R = 22, C = 2 * Math.PI * R;

  return (
    <div className="timer-dock fixed z-40 flex flex-col items-end gap-2">
      {doneFlash && (
        <button onClick={() => setDoneFlash(false)} className="flash rounded-2xl bg-accent px-4 py-3 text-left text-accentInk shadow-xl">
          <div className="font-display text-xl font-semibold uppercase leading-none">Descanso terminado</div>
          <div className="text-xs opacity-80">Siguiente serie. Toca para cerrar.</div>
        </button>
      )}
      {open && (
        <div className="w-64 rounded-2xl border border-line bg-surface p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-lg font-semibold uppercase tracking-wide">Descanso</span>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 text-muted hover:text-fg" aria-label="Cerrar temporizador"><X size={18} /></button>
          </div>
          <div className="mb-3 text-center font-mono text-5xl tabular-nums">{timer ? `${Math.floor(secs / 60)}:${pad(secs % 60)}` : "0:00"}</div>
          <div className="grid grid-cols-4 gap-2">
            {[45, 60, 90, 120].map((s) => (
              <button key={s} onClick={() => start(s)} className="rounded-lg border border-line bg-surface2 py-2 font-mono text-sm hover:border-accent hover:text-accent">{s < 120 ? `${s}s` : "2m"}</button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={togglePause} disabled={!timer} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-surface2 py-2 text-sm disabled:opacity-40">
              {timer?.paused ? <Play size={15} /> : <Pause size={15} />}{timer?.paused ? "Seguir" : "Pausa"}
            </button>
            <button onClick={() => setTimer(null)} disabled={!timer} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-surface2 py-2 text-sm disabled:opacity-40"><RotateCcw size={15} />Reset</button>
          </div>
        </div>
      )}
      <button onClick={() => { unlockAudio(); setOpen((o) => !o); }} className="relative grid h-16 w-16 place-items-center rounded-full border border-line bg-surface shadow-2xl" aria-label="Abrir temporizador de descanso">
        <svg width="56" height="56" className="absolute -rotate-90">
          <circle cx="28" cy="28" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="4" />
          <circle cx="28" cy="28" r={R} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset .2s linear" }} />
        </svg>
        {timer ? <span className="relative font-mono text-sm font-medium tabular-nums">{secs}</span> : <Timer size={22} className="relative text-accent" />}
      </button>
    </div>
  );
}
