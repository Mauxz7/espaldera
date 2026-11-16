import { Droplets, Pill, FlaskConical, PackageCheck, MonitorOff, BookOpen, Milk, Apple, Check, Hash } from "lucide-react";

// Definiciones iniciales: 7 hábitos existentes con sus mismos IDs + «Comer una fruta» (opcional).
// `identity` es la identidad por la que vota cada hábito (ver src/data/identities.js).
export const DEFAULT_HABIT_DEFS = [
  { id: "o_creatine", label: "Tomar creatina todos los días.", group: "req", kind: "check", target: 1, unit: "", remindAt: "12:00", identity: "atleta" },
  { id: "o_prep", label: "Alistar la creatina del día siguiente.", group: "req", kind: "check", target: 1, unit: "", remindAt: null, identity: "atleta" },
  { id: "o_water", label: "Tomar 2 botellas de agua (2L en total).", group: "req", kind: "count", target: 2, unit: "botellas", remindAt: null, identity: "atleta" },
  { id: "o_pills", label: "Tomar pastillas (magnesio, omega 3, vitamina C).", group: "req", kind: "check", target: 1, unit: "", remindAt: null, identity: "atleta" },
  { id: "o_screens", label: "Dejar dispositivos electrónicos a las 10:30 p.m.", group: "req", kind: "check", target: 1, unit: "", remindAt: null, identity: "descanso" },
  { id: "f_read", label: "Leer 15 min de libro personal.", group: "opt", kind: "check", target: 1, unit: "", remindAt: null, identity: "lector" },
  { id: "f_shake", label: "Tomar batido de proteína.", group: "opt", kind: "check", target: 1, unit: "", remindAt: null, identity: "atleta" },
  { id: "f_fruit", label: "Comer una fruta.", group: "opt", kind: "check", target: 1, unit: "", remindAt: null, identity: "atleta" },
];

export const HABIT_ICONS = {
  o_creatine: FlaskConical,
  o_prep: PackageCheck,
  o_water: Droplets,
  o_pills: Pill,
  o_screens: MonitorOff,
  f_read: BookOpen,
  f_shake: Milk,
  f_fruit: Apple,
};

export function getHabitIcon(hb) {
  if (hb && hb.icon) return hb.icon;
  if (hb && hb.id && HABIT_ICONS[hb.id]) return HABIT_ICONS[hb.id];
  return hb && hb.kind === "count" ? Hash : Check;
}

export const CREATINE_ID = "o_creatine";

export function isHabitDone(def, val) {
  if (val === true) return true;
  if (val === false || val == null) return false;
  if (def && def.kind === "count") {
    const num = typeof val === "number" ? val : Number(val);
    const target = def.target != null ? Number(def.target) : 1;
    return !isNaN(num) && num >= target;
  }
  return Boolean(val);
}

export function isHabitDoneOrMini(def, dayMap) {
  if (!def || !dayMap || typeof dayMap !== "object") return false;
  if (isHabitDone(def, dayMap[def.id])) return true;
  return Boolean(dayMap._mini && dayMap._mini[def.id]);
}

export function reqDone(h, defs = DEFAULT_HABIT_DEFS) {
  if (!h || !Array.isArray(defs)) return 0;
  return defs.filter((d) => (!d.group || d.group === "req") && !d.archived && isHabitDoneOrMini(d, h)).length;
}

export function optDone(h, defs = DEFAULT_HABIT_DEFS) {
  if (!h || !Array.isArray(defs)) return 0;
  return defs.filter((d) => d.group === "opt" && !d.archived && isHabitDoneOrMini(d, h)).length;
}

export const HABITS_REQ = DEFAULT_HABIT_DEFS.filter((d) => d.group === "req").map((d, i) => ({
  ...d,
  code: `O${i + 1}`,
  icon: HABIT_ICONS[d.id] || Check,
}));

export const HABITS_OPT = DEFAULT_HABIT_DEFS.filter((d) => d.group === "opt").map((d, i) => ({
  ...d,
  code: `F${i + 1}`,
  icon: HABIT_ICONS[d.id] || Check,
}));

export const HABITS_ALL = [...HABITS_REQ, ...HABITS_OPT];
