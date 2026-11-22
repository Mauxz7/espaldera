import { useMemo } from "react";
import { Play, Watch, Check, Coffee, Moon, Building2, Home, BatteryLow, ChevronRight } from "lucide-react";
import { dkey, DAYS_LONG } from "../lib/dates.js";
import { usePersisted } from "../lib/storage.js";
import { BLOCK_WEEKS } from "../data/program.js";
import { getActiveRoutine } from "../lib/routines.js";
import { weekProgress, todayPlan, buildTodayBevelBanner } from "../lib/home.js";
import { lastNight, isPoorSleep, fmtSleep } from "../lib/sleep.js";
import { Ring, Card, SectionTitle, btnCls } from "../components/ui.jsx";
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
  const bevelAdjustment = info.bevelAdjustment || wp.bevelAdjustment || null;
  const banner = buildTodayBevelBanner({ plan, night, bevelAdjustment });
  const bannerTitleCls = banner
    ? banner.tone === "good"
      ? "text-good"
      : banner.tone === "cool"
        ? "text-cool"
        : "text-warn"
    : "";

  const sleepDay = bevelToday?.sleep || null;
  const sleepScore = typeof sleepDay?.score === "number" ? sleepDay.score : null;
  const strainScore = typeof strain?.score === "number" ? strain.score : null;
  const hasRings = bevelToday && (recScore != null || sleepScore != null || strain?.target);
  const recSub = rec?.mode === "missing" ? "Esperando a Fitbit" : rec?.label || (rec?.mode === "estimated" ? "Estimada" : "—");

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <div className="px-1">
          <div className="text-[13px] font-medium text-muted">{DAYS_LONG[wp.todayIdx]} · Semana {week} · {bw.label}</div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Hoy</h1>
        </div>

        {/* Anillos del día: Recuperación, Sueño y Strain (abren Salud) */}
        {hasRings && (
          <Card as="button" type="button" onClick={goHealth} className="block w-full text-left transition active:scale-[0.99]" aria-label="Ver Salud">
            <div className="grid grid-cols-3 gap-1 pt-1">
              <Ring size="xl" value={recScore} goal={100} display={recScore != null ? `${recScore}%` : "—"} label="Recuperación" sub={recSub} color={recScore == null ? "muted" : recTone === "good" ? "good" : recTone === "accent" ? "accent" : "warn"} />
              <Ring size="xl" value={sleepScore} goal={100} display={sleepScore != null ? `${sleepScore}%` : "—"} label="Sueño" sub={night ? fmtSleep(night.min) : "Sin datos"} color={sleepScore == null ? "muted" : "sleep"} />
              <Ring size="xl" value={strainScore ?? 0} goal={100} display={`${strainScore ?? 0}%`} label="Strain" sub={strain?.target ? `Meta ${strain.target.min}–${strain.target.max}%` : ""} color="strain" targetRange={strain?.target || null} />
            </div>
            {banner && (
              <div className="mt-4 flex items-start gap-2.5 border-t border-line pt-3.5 text-sm leading-snug text-fg/85">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${banner.tone === "good" ? "bg-good" : banner.tone === "cool" ? "bg-cool" : "bg-warn"}`} aria-hidden="true" />
                <p><span className={`font-semibold ${bannerTitleCls}`}>{banner.title}.</span> {banner.text}</p>
              </div>
            )}
          </Card>
        )}

        {/* Tarjeta de hoy: una sola acción principal */}
        <div>
          <SectionTitle aside={routine && plan.state !== "rest" ? routine.short : null}>{plan.state === "rest" ? "Descanso" : "Entreno de hoy"}</SectionTitle>
          <Card glow={plan.state === "done" || plan.state === "fitbit" ? "good" : plan.state === "rest" ? null : "accent"}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1">{info.office ? <Building2 size={13} className="text-warn" /> : <Home size={13} />}{info.office ? "Oficina" : "Casa"}{plan.state === "planned" && !plan.evening ? ` · ${info.wake}` : ""}</span>
              {plan.state === "planned" && plan.evening && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1"><Moon size={13} className="text-cool" />De noche</span>}
              {!hasRings && night && <span className={`rounded-full bg-white/[0.07] px-2.5 py-1 ${isPoorSleep(night) ? "text-warn" : ""}`}>Dormiste {fmtSleep(night.min)}</span>}
            </div>

            {plan.state === "rest" ? (
              <>
                <h3 className="flex items-center gap-2 text-[22px] font-bold leading-tight tracking-tight"><Coffee size={22} className="text-muted" />Hoy toca recuperar</h3>
                <p className="mt-1 text-sm text-muted">Una caminata suave o 10 min de movilidad suman sin cargar rodillas ni tobillos.{next ? ` Lo siguiente: ${next.name}.` : ""}</p>
                {banner && !hasRings && (
                  <p className="mt-3 text-sm"><span className={`font-semibold ${bannerTitleCls}`}>{banner.title}.</span> {banner.text}</p>
                )}
                <button onClick={() => goTrain("low")} className={btnCls("ghost", "mt-4 w-full")}>
                  <BatteryLow size={17} />Sesión suave de 20 min
                </button>
              </>
            ) : (
              <>
                <h3 className="text-[22px] font-bold leading-tight tracking-tight">{routine.name}</h3>
                <p className="mt-1 text-sm text-muted">{routine.focus}</p>
                <div className="mt-3 flex gap-5">
                  <div className="text-xs text-muted"><b className="block font-mono text-[17px] font-bold text-fg">~{routine.minutes} min</b>Duración</div>
                  {strain?.target && <div className="text-xs text-muted"><b className="block font-mono text-[17px] font-bold text-fg">{strain.target.min}–{strain.target.max}%</b>Strain meta</div>}
                </div>
                {banner && !hasRings && (
                  <p className="mt-3 text-sm"><span className={`font-semibold ${bannerTitleCls}`}>{banner.title}</span> {banner.text}</p>
                )}
                {banner?.offerLow && (
                  <button onClick={() => goTrain("low")} className={btnCls("soft-warn", "mt-3 w-full")}>
                    <BatteryLow size={17} />Cambiar a sesión suave
                  </button>
                )}
                {plan.state === "done" && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-good"><Check size={16} />Hecha hoy</p>
                )}
                {plan.state === "fitbit" && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-good"><Watch size={16} />Fitbit ya la registró hoy</p>
                )}
                <div className="mt-4 flex gap-2.5">
                  {plan.state === "planned" ? (
                    <>
                      <button onClick={() => goTrain(plan.rid)} className={btnCls("primary", "flex-1")}>
                        <Play size={17} fill="currentColor" />Empezar
                      </button>
                      {!fitbit.hidden && (
                        <a href={buildFitbitShortcutUrl(fitbit.name)} onClick={() => goTrain(plan.rid)} className={btnCls("ghost", "flex-1")}>
                          <Watch size={17} />Con Fitbit
                        </a>
                      )}
                    </>
                  ) : (
                    <button onClick={() => goTrain(plan.rid)} className={btnCls("ghost", "w-full")}>
                      Ver rutina<ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Anillos de la semana */}
        <div>
          <SectionTitle aside={`${prog.sessions.value} de ${prog.sessions.goal} sesiones`}>Esta semana</SectionTitle>
          <Card>
            <div className="grid grid-cols-3 gap-2">
              <Ring value={prog.sessions.value} goal={prog.sessions.goal} label="Sesiones" sub={`de ${prog.sessions.goal}`} color="accent" />
              <Ring value={prog.habits.value} goal={prog.habits.goal} label="Hábitos" sub={`días de ${prog.habits.goal}`} color="good" />
              <Ring value={prog.minutes.value} goal={prog.minutes.goal} label="Minutos" sub={`Fitbit · meta ${prog.minutes.goal}`} color="cool" />
            </div>
          </Card>
        </div>

        <WeekCard wp={wp} log={log} routineVariants={routineVariants} />
      </div>

      <aside className="grid min-w-0 content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
        <div>
          <SectionTitle>Hábitos de hoy</SectionTitle>
          <Card>
            <HabitsMini habits={habits} setHabits={setHabits} habitDefs={habitDefs} />
          </Card>
        </div>
        <IdentityCard wp={wp} log={log} habits={habits} habitDefs={habitDefs} />
        <ReviewCard wins={wins} setWins={setWins} reviews={reviews} onOpenReview={openReview} />
        <BlockCard block={block} setBlock={setBlock} />
      </aside>
    </div>
  );
}
