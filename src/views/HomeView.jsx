import { useId, useMemo, useState } from "react";
import { Play, Watch, Check, Coffee, Moon, Building2, Home, BatteryLow, ChevronRight, Shuffle, SlidersHorizontal, Minus, Plus } from "lucide-react";
import { dkey, addDays, DAYS, DAYS_LONG } from "../lib/dates.js";
import { usePersisted } from "../lib/storage.js";
import { BLOCK_WEEKS, routineById } from "../data/program.js";
import { getActiveRoutine } from "../lib/routines.js";
import { MAIN, TAG, DEFAULT_WEEK_TARGETS, WEEK_TARGET_PRESETS, countMainCodes } from "../lib/planner.js";
import { weekProgress, todayPlan, buildTodayBevelBanner } from "../lib/home.js";
import { lastNight, isPoorSleep, fmtSleep } from "../lib/sleep.js";
import { Ring, Card, SectionTitle, btnCls } from "../components/ui.jsx";
import { recoveryTone } from "../components/HealthRings.jsx";
import { SheetDialog } from "../components/SheetDialog.jsx";
import { BlockCard } from "../components/BlockCard.jsx";
import { IdentityCard } from "../components/IdentityCard.jsx";
import { ReviewCard } from "../components/ReviewCard.jsx";
import { HabitsMini } from "../components/Habits.jsx";
import { useFitbitShortcut, buildFitbitShortcutUrl } from "../components/FitbitShortcutCard.jsx";

const ROUTINE_ROWS = [
  { id: "d1", label: "Torso", sub: "Fuerza / Calistenia" },
  { id: "d2", label: "Pierna & Core", sub: "Estabilidad y fuerza" },
  { id: "d3", label: "Running", sub: "Trote y tobillos" },
  { id: "d4", label: "Full Body", sub: "Kettlebell / Barra" },
];

const sameTargets = (a, b) => MAIN.every((c) => (a?.[c] || 0) === (b?.[c] || 0));

function formatMixSummary(targets) {
  const shortName = { d1: "Torso", d2: "Pierna", d3: "Run", d4: "Full" };
  return MAIN.filter((c) => (targets?.[c] || 0) > 0)
    .map((c) => `${targets[c]}× ${shortName[c]}`)
    .join(" · ");
}

