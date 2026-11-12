import { Droplets, Pill, FlaskConical, PackageCheck, MonitorOff, BookOpen, Milk } from "lucide-react";

// Hábitos Obligatorios: definen el 100 % del día. Hábitos Facultativos: bonus aparte.
// `notion` es el nombre exacto de la columna en la base "Registro diario".
export const HABITS_REQ = [
  { id: "o_creatine", code: "O1", label: "Tomar creatina todos los días.", icon: FlaskConical, notion: "O1 · Tomar creatina" },
  { id: "o_prep", code: "O2", label: "Alistar la creatina del día siguiente.", icon: PackageCheck, notion: "O2 · Alistar creatina de mañana" },
  { id: "o_water", code: "O3", label: "Tomar 2 botellas de agua (2L en total).", icon: Droplets, notion: "O3 · 2 botellas de agua (2 L)" },
  { id: "o_pills", code: "O4", label: "Tomar pastillas (magnesio, omega 3, vitamina C).", icon: Pill, notion: "O4 · Pastillas (Mg, Ω3, Vit C)" },
  { id: "o_screens", code: "O5", label: "Dejar dispositivos electrónicos a las 10:30 p.m.", icon: MonitorOff, notion: "O5 · Pantallas off 10:30 p.m." },
];

export const HABITS_OPT = [
  { id: "f_read", code: "F1", label: "Leer 15 min de libro personal.", icon: BookOpen, notion: "F1 · Leer 15 min" },
  { id: "f_shake", code: "F2", label: "Tomar batido de proteína.", icon: Milk, notion: "F2 · Batido de proteína" },
];

export const HABITS_ALL = [...HABITS_REQ, ...HABITS_OPT];

export const CREATINE_ID = "o_creatine";

export const reqDone = (h) => HABITS_REQ.filter((x) => h && h[x.id]).length;

export const optDone = (h) => HABITS_OPT.filter((x) => h && h[x.id]).length;
