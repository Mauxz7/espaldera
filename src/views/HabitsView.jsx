import { Flame, AlarmClock } from "lucide-react";
import { dkey, fromKey, addDays, DAYS, DAYS_LONG, clockAm, fmtShort } from "../lib/dates.js";
import { getActiveRoutine } from "../lib/routines.js";
import { DEFAULT_HABIT_DEFS, reqDone, isHabitDoneOrMini, getHabitIcon } from "../data/habits.js";
import { computeAllHabitStats } from "../lib/habitStats.js";
import { Chip, Card, SectionTitle } from "../components/ui.jsx";
import { HabitsMini } from "../components/Habits.jsx";
import { DopamineCard } from "../components/DopamineCard.jsx";

export const NIGHT = [
  { t: "9:30 p.m.", h: "Antes de salir de la U", d: "Luz del celular al mínimo y modo noche activo. Decide hoy la rutina de mañana (la app te la sugiere)." },
  { t: "10:00 p.m.", h: "Llegada: cena sin decidir", d: "Cena ya preparada (táper) o la cena de 10 minutos. Nada de pantallas brillantes mientras comes." },
  { t: "10:20 p.m.", h: "Escenario listo", d: "Ropa de entreno sobre la silla, KB y mancuernas junto a la espaldera, botella de agua llena en la cocina." },
  { t: "10:30 p.m.", h: "Apagado (hábito O5)", d: "Dispositivos fuera: celular cargando lejos de la cama. Ducha tibia, cuarto fresco y oscuro." },
  { t: "10:50 p.m.", h: "Luces fuera", d: "De 10:50 p.m. a 6:30 a.m. son 7 h 40 min en cama, cerca de tu promedio de sueño reparador. Los días sin entreno la alarma pasa a las 7:00." },
];

export function morningSteps(info, routineVariants = null) {
  const r = info.rid ? getActiveRoutine(info.rid, { routineVariants }) : null;
  const leave = { t: "7:50 a.m.", h: "Salida a la oficina", d: "Traslado de 7:50 a 8:45." };
  if (r && info.evening) {
    return [
      { t: "7:00 a.m.", h: "Despertar", d: "Hoy entrenas de noche: sin madrugar." },
      { t: "7:15 a.m.", h: "Desayuno proteico", d: "30–40 g de proteína antes de salir." },
      leave,
      { t: "Noche", h: `Entreno: ${r.name}`, d: `~${r.minutes} min al llegar a casa, sin clase. Termina al menos una hora antes de las 10:30 p.m. y cena con proteína después.` },
    ];
  }
  if (r) {
    const steps = [
      { t: "6:30 a.m.", h: "Despertar sin negociar", d: "Alarma lejos de la cama. Agua + sal, luz encendida y Modo Arranque inmediato." },
      { t: "6:40 a.m.", h: `Entreno: ${r.name}`, d: `~${r.minutes} min. ${info.office ? "Día de oficina: respeta los descansos del temporizador, sin alargarlos." : "Día en casa: sin traslado, tienes margen si una serie se alarga."}` },
      { t: clockAm(6 * 60 + 40 + r.minutes), h: "Ducha y desayuno proteico", d: info.office ? "30–40 g de proteína. Tienes hasta las 7:50." : "30–40 g de proteína, sin prisa: hoy no hay traslado." },
    ];
    if (info.office) steps.push(leave);
    return steps;
  }
  const steps = [
    { t: "7:00 a.m.", h: "Despertar", d: "Día sin entreno: media hora más de sueño para recuperar." },
    { t: "7:15 a.m.", h: "Desayuno proteico", d: "30–40 g de proteína antes de empezar el día." },
  ];
  if (info.office) steps.push(leave);
  return steps;
}

export const PROTEIN_RULES = [
  { h: "Ancla de 30–40 g en cada comida", d: "Antes de las 8:30 a.m.: batido de whey con leche y avena, o 3 huevos + 1 yogur griego. Si una comida no tiene ancla proteica, no está completa." },
  { h: "Cocina dos veces por semana, no siete", d: "Domingo y miércoles: 1,5 kg de pollo o carne molida, arroz o papa y vegetales congelados. 5 tápers listos para almuerzo y cena de las 10:00 p.m." },
  { h: "Kit de emergencia anti comida rápida", d: "En la mochila: batido listo para tomar, atún en lata, maní y fruta. En casa: huevos, queso cottage, tortillas y frijoles para una cena de 10 minutos." },
];

