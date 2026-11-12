import { Check, Star, Plus, Minus, Bell } from "lucide-react";
import { dkey, pruneDays } from "../lib/dates.js";
import { DEFAULT_HABIT_DEFS, isHabitDone, reqDone, optDone, getHabitIcon } from "../data/habits.js";

export function HabitItem({ hb, bonus, code, value, on, onToggle, onAdjust }) {
  const Icon = getHabitIcon(hb);
  const onCls = bonus ? "border-cool/40 bg-cool/10" : "border-good/40 bg-good/10";
  const dotCls = bonus ? "bg-cool text-bg" : "bg-good text-bg";

  if (hb.kind === "count") {
    const target = hb.target != null ? Number(hb.target) : 1;
    const count = value === true ? target : (typeof value === "number" ? value : 0);
    return (
      <div className={`flex w-full items-center gap-3 rounded-xl border p-3 transition ${on ? onCls : "border-line bg-surface2"}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={on ? `Marcar ${hb.label} como incompleto` : `Marcar ${hb.label} como completado`}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition active:scale-95 ${on ? dotCls : "bg-surface text-muted hover:text-fg"}`}
        >
          {on ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
        </button>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium leading-snug">{hb.label}</span>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface/80 p-0.5">
              <button
                type="button"
                onClick={() => onAdjust && onAdjust(-1)}
                disabled={count <= 0}
                aria-label={`Restar 1 a ${hb.label}`}
                className="grid h-6 w-6 place-items-center rounded-md bg-surface2 text-muted hover:text-fg disabled:pointer-events-none disabled:opacity-25"
              >
                <Minus size={13} />
              </button>
              <span className="px-2 font-mono text-xs font-semibold tabular-nums text-fg">
                {count}/{target}{hb.unit ? ` ${hb.unit}` : ""}
              </span>
              <button
                type="button"
                onClick={() => onAdjust && onAdjust(1)}
                aria-label={`Sumar 1 a ${hb.label}`}
                className="grid h-6 w-6 place-items-center rounded-md bg-surface2 text-muted hover:text-fg active:scale-95"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 font-mono text-[10px] text-muted">
          <span>{code}</span>
          {hb.remindAt && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-muted">
              <Bell size={9} />
              {hb.remindAt}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${on ? onCls : "border-line bg-surface2"}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${on ? dotCls : "bg-surface text-muted"}`}>
        {on ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{hb.label}</span>
      <div className="flex shrink-0 flex-col items-end gap-1 font-mono text-[10px] text-muted">
        <span>{code}</span>
        {hb.remindAt && (
          <span className="inline-flex items-center gap-0.5 text-[9px] text-muted">
            <Bell size={9} />
            {hb.remindAt}
          </span>
        )}
      </div>
    </button>
  );
}

export function HabitsMini({ habits, setHabits, habitDefs }) {
  const today = dkey();
  const h = habits[today] || {};
  const defs = habitDefs || DEFAULT_HABIT_DEFS;
  const reqDefs = defs.filter((d) => !d.archived && (!d.group || d.group === "req"));
  const optDefs = defs.filter((d) => !d.archived && d.group === "opt");

  const updateVal = (id, val) => setHabits((all) => {
    const next = { ...all, [today]: { ...(all[today] || {}), [id]: val } };
    return pruneDays(next, 60);
  });

  const toggle = (hb) => {
    const cur = h[hb.id];
    if (hb.kind === "count") {
      const done = isHabitDone(hb, cur);
      updateVal(hb.id, done ? 0 : (hb.target || 1));
    } else {
      updateVal(hb.id, !isHabitDone(hb, cur));
    }
  };

  const adjust = (hb, delta) => {
    const cur = h[hb.id];
    const target = hb.target != null ? Number(hb.target) : 1;
    const count = cur === true ? target : (typeof cur === "number" ? cur : 0);
    const nextVal = Math.max(0, count + delta);
    updateVal(hb.id, nextVal);
  };

  const r = reqDone(h, reqDefs);
  const o = optDone(h, optDefs);
  const pct = reqDefs.length ? Math.round((r / reqDefs.length) * 100) : 0;

  const renderItem = (hb, bonus, code) => {
    const val = h[hb.id];
    return (
      <HabitItem
        key={hb.id}
        hb={hb}
        bonus={bonus}
        code={hb.code || code}
        value={val}
        on={isHabitDone(hb, val)}
        onToggle={() => toggle(hb)}
        onAdjust={(delta) => adjust(hb, delta)}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-good">Hábitos Obligatorios</span>
          <span className="font-mono text-xs tabular-nums text-muted">{r}/{reqDefs.length} · {pct}%</span>
        </div>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface2">
          <div className="h-full rounded-full bg-good transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="space-y-2">
          {reqDefs.map((hb, i) => renderItem(hb, false, `O${i + 1}`))}
        </div>
      </div>
      {optDefs.length > 0 && (
        <div className="rounded-xl border border-dashed border-line p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cool">
              <Star size={12} />Hábitos Facultativos · bonus
            </span>
            <span className="font-mono text-xs tabular-nums text-muted">+{o}/{optDefs.length}</span>
          </div>
          <div className="space-y-2">
            {optDefs.map((hb, i) => renderItem(hb, true, `F${i + 1}`))}
          </div>
          <p className="mt-2 px-0.5 text-[11px] text-muted">No cuentan para el 100 % del día.</p>
        </div>
      )}
    </div>
  );
}
