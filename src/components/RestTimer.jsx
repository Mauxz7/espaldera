import { useState, useEffect, useRef } from "react";
import { Timer, Play, Pause, RotateCcw, X, Volume2, VolumeX, BellRing } from "lucide-react";
import { pad } from "../lib/dates.js";
import {
  unlockTimerAudio,
  playTimerDoneChime,
  playTimerPreviewPing,
  isTimerSoundEnabled,
  setTimerSoundEnabled,
  subscribeTimerSound,
  shouldFireTimerFinish,
} from "../lib/timerSound.js";

export function RestTimer({ timer, setTimer }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [doneFlash, setDoneFlash] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => isTimerSoundEnabled());
  const [testingSound, setTestingSound] = useState(false);

  const firedIdRef = useRef(null);
  const prevRemainingRef = useRef(null);
  const lastTimerIdRef = useRef(null);
  const flashTimeoutRef = useRef(null);
  const testTimeoutRef = useRef(null);

  const timerId = timer ? (timer.id ?? timer.endAt) : null;

  useEffect(() => subscribeTimerSound(setSoundEnabled), []);

  useEffect(() => () => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
  }, []);

  const clearFlash = () => {
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    setDoneFlash(false);
  };

  // Reinicia los guardas al arrancar un temporizador nuevo.
  useEffect(() => {
    if (timerId === lastTimerIdRef.current) return;
    lastTimerIdRef.current = timerId;
    if (!timer) {
      prevRemainingRef.current = null;
      return;
    }
    const currentNow = Date.now();
    setNow(currentNow);
    const initialRem = timer.paused ? timer.left : Math.max(0, timer.endAt - currentNow);
    // Si ya llegó vencido (p. ej. restaurado tras recargar), dejar prevRemaining en null
    // para que shouldFireTimerFinish aplique la ventana de cortesía (<= 10 s).
    prevRemainingRef.current = initialRem > 0 ? initialRem : null;
    if (initialRem > 0) clearFlash();
  }, [timer, timerId]);

  useEffect(() => {
    if (!timer || timer.paused) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 200);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [timer]);

  const remaining = timer ? (timer.paused ? timer.left : Math.max(0, timer.endAt - now)) : 0;

  useEffect(() => {
    if (!timer || timer.paused) return;

    if (remaining > 0) {
      prevRemainingRef.current = remaining;
      return;
    }

    const shouldFire = shouldFireTimerFinish({
      prevRemainingMs: prevRemainingRef.current,
      remainingMs: remaining,
      endAt: timer.endAt,
      now,
      paused: Boolean(timer.paused),
      alreadyFired: firedIdRef.current === timerId,
    });

    firedIdRef.current = timerId;
    prevRemainingRef.current = 0;

    if (shouldFire) {
      playTimerDoneChime({ enabled: soundEnabled });
      setDoneFlash(true);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => {
        setDoneFlash(false);
        flashTimeoutRef.current = null;
      }, 6500);
    }

    setTimer(null);
  }, [remaining, timer, timerId, now, soundEnabled, setTimer]);

  const start = (sec) => {
    unlockTimerAudio();
    clearFlash();
    const t = Date.now();
    setNow(t);
    setTimer({ id: t, endAt: t + sec * 1000, duration: sec * 1000 });
  };

  const togglePause = () => {
    if (!timer) return;
    if (timer.paused) {
      unlockTimerAudio();
      const t = Date.now();
      setNow(t);
      setTimer({ id: t, endAt: t + timer.left, duration: timer.duration });
    } else {
      setTimer({ ...timer, paused: true, left: remaining });
    }
  };

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

  const secs = Math.ceil(remaining / 1000);
  const frac = timer && timer.duration > 0 ? Math.max(0, Math.min(1, remaining / timer.duration)) : 0;
  const R = 22;
  const C = 2 * Math.PI * R;

  return (
    <div className="timer-dock fixed z-40 flex flex-col items-end gap-2">
      {doneFlash && (
        <button
          type="button"
          onClick={clearFlash}
          className="flash max-w-[calc(100vw-32px)] rounded-2xl bg-gradient-to-b from-[#f3c582] to-[#e2a95a] px-4 py-3 text-left text-accentInk shadow-[0_8px_24px_rgb(232_181_110/.35)]"
          role="status"
          aria-live="assertive"
        >
          <div className="text-lg font-bold leading-tight tracking-tight">¡Listo! Descanso terminado</div>
          <div className="text-xs opacity-80">Siguiente serie. Toca para cerrar.</div>
        </button>
      )}
      {open && (
        <div className="w-64 max-w-[calc(100vw-32px)] rounded-[22px] border border-white/[0.1] bg-[rgb(30_36_48/.94)] p-4 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-base font-bold tracking-tight">Descanso</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-muted hover:text-fg"
              aria-label="Cerrar temporizador"
            >
              <X size={16} />
            </button>
          </div>
          <div
            className={`mb-3 text-center font-mono font-bold tabular-nums ${
              !timer && doneFlash ? "text-4xl text-good" : "text-5xl text-fg"
            }`}
          >
            {timer ? `${Math.floor(secs / 60)}:${pad(secs % 60)}` : doneFlash ? "¡Listo!" : "0:00"}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[45, 60, 90, 120].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => start(s)}
                className="rounded-xl bg-white/[0.07] py-2 font-mono text-sm font-bold text-fg transition hover:bg-accent/15 hover:text-accent"
              >
                {s < 120 ? `${s}s` : "2m"}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={togglePause}
              disabled={!timer}
              className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.08] py-2 text-sm font-semibold text-fg transition hover:bg-white/[0.14] disabled:opacity-40"
            >
              {timer?.paused ? <Play size={15} /> : <Pause size={15} />}
              {timer?.paused ? "Seguir" : "Pausa"}
            </button>
            <button
              type="button"
              onClick={() => { clearFlash(); setTimer(null); }}
              disabled={!timer}
              className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/[0.08] py-2 text-sm font-semibold text-fg transition hover:bg-white/[0.14] disabled:opacity-40"
            >
              <RotateCcw size={15} />Reset
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/[0.08] pt-3">
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? "Silenciar sonido del temporizador" : "Activar sonido del temporizador"}
              className={`flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
                soundEnabled
                  ? "bg-accent/15 text-accent hover:bg-accent/25"
                  : "bg-white/[0.06] text-muted hover:bg-white/[0.12] hover:text-fg"
              }`}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span>{soundEnabled ? "Sonido" : "Silencio"}</span>
            </button>
            <button
              type="button"
              onClick={testSound}
              aria-label="Probar sonido del temporizador"
              className={`inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                testingSound
                  ? "bg-good/20 text-good"
                  : "bg-white/[0.08] text-fg hover:bg-white/[0.14]"
              }`}
            >
              <BellRing size={14} className={testingSound ? "text-good" : "text-accent"} />
              <span>{testingSound ? "Listo" : "Probar"}</span>
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => { unlockTimerAudio(); setOpen((o) => !o); }}
        className="relative grid h-16 w-16 place-items-center rounded-full border border-white/[0.1] bg-[rgb(30_36_48/.88)] shadow-[0_12px_32px_rgb(0_0_0/.45)] backdrop-blur-xl"
        aria-label="Abrir temporizador de descanso"
      >
        <svg width="56" height="56" className="absolute -rotate-90">
          <circle cx="28" cy="28" r={R} fill="none" stroke="rgb(255 255 255 / .1)" strokeWidth="4" />
          <circle
            cx="28"
            cy="28"
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            style={{
              transition: "stroke-dashoffset .2s linear",
              filter: "drop-shadow(0 0 6px rgb(var(--c-accent) / .45))",
            }}
          />
        </svg>
        {timer ? <span className="relative font-mono text-sm font-bold tabular-nums">{secs}</span> : <Timer size={22} className="relative text-accent" />}
        {!soundEnabled && (
          <span
            className="absolute -left-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full border border-white/[0.12] bg-[rgb(30_36_48)] text-muted shadow"
            aria-hidden="true"
            title="Sonido silenciado"
          >
            <VolumeX size={11} />
          </span>
        )}
      </button>
    </div>
  );
}
