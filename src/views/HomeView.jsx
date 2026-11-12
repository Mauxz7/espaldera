import { useMemo } from "react";
import { Play, Watch, Check, Coffee, Moon, Building2, Home, BatteryLow, ChevronRight } from "lucide-react";
import { dkey, DAYS_LONG } from "../lib/dates.js";
import { usePersisted } from "../lib/storage.js";
import { routineById, BLOCK_WEEKS } from "../data/program.js";
import { weekProgress, todayPlan } from "../lib/home.js";
import { WeekCard } from "../components/WeekCard.jsx";
import { BlockCard } from "../components/BlockCard.jsx";
import { HabitsMini } from "../components/Habits.jsx";
import { useFitbitShortcut, buildFitbitShortcutUrl } from "../components/FitbitShortcutCard.jsx";

// Anillo de progreso (estilo «anillos de actividad»): valor sobre meta, con el número al centro.
function Ring({ value, goal, label, sub, color }) {
  const pct = goal ? Math.min(1, value / goal) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div className="relative h-[68px] w-[68px]">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-surface2" />
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round" stroke={`rgb(var(--c-${color}))`}
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset .5s" }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center font-mono text-sm font-semibold tabular-nums">{value}<span className="sr-only"> de {goal}</span></div>
      </div>
      <div className="mt-1 text-xs font-semibold">{label}</div>
      <div className="text-[10px] text-muted">{sub}</div>
    </div>
  );
}

export function HomeView({ wp, log, habits, setHabits, habitDefs, block, setBlock, goTrain }) {
  const today = dkey();
  const [workouts] = usePersisted("workouts", []);
  const [fitbit] = useFitbitShortcut();
  const info = wp.info(today);
  const plan = todayPlan({ info, logged: log[today], fromFitbit: wp.fromFitbit && wp.fromFitbit[wp.todayIdx] });
  const routine = plan.rid ? routineById(plan.rid) : null;
  const prog = useMemo(
    () => weekProgress({ keys: wp.keys, todayIdx: wp.todayIdx, fixed: wp.fixed, habits, habitDefs, workouts }),
    [wp.keys, wp.todayIdx, wp.fixed, habits, habitDefs, workouts],
  );
  const week = (block && block.week) || 1;
  const bw = BLOCK_WEEKS[week - 1];
  const next = wp.nextRid && plan.state === "rest" ? routineById(wp.nextRid) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{DAYS_LONG[wp.todayIdx]} · Semana {week} del bloque · {bw.label}</div>
          <h1 className="font-display text-3xl font-semibold uppercase leading-none">Hoy</h1>
        </div>

        {/* Tarjeta de hoy: una sola acción principal */}
        <section className={`rounded-2xl border p-4 md:p-5 ${plan.state === "done" || plan.state === "fitbit" ? "border-good/40 bg-good/10" : plan.state === "rest" ? "border-line bg-surface" : "border-accent/40 bg-accent/10"}`}>
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">{info.office ? <Building2 size={13} className="text-warn" /> : <Home size={13} />}{info.office ? "Oficina" : "Casa"}</span>
            {plan.state === "planned" && plan.evening && <span className="inline-flex items-center gap-1"><Moon size={13} className="text-cool" />Entreno de noche</span>}
            {plan.state === "planned" && !plan.evening && <span>Despertar {info.wake}</span>}
          </div>

          {plan.state === "rest" ? (
            <>
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold uppercase leading-tight"><Coffee size={22} className="text-muted" />Descanso</h2>
              <p className="mt-1 text-sm text-muted">Hoy toca recuperar. Una caminata suave o 10 min de movilidad suman sin cargar rodillas ni tobillos.{next ? ` Lo siguiente: ${next.name}.` : ""}</p>
              <button onClick={() => goTrain("low")} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-sm font-semibold hover:border-cool hover:text-cool">
                <BatteryLow size={16} />Sesión suave de 20 min
              </button>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold uppercase leading-tight">{routine.name}</h2>
              <p className="mt-0.5 text-sm text-muted">{routine.short} · ~{routine.minutes} min · {routine.focus}</p>
              {plan.state === "done" && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-good"><Check size={16} />Hecha hoy</p>
              )}
              {plan.state === "fitbit" && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-good"><Watch size={16} />Fitbit ya la registró hoy</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {plan.state === "planned" ? (
                  <>
                    {!fitbit.hidden && (
                      <a href={buildFitbitShortcutUrl(fitbit.name)} onClick={() => goTrain(plan.rid)}
                        className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk shadow-lg">
                        <Watch size={16} />Empezar con Fitbit
                      </a>
                    )}
                    <button onClick={() => goTrain(plan.rid)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${fitbit.hidden ? "bg-accent text-accentInk shadow-lg" : "border border-line bg-surface2 hover:border-accent hover:text-accent"}`}>
                      <Play size={16} />Empezar
                    </button>
                  </>
                ) : (
                  <button onClick={() => goTrain(plan.rid)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface2 px-3.5 py-2 text-sm hover:border-accent hover:text-accent">
                    Ver rutina<ChevronRight size={15} />
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {/* Anillos de la semana */}
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide">Esta semana</h2>
          <div className="grid grid-cols-3 gap-2">
            <Ring value={prog.sessions.value} goal={prog.sessions.goal} label="Sesiones" sub={`de ${prog.sessions.goal}`} color="accent" />
            <Ring value={prog.habits.value} goal={prog.habits.goal} label="Hábitos" sub={`días de ${prog.habits.goal}`} color="good" />
            <Ring value={prog.minutes.value} goal={prog.minutes.goal} label="Minutos" sub={`Fitbit · meta ${prog.minutes.goal}`} color="cool" />
          </div>
        </section>

        <WeekCard wp={wp} log={log} />
      </div>

      <aside className="grid min-w-0 content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
        <BlockCard block={block} setBlock={setBlock} />
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 font-display text-lg font-semibold uppercase tracking-wide">Hábitos de hoy</h2>
          <HabitsMini habits={habits} setHabits={setHabits} habitDefs={habitDefs} />
        </section>
      </aside>
    </div>
  );
}
