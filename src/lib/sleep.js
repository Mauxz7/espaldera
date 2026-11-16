// Sueño desde Fitbit (D2). La clave sincronizada `sleep` la escribe el repo privado:
// { "AAAA-MM-DD" (día en que despertaste): { min: minutos dormidos, bed: "HH:MM", wake: "HH:MM" } }.
// Sin interfaz; pruebas en tests/sleep.test.mjs.

export const SLEEP_GOAL_MIN = 7 * 60; // 7 h o más: noche de «Persona descansada»
export const BED_GOAL = "23:00"; // dormirse antes de las 11 p.m. también cuenta (luces fuera 10:50 p.m.)
export const POOR_SLEEP_MIN = 6 * 60; // menos de 6 h: hoy conviene una sesión más liviana

// Minutos de la hora de acostarse en una escala que sigue la noche: 22:30 < 23:59 < 00:30 < 02:00.
export function bedMinutes(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || ""));
  if (!m) return null;
  const h = Number(m[1]);
  return (h < 12 ? h + 24 : h) * 60 + Number(m[2]);
}

// La noche cuenta como descanso si dormiste 7 h o más, o si te dormiste antes de la meta.
export function isRested(night) {
  if (!night || !(night.min > 0)) return false;
  if (night.min >= SLEEP_GOAL_MIN) return true;
  const bed = bedMinutes(night.bed);
  return bed !== null && bed <= bedMinutes(BED_GOAL);
}

// La noche que terminó hoy (la que importa para el entreno de hoy).
export function lastNight(sleep, today) {
  const n = sleep && typeof sleep === "object" ? sleep[today] : null;
  return n && n.min > 0 ? n : null;
}

export function isPoorSleep(night) {
  return !!(night && night.min > 0 && night.min < POOR_SLEEP_MIN);
}

// «6 h 50 min», «7 h».
export function fmtSleep(min) {
  const t = Math.round(Number(min) || 0);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
