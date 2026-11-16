// Google Calendar (Fase 7, C2/C3).
// - La app escribe el plan de los próximos 14 días en cal/plan.json del repo privado SOLO cuando cambia
//   (no en data.json: así la tarea «Calendario» no corre en cada sincronización).
// - La tarea del repo privado lo copia al calendario «Shift» y escribe la clave `calBusy`
//   ({ days: { "YYYY-MM-DD": { nightBusy, exam } } }) leyendo el calendario principal.
// - Oficina/casa NO se lee del calendario: el selector manual manda. El calendario solo sugiere noches y exámenes.
import { useEffect, useMemo } from "react";
import { Sync, LS, b64e, b64d } from "./storage.js";
import { routineById } from "../data/program.js";

export const MORNING_START = "06:30";
export const EVENING_START = "19:00";
export const PLAN_PATH = "cal/plan.json";

const nextDay = (k) => {
  const d = new Date(`${k}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const day = (calBusy, k) => (calBusy && calBusy.days && calBusy.days[k]) || null;

// Noches libres sugeridas (true = sin nada ocupado de 18:30 a 21:00). Sin datos del calendario: ocupada, como antes.
export function calNight(calBusy, keys) {
  return keys.map((k) => { const d = day(calBusy, k); return !!d && !d.nightBusy; });
}

// Examen o entrega ese día o al siguiente: el plan prefiere descanso o algo liviano.
export function calExamSoon(calBusy, keys) {
  return keys.map((k) => !!((day(calBusy, k) || {}).exam || (day(calBusy, nextDay(k)) || {}).exam));
}

// Lo que se manda al calendario: una entrada por día con sesión, desde hoy.
export function buildCalPlan(days) {
  return (days || []).filter((d) => d && d.rid).map((d) => {
    const r = routineById(d.rid);
    const lines = (r.exercises || []).map((e) => `• ${e.name}: ${e.sets} × ${e.reps}`);
    const head = d.evening ? "Entreno de noche (día de oficina con la noche libre)." : d.office ? "Día de oficina: sesión temprano." : "Día en casa.";
    return {
      date: d.date,
      rid: d.rid,
      title: `🏋️ ${r.short} · ${r.name}`,
      start: d.evening ? EVENING_START : MORNING_START,
      min: r.minutes,
      desc: [head, `~${r.minutes} min · ${r.focus}`, "", ...lines, "", "Plan de Shift: se actualiza solo al reacomodar la semana."].join("\n"),
    };
  });
}

export const planFile = (items) => JSON.stringify({ items }, null, 1) + "\n";

// Sube cal/plan.json si cambió. Devuelve "same" | "sent" | "skip".
export async function pushCalPlan(items, fetchImpl = fetch) {
  const c = Sync.cfg();
  if (!c) return "skip";
  const text = planFile(items);
  if (LS.get("@calPlanSent") === text) return "same";
  const url = `https://api.github.com/repos/${c.repo}/contents/${PLAN_PATH}`;
  const headers = { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const cur = await fetchImpl(url, { headers, cache: "no-store" });
  let sha;
  if (cur.ok) {
    const j = await cur.json();
    sha = j.sha;
    let old = "";
    try { old = b64d(j.content || ""); } catch (e) { old = ""; }
    if (old === text) { LS.set("@calPlanSent", text); return "same"; }
  } else if (cur.status !== 404) throw { status: cur.status };
  const body = { message: "calendario: plan " + new Date().toISOString(), content: b64e(text) };
  if (sha) body.sha = sha;
  const r = await fetchImpl(url, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!r.ok) throw { status: r.status };
  LS.set("@calPlanSent", text);
  return "sent";
}

// Manda el plan unos segundos después del último cambio, y solo cuando la sincronización ya trajo los datos
// de los otros dispositivos (si no, un teléfono con datos viejos podría mandar un plan viejo).
export function useCalendarSync(upcoming) {
  const items = useMemo(() => buildCalPlan(upcoming), [upcoming]);
  const text = planFile(items);
  useEffect(() => {
    let t;
    const tryPush = () => {
      if (!Sync.cfg()) return;
      if (Sync.status.state !== "ok") { t = setTimeout(tryPush, 5000); return; }
      pushCalPlan(items).catch(() => { t = setTimeout(tryPush, 60000); });
    };
    t = setTimeout(tryPush, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
}
