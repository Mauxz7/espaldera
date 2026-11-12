import { dkey, fromKey, addDays, DAYS, fmtShort } from "./dates.js";

// El historial vive en tus datos (clave "health"), no en el código.
export const GH_SEED_ROWS = [];

export const GH_SEED = GH_SEED_ROWS.map(([weekStart, totalSteps, avgSteps, bestDay, bestSteps, floors, distanceKm, caloriesAvg, azmTotal, sleepAvgMin, activeHours, restingHr, weightKg]) => ({
  weekStart, totalSteps, avgSteps, bestDay, bestSteps, floors, distanceKm, caloriesAvg, azmTotal, sleepAvgMin, activeHours, restingHr, weightKg, source: "gmail",
}));

export const SAMPLE_EMAIL = `Weekly stats

Here are your stats for Jan 3 - Jan 9

Sun Mon Tue Wed Thu Best day!
9,000 Sat

42,000

total steps

best day Best day · 9,000

hourly activity Avg 6,000 steps/day

total floors

40

total floors

total distance

30.00

total kilometers

total calories

2,500

avg. calories burned

total active zone minutes

300

total active zone minutes

total sleep

7h 30m

avg. restful sleep

hourly activity

4 of 9h

avg. hrs with 250+ steps

55 bpm

avg. resting heart rate

weight

70.0kg
`;

export const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// Índice en DAYS (Lun=0 … Dom=6) para cada abreviatura inglesa del correo

export const EN_DAY = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

export function parseNum(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  const n = Number(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

export const NUM = "(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d+)?)";

// Infiere el año: el reporte siempre es de una semana pasada
export function inferDate(monTxt, day) {
  const m = monTxt.toLowerCase().slice(0, 3);
  let mi = MONTHS_EN.indexOf(m);
  if (mi < 0) mi = MONTHS_ES.indexOf(m);
  if (mi < 0) return null;
  const now = new Date();
  let d = new Date(now.getFullYear(), mi, Number(day));
  if (d > addDays(now, 7)) d = new Date(now.getFullYear() - 1, mi, Number(day));
  return dkey(d);
}

export function parseHealth(text) {
  const low = text.replace(/ /g, " ").toLowerCase();
  const out = {};
  const pick = (re) => { const m = low.match(re); return m ? parseNum(m[1]) : null; };
  const ws = "[\\s·:]*";

  const range = low.match(/stats for\s+([a-z]{3})[a-z]*\.?\s+(\d{1,2})\s*[-–]\s*([a-z]{3})[a-z]*\.?\s+(\d{1,2})/);
  if (range) out.weekStart = inferDate(range[1], range[2]);

  out.totalSteps = pick(new RegExp(NUM + "\\s+total steps")) ?? pick(new RegExp("(?:pasos totales|total de pasos)" + ws + NUM));
  out.avgSteps = pick(new RegExp("avg\\.?\\s+" + NUM + "\\s+steps\\s*/\\s*day")) ?? pick(new RegExp("(?:promedio diario|promedio)" + ws + NUM + "\\s*pasos"));
  out.bestSteps = pick(new RegExp("best day\\s*·\\s*" + NUM)) ?? pick(new RegExp("mejor d[ií]a[^\\d]{0,30}" + NUM));
  out.floors = pick(new RegExp("total floors\\s+" + NUM + "\\s+total floors"));
  out.distanceKm = pick(new RegExp("total distance\\s+" + NUM + "\\s+total kilometers")) ?? pick(new RegExp(NUM + "\\s*(?:km|kil[oó]metros)"));
  out.caloriesAvg = pick(new RegExp("total calories\\s+" + NUM + "\\s+avg\\.? calories")) ?? pick(new RegExp("calor[ií]as[^\\d]{0,20}" + NUM));
  out.azmTotal = pick(new RegExp("total active zone minutes\\s+" + NUM + "\\s+total active zone minutes")) ??
    pick(new RegExp(NUM + "[ \\t]*(?:active zone minutes|minutos en zona activa)")) ??
    pick(new RegExp("(?:minutos en zona activa|active zone minutes)" + ws + NUM));
  out.activeHours = pick(/(\d+)\s+of\s+\d+\s*h/);
  out.restingHr = pick(/(\d{2,3})\s*bpm/);
  out.weightKg = pick(/(\d{2,3}(?:\.\d)?)\s*kg/);

  const sl = low.match(/(?:total sleep|sueño|sleep)[^\d]{0,30}(\d{1,2})\s*(?:h|hr|hrs|horas?)\s*(\d{1,2})?\s*(?:m|min)?/);
  if (sl) out.sleepAvgMin = Number(sl[1]) * 60 + (sl[2] ? Number(sl[2]) : 0);

  // Mejor día: en la fila del gráfico su nombre se sustituye por "Best day!", así que es el que falta
  const a = range ? low.indexOf(range[0]) + range[0].length : 0;
  const b = low.indexOf("total steps", a);
  if (b > a) {
    const seen = new Set((low.slice(a, b).match(/\b(sun|mon|tue|wed|thu|fri|sat)\b/g) || []).map((d) => EN_DAY[d]));
    if (seen.size === 6) out.bestDay = [0, 1, 2, 3, 4, 5, 6].find((i) => !seen.has(i));
  }
  if (out.bestDay == null) {
    const m = low.match(/(?:mejor día|mejor dia)[^a-záéíóú]*(?:fue\s+)?(?:el\s+)?(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/);
    if (m) out.bestDay = ["lunes", "martes", "mi", "jueves", "viernes", "s", "domingo"].findIndex((p) => m[1].startsWith(p));
  }
  Object.keys(out).forEach((k) => out[k] == null && delete out[k]);
  return out;
}

export function deriveWeek(w) {
  if (!w) return null;
  const steps = (w.steps || []).map((n) => Number(n) || 0);
  const hasDaily = steps.some((n) => n > 0);
  const totalSteps = Number(w.totalSteps) || (hasDaily ? steps.reduce((a, b) => a + b, 0) : 0);
  const avgSteps = Number(w.avgSteps) || totalSteps / 7;
  const start = fromKey(w.weekStart);
  // Etiquetas de los 7 días reales del reporte (Google Health empieza en sábado)
  const dayLabels = Array.from({ length: 7 }, (_, i) => DAYS[(addDays(start, i).getDay() + 6) % 7]);
  return { ...w, steps, hasDaily, totalSteps, avgSteps, dayLabels, weekEnd: dkey(addDays(start, 6)) };
}

export const fmtRange = (w) => `${fmtShort(w.weekStart)} – ${fmtShort(dkey(addDays(fromKey(w.weekStart), 6)))}`;