function WeekTargetsSheet({ targets, fixed, onApply, onClose }) {
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_WEEK_TARGETS, ...(targets || {}) }));
  const [applyFuture, setApplyFuture] = useState(false);
  const futureCheckboxId = useId();
  const doneCounts = useMemo(() => countMainCodes(fixed), [fixed]);
  const draftTotal = MAIN.reduce((acc, c) => acc + (draft[c] || 0), 0);

  const adjust = (id, delta) => {
    setDraft((prev) => {
      const cur = prev[id] || 0;
      const curTotal = MAIN.reduce((acc, c) => acc + (prev[c] || 0), 0);
      if (delta > 0 && curTotal >= 7) return prev;
      const nextVal = Math.max(0, Math.min(7, cur + delta));
      return { ...prev, [id]: nextVal };
    });
  };

  const applyPreset = (presetTargets) => {
    setDraft({ ...presetTargets });
  };

  const handleApply = () => {
    if (draftTotal < 1) return;
    onApply(draft, { applyFuture });
    onClose();
  };

  const footer = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onClose} className={btnCls("ghost", "px-4")}>
        Cancelar
      </button>
      <button
        type="button"
        onClick={handleApply}
        disabled={draftTotal < 1}
        className={btnCls("primary", "min-w-0 flex-1")}
      >
        Aplicar a mi semana
      </button>
    </div>
  );

  return (
    <SheetDialog
      eyebrow="Mi semana"
      icon={SlidersHorizontal}
      title="Elegir sesiones"
      subtitle={`${draftTotal} ${draftTotal === 1 ? "sesión" : "sesiones"} · máx. 7`}
      footer={footer}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Presets rápidos de 1 toque */}
        <div>
          <div className="mb-2 text-xs font-medium text-muted">Atajos rápidos</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Combinaciones rápidas">
            {WEEK_TARGET_PRESETS.map((p) => {
              const active = sameTargets(draft, p.targets);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.targets)}
                  aria-pressed={active}
                  className={`min-h-[40px] rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                    active
                      ? "bg-accent/18 text-accent ring-1 ring-inset ring-accent/55"
                      : "bg-white/[0.06] text-fg/90 hover:bg-white/[0.11]"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 filas con controles táctiles − / cantidad / + */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Sesiones de esta semana</span>
            <span className={`font-mono font-semibold tabular-nums ${draftTotal === 0 ? "text-warn" : "text-fg"}`}>
              {draftTotal} {draftTotal === 1 ? "sesión" : "sesiones"} · máx. 7
            </span>
          </div>
          {ROUTINE_ROWS.map((row) => {
            const count = draft[row.id] || 0;
            const done = doneCounts[row.id] || 0;
            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.05] px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                      {TAG[row.id]}
                    </span>
                    <span className="text-[15px] font-semibold text-fg">{row.label}</span>
                    {done > 0 && (
                      <span className="rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-semibold text-good">
                        {done} {done === 1 ? "hecha" : "hechas"}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{row.sub}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjust(row.id, -1)}
                    disabled={count <= 0}
                    aria-label={`Quitar una sesión de ${row.label}`}
                    className="grid h-11 w-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl bg-white/[0.08] text-fg transition hover:bg-white/[0.14] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Minus size={17} aria-hidden="true" />
                  </button>
                  <span
                    aria-live="polite"
                    className="min-w-[2rem] text-center font-mono text-lg font-bold tabular-nums text-fg"
                  >
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjust(row.id, 1)}
                    disabled={draftTotal >= 7}
                    aria-label={`Sumar una sesión de ${row.label}`}
                    className="grid h-11 w-11 min-h-[44px] min-w-[44px] place-items-center rounded-xl bg-white/[0.08] text-fg transition hover:bg-white/[0.14] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Plus size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
          {draftTotal === 0 && (
            <p role="alert" className="text-xs font-medium text-warn">
              Elige al menos 1 sesión para recalcular tu semana.
            </p>
          )}
        </div>

        {/* Opción: solo esta semana vs próximas semanas */}
        <label
          htmlFor={futureCheckboxId}
          className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-2xl bg-white/[0.05] px-3.5 py-3 transition hover:bg-white/[0.08]"
        >
          <span className="relative mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
            <input
              id={futureCheckboxId}
              type="checkbox"
              checked={applyFuture}
              onChange={(e) => setApplyFuture(e.target.checked)}
              className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border border-white/25 bg-white/[0.04] transition checked:border-accent checked:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <Check
              size={14}
              strokeWidth={3}
              aria-hidden="true"
              className="pointer-events-none absolute text-accentInk opacity-0 transition peer-checked:opacity-100"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg">Usar también en próximas semanas</span>
            <span className="mt-0.5 block text-xs text-muted">
              {applyFuture
                ? "Se guardará como tu plantilla para las próximas semanas."
                : "Solo se aplica a esta semana; el lunes volverás a tu plantilla habitual."}
            </span>
          </span>
        </label>
      </div>
    </SheetDialog>
  );
}

function WeekSection({ wp, log, routineVariants, onOpenTargets }) {
  const today = dkey();
  const t = wp.info(today);
  const tm = wp.info(dkey(addDays(new Date(), 1)));
  const fitDays = wp.keys.map((k, i) => ({ i, f: wp.fit && wp.fit[i] })).filter((d) => d.f);
  const line = (x) => `${x.office ? "oficina" : "casa"} · ${x.rid ? getActiveRoutine(x.rid, { routineVariants }).name + (x.evening ? " (de noche)" : "") : "descanso"} · despertar ${x.wake}`;
  const mixSummary = formatMixSummary(wp.targets || DEFAULT_WEEK_TARGETS);

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="whitespace-nowrap text-[20px] font-bold tracking-tight">Mi semana</h2>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onOpenTargets}
            className="inline-flex min-h-[36px] items-center gap-1 whitespace-nowrap rounded-xl bg-accent/15 px-2.5 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/25"
          >
            <SlidersHorizontal size={13} aria-hidden="true" />Elegir sesiones
          </button>
          <button
            type="button"
            onClick={wp.shuffle}
            className="inline-flex min-h-[36px] items-center gap-1 whitespace-nowrap rounded-xl bg-white/[0.08] px-2.5 py-1.5 text-xs font-semibold text-fg transition hover:bg-white/[0.14] hover:text-accent"
          >
            <Shuffle size={13} aria-hidden="true" />Reacomodar
          </button>
        </div>
      </div>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="truncate">{mixSummary}</span>
          <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-fg/85">
            {wp.doneCount ?? 0}/{wp.totalTarget ?? 4} sesiones
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {wp.keys.map((k, i) => {
            const l = log[k];
            const planned = wp.arr[i];
            const isToday = k === today;
            const fit = wp.fit && wp.fit[i];
            const viaFitbit = !l && wp.fromFitbit && wp.fromFitbit[i];
            const missed = !l && !viaFitbit && planned && i < wp.todayIdx;
            const ring = l ? (routineById(l.r, undefined, l.v).low ? "bg-cool text-bg" : "bg-accent text-accentInk")
              : viaFitbit ? "bg-good text-bg"
              : planned ? `border border-dashed ${missed ? "border-line text-muted/60" : "border-accent text-accent"}`
              : isToday ? "border border-line text-muted" : "bg-white/[0.07] text-muted";
            return (
              <div key={k} className="text-center">
                <div className={`text-[10px] ${isToday ? "font-semibold text-accent" : "text-muted"}`}>{DAYS[i]}</div>
                <div className={`relative mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full font-mono text-[10px] font-bold ${ring}`}
                  aria-label={fit ? `${DAYS_LONG[i]}: Fitbit, ${fit.main.type}, ${fit.total} min` : undefined}>
                  {l ? TAG[l.r] : planned ? TAG[planned] : ""}
                  {fit && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-surface bg-good text-bg"><Watch size={9} strokeWidth={2.5} /></span>}
                </div>
                <button type="button" onClick={() => wp.toggleOffice(i)} aria-pressed={wp.office[i]} aria-label={`${DAYS_LONG[i]}: ${wp.office[i] ? "oficina" : "casa"}. Tocar para cambiar`} title={wp.office[i] ? "Oficina" : "Casa"}
                  className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-lg transition ${wp.office[i] ? "bg-warn/15 text-warn" : "bg-white/[0.07] text-muted hover:bg-white/[0.12]"}`}>
                  {wp.office[i] ? <Building2 size={13} /> : <Home size={13} />}
                </button>
                <button type="button" onClick={() => wp.toggleNight(i)} aria-pressed={wp.night[i]} aria-label={`${DAYS_LONG[i]}: noche ${wp.night[i] ? "libre, sin clase" : "con clase"}. Tocar para cambiar`} title={wp.night[i] ? "Noche libre" : "Noche con clase"}
                  className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-lg transition ${wp.night[i] ? "bg-cool/15 text-cool" : "bg-white/[0.07] text-muted/60 hover:bg-white/[0.12]"}`}>
                  <Moon size={13} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1"><Building2 size={11} className="text-warn" />oficina</span>
          <span className="inline-flex items-center gap-1"><Home size={11} />casa</span>
          <span className="inline-flex items-center gap-1"><Moon size={11} className="text-cool" />noche libre (sin clase)</span>
          <span className="inline-flex items-center gap-1"><Watch size={11} className="text-good" />entreno de Fitbit</span>
          <span>Toca un ícono para cambiarlo.</span>
        </p>
        {fitDays.length > 0 && (
          <div className="mt-3 rounded-2xl bg-good/10 px-3.5 py-2.5 text-xs">
            <div className="mb-0.5 inline-flex items-center gap-1 font-semibold text-good"><Watch size={12} />Fitbit esta semana</div>
            <ul className="space-y-0.5">
              {fitDays.map(({ i, f }) => (
                <li key={i} className="flex flex-wrap gap-x-1.5">
                  <span className="text-muted">{DAYS[i]}:</span>
                  <span>{f.list.map((w) => `${w.type} ${w.min} min`).join(" · ")}</span>
                  {wp.fromFitbit && wp.fromFitbit[i] && !log[wp.keys[i]] && <span className="text-good">→ cuenta como {getActiveRoutine(wp.fromFitbit[i], { routineVariants }).name}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 space-y-1 rounded-2xl bg-white/[0.05] px-3.5 py-2.5 text-xs">
          <div><span className="text-muted">Hoy:</span> {line(t)}</div>
          <div><span className="text-muted">Mañana:</span> {line(tm)}</div>
        </div>
        {wp.late && <p className="mt-2.5 text-xs text-warn">Quedó una sesión atrás. Toca «Reacomodar» para repartirla en lo que queda de la semana.</p>}
        <p className="mt-2.5 text-[11px] text-muted">Running nunca cae el día después de pierna, se evita repetir la misma rutina en días seguidos y los días de oficina se dejan para descanso o la sesión más corta. Si un día de oficina tiene la noche libre, la sesión va de noche y se evita madrugar a entrenar al día siguiente si también es de oficina. Un entreno de fuerza o running de Fitbit de 20 min o más cuenta como la sesión de ese día, y tras 30 min o más de otro deporte no se pone pierna al día siguiente.</p>
      </Card>
    </div>
  );
}

export function HomeView({ wp, log, setLog = null, habits, setHabits, habitDefs, block, setBlock, goTrain, goHealth, wins, setWins, reviews, openReview, routineVariants, bevelHistory }) {
  const today = dkey();
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [workouts] = usePersisted("workouts", []);
  const [fitbit] = useFitbitShortcut();
  const [sleep] = usePersisted("sleep", null);
  const night = lastNight(sleep, today);
  const info = wp.info(today);
  const plan = todayPlan({ info, logged: log[today], fromFitbit: wp.fromFitbit && wp.fromFitbit[wp.todayIdx] });
  const routine = plan.rid ? getActiveRoutine(plan.rid, { routineVariants: plan.state === "done" && log[today]?.v ? { [plan.rid]: log[today].v } : routineVariants }) : null;
  const prog = useMemo(
    () => weekProgress({ keys: wp.keys, todayIdx: wp.todayIdx, fixed: wp.fixed, habits, habitDefs, workouts, setLog, targets: wp.targets }),
    [wp.keys, wp.todayIdx, wp.fixed, habits, habitDefs, workouts, setLog, wp.targets],
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

        <WeekSection wp={wp} log={log} routineVariants={routineVariants} onOpenTargets={() => setTargetsOpen(true)} />
      </div>

      <aside className="grid min-w-0 content-start gap-5 md:grid-cols-2 xl:grid-cols-1">
        <div>
          <SectionTitle>Hábitos de hoy</SectionTitle>
          <Card>
            <HabitsMini habits={habits} setHabits={setHabits} habitDefs={habitDefs} />
          </Card>
        </div>
        <IdentityCard wp={wp} log={log} setLog={setLog} habits={habits} habitDefs={habitDefs} />
        <ReviewCard wins={wins} setWins={setWins} reviews={reviews} onOpenReview={openReview} />
        <BlockCard block={block} setBlock={setBlock} />
      </aside>

      {targetsOpen && (
        <WeekTargetsSheet
          targets={wp.targets}
          fixed={wp.fixed}
          onApply={(nextTargets, opts) => wp.setTargets(nextTargets, opts)}
          onClose={() => setTargetsOpen(false)}
        />
      )}
    </div>
  );
}
