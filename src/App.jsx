import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dumbbell, Activity, Sunrise, Settings, LayoutDashboard } from "lucide-react";
import { Sync, LS, usePersisted, useSyncStatus } from "./lib/storage.js";
import {
  triggerFitbitSync,
  shouldAutoSyncFitbit,
  readFitbitSyncMeta,
  getTodayFitbitStatus,
  isFitbitSyncInFlight,
} from "./lib/fitbitSync.js";
import { dkey, addDays } from "./lib/dates.js";
import { DEFAULT_HABIT_DEFS } from "./data/habits.js";
import { useWeekPlan } from "./lib/planner.js";
import { DEFAULT_HEALTH_PREFS, computeBevelHistory } from "./lib/bevel.js";
import { useCalendarSync } from "./lib/calendar.js";
import { unlockTimerAudio, REST_TIMER_STORAGE_KEY, sanitizeRestoredTimer } from "./lib/timerSound.js";
import { SyncBadge } from "./components/ui.jsx";
import { RestTimer } from "./components/RestTimer.jsx";
import { WarmupSheet } from "./components/WarmupSheet.jsx";
import { TrainView } from "./views/TrainView.jsx";
import { HomeView } from "./views/HomeView.jsx";
import { ReviewView } from "./views/ReviewView.jsx";
import { DashboardView } from "./views/DashboardView.jsx";
import { HabitsView } from "./views/HabitsView.jsx";
import { useHabitReminders, ReminderCard } from "./lib/reminder.jsx";
import { SettingsView } from "./views/SettingsView.jsx";

export const TABS = [
  { id: "home", label: "Inicio", icon: LayoutDashboard },
  { id: "train", label: "Entreno", icon: Dumbbell },
  { id: "fitbit", label: "Salud", icon: Activity },
  { id: "habits", label: "Hábitos", icon: Sunrise },
  { id: "settings", label: "Ajustes", icon: Settings },
];

