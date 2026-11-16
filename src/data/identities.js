// Identidades: cada hábito cumplido es un «voto» por una de ellas.
// Son editables (clave persistida `identities`); estas son las iniciales.
// `color` es uno de los tokens del tema (--c-accent, --c-good, --c-cool, --c-warn).

export const IDENTITY_COLORS = ["accent", "good", "cool", "warn"];

export const ATHLETE_ID = "atleta";

export const DEFAULT_IDENTITIES = [
  { id: "atleta", label: "Atleta", emoji: "🏋️", color: "accent" },
  { id: "estudiante", label: "Estudiante de Derecho", emoji: "⚖️", color: "warn" },
  { id: "lector", label: "Lector", emoji: "📚", color: "good" },
  { id: "descanso", label: "Persona descansada", emoji: "😴", color: "cool" },
];

// Identidad por defecto de los hábitos iniciales. Se usa cuando un habitDef guardado
// no tiene el campo `identity` (datos anteriores a esta función).
export const DEFAULT_HABIT_IDENTITY = {
  o_creatine: "atleta",
  o_prep: "atleta",
  o_water: "atleta",
  o_pills: "atleta",
  f_shake: "atleta",
  f_fruit: "atleta",
  f_read: "lector",
  o_screens: "descanso",
};

// Identidad de un hábito: la suya si tiene el campo (aunque sea null = «no vota»);
// si no lo tiene, la del mapa por id; los hábitos nuevos sin identidad no votan.
export function habitIdentity(def) {
  if (!def) return null;
  if (Object.prototype.hasOwnProperty.call(def, "identity")) return def.identity || null;
  return DEFAULT_HABIT_IDENTITY[def.id] || null;
}
