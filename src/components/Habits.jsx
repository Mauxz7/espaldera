import { Check, Star, Plus, Minus, Bell } from "lucide-react";
import { dkey, pruneDays } from "../lib/dates.js";
import { DEFAULT_HABIT_DEFS, isHabitDone, reqDone, optDone, getHabitIcon } from "../data/habits.js";
import { isMissedYesterday } from "../lib/habitStats.js";

export function HabitItem({ hb, bonus, code, value, on, miniOn, missedYesterday, onToggle, onToggleMini, onAdjust }) {
  const Icon = getHabitIcon(hb);
  const fullOn = Boolean(on);
  const miniOnly = !fullOn && Boolean(miniOn);
  const doneAny = fullOn || miniOnly;
  const hasMini = Boolean(hb.mini && hb.mini.trim());
  const hasAfter = Boolean(hb.after && hb.after.trim());
  const showMissed = Boolean(missedYesterday && !doneAny);

  let dotCls = "bg-white/[0.07] text-muted";
  if (fullOn) dotCls = bonus ? "bg-cool text-bg" : "bg-good text-bg";
  else if (miniOnly) dotCls = bonus ? "border-2 border-cool bg-cool/10 text-cool" : "border-2 border-good bg-good/10 text-good";

  const miniBtnCls = miniOnly
    ? (bonus ? "bg-cool/20 text-cool" : "bg-good/20 text-good")
    : "bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg";

  const rightMeta = (
    <div className="flex shrink-0 flex-col items-end gap-1 font-mono text-[10px] text-muted">
      <span>{code}</span>
      {hb.remindAt && (
        <span className="inline-flex items-center gap-0.5 text-[9px] text-muted">
          <Bell size={9} />
          {hb.remindAt}
        </span>
      )}
    </div>
  );

  const miniButton = hasMini && (
    <button
      type="button"
      onClick={onToggleMini}
      aria-pressed={miniOnly}
      aria-label={`Versión de 2 minutos: ${hb.mini.trim()}`}
      title={hb.mini.trim()}
      className={`min-h-[40px] shrink-0 rounded-xl px-2.5 text-xs font-semibold transition active:scale-95 ${miniBtnCls}`}
    >
      2 min
    </button>
  );

  const rowCls = `flex w-full items-center gap-2.5 transition ${
    showMissed ? "bg-warn/[0.07] py-2.5 pl-2.5 pr-1 shadow-[inset_3px_0_0_rgb(var(--c-warn))]" : "py-2.5 first:pt-1 last:pb-1"
  }`;

  if (hb.kind === "count") {
    const target = hb.target != null ? Number(hb.target) : 1;
    const count = value === true ? target : (typeof value === "number" ? value : 0);
    return (
      <div className={rowCls}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={fullOn ? `Marcar ${hb.label} como incompleto` : `Marcar ${hb.label} como completado`}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-95 ${dotCls}`}
        >
          {doneAny ? <Check size={17} strokeWidth={3} /> : <Icon size={17} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-snug">{hb.label}</div>
          {hasAfter && <div className="text-xs text-muted">{hb.after.trim()}</div>}
          {showMissed && <div className="mt-0.5 text-xs font-medium text-warn">Ayer fallaste: hoy no lo dejes pasar</div>}
          {miniOnly && hasMini && <div className="mt-0.5 text-xs text-muted">2 min: {hb.mini.trim()}</div>}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-xl bg-white/[0.06] p-0.5">
              <button
                type="button"
                onClick={() => onAdjust && onAdjust(-1)}
                disabled={count <= 0}
                aria-label={`Restar 1 a ${hb.label}`}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg disabled:pointer-events-none disabled:opacity-25"
              >
                <Minus size={13} />
              </button>
              <span className="px-1.5 font-mono text-xs font-bold tabular-nums text-fg">
                {count}/{target}{hb.unit ? ` ${hb.unit}` : ""}
              </span>
              <button
                type="button"
                onClick={() => onAdjust && onAdjust(1)}
                aria-label={`Sumar 1 a ${hb.label}`}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg active:scale-95"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        </div>
        {miniButton}
        {rightMeta}
      </div>
    );
  }

  return (
    <div className={rowCls}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={fullOn}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${dotCls}`}>
          {doneAny ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-snug">{hb.label}</span>
          {hasAfter && <span className="block text-xs text-muted">{hb.after.trim()}</span>}
          {showMissed && <span className="mt-0.5 block text-xs font-medium text-warn">Ayer fallaste: hoy no lo dejes pasar</span>}
          {miniOnly && hasMini && <span className="mt-0.5 block text-xs text-muted">2 min: {hb.mini.trim()}</span>}
        </span>
      </button>
      {miniButton}
      {rightMeta}
    </div>
  );
}

export function HabitsMini({ habits, setHabits, habitDefs }) {
  const today = dkey();
  const h = habits[today] || {};
  const defs = habitDefs || DEFAULT_HABIT_DEFS;
  const reqDefs = defs.filter((d) => !d.archived && (!d.group || d.group === "req"));
  const optDefs = defs.filter((d) => !d.archived && d.group === "opt");

  const updateDay = (updater) => setHabits((all) => {
    const curDay = { ...(all[today] || {}) };
    const nextDay = updater(curDay);
    return pruneDays({ ...all, [today]: nextDay }, 60);
  });

  const clearMini = (day, id) => {
    if (!day._mini || !(id in day._mini)) return day;
    const nextMini = { ...day._mini };
    delete nextMini[id];
    const nextDay = { ...day };
    if (Object.keys(nextMini).length > 0) nextDay._mini = nextMini;
    else delete nextDay._mini;
    return nextDay;
  };

  const toggle = (hb) => {
    const cur = h[hb.id];
    const nextDone = !isHabitDone(hb, cur);
    updateDay((day) => {
      const val = hb.kind === "count" ? (nextDone ? (hb.target || 1) : 0) : nextDone;
      const base = nextDone ? clearMini(day, hb.id) : day;
      return { ...base, [hb.id]: val };
    });
  };

  const toggleMini = (hb) => {
    const isMini = Boolean(h._mini && h._mini[hb.id]);
    updateDay((day) => {
      if (isMini) return clearMini(day, hb.id);
      return {
        ...day,
        [hb.id]: hb.kind === "count" ? 0 : false,
        _mini: { ...(day._mini || {}), [hb.id]: true },
      };
    });
  };

  const adjust = (hb, delta) => {
    const cur = h[hb.id];
    const target = hb.target != null ? Number(hb.target) : 1;
    const count = cur === true ? target : (typeof cur === "number" ? cur : 0);
    const nextVal = Math.max(0, count + delta);
    updateDay((day) => {
      const base = nextVal >= target ? clearMini(day, hb.id) : day;
      return { ...base, [hb.id]: nextVal };
    });
  };

  const r = reqDone(h, reqDefs);
  const o = optDone(h, optDefs);
  const pct = reqDefs.length ? Math.round((r / reqDefs.length) * 100) : 0;

  const renderItem = (hb, bonus, code) => {
    const val = h[hb.id];
    const full = isHabitDone(hb, val);
    const miniOn = !full && Boolean(h._mini && h._mini[hb.id]);
    const missedYesterday = !bonus && isMissedYesterday(hb, habits, today);
    return (
      <HabitItem
        key={hb.id}
        hb={hb}
        bonus={bonus}
        code={hb.code || code}
        value={val}
        on={full}
        miniOn={miniOn}
        missedYesterday={missedYesterday}
        onToggle={() => toggle(hb)}
        onToggleMini={() => toggleMini(hb)}
        onAdjust={(delta) => adjust(hb, delta)}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-good">Hábitos obligatorios</span>
          <span className="font-mono text-xs font-bold tabular-nums text-muted">{r}/{reqDefs.length} · {pct}%</span>
        </div>
        <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-good transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="divide-y divide-line">
          {reqDefs.map((hb, i) => renderItem(hb, false, `O${i + 1}`))}
        </div>
      </div>
      {optDefs.length > 0 && (
        <div className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-cool">
              <Star size={13} />Hábitos facultativos · bonus
            </span>
            <span className="font-mono text-xs font-bold tabular-nums text-muted">+{o}/{optDefs.length}</span>
          </div>
          <div className="divide-y divide-line">
            {optDefs.map((hb, i) => renderItem(hb, true, `F${i + 1}`))}
          </div>
          <p className="mt-2 text-xs text-muted">No cuentan para el 100 % del día.</p>
        </div>
      )}
    </div>
  );
}