export default function App() {
  // Siempre abre en Inicio, salvo ?ver=revision o si se cerró a mitad de un entreno hace menos de 2 horas.
  const [tab, setTab] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).get("ver") === "revision") return "review";
      const last = localStorage.getItem("fitpanel:tab");
      const at = Number(localStorage.getItem("fitpanel:tabAt")) || 0;
      return last === "train" && Date.now() - at < 2 * 3600000 ? "train" : "home";
    } catch (e) { return "home"; }
  });
  const [trainRid, setTrainRid] = useState(null);
  const goTrain = useCallback((rid) => { setTrainRid(rid || null); setTab("train"); window.scrollTo(0, 0); }, []);
  const goHealth = useCallback(() => { setTab("fitbit"); window.scrollTo(0, 0); }, []);
  const openReview = useCallback(() => { setTab("review"); window.scrollTo(0, 0); }, []);
  const goHome = useCallback(() => { setTab("home"); window.scrollTo(0, 0); }, []);
  const goSettings = useCallback(() => { setTab("settings"); window.scrollTo(0, 0); }, []);
  const [sets, setSets] = usePersisted("sets", {});
  const [seriesLog, setSeriesLog] = usePersisted("setLog", {});
  const [log, setLog] = usePersisted("log", {});
  const [habits, setHabits] = usePersisted("habits", {});
  const [habitDefs, setHabitDefs] = usePersisted("habitDefs", DEFAULT_HABIT_DEFS);
  const [health, setHealth] = usePersisted("health", []);
  const [block, setBlock] = usePersisted("block", { week: 1 });
  const [swaps, setSwaps] = usePersisted("swaps", {});
  const [loads, setLoads] = usePersisted("loads", {});
  const [lastLoads, setLastLoads] = usePersisted("lastLoads", {});
  const [wins, setWins] = usePersisted("wins", []);
  const [reviews, setReviews] = usePersisted("reviews", {});
  const [routineVariants, setRoutineVariants] = usePersisted("routineVariants", {});
  const [skips, setSkips] = usePersisted("skips", {});
  const [customExercises, setCustomExercises] = usePersisted("customExercises", []);
  const [freeSessions, setFreeSessions] = usePersisted("freeSessions", {});
  const [soreness, setSoreness] = usePersisted("soreness", {});
  const [sleep] = usePersisted("sleep", {}); // de Fitbit; solo lectura
  const [workouts] = usePersisted("workouts", []); // de Fitbit; solo lectura
  const [vitals] = usePersisted("vitals", {}); // de Fitbit; solo lectura
  const [healthPrefs, setHealthPrefs] = usePersisted("healthPrefs", DEFAULT_HEALTH_PREFS);
  const today = dkey();
  const bevelHistory = useMemo(
    () => computeBevelHistory({ sleep, workouts, vitals, setLog: seriesLog, sets, loads, log, block, healthPrefs, today }),
    [sleep, workouts, vitals, seriesLog, sets, loads, log, block, healthPrefs, today],
  );
  const wp = useWeekPlan(log, { bevel: bevelHistory });
  useCalendarSync(wp.upcoming, routineVariants); // plan → cal/plan.json → calendario «Shift» (repo privado)
  const [timer, setTimer] = useState(() => {
    try {
      const raw = localStorage.getItem(REST_TIMER_STORAGE_KEY);
      return raw ? sanitizeRestoredTimer(JSON.parse(raw), Date.now()) : null;
    } catch (e) {
      return null;
    }
  });
  const [warmup, setWarmup] = useState(false);

  useEffect(() => {
    try {
      if (timer) localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify(timer));
      else localStorage.removeItem(REST_TIMER_STORAGE_KEY);
    } catch (e) {}
  }, [timer]);

  useEffect(() => {
    const save = () => { try { localStorage.setItem("fitpanel:tab", tab); localStorage.setItem("fitpanel:tabAt", String(Date.now())); } catch (e) {} };
    save();
    if (tab !== "train") return;
    const id = setInterval(save, 60000); // mientras entrenas, mantiene fresca la marca de tiempo
    return () => clearInterval(id);
  }, [tab]);
  // El navegador solo deja sonar audio después de un toque: se desbloquea con el primero.
  useEffect(() => { window.addEventListener("pointerdown", unlockTimerAudio); return () => window.removeEventListener("pointerdown", unlockTimerAudio); }, []);
  const startTimer = useCallback((sec) => {
    unlockTimerAudio();
    const now = Date.now();
    setTimer({ id: now, endAt: now + sec * 1000, duration: sec * 1000 });
  }, []);

  // Limpia ?ver=revision tras abrir la vista y escucha mensajes del service worker al tocar un aviso.
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("ver") === "revision") {
        u.searchParams.delete("ver");
        window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
      }
    } catch (e) {}
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e) => {
      const d = e && e.data;
      if (!d || d.type !== "open" || !d.url) return;
      try {
        const target = new URL(d.url, window.location.href);
        if (target.searchParams.get("ver") === "revision") {
          setTab("review");
          window.scrollTo(0, 0);
        }
      } catch (err) {}
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  // Sincroniza al abrir, al volver a la app y cada minuto mientras está a la vista.
  useEffect(() => {
    Sync.run();
    const onVis = () => { if (!document.hidden) Sync.run(); };
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(() => { if (!document.hidden) Sync.run(); }, 60000);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(id); };
  }, []);

  const syncStatus = useSyncStatus();
  const [fitbitSync, setFitbitSync] = useState(() => {
    const meta = readFitbitSyncMeta();
    return {
      syncing: false,
      statusText: "",
      error: null,
      notice: null,
      lastSyncedAt: meta.lastSuccessMs || null,
    };
  });
  const fitbitInFlightRef = useRef(false);

  const dismissFitbitMessage = useCallback(() => {
    setFitbitSync((cur) => ({ ...cur, error: null, notice: null }));
  }, []);

  const syncFitbitNow = useCallback(async ({ manual = false } = {}) => {
    const cfg = Sync.cfg();
    if (!cfg) {
      if (manual) {
        setFitbitSync((cur) => ({
          ...cur,
          syncing: false,
          statusText: "",
          error: {
            code: "no_config",
            message: "Conecta primero tu repositorio privado de GitHub en Ajustes para sincronizar Fitbit.",
            runUrl: null,
          },
          notice: null,
        }));
      }
      return { ok: false, code: "no_config" };
    }
    if (fitbitInFlightRef.current || isFitbitSyncInFlight()) {
      return { ok: false, code: "in_flight" };
    }
    fitbitInFlightRef.current = true;
    setFitbitSync((cur) => ({
      ...cur,
      syncing: true,
      statusText: "Enviando…",
      error: null,
      notice: null,
    }));
    try {
      const res = await triggerFitbitSync({
        repo: cfg.repo,
        token: cfg.token,
        onStatus: (st) => {
          setFitbitSync((cur) => ({ ...cur, statusText: st?.text || cur.statusText }));
        },
      });
      if (!res.ok) {
        setFitbitSync((cur) => ({
          ...cur,
          syncing: false,
          statusText: "",
          error: { code: res.code, message: res.message, runUrl: res.runUrl || null },
          notice: null,
        }));
        return res;
      }
      setFitbitSync((cur) => ({ ...cur, statusText: "Actualizando datos…" }));
      const pullRes = await Sync.pullNow();
      const currentToday = dkey();
      const todayStatus = getTodayFitbitStatus(currentToday, LS.get("sleep"), LS.get("vitals"));
      if (res.pending) {
        setFitbitSync((cur) => ({
          ...cur,
          syncing: false,
          statusText: "",
          error: null,
          notice: { kind: "info", message: res.message },
        }));
      } else if (!pullRes.ok) {
        setFitbitSync((cur) => ({
          ...cur,
          syncing: false,
          statusText: "",
          error: {
            code: "pull_failed",
            message: "Fitbit terminó en GitHub, pero falló la recarga local. Toca de nuevo para actualizar.",
            runUrl: res.runUrl || null,
          },
          notice: null,
        }));
      } else {
        let notice = null;
        if (!todayStatus.hasSleep) {
          notice = {
            kind: "info",
            message: "Sincronización completada, pero Fitbit aún no ha subido el sueño de hoy desde tu reloj. Abre la app de Fitbit y vuelve a intentar en un minuto.",
          };
        } else if (!todayStatus.hasVitals) {
          notice = {
            kind: "info",
            message: "Sueño actualizado; Fitbit aún no reporta HRV ni FC en reposo de hoy.",
          };
        }
        setFitbitSync({
          syncing: false,
          statusText: "Actualizado",
          error: null,
          notice,
          lastSyncedAt: Date.now(),
        });
      }
      return res;
    } finally {
      fitbitInFlightRef.current = false;
    }
  }, []);

  // Dispara sincronización automática de Fitbit al abrir Salud si faltan datos de hoy y pasó el cooldown.
  useEffect(() => {
    if (tab !== "fitbit") return;
    const cfg = Sync.cfg();
    if (!cfg) return;
    if (syncStatus.state === "syncing" || syncStatus.state === "off") return;
    const meta = readFitbitSyncMeta();
    const should = shouldAutoSyncFitbit({
      todayKey: today,
      sleep,
      vitals,
      nowMs: Date.now(),
      lastAttemptMs: meta.lastAttemptMs,
      lastForbiddenMs: meta.lastForbiddenMs,
      hasSyncConfig: Boolean(cfg),
      inFlight: fitbitInFlightRef.current || isFitbitSyncInFlight(),
    });
    if (should) syncFitbitNow({ manual: false });
  }, [tab, today, sleep, vitals, syncStatus.state, syncFitbitNow]);

  const rem = useHabitReminders(habitDefs, habits[today] || {});

  return (
    <div className="min-h-full md:flex">
      <nav className="side-nav hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-line md:bg-white/[0.02] md:p-4 lg:w-64">
        <div className="mb-6 px-2">
          <div className="text-2xl font-bold leading-none tracking-tight">Shift</div>
          <div className="text-xs text-muted">Hábitos e identidad</div>
        </div>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { if (t.id === "train") setTrainRid(null); setTab(t.id); }} aria-current={tab === t.id ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${tab === t.id ? "bg-white/[0.08] text-fg [&>svg]:text-accent" : "text-muted hover:bg-white/[0.05] hover:text-fg"}`}>
              <Icon size={18} />{t.label}
            </button>
          );
        })}
        <div className="mt-auto px-2"><SyncBadge /></div>
      </nav>

      <main className="page-main min-w-0 flex-1">
        <header className="mb-3 flex items-center justify-between md:hidden">
          <div className="text-[15px] font-bold tracking-tight text-muted">Shift</div>
          <SyncBadge />
        </header>
        <div className="mx-auto max-w-6xl">
          {tab === "home" && <HomeView wp={wp} log={log} setLog={seriesLog} habits={habits} setHabits={setHabits} habitDefs={habitDefs} block={block} setBlock={setBlock} goTrain={goTrain} goHealth={goHealth} wins={wins} setWins={setWins} reviews={reviews} openReview={openReview} routineVariants={routineVariants} bevelHistory={bevelHistory} />}
          {tab === "review" && <ReviewView wp={wp} log={log} setLog={seriesLog} habits={habits} habitDefs={habitDefs} wins={wins} setWins={setWins} reviews={reviews} setReviews={setReviews} onBack={goHome} />}
          {tab === "train" && <TrainView key={trainRid || "auto"} initialRid={trainRid} sets={sets} setSets={setSets} seriesLog={seriesLog} setSeriesLog={setSeriesLog} log={log} setLog={setLog} block={block} swaps={swaps} setSwaps={setSwaps} loads={loads} setLoads={setLoads} lastLoads={lastLoads} setLastLoads={setLastLoads} routineVariants={routineVariants} setRoutineVariants={setRoutineVariants} skips={skips} setSkips={setSkips} customExercises={customExercises} setCustomExercises={setCustomExercises} freeSessions={freeSessions} setFreeSessions={setFreeSessions} soreness={soreness} timer={timer} setTimer={setTimer} startTimer={startTimer} openWarmup={() => setWarmup(true)} wp={wp} bevelHistory={bevelHistory} />}
          {tab === "fitbit" && <DashboardView health={health} setHealth={setHealth} log={log} bevelHistory={bevelHistory} vitals={vitals} sleep={sleep} workouts={workouts} setLog={seriesLog} customExercises={customExercises} soreness={soreness} setSoreness={setSoreness} fitbitSync={fitbitSync} onSyncFitbit={() => syncFitbitNow({ manual: true })} onDismissFitbitMessage={dismissFitbitMessage} hasSyncConfig={Boolean(Sync.cfg())} onOpenSettings={goSettings} />}
          {tab === "settings" && <SettingsView habitDefs={habitDefs} setHabitDefs={setHabitDefs} reminderCard={<ReminderCard rem={rem} />} healthPrefs={healthPrefs} setHealthPrefs={setHealthPrefs} />}
          {tab === "habits" && <HabitsView habits={habits} setHabits={setHabits} habitDefs={habitDefs} tomorrow={wp.info(dkey(addDays(new Date(), 1)))} tonight={wp.info(dkey())} routineVariants={routineVariants} />}
        </div>
      </main>

      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-30 md:hidden">
        <div className="mx-3 mb-2 grid grid-cols-5 rounded-[30px] border border-white/[0.08] bg-[rgb(30_35_46/.78)] px-1 py-1.5 shadow-[0_12px_40px_rgb(0_0_0/.5)] backdrop-blur-xl">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => { if (t.id === "train") setTrainRid(null); setTab(t.id); }} aria-current={on ? "page" : undefined} className={`flex flex-col items-center gap-0.5 rounded-[22px] py-1.5 text-[10.5px] font-semibold transition ${on ? "text-fg" : "text-faint"}`}>
                <Icon size={21} className={on ? "text-accent" : ""} />{t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <RestTimer timer={timer} setTimer={setTimer} />
      {warmup && <WarmupSheet onClose={() => setWarmup(false)} />}
    </div>
  );
}