export function HabitsView({ habits, setHabits, habitDefs, tomorrow, tonight, routineVariants }) {
  const defs = habitDefs || DEFAULT_HABIT_DEFS;
  const reqDefs = defs.filter((d) => !d.archived && (!d.group || d.group === "req"));
  const optDefs = defs.filter((d) => !d.archived && d.group === "opt");
  const habitStats = computeAllHabitStats([...reqDefs, ...optDefs], habits);
  const last7 = Array.from({ length: 7 }, (_, i) => dkey(addDays(new Date(), i - 6)));
  let streak = 0;
  for (let i = 6; i >= 0; i--) {
    const h = habits[last7[i]] || {};
    const all = reqDefs.length > 0 && reqDone(h, reqDefs) === reqDefs.length;
    if (all) streak++;
    else if (i !== 6) break;
  }
  return (
    <div className="space-y-5">
      <div className="px-1">
        <div className="text-[13px] font-medium text-muted">Nutrición rápida y hábitos</div>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">Fricción cero</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionTitle aside={<Chip tone={streak ? "good" : "plain"}><Flame size={11} />{streak} {streak === 1 ? "día" : "días"} completos</Chip>}>Checklist de hoy</SectionTitle>
          <Card className="min-w-0">
            <HabitsMini habits={habits} setHabits={setHabits} habitDefs={defs} />
            <div className="mt-4 grid grid-cols-7 gap-1 border-t border-line pt-4">
              {last7.map((k) => {
                const h = habits[k] || {};
                const n = reqDone(h, reqDefs);
                const totalReq = reqDefs.length || 1;
                const allDone = reqDefs.length > 0 && n === reqDefs.length;
                return (
                  <div key={k} className="text-center">
                    <div className="text-[10px] font-medium text-muted">{DAYS[(fromKey(k).getDay() + 6) % 7]}</div>
                    <div className="mx-auto mt-1 flex h-10 w-6 flex-col-reverse overflow-hidden rounded-md bg-white/[0.07]">
                      <div className={allDone ? "bg-good" : "bg-accent"} style={{ height: `${(n / totalReq) * 100}%` }} />
                    </div>
                    <div className="mt-1 flex justify-center gap-0.5">
                      {optDefs.map((x) => (
                        <span key={x.id} className={`h-1.5 w-1.5 rounded-full ${isHabitDoneOrMini(x, h) ? "bg-cool" : "bg-white/[0.1]"}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="min-w-0">
          <SectionTitle>3 reglas de proteína</SectionTitle>
          <Card className="min-w-0">
            <ol className="divide-y divide-line">
              {PROTEIN_RULES.map((r, i) => (
                <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-sm font-bold text-accent">{i + 1}</span>
                  <div className="min-w-0"><div className="text-sm font-semibold">{r.h}</div><p className="text-sm text-muted">{r.d}</p></div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <DopamineCard />

      <div>
        <SectionTitle>Rachas y cumplimiento</SectionTitle>
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">Últimos 30 días por hábito · de hace 29 días a hoy</p>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-good" />Obligatorio</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-cool" />Facultativo</span>
            </div>
          </div>
          <div className="divide-y divide-line">
            {habitStats.map((hb) => {
              const Icon = getHabitIcon(hb);
              const isOpt = hb.group === "opt";
              const barColor = isOpt ? "bg-cool" : "bg-good";
              const streakTone = hb.currentStreak > 0 ? (isOpt ? "text-cool" : "text-good") : "text-muted";
              return (
                <div key={hb.id} className={hb.missedYesterday ? "bg-warn/[0.07] py-3 pl-2.5 pr-1 shadow-[inset_3px_0_0_rgb(var(--c-warn))]" : "py-3 first:pt-0 last:pb-0"}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 basis-full items-start gap-2 sm:basis-auto">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.07] text-muted">
                        <Icon size={13} />
                      </span>
                      <span className="mt-1 font-mono text-[10px] text-muted">{hb.code}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium leading-snug">{hb.label}</div>
                        {hb.after && hb.after.trim() && (
                          <div className="text-xs text-muted">{hb.after.trim()}</div>
                        )}
                        {hb.missedYesterday && (
                          <div className="mt-0.5 text-xs font-medium text-warn">Ayer fallaste: hoy no lo dejes pasar</div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 font-mono text-xs tabular-nums">
                      <span className={`inline-flex items-center gap-1 font-bold ${streakTone}`} title="Racha actual">
                        <Flame size={12} />{hb.currentStreak} {hb.currentStreak === 1 ? "día" : "días"}
                      </span>
                      <span className="text-muted" title="Racha sin dos fallos seguidos">
                        sin 2 fallos: {hb.noTwoMissesStreak}d
                      </span>
                      <span className="text-muted" title="Mejor racha">
                        máx {hb.bestStreak}d
                      </span>
                      <span className="rounded-lg bg-white/[0.08] px-2 py-0.5 text-xs font-bold text-fg" title={`${hb.done30} de 30 días cumplidos`}>
                        {hb.rate30}%
                      </span>
                    </div>
                  </div>
                  <div
                    className="mt-2 grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[2px]"
                    role="img"
                    aria-label={`Últimos 30 días de ${hb.label}: ${hb.done30} de 30 días cumplidos (${hb.rate30}%)`}
                  >
                    {hb.days30.map((d, idx) => {
                      const isToday = idx === hb.days30.length - 1;
                      let cellColor = "bg-white/[0.07]";
                      if (d.done) {
                        cellColor = d.mini
                          ? (isOpt ? "border border-cool/80 bg-cool/25" : "border border-good/80 bg-good/25")
                          : barColor;
                      }
                      return (
                        <span
                          key={d.date}
                          title={`${fmtShort(d.date)}: ${d.mini ? "2 min" : d.done ? "Cumplido" : "Pendiente"}`}
                          className={`h-2.5 rounded-[2px] ${cellColor} ${isToday && !d.done ? "ring-1 ring-inset ring-muted/40" : ""}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle>De las 10:00 p.m. a la espaldera</SectionTitle>
        <Card>
          {tonight.rid && tonight.evening && (
            <p className="mb-3 rounded-2xl bg-cool/12 px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-cool">Hoy entrenas de noche:</span> {getActiveRoutine(tonight.rid, { routineVariants }).name}. Sin clase, entrena al llegar, termina al menos una hora antes de las 10:30 p.m. y retoma esta rutina desde la cena.
            </p>
          )}
          <ol className="relative space-y-4 border-l border-line pl-5">
            {NIGHT.map((s) => (
              <li key={s.t} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-sm font-bold text-accent">{s.t}</span>
                  <span className="text-sm font-semibold">{s.h}</span>
                </div>
                <p className="max-w-prose text-sm text-muted">{s.d}</p>
                {s.t === "10:30 p.m." && (
                  <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-accent/12 px-3 py-1.5 text-sm">
                    <AlarmClock size={14} className="text-accent" />
                    <span className="text-muted">Antes de soltar el celular, dile:</span>
                    <span className="font-semibold">«Alexa, pon una alarma a las {tomorrow.wake} de la mañana»</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
          <h3 className="mb-3 mt-5 flex flex-wrap items-center gap-2 text-sm font-semibold">
            <AlarmClock size={15} className="text-accent" />Mañana, {DAYS_LONG[(fromKey(tomorrow.date).getDay() + 6) % 7].toLowerCase()}
            <Chip tone={tomorrow.office ? "accent" : "plain"}>{tomorrow.office ? "Oficina" : "Casa"}</Chip>
            <Chip tone={tomorrow.rid ? "good" : "plain"}>{tomorrow.rid ? (tomorrow.evening ? "Entreno de noche · 7:00" : "Entreno · 6:30") : "Descanso · 7:00"}</Chip>
          </h3>
          <ol className="relative space-y-4 border-l border-line pl-5">
            {morningSteps(tomorrow, routineVariants).map((s) => (
              <li key={s.t} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-sm font-bold text-accent">{s.t}</span>
                  <span className="text-sm font-semibold">{s.h}</span>
                </div>
                <p className="max-w-prose text-sm text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
