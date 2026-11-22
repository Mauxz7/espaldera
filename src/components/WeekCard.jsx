import { Moon, Shuffle, Building2, Home, Watch } from "lucide-react";
import { dkey, addDays, DAYS, DAYS_LONG } from "../lib/dates.js";
import { routineById } from "../data/program.js";
import { getActiveRoutine } from "../lib/routines.js";
import { TAG } from "../lib/planner.js";
import { Card, SectionTitle } from "./ui.jsx";

export function WeekCard({ wp, log, routineVariants }) {
  const today = dkey();
  const t = wp.info(today);
  const tm = wp.info(dkey(addDays(new Date(), 1)));
  const fitDays = wp.keys.map((k, i) => ({ i, f: wp.fit && wp.fit[i] })).filter((d) => d.f);
  const line = (x) => `${x.office ? "oficina" : "casa"} · ${x.rid ? getActiveRoutine(x.rid, { routineVariants }).name + (x.evening ? " (de noche)" : "") : "descanso"} · despertar ${x.wake}`;
  return (
    <div>
      <SectionTitle
        aside={
          <button
            onClick={wp.shuffle}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-fg transition hover:bg-white/[0.14] hover:text-accent"
          >
            <Shuffle size={13} />Reacomodar
          </button>
        }
      >
        Mi semana
      </SectionTitle>
      <Card>
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
                <button onClick={() => wp.toggleOffice(i)} aria-pressed={wp.office[i]} aria-label={`${DAYS_LONG[i]}: ${wp.office[i] ? "oficina" : "casa"}. Tocar para cambiar`} title={wp.office[i] ? "Oficina" : "Casa"}
                  className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-lg transition ${wp.office[i] ? "bg-warn/15 text-warn" : "bg-white/[0.07] text-muted hover:bg-white/[0.12]"}`}>
                  {wp.office[i] ? <Building2 size={13} /> : <Home size={13} />}
                </button>
                <button onClick={() => wp.toggleNight(i)} aria-pressed={wp.night[i]} aria-label={`${DAYS_LONG[i]}: noche ${wp.night[i] ? "libre, sin clase" : "con clase"}. Tocar para cambiar`} title={wp.night[i] ? "Noche libre" : "Noche con clase"}
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
        <p className="mt-2.5 text-[11px] text-muted">Running nunca cae el día después de pierna, se evitan tres días seguidos y los días de oficina se dejan para descanso o la sesión más corta. Si un día de oficina tiene la noche libre, la sesión va de noche y se evita madrugar a entrenar al día siguiente si también es de oficina. Un entreno de fuerza o running de Fitbit de 20 min o más cuenta como la sesión de ese día, y tras 30 min o más de otro deporte no se pone pierna al día siguiente.</p>
      </Card>
    </div>
  );
}
