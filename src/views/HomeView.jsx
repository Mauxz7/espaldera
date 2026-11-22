import { useMemo } from "react";
import { Play, Watch, Check, Coffee, Moon, Building2, Home, BatteryLow, ChevronRight, HeartPulse, Flame } from "lucide-react";
import { dkey, DAYS_LONG } from "../lib/dates.js";
import { usePersisted } from "../lib/storage.js";
import { BLOCK_WEEKS } from "../data/program.js";
import { getActiveRoutine } from "../lib/routines.js";
import { weekProgress, todayPlan, buildTodayBevelBanner } from "../lib/home.js";
import { lastNight, isPoorSleep, fmtSleep } from "../lib/sleep.js";
import { Ring } from "../components/ui.jsx";
import { recoveryTone } from "../components/HealthRings.jsx";
import { WeekCard } from "../components/WeekCard.jsx";
import { BlockCard } from "../components/BlockCard.jsx";
import { IdentityCard } from "../components/IdentityCard.jsx";
import { ReviewCard } from "../components/ReviewCard.jsx";
import { HabitsMini } from "../components/Habits.jsx";
import { useFitbitShortcut, buildFitbitShortcutUrl } from "../components/FitbitShortcutCard.jsx";

export function HomeView({ wp, log, habits, setHabits, habitDefs, block, setBlock, goTrain, goHealth, wins, setWins, reviews, openReview, routineVariants, bevelHistory }) {
  const today = dkey();
  const [workouts] = usePersisted("workouts", []);
  const [fitbit] = useFitbitShortcut();
  const [sleep] = usePersisted("sleep", null);
  const night = lastNight(sleep, today);
  const info = wp.info(today);
  const plan = todayPlan({ info, logged: log[today], fromFitbit: wp.fromFitbit && wp.fromFitbit[wp.todayIdx] });
  const routine = plan.rid ? getActiveRoutine(plan.rid, { routineVariants: plan.state === "done" && log[today]?.v ? { [plan.rid]: log[today].v } : routineVariants }) : null;
  const prog = useMemo(
    () => weekProgress({ keys: wp.keys, todayIdx: wp.todayIdx, fixed: wp.fixed, habits, habitDefs, workouts }),
    [wp.keys, wp.todayIdx, wp.fixed, habits, habitDefs, workouts],
  );
  const week = (block && block.week) || 1;
  const bw = BLOCK_WEEKS[week - 1];
  const next = wp.nextRid && plan.state === "rest" ? getActiveRoutine(wp.nextRid, { routineVariants }) : null;

  const bevelToday = (bevelHistory && (bevelHistory.byDate?.[today] || bevelHistory.today)) || null;
  const rec = bevelToday?.recovery || null;
  const strain = bevelToday?.strain || null;
  const recScore = typeof rec?.score === "number" ? rec.score : null;
  const recTone = recoveryTone(recScore);
  const recToneCls = recTone === "good" ? "text-good" : recTone === "accent" ? "text-accent" : recTone === "warn" ? "text-warn" : "text-muted";
  const bevelAdjustment = info.bevelAdjustment || wp.bevelAdjustment || null;
  const banner = buildTodayBevelBanner({ plan, night, bevelAdjustment });
  const bannerCls = banner
    ? banner.tone === "good"
      ? "border-good/40 bg-good/10"
      : banner.tone === "cool"
        ? "border-cool/40 bg-cool/10"
        : "border-warn/40 bg-warn/10"
    : "";
  const bannerTitleCls = banner
    ? banner.tone === "good"
      ? "text-good"
      : banner.tone === "cool"
        ? "text-cool"
        : "text-warn"
    : "";

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
            {night && <span className={isPoorSleep(night) ? "text-warn" : ""}>Dormiste {fmtSleep(night.min)}</span>}
          </div>

          {/* Resumen compacto de Recuperación y Target Strain */}
          {bevelToday && (recScore != null || strain?.target) && (
            <button
              type="button"
              onClick={goHealth}
              className="mb-2.5 mt-1.5 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-line/80 bg-surface/80 px-3 py-2 text-left text-xs transition hover:border-accent/60"
            >
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <HeartPulse size={13} className={recToneCls} />
                  <span className="text-muted">Recuperación</span>
                  <span className={`font-mono font-semibold tabular-nums ${recToneCls}`}>
                    {recScore != null ? `${recScore}%` : "—"}
                  </span>
                  {rec?.mode === "estimated" && <span className="text-[10px] text-muted">(est.)</span>}
                </span>
                {strain?.target && (
                  <span className="inline-flex items-center gap-1.5">
                    <Flame size={13} className="text-accent" />
                    <span className="text-muted">Strain</span>
                    <span className="font-mono font-semibold tabular-nums text-fg">{strain.score}%</span>
                    <span className="font-mono text-[11px] text-muted">· Meta {strain.target.min}–{strain.target.max}%</span>
                  </span>
                )}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted">
                Salud<ChevronRight size={13} />
              </span>
            </button>
          )}

          {plan.state === "rest" ? (
            <>
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold uppercase leading-tight"><Coffee size={22} className="text-muted" />Descanso</h2>
              <p className="mt-1 text-sm text-muted">Hoy toca recuperar. Una caminata suave o 10 min de movilidad suman sin cargar rodillas ni tobillos.{next ? ` Lo siguiente: ${next.name}.` : ""}</p>
              {banner && (
                <div className={`mt-3 rounded-xl border p-3 text-sm ${bannerCls}`}>
                  <p><span className={`font-semibold ${bannerTitleCls}`}>{banner.title}.</span> {banner.text}</p>
                </div>
              )}
              <button onClick={() => goTrain("low")} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-sm font-semibold hover:border-cool hover:text-cool">
                <BatteryLow size={16} />Sesión suave de 20 min
              </button>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold uppercase leading-tight">{routine.name}</h2>
              <p className="mt-0.5 text-sm text-muted">{routine.short} · ~{routine.minutes} min · {routine.focus}</p>
              {banner && (
                <div className={`mt-3 rounded-xl border p-3 text-sm ${bannerCls}`}>
                  <p><span className={`font-semibold ${bannerTitleCls}`}>{banner.title}</span> {banner.text}</p>
                  {banner.offerLow && (
                    <button onClick={() => goTrain("low")} className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-warn/50 bg-surface2 px-3.5 py-2 text-sm font-semibold text-warn hover:bg-warn/15">
                      <BatteryLow size={16} />Cambiar a sesión suave
                    </button>
                  )}
                </div>
              )}
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

        <WeekCard wp={wp} log={log} routineVariants={routineVariants} />
      </div>

      <aside className="grid min-w-0 content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
        <IdentityCard wp={wp} log={log} habits={habits} habitDefs={habitDefs} />
        <ReviewCard wins={wins} setWins={setWins} reviews={reviews} onOpenReview={openReview} />
        <BlockCard block={block} setBlock={setBlock} />
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 font-display text-lg font-semibold uppercase tracking-wide">Hábitos de hoy</h2>
          <HabitsMini habits={habits} setHabits={setHabits} habitDefs={habitDefs} />
        </section>
      </aside>
    </div>
  );
}
