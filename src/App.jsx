import { useState, useEffect, useCallback } from "react";
import { Dumbbell, Activity, Sunrise, Settings, LayoutDashboard } from "lucide-react";
import { Sync, usePersisted } from "./lib/storage.js";
import { dkey, addDays, pruneDays } from "./lib/dates.js";
import { CREATINE_ID, DEFAULT_HABIT_DEFS } from "./data/habits.js";
import { useWeekPlan } from "./lib/planner.js";
import { unlockAudio } from "./lib/audio.js";
import { SyncBadge } from "./components/ui.jsx";
import { RestTimer } from "./components/RestTimer.jsx";
import { WarmupSheet } from "./components/WarmupSheet.jsx";
import { TrainView } from "./views/TrainView.jsx";
import { HomeView } from "./views/HomeView.jsx";
import { DashboardView } from "./views/DashboardView.jsx";
import { HabitsView } from "./views/HabitsView.jsx";
import { useHabitReminders, ReminderBanner, ReminderCard, resolveCompletedValue } from "./lib/reminder.jsx";
import { SettingsView } from "./views/SettingsView.jsx";

export const TABS = [
  { id: "home", label: "Inicio", icon: LayoutDashboard },
  { id: "train", label: "Entreno", icon: Dumbbell },
  { id: "fitbit", label: "Salud", icon: Activity },
  { id: "habits", label: "Hábitos", icon: Sunrise },
  { id: "settings", label: "Ajustes", icon: Settings },
];

export default function App() {
  // Siempre abre en Inicio, salvo que se haya cerrado a mitad de un entreno hace menos de 2 horas.
  const [tab, setTab] = useState(() => {
    try {
      const last = localStorage.getItem("fitpanel:tab");
      const at = Number(localStorage.getItem("fitpanel:tabAt")) || 0;
      return last === "train" && Date.now() - at < 2 * 3600000 ? "train" : "home";
    } catch (e) { return "home"; }
  });
  const [trainRid, setTrainRid] = useState(null);
  const goTrain = useCallback((rid) => { setTrainRid(rid || null); setTab("train"); window.scrollTo(0, 0); }, []);
  const [sets, setSets] = usePersisted("sets", {});
  const [log, setLog] = usePersisted("log", {});
  const [habits, setHabits] = usePersisted("habits", {});
  const [habitDefs, setHabitDefs] = usePersisted("habitDefs", DEFAULT_HABIT_DEFS);
  const [health, setHealth] = usePersisted("health", []);
  const [block, setBlock] = usePersisted("block", { week: 1 });
  const [swaps, setSwaps] = usePersisted("swaps", {});
  const [loads, setLoads] = usePersisted("loads", {});
  const [lastLoads, setLastLoads] = usePersisted("lastLoads", {});
  const wp = useWeekPlan(log);
  const [timer, setTimer] = useState(null);
  const [warmup, setWarmup] = useState(false);

  useEffect(() => {
    const save = () => { try { localStorage.setItem("fitpanel:tab", tab); localStorage.setItem("fitpanel:tabAt", String(Date.now())); } catch (e) {} };
    save();
    if (tab !== "train") return;
    const id = setInterval(save, 60000); // mientras entrenas, mantiene fresca la marca de tiempo
    return () => clearInterval(id);
  }, [tab]);
  // El navegador solo deja sonar audio después de un toque: se desbloquea con el primero.
  useEffect(() => { window.addEventListener("pointerdown", unlockAudio); return () => window.removeEventListener("pointerdown", unlockAudio); }, []);
  const startTimer = useCallback((sec) => { unlockAudio(); setTimer({ endAt: Date.now() + sec * 1000, duration: sec * 1000 }); }, []);

  // Sincroniza al abrir, al volver a la app y cada minuto mientras está a la vista.
  useEffect(() => {
    Sync.run();
    const onVis = () => { if (!document.hidden) Sync.run(); };
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(() => { if (!document.hidden) Sync.run(); }, 60000);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(id); };
  }, []);

  const today = dkey();
  const rem = useHabitReminders(habitDefs, habits[today] || {});
  const completeHabit = useCallback((id = CREATINE_ID) => {
    const defs = habitDefs || DEFAULT_HABIT_DEFS;
    const def = defs.find((d) => d.id === id);
    const val = resolveCompletedValue(def);
    setHabits((all) => pruneDays({ ...all, [today]: { ...(all[today] || {}), [id]: val } }, 60));
  }, [habitDefs, setHabits, today]);

  return (
    <div className="min-h-full md:flex">
      <nav className="side-nav hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-line md:p-4 lg:w-64">
        <div className="mb-6 px-2">
          <div className="font-display text-2xl font-semibold uppercase leading-none">Espaldera</div>
          <div className="text-xs text-muted">Centro de entrenamiento</div>
        </div>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { if (t.id === "train") setTrainRid(null); setTab(t.id); }} aria-current={tab === t.id ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${tab === t.id ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface hover:text-fg"}`}>
              <Icon size={18} />{t.label}
            </button>
          );
        })}
        <div className="mt-auto px-2"><SyncBadge /></div>
      </nav>

      <main className="page-main min-w-0 flex-1">
        <header className="mb-4 flex items-center justify-between md:hidden">
          <div className="font-display text-xl font-semibold uppercase">Espaldera</div>
          <SyncBadge />
        </header>
        <div className="mx-auto max-w-6xl">
          {tab === "home" && <HomeView wp={wp} log={log} habits={habits} setHabits={setHabits} habitDefs={habitDefs} block={block} setBlock={setBlock} goTrain={goTrain} />}
          {tab === "train" && <TrainView key={trainRid || "auto"} initialRid={trainRid} sets={sets} setSets={setSets} log={log} setLog={setLog} block={block} swaps={swaps} setSwaps={setSwaps} loads={loads} setLoads={setLoads} lastLoads={lastLoads} setLastLoads={setLastLoads} startTimer={startTimer} openWarmup={() => setWarmup(true)} wp={wp} />}
          {tab === "fitbit" && <DashboardView health={health} setHealth={setHealth} log={log} />}
          {tab === "settings" && <SettingsView habitDefs={habitDefs} setHabitDefs={setHabitDefs} reminderCard={<ReminderCard rem={rem} />} />}
          {tab === "habits" && <HabitsView habits={habits} setHabits={setHabits} habitDefs={habitDefs} tomorrow={wp.info(dkey(addDays(new Date(), 1)))} tonight={wp.info(dkey())} />}
        </div>
      </main>

      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { if (t.id === "train") setTrainRid(null); setTab(t.id); }} aria-current={tab === t.id ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${tab === t.id ? "text-accent" : "text-muted"}`}>
              <Icon size={21} />{t.label}
            </button>
          );
        })}
      </nav>

      <RestTimer timer={timer} setTimer={setTimer} />
      <ReminderBanner rem={rem} onTake={completeHabit} />
      {warmup && <WarmupSheet onClose={() => setWarmup(false)} />}
    </div>
  );
}
