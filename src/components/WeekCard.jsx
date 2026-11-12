import { Moon, Shuffle, Building2, Home } from "lucide-react";
import { dkey, addDays, DAYS, DAYS_LONG } from "../lib/dates.js";
import { routineById } from "../data/program.js";
import { TAG } from "../lib/planner.js";

export function WeekCard({ wp, log }) {
  const today = dkey();
  const t = wp.info(today);
  const tm = wp.info(dkey(addDays(new Date(), 1)));
  const line = (x) => `${x.office ? "oficina" : "casa"} · ${x.rid ? routineById(x.rid).name + (x.evening ? " (de noche)" : "") : "descanso"} · despertar ${x.wake}`;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Mi semana</h2>
        <button onClick={wp.shuffle} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:text-accent"><Shuffle size={13} />Reacomodar</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {wp.keys.map((k, i) => {
          const l = log[k];
          const planned = wp.arr[i];
          const isToday = k === today;
          const missed = !l && planned && i < wp.todayIdx;
          const ring = l ? (routineById(l.r).low ? "bg-cool text-bg" : "bg-accent text-accentInk")
            : planned ? `border border-dashed ${missed ? "border-line text-muted/60" : "border-accent text-accent"}`
            : isToday ? "border border-line text-muted" : "bg-surface2 text-muted";
          return (
            <div key={k} className="text-center">
              <div className={`text-[10px] ${isToday ? "font-semibold text-accent" : "text-muted"}`}>{DAYS[i]}</div>
              <div className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full font-mono text-[9px] font-semibold ${ring}`}>{l ? TAG[l.r] : planned ? TAG[planned] : ""}</div>
              <button onClick={() => wp.toggleOffice(i)} aria-pressed={wp.office[i]} aria-label={`${DAYS_LONG[i]}: ${wp.office[i] ? "oficina" : "casa"}. Tocar para cambiar`} title={wp.office[i] ? "Oficina" : "Casa"}
                className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-md border ${wp.office[i] ? "border-warn/40 bg-warn/10 text-warn" : "border-line bg-surface2 text-muted"}`}>
                {wp.office[i] ? <Building2 size={13} /> : <Home size={13} />}
              </button>
              <button onClick={() => wp.toggleNight(i)} aria-pressed={wp.night[i]} aria-label={`${DAYS_LONG[i]}: noche ${wp.night[i] ? "libre, sin clase" : "con clase"}. Tocar para cambiar`} title={wp.night[i] ? "Noche libre" : "Noche con clase"}
                className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-md border ${wp.night[i] ? "border-cool/50 bg-cool/15 text-cool" : "border-line bg-surface2 text-muted/50"}`}>
                <Moon size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1"><Building2 size={11} className="text-warn" />oficina</span>
        <span className="inline-flex items-center gap-1"><Home size={11} />casa</span>
        <span className="inline-flex items-center gap-1"><Moon size={11} className="text-cool" />noche libre (sin clase)</span>
        <span>Toca un ícono para cambiarlo.</span>
      </p>
      <div className="mt-2 space-y-1 rounded-xl bg-surface2 px-3 py-2 text-xs">
        <div><span className="text-muted">Hoy:</span> {line(t)}</div>
        <div><span className="text-muted">Mañana:</span> {line(tm)}</div>
      </div>
      {wp.late && <p className="mt-2 text-xs text-warn">Quedó una sesión atrás. Toca «Reacomodar» para repartirla en lo que queda de la semana.</p>}
      <p className="mt-2 text-[11px] text-muted">Running nunca cae el día después de pierna, se evitan tres días seguidos y los días de oficina se dejan para descanso o la sesión más corta. Si un día de oficina tiene la noche libre, la sesión va de noche y se evita madrugar a entrenar al día siguiente si también es de oficina.</p>
    </section>
  );
}
