import { Check, Star } from "lucide-react";
import { dkey } from "../lib/dates.js";
import { HABITS_REQ, HABITS_OPT, reqDone, optDone } from "../data/habits.js";

export function HabitItem({ hb, bonus, on, onToggle }) {
  const Icon = hb.icon;
  const onCls = bonus ? "border-cool/40 bg-cool/10" : "border-good/40 bg-good/10";
  const dotCls = bonus ? "bg-cool text-bg" : "bg-good text-bg";
  return (
    <button onClick={onToggle} aria-pressed={on} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${on ? onCls : "border-line bg-surface2"}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${on ? dotCls : "bg-surface text-muted"}`}>{on ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}</span>
      <span className="min-w-0 flex-1 text-sm font-medium">{hb.label}</span>
      <span className="shrink-0 font-mono text-[10px] text-muted">{hb.code}</span>
    </button>
  );
}

export function HabitsMini({ habits, setHabits }) {
  const today = dkey();
  const h = habits[today] || {};
  const toggle = (id) => setHabits((all) => {
    const next = { ...all, [today]: { ...(all[today] || {}), [id]: !(all[today] || {})[id] } };
    const keep = Object.keys(next).sort().slice(-60);
    return Object.fromEntries(keep.map((k) => [k, next[k]]));
  });
  const r = reqDone(h);
  const o = optDone(h);
  const pct = Math.round((r / HABITS_REQ.length) * 100);
  const item = (hb, bonus) => <HabitItem key={hb.id} hb={hb} bonus={bonus} on={!!h[hb.id]} onToggle={() => toggle(hb.id)} />;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-good">Hábitos Obligatorios</span>
          <span className="font-mono text-xs tabular-nums text-muted">{r}/{HABITS_REQ.length} · {pct}%</span>
        </div>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-good transition-all duration-500" style={{ width: `${pct}%` }} /></div>
        <div className="space-y-2">{HABITS_REQ.map((hb) => item(hb, false))}</div>
      </div>
      <div className="rounded-xl border border-dashed border-line p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cool"><Star size={12} />Hábitos Facultativos · bonus</span>
          <span className="font-mono text-xs tabular-nums text-muted">+{o}/{HABITS_OPT.length}</span>
        </div>
        <div className="space-y-2">{HABITS_OPT.map((hb) => item(hb, true))}</div>
        <p className="mt-2 px-0.5 text-[11px] text-muted">No cuentan para el 100 % del día.</p>
      </div>
    </div>
  );
}
