import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Bell, BellRing, BellOff } from "lucide-react";
import { dkey, hhmm } from "./dates.js";
import { unlockAudio, beep } from "./audio.js";
import { CREATINE_ID, DEFAULT_HABIT_DEFS, isHabitDone, getHabitIcon } from "../data/habits.js";

export const CREATINE_HOUR = 12;
export const REMINDER_STORAGE_KEY = "fitpanel:reminderFired";
export const LEGACY_CREATINE_STORAGE_KEY = "fitpanel:creatineFired";

export const notifSupported = () => {
  try {
    return typeof window !== "undefined" && "Notification" in window;
  } catch (e) {
    return false;
  }
};

export const notifPerm = () => {
  try {
    return notifSupported() ? Notification.permission : "unsupported";
  } catch (e) {
    return "unsupported";
  }
};

export function parseRemindAt(remindAt) {
  if (typeof remindAt !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(remindAt.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return {
    hour,
    minute,
    minutes: hour * 60 + minute,
    hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

export function getScheduledHabits(habitDefs = DEFAULT_HABIT_DEFS) {
  const defs = Array.isArray(habitDefs) ? habitDefs : DEFAULT_HABIT_DEFS;
  return defs.filter((d) => d && !d.archived && parseRemindAt(d.remindAt) !== null);
}

export function isHabitDue(def, dayHabits = {}, now = new Date()) {
  if (!def || def.archived) return false;
  const parsed = parseRemindAt(def.remindAt);
  if (!parsed) return false;
  const val = dayHabits ? dayHabits[def.id] : undefined;
  if (isHabitDone(def, val)) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= parsed.minutes;
}

export function getDueHabits(habitDefs = DEFAULT_HABIT_DEFS, dayHabits = {}, now = new Date()) {
  const defs = Array.isArray(habitDefs) ? habitDefs : DEFAULT_HABIT_DEFS;
  return defs.filter((def) => isHabitDue(def, dayHabits, now));
}

export function shouldFireReminder(dueHabits, firedMap = {}, today, hour) {
  const slot = `${today}-${hour}`;
  const cleanedMap = {};
  if (firedMap && typeof firedMap === "object") {
    for (const [k, v] of Object.entries(firedMap)) {
      if (typeof v === "string" && v.startsWith(`${today}-`)) {
        cleanedMap[k] = v;
      }
    }
  }
  if (!Array.isArray(dueHabits) || dueHabits.length === 0) {
    return { shouldFire: false, slot, newlyDue: [], nextFiredMap: cleanedMap };
  }
  const newlyDue = dueHabits.filter((h) => h && h.id && cleanedMap[h.id] !== slot);
  if (newlyDue.length === 0) {
    return { shouldFire: false, slot, newlyDue: [], nextFiredMap: cleanedMap };
  }
  const nextFiredMap = { ...cleanedMap };
  for (const h of dueHabits) {
    if (h && h.id) nextFiredMap[h.id] = slot;
  }
  return { shouldFire: true, slot, newlyDue, nextFiredMap };
}

export function cleanHabitLabel(label) {
  if (typeof label !== "string") return "Hábito";
  return label.trim().replace(/\.+$/, "") || "Hábito";
}

export function buildNotificationPayload(dueHabits = [], now = new Date()) {
  const list = Array.isArray(dueHabits) ? dueHabits : [];
  if (list.length === 1) {
    const hb = list[0];
    const clean = cleanHabitLabel(hb.label);
    if (hb.id === CREATINE_ID) {
      return {
        title: "Creatina pendiente",
        body: `Son las ${hhmm(now)} y aún no la marcas. Tómala y toca el check en Espaldera.`,
        tabTitle: "⏰ Creatina pendiente",
        tag: "espaldera-recordatorio",
      };
    }
    return {
      title: `Hábito pendiente: ${clean}`,
      body: `Son las ${hhmm(now)} y aún no marcas «${clean}». Hazlo y márcalo en Espaldera.`,
      tabTitle: `⏰ ${clean}`,
      tag: "espaldera-recordatorio",
    };
  }
  if (list.length > 1) {
    const names = list.map((h) => cleanHabitLabel(h.label)).join(", ");
    return {
      title: `${list.length} hábitos pendientes`,
      body: `Son las ${hhmm(now)}. Pendientes: ${names}.`,
      tabTitle: `⏰ ${list.length} hábitos pendientes`,
      tag: "espaldera-recordatorio",
    };
  }
  return {
    title: "Recordatorio de hábitos",
    body: `Son las ${hhmm(now)}. Así te avisará Espaldera cuando tengas hábitos pendientes.`,
    tabTitle: "⏰ Recordatorio de hábitos",
    tag: "espaldera-recordatorio",
  };
}

export function resolveCompletedValue(def) {
  if (def && def.kind === "count") {
    return Math.max(1, Number(def.target) || 1);
  }
  return true;
}

export function useHabitReminders(habitDefsOrTaken = DEFAULT_HABIT_DEFS, habitsInput = {}) {
  const [now, setNow] = useState(() => new Date());
  const [perm, setPerm] = useState(notifPerm);
  const [ringing, setRinging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const notifRef = useRef(null);

  const today = dkey(now);
  const hour = now.getHours();

  let defs = DEFAULT_HABIT_DEFS;
  let dayHabits = {};
  if (typeof habitDefsOrTaken === "boolean") {
    dayHabits = { [CREATINE_ID]: habitDefsOrTaken };
  } else {
    defs = Array.isArray(habitDefsOrTaken) && habitDefsOrTaken.length ? habitDefsOrTaken : DEFAULT_HABIT_DEFS;
    if (habitsInput && typeof habitsInput === "object") {
      dayHabits =
        typeof habitsInput[today] === "object" && habitsInput[today] !== null && !Array.isArray(habitsInput[today])
          ? habitsInput[today]
          : habitsInput;
    }
  }

  const scheduledHabits = getScheduledHabits(defs);
  const dueHabits = getDueHabits(defs, dayHabits, now);
  const due = dueHabits.length > 0;
  const dueKey = dueHabits.map((d) => `${d.id}:${d.remindAt || ""}`).join(",");
  const allScheduledDone =
    scheduledHabits.length > 0 && scheduledHabits.every((d) => isHabitDone(d, dayHabits[d.id]));

  const dueHabitsRef = useRef(dueHabits);
  dueHabitsRef.current = dueHabits;

  // Reloj del checker: revisa cada 15 s si toca avisar.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  const fire = useCallback(() => {
    setRinging(true);
    setHidden(false);
    beep();
    if (notifPerm() === "granted") {
      try {
        if (notifRef.current) notifRef.current.close();
        const payload = buildNotificationPayload(dueHabitsRef.current, new Date());
        const n = new Notification(payload.title, {
          body: payload.body,
          tag: payload.tag,
          renotify: true,
          requireInteraction: true,
        });
        n.onclick = () => {
          try {
            window.focus();
          } catch (e) {}
          n.close();
        };
        notifRef.current = n;
      } catch (e) {}
    }
  }, []);

  // Un aviso desde la hora configurada de cada hábito y repetición cada hora en punto mientras siga sin marcar.
  useEffect(() => {
    if (!due) return;
    let firedMap = {};
    try {
      const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
      if (raw) firedMap = JSON.parse(raw) || {};
    } catch (e) {
      firedMap = {};
    }
    try {
      const legacy = localStorage.getItem(LEGACY_CREATINE_STORAGE_KEY);
      if (legacy && !firedMap[CREATINE_ID]) firedMap[CREATINE_ID] = legacy;
    } catch (e) {}

    const { shouldFire, nextFiredMap } = shouldFireReminder(dueHabitsRef.current, firedMap, today, hour);
    if (!shouldFire) return;
    try {
      localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(nextFiredMap));
      if (nextFiredMap[CREATINE_ID]) {
        localStorage.setItem(LEGACY_CREATINE_STORAGE_KEY, nextFiredMap[CREATINE_ID]);
      }
    } catch (e) {}
    fire();
  }, [due, dueKey, today, hour, fire]);

  // Parpadeo del título de la pestaña durante 60 s tras cada aviso.
  useEffect(() => {
    if (!ringing) return;
    const original = document.title;
    let on = false;
    const id = setInterval(() => {
      on = !on;
      const { tabTitle } = buildNotificationPayload(dueHabitsRef.current, new Date());
      document.title = on ? tabTitle : original;
    }, 1000);
    const stop = setTimeout(() => setRinging(false), 60000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
      document.title = original;
    };
  }, [ringing]);

  // Al marcar todos los hábitos pendientes se apaga todo al instante.
  useEffect(() => {
    if (due) return;
    setRinging(false);
    setHidden(false);
    try {
      if (notifRef.current) notifRef.current.close();
    } catch (e) {}
    notifRef.current = null;
  }, [due]);

  const ask = useCallback(async () => {
    unlockAudio();
    if (!notifSupported()) {
      setPerm("unsupported");
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
    } catch (e) {
      setPerm(notifPerm());
    }
  }, []);

  const test = useCallback(() => {
    unlockAudio();
    fire();
  }, [fire]);

  return {
    due,
    dueHabits,
    scheduledHabits,
    allScheduledDone,
    dayHabits,
    ringing,
    hidden,
    setHidden,
    perm,
    ask,
    test,
  };
}

export const useCreatineReminder = useHabitReminders;

export function ReminderBanner({ rem, onTake }) {
  if (!rem || !rem.due || rem.hidden) return null;
  const dueHabits =
    Array.isArray(rem.dueHabits) && rem.dueHabits.length > 0
      ? rem.dueHabits
      : [DEFAULT_HABIT_DEFS[0]];
  const dayHabits = rem.dayHabits || {};
  const single = dueHabits.length === 1;

  return (
    <div className="creatine-banner fixed inset-x-0 z-40 flex justify-center px-4" role="alert">
      <div
        className={`w-full max-w-xl rounded-2xl border border-warn/50 bg-surface p-3 shadow-2xl ${
          rem.ringing ? "flash" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warn/20 text-warn">
              <BellRing size={18} className={rem.ringing ? "ring-bell" : ""} />
            </span>
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold uppercase leading-none">
                {single ? "Hábito pendiente" : `${dueHabits.length} hábitos pendientes`}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {single
                  ? `Desde las ${dueHabits[0].remindAt || "12:00"}. Te aviso cada hora en punto hasta que lo marques.`
                  : "Te aviso cada hora en punto hasta que los marques."}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => rem.setHidden(true)}
            className="shrink-0 rounded-xl bg-surface2 px-2.5 py-1.5 text-xs text-muted hover:text-fg"
            aria-label="Ocultar hasta el próximo aviso"
          >
            Ocultar
          </button>
        </div>

        <ul className="mt-2.5 max-h-56 space-y-1.5 overflow-y-auto">
          {dueHabits.map((hb) => {
            const Icon = getHabitIcon(hb);
            const cur = dayHabits[hb.id];
            const count = typeof cur === "number" ? cur : 0;
            const isCount = hb.kind === "count";
            return (
              <li
                key={hb.id}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-line bg-surface2/80 px-2.5 py-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface text-warn">
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-fg">{hb.label}</div>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted">
                      {hb.remindAt && (
                        <span className="inline-flex items-center gap-0.5">
                          <Bell size={9} />
                          {hb.remindAt}
                        </span>
                      )}
                      {isCount && (
                        <span className="text-accent">
                          {count}/{hb.target || 1}
                          {hb.unit ? ` ${hb.unit}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onTake && onTake(hb.id)}
                  aria-label={`Marcar ${hb.label}`}
                  className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-good px-3 py-1.5 text-xs font-semibold text-bg active:scale-95"
                >
                  <Check size={14} strokeWidth={3} />
                  Marcar
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export const CreatineBanner = ReminderBanner;

export function ReminderCard({ rem, taken }) {
  const permText =
    {
      granted: { t: "Notificaciones del sistema activas.", cls: "text-good", icon: Bell },
      denied: {
        t: "El navegador bloquea las notificaciones del sistema en esta vista. El aviso en pantalla, el sonido y el título que parpadea siguen funcionando.",
        cls: "text-warn",
        icon: BellOff,
      },
      default: { t: "Aún no has dado permiso para notificaciones del sistema.", cls: "text-muted", icon: Bell },
      unsupported: {
        t: "Este navegador no ofrece notificaciones aquí. El aviso en pantalla y el sonido siguen funcionando.",
        cls: "text-warn",
        icon: BellOff,
      },
    }[rem.perm] || { t: "", cls: "text-muted", icon: Bell };
  const Icon = permText.icon;

  const scheduled = Array.isArray(rem.scheduledHabits) ? rem.scheduledHabits : [];
  const dueHabits = Array.isArray(rem.dueHabits) ? rem.dueHabits : [];
  const dayHabits = rem.dayHabits || {};
  const allDone = rem.allScheduledDone != null ? rem.allScheduledDone : Boolean(taken);

  let statusText = "los avisos empiezan a las 12:00.";
  if (scheduled.length === 0 && rem.scheduledHabits) {
    statusText = "ningún hábito tiene hora de recordatorio configurada.";
  } else if (allDone) {
    statusText = "todos los hábitos con recordatorio están marcados, sin avisos.";
  } else if (rem.due) {
    statusText =
      dueHabits.length === 1
        ? "1 hábito pendiente, avisos activos."
        : `${dueHabits.length} hábitos pendientes, avisos activos.`;
  } else if (scheduled.length > 0) {
    const pending = scheduled
      .filter((d) => !isHabitDone(d, dayHabits[d.id]))
      .sort((a, b) => (parseRemindAt(a.remindAt)?.minutes || 0) - (parseRemindAt(b.remindAt)?.minutes || 0));
    if (pending.length > 0) {
      statusText = `próximo aviso a las ${pending[0].remindAt}.`;
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-display text-lg font-semibold uppercase tracking-wide">Recordatorios de hábitos</h2>
      <p className="text-sm text-muted">
        A partir de la hora configurada en cada hábito, si sigue pendiente, Espaldera te avisa cada hora en punto con notificación, sonido y aviso en pantalla. Se detiene apenas lo marcas.
      </p>
      <div className={`mt-3 flex items-start gap-2 text-xs ${permText.cls}`}>
        <Icon size={14} className="mt-0.5 shrink-0" />
        {permText.t}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {rem.perm === "default" && (
          <button
            onClick={rem.ask}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk"
          >
            <Bell size={15} />
            Activar notificaciones
          </button>
        )}
        <button
          onClick={rem.test}
          className="inline-flex items-center gap-1.5 rounded-xl bg-surface2 px-3.5 py-2 text-sm text-muted hover:text-fg"
        >
          <BellRing size={15} />
          Probar aviso
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Hoy: {statusText} Funciona mientras Espaldera esté abierta en alguna pestaña.
      </p>
    </section>
  );
}
