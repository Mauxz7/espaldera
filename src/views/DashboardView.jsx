import { useState, useMemo, useEffect } from "react";
import { ResponsiveContainer, ComposedChart, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { Dumbbell, Activity, Bike, X, Zap, Trophy, Footprints, ClipboardPaste, Save, Trash2, Moon, Flame, TrendingUp, TrendingDown, CalendarDays, HeartPulse } from "lucide-react";
import { pad, dkey, fromKey, addDays, mondayOf, DAYS, DAYS_LONG, fmtShort, fmtInt, fmtSleep, hhmm } from "../lib/dates.js";
import { GH_SEED, SAMPLE_EMAIL, parseHealth, deriveWeek, fmtRange, hideHealthWeek, findWorkoutStrain } from "../lib/health.js";
import { computeStreak } from "../lib/planner.js";
import { routineById } from "../data/program.js";
import { WORKOUT_KINDS, KIND_LABELS, validWorkouts, lastWeeks } from "../lib/workouts.js";
import { Card, SectionTitle, Chip, btnCls } from "../components/ui.jsx";
import { HealthRings } from "../components/HealthRings.jsx";
import { HealthMonitor } from "../components/HealthMonitor.jsx";
import { FitnessSection } from "../components/FitnessSection.jsx";
import { BiomarkersSection } from "../components/BiomarkersSection.jsx";
import { HealthSheets } from "../components/HealthSheets.jsx";

const KIND_ICON = {
  run: Flame,
  bike: Bike,
  walk: Footprints,
  strength: Dumbbell,
  other: Activity,
};

const KIND_COLOR = {
  run: "rgb(var(--c-strain))",
  bike: "var(--accent)",
  walk: "var(--cool)",
  strength: "var(--good)",
  other: "var(--muted)",
};

export function Kpi({ label, value, sub, icon: Icon, badge, delta, invert }) {
  const good = delta != null && (invert ? delta <= 0 : delta >= 0);
  return (
    <div className="card min-w-0 p-4">
      <div className="flex items-center justify-between text-muted">
        <span className="text-[13px] font-medium">{label}</span>
        <Icon size={16} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-[28px] font-bold leading-none text-fg tabular-nums">{value}</span>
        {badge && <Chip tone="accent"><Trophy size={11} />{badge}</Chip>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
        {sub}
        {delta != null && isFinite(delta) && (
          <span className={`inline-flex items-center gap-0.5 ${good ? "text-good" : "text-warn"}`}>
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{delta >= 0 ? "+" : ""}{Math.round(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

export const chartTooltip = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--fg)", fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--fg)" },
  cursor: { fill: "var(--surface-2)" },
};

export const axisTick = { fill: "var(--muted)", fontSize: 11 };

export const kTick = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v);

export const COMPARE = [
  { key: "avgSteps", label: "Pasos / día", fmt: fmtInt },
  { key: "azmTotal", label: "Min. zona activa", fmt: fmtInt },
  { key: "sleepAvgMin", label: "Sueño reparador", fmt: fmtSleep },
  { key: "distanceKm", label: "Distancia", fmt: (v) => (v ? `${v.toFixed(1)} km` : "—") },
  { key: "caloriesAvg", label: "Calorías / día", fmt: fmtInt },
  { key: "floors", label: "Pisos", fmt: fmtInt },
  { key: "restingHr", label: "FC en reposo", fmt: (v) => (v ? `${v} lpm` : "—"), invert: true },
];

export function CompareRows({ cur, prev }) {
  return (
    <ul className="space-y-3">
      {COMPARE.map((m) => {
        const a = Number(cur?.[m.key]) || 0;
        const b = Number(prev?.[m.key]) || 0;
        const max = Math.max(a, b) || 1;
        const d = b ? ((a - b) / b) * 100 : null;
        const good = d != null && (m.invert ? d <= 0 : d >= 0);
        return (
          <li key={m.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted">{m.label}</span>
              <span className="flex items-baseline gap-2 font-mono font-bold tabular-nums">
                <span className="text-fg">{m.fmt(a)}</span>
                {d != null && <span className={good ? "text-good" : "text-warn"}>{d >= 0 ? "+" : ""}{Math.round(d)}%</span>}
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-accent" style={{ width: `${(a / max) * 100}%` }} /></div>
              <div className="h-1.5 rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-cool/60" style={{ width: `${(b / max) * 100}%` }} /></div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ImportPanel({ onSave, onClose, initial }) {
  const lastSat = (() => { const d = new Date(); const back = ((d.getDay() + 1) % 7) + 7; return dkey(addDays(d, -back)); })();
  const blank = { weekStart: lastSat, totalSteps: "", avgSteps: "", bestDay: "", bestSteps: "", azmTotal: "", sleepH: "", sleepM: "", caloriesAvg: "", distanceKm: "", floors: "", restingHr: "", weightKg: "", activeHours: "", steps: Array(7).fill("") };
  const [text, setText] = useState("");
  const [f, setF] = useState(() => {
    if (!initial) return blank;
    const s = initial.sleepAvgMin;
    return { ...blank, ...Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ""])), steps: (initial.steps || Array(7).fill("")).map((n) => n || ""), sleepH: s ? Math.floor(s / 60) : "", sleepM: s ? s % 60 : "" };
  });
  const [msg, setMsg] = useState("");
  const labels = deriveWeek({ weekStart: f.weekStart || lastSat }).dayLabels;

  const analyze = () => {
    const p = parseHealth(text);
    const names = { weekStart: "fechas", totalSteps: "pasos", avgSteps: "promedio", bestDay: "mejor día", bestSteps: "pasos del mejor día", azmTotal: "zona activa", sleepAvgMin: "sueño", caloriesAvg: "calorías", distanceKm: "distancia", floors: "pisos", restingHr: "FC reposo", weightKg: "peso", activeHours: "horas activas" };
    setF((cur) => {
      const n = { ...cur };
      Object.entries(p).forEach(([k, v]) => { if (k === "sleepAvgMin") { n.sleepH = Math.floor(v / 60); n.sleepM = v % 60; } else n[k] = v; });
      return n;
    });
    const found = Object.keys(p).map((k) => names[k]).filter(Boolean);
    setMsg(found.length ? `Detecté ${found.length} datos: ${found.join(", ")}. Revisa y guarda.` : "No encontré cifras reconocibles. Escríbelas abajo a mano.");
  };

  const save = () => {
    const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
    const sleep = (num(f.sleepH) || 0) * 60 + (num(f.sleepM) || 0);
    const steps = f.steps.map((v) => num(v) || 0);
    onSave({
      weekStart: f.weekStart, source: "manual",
      totalSteps: num(f.totalSteps), avgSteps: num(f.avgSteps), bestDay: num(f.bestDay), bestSteps: num(f.bestSteps),
      azmTotal: num(f.azmTotal), sleepAvgMin: sleep || null, caloriesAvg: num(f.caloriesAvg), distanceKm: num(f.distanceKm),
      floors: num(f.floors), restingHr: num(f.restingHr), weightKg: num(f.weightKg), activeHours: num(f.activeHours),
      steps: steps.some((n) => n > 0) ? steps : undefined, savedAt: Date.now(),
    });
  };

  const input = "w-full min-w-0 rounded-xl border border-line bg-white/[0.06] px-2.5 py-2 font-mono text-sm font-bold tabular-nums text-fg focus:border-accent focus:outline-none";
  const field = (id, label, key, extra) => (
    <div className="min-w-0"><label htmlFor={id} className="mb-1 block text-xs text-muted">{label}</label>
      <input id={id} inputMode="decimal" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className={input} {...extra} /></div>
  );

  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div className="sheet max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[26px] border border-line bg-surface p-5 shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium text-accent">Google Health · reporte semanal</div>
            <h2 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">{initial ? "Editar semana" : "Importar semana"}</h2>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-muted hover:text-fg" aria-label="Cerrar"><X size={20} /></button>
        </div>

        <label htmlFor="fb-paste" className="mb-1 block text-xs font-medium text-muted">Pega el texto del correo «Your weekly progress report from Google Health»</label>
        <textarea id="fb-paste" value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Abre el correo en Gmail, selecciona todo (⌘A), copia y pega aquí…" className="w-full rounded-xl border border-line bg-white/[0.06] p-3 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none" />
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={analyze} disabled={!text.trim()} className={btnCls("ghost", "min-h-[42px] px-4 text-sm bg-accent/15 text-accent hover:bg-accent/25")}><ClipboardPaste size={15} />Analizar texto</button>
          <button onClick={() => setText(SAMPLE_EMAIL)} className={btnCls("ghost", "min-h-[42px] px-4 text-sm text-muted")}>Probar con un ejemplo</button>
        </div>
        {msg && <p className="mt-2 text-xs text-cool">{msg}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="min-w-0"><label htmlFor="fb-week" className="mb-1 block text-xs text-muted">Inicio de semana (sábado)</label><input id="fb-week" type="date" value={f.weekStart} onChange={(e) => setF({ ...f, weekStart: e.target.value })} className={input} /></div>
          {field("fb-total", "Pasos totales", "totalSteps")}
          {field("fb-avg", "Promedio pasos/día", "avgSteps")}
          <div className="min-w-0"><label htmlFor="fb-best" className="mb-1 block text-xs text-muted">Mejor día</label>
            <select id="fb-best" value={f.bestDay} onChange={(e) => setF({ ...f, bestDay: e.target.value })} className={input}>
              <option value="">—</option>
              {DAYS_LONG.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          {field("fb-bests", "Pasos del mejor día", "bestSteps")}
          {field("fb-azm", "Min. zona activa", "azmTotal")}
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-muted">Sueño promedio</span>
            <div className="flex gap-1.5">
              <input id="fb-sh" aria-label="Horas de sueño" inputMode="numeric" placeholder="h" value={f.sleepH} onChange={(e) => setF({ ...f, sleepH: e.target.value })} className={input} />
              <input id="fb-sm" aria-label="Minutos de sueño" inputMode="numeric" placeholder="min" value={f.sleepM} onChange={(e) => setF({ ...f, sleepM: e.target.value })} className={input} />
            </div>
          </div>
          {field("fb-cal", "Calorías / día", "caloriesAvg")}
          {field("fb-km", "Distancia (km)", "distanceKm")}
          {field("fb-floors", "Pisos", "floors")}
          {field("fb-hr", "FC reposo (lpm)", "restingHr")}
          {field("fb-kg", "Peso (kg)", "weightKg")}
        </div>

        <details className="mt-4 rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted">Pasos por día (opcional: el correo no los trae, cópialos de la app si quieres la gráfica diaria)</summary>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {labels.map((d, i) => (
              <div key={i} className="min-w-0 text-center">
                <label htmlFor={`fb-s${i}`} className="mb-1 block text-[10px] text-muted">{d}</label>
                <input id={`fb-s${i}`} inputMode="numeric" value={f.steps[i]} onChange={(e) => { const a = [...f.steps]; a[i] = e.target.value; setF({ ...f, steps: a }); }} className={input + " px-1 text-center text-xs"} />
              </div>
            ))}
          </div>
        </details>

        <button onClick={save} disabled={!f.weekStart} className={btnCls("primary", "mt-5 w-full")}><Save size={17} />Guardar semana en el historial</button>
      </div>
    </div>
  );
}

export function WorkoutsSection({ workouts, log, bevelHistory }) {
  const list = useMemo(() => validWorkouts(workouts), [workouts]);
  const weekly = useMemo(() => lastWeeks(list, 8), [list]);
  const recent = useMemo(() => list.slice(0, 10), [list]);

  if (!list.length) {
    return (
      <div>
        <SectionTitle>Entrenos</SectionTitle>
        <Card className="min-w-0">
          <p className="text-sm text-muted">
            Todavía no llegan entrenos. El Atajo se configura en Ajustes → «Entrenos de Apple Health».
          </p>
        </Card>
      </div>
    );
  }

  const totalCount8w = weekly.reduce((s, w) => s + w.count, 0);
  const totalMin8w = weekly.reduce((s, w) => s + w.totalMin, 0);

  return (
    <div>
      <SectionTitle aside={`${totalCount8w} ${totalCount8w === 1 ? "entreno" : "entrenos"} · ${fmtInt(totalMin8w)} min (8 sem)`}>Entrenos</SectionTitle>
      <Card className="min-w-0">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-2 text-xs text-muted">Resumen de las últimas 8 semanas (min por tipo)</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                  <Tooltip {...chartTooltip} formatter={(v, n) => [`${fmtInt(v)} min`, n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                  {WORKOUT_KINDS.map((k) => (
                    <Bar key={k} isAnimationActive={false} stackId="min" dataKey={k} name={KIND_LABELS[k]} fill={KIND_COLOR[k]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 text-xs text-muted">Últimos {recent.length} entrenos</div>
            <ul className="divide-y divide-line">
              {recent.map((w) => {
                const Icon = KIND_ICON[w.kind] || Activity;
                const logged = log && log[w.date] && log[w.date].r ? routineById(log[w.date].r, undefined, log[w.date].v) : null;
                const bevelW = findWorkoutStrain(bevelHistory, w);
                const avgHr = w.avgHr ?? bevelW?.avgHr ?? null;
                const strainPct = bevelW && typeof bevelW.strainPct === "number" ? bevelW.strainPct : null;
                return (
                  <li key={w.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-strain">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate font-medium text-fg">{w.type}</span>
                          <span className="text-xs text-muted">· {KIND_LABELS[w.kind]}</span>
                          {logged && <Chip tone="accent">{logged.short}</Chip>}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs text-muted">
                          <span>{fmtShort(w.date)} · {hhmm(new Date(w.start))}</span>
                          {avgHr != null && (
                            <span className="inline-flex items-center gap-0.5 text-fg/80">
                              <HeartPulse size={11} className="text-warn" />{avgHr} lpm
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-xs font-bold text-fg tabular-nums">
                        {w.min != null ? `${fmtInt(w.min)} min` : "—"}
                      </span>
                      {strainPct != null && <Chip tone="warn">Strain {strainPct}%</Chip>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function DashboardView({ health, setHealth, log, bevelHistory, vitals = {}, sleep = {}, workouts = [], setLog = {} }) {
  const [subTab, setSubTab] = useState("daily"); // "daily" | "weekly"
  const [activeSheet, setActiveSheet] = useState(null); // null | "recovery" | "sleep" | "strain"
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [sel, setSel] = useState(null);

  const todayKey = dkey();
  const navDates = useMemo(() => {
    const all = bevelHistory && Array.isArray(bevelHistory.dates) && bevelHistory.dates.length
      ? bevelHistory.dates
      : [todayKey];
    return all.slice(-30);
  }, [bevelHistory, todayKey]);

  const defaultDate = (bevelHistory && (bevelHistory.today?.date || bevelHistory.latestDate)) || navDates[navDates.length - 1] || todayKey;
  const [selectedDate, setSelectedDate] = useState(defaultDate);

  useEffect(() => {
    if (!navDates.includes(selectedDate)) {
      setSelectedDate(defaultDate);
    }
  }, [navDates, selectedDate, defaultDate]);

  const dateIdx = Math.max(0, navDates.indexOf(selectedDate));
  const canPrevDate = dateIdx > 0;
  const canNextDate = dateIdx < navDates.length - 1;
  const goPrevDate = () => { if (canPrevDate) setSelectedDate(navDates[dateIdx - 1]); };
  const goNextDate = () => { if (canNextDate) setSelectedDate(navDates[dateIdx + 1]); };
  const goTodayDate = () => setSelectedDate(defaultDate);

  const activeDay = (bevelHistory && bevelHistory.byDate && bevelHistory.byDate[selectedDate]) || bevelHistory?.today || null;

  const handleSubTabKeyDown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = subTab === "daily" ? "weekly" : "daily";
    setSubTab(next);
    const btn = e.currentTarget.querySelector(`[data-health-tab="${next}"]`);
    if (btn) btn.focus();
  };

  // Historial = semanas reales de Gmail + lo que importes; lo guardado gana si coincide la fecha. "hidden" oculta una semana.
  const weeks = useMemo(() => {
    const map = new Map(GH_SEED.map((w) => [w.weekStart, w]));
    (health || []).forEach((w) => (w.hidden ? map.delete(w.weekStart) : map.set(w.weekStart, w)));
    return [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).map(deriveWeek);
  }, [health]);

  const selIdx = sel != null && weeks[sel] ? sel : weeks.length - 1;
  const cur = weeks[selIdx];
  const prev = weeks[selIdx - 1];
  const pct = (a, b) => (a != null && b ? ((a - b) / b) * 100 : null);

  const thisMonday = mondayOf(new Date());
  const sessionsThisWeek = Object.keys(log).filter((k) => { const d = fromKey(k); return d >= thisMonday && d < addDays(thisMonday, 7); }).length;
  const streak = computeStreak(log);

  const recent = weeks.slice(-12);
  const offset = weeks.length - recent.length;
  const trend = recent.map((w) => ({ week: fmtShort(w.weekStart), pasos: Math.round(w.avgSteps), azm: w.azmTotal || 0, sueño: w.sleepAvgMin ? +(w.sleepAvgMin / 60).toFixed(2) : null, fc: w.restingHr || null }));
  const bestFreq = DAYS.map((d, i) => ({ day: d, veces: weeks.filter((w) => w.bestDay === i).length }));
  const topDay = bestFreq.reduce((a, b, i) => (b.veces > bestFreq[a].veces ? i : a), 0);
  const avgAll = weeks.reduce((a, w) => a + w.avgSteps, 0) / (weeks.length || 1);
  const daily = cur?.hasDaily ? cur.dayLabels.map((d, i) => ({ day: d, pasos: cur.steps[i] })) : null;

  const saveWeek = (rec) => {
    setHealth((list) => [...(list || []).filter((w) => w.weekStart !== rec.weekStart), rec].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).slice(-156));
    setShowImport(false); setEditing(null); setSel(null);
  };

  const hideWeek = (weekStart) => {
    setHealth((list) => hideHealthWeek(list, weekStart));
    setConfirmDel(null);
    setSel(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-muted">Salud · seguimiento diario y semanal</div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Salud</h1>
        </div>
        {subTab === "weekly" && cur && (
          <button onClick={() => { setEditing(null); setShowImport(true); }} className={btnCls("primary")}>
            <ClipboardPaste size={16} />Importar correo nuevo
          </button>
        )}
      </div>

      {/* Sub-pestañas: Resumen diario (por defecto) / Reportes semanales */}
      <div role="tablist" aria-label="Vistas de salud" onKeyDown={handleSubTabKeyDown} className="flex gap-1 border-b border-line">
        <button
          type="button"
          role="tab"
          id="health-tab-daily"
          data-health-tab="daily"
          aria-selected={subTab === "daily"}
          tabIndex={subTab === "daily" ? 0 : -1}
          onClick={() => setSubTab("daily")}
          className={`px-3.5 py-2.5 text-sm font-semibold transition ${subTab === "daily" ? "text-accent" : "text-muted hover:text-fg"}`}
        >
          Resumen diario
        </button>
        <button
          type="button"
          role="tab"
          id="health-tab-weekly"
          data-health-tab="weekly"
          aria-selected={subTab === "weekly"}
          tabIndex={subTab === "weekly" ? 0 : -1}
          onClick={() => setSubTab("weekly")}
          className={`px-3.5 py-2.5 text-sm font-semibold transition ${subTab === "weekly" ? "text-accent" : "text-muted hover:text-fg"}`}
        >
          Reportes semanales
        </button>
      </div>

      <div role="tabpanel" aria-labelledby="health-tab-daily" hidden={subTab !== "daily"}>
        {subTab === "daily" && (
          <div className="space-y-5">
            <HealthRings
              day={activeDay}
              selectedDate={selectedDate}
              todayKey={todayKey}
              canPrev={canPrevDate}
              canNext={canNextDate}
              onPrev={goPrevDate}
              onNext={goNextDate}
              onToday={goTodayDate}
              onOpenSheet={setActiveSheet}
              vitals={vitals}
            />
            <HealthMonitor
              vitals={vitals}
              sleep={sleep}
              bevelHistory={bevelHistory}
              selectedDate={selectedDate}
              todayKey={todayKey}
            />
            <FitnessSection
              bevelHistory={bevelHistory}
              workouts={workouts}
              setLog={setLog}
              log={log}
              selectedDate={selectedDate}
              todayKey={todayKey}
            />
            <BiomarkersSection
              vitals={vitals}
              health={health}
              selectedDate={selectedDate}
              todayKey={todayKey}
            />
            <WorkoutsSection workouts={workouts} log={log} bevelHistory={bevelHistory} />
            {activeSheet && (
              <HealthSheets
                activeSheet={activeSheet}
                onClose={() => setActiveSheet(null)}
                bevelHistory={bevelHistory}
                day={activeDay}
                selectedDate={selectedDate}
                todayKey={todayKey}
                canPrev={canPrevDate}
                canNext={canNextDate}
                onPrev={goPrevDate}
                onNext={goNextDate}
              />
            )}
          </div>
        )}
      </div>

      <div role="tabpanel" aria-labelledby="health-tab-weekly" hidden={subTab !== "weekly"}>
        {subTab === "weekly" && (
          !cur ? (
            <div className="space-y-5">
              <Card className="p-6 text-center">
                <p className="text-sm text-muted">No hay semanas en el historial.</p>
                <button onClick={() => setShowImport(true)} className={btnCls("primary", "mt-3")}><ClipboardPaste size={16} />Importar correo</button>
              </Card>
              <WorkoutsSection workouts={workouts} log={log} bevelHistory={bevelHistory} />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                <div className="text-sm text-muted">
                  Google Health · {weeks.length} {weeks.length === 1 ? "semana" : "semanas"} · Semana {fmtRange(cur)} <span className="text-muted/70">(sáb – vie)</span>
                </div>
              </div>

              <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
                {weeks.map((w, i) => (
                  <button key={w.weekStart} onClick={() => setSel(i)} aria-pressed={i === selIdx} className={`shrink-0 rounded-xl px-3 py-1.5 font-mono text-xs font-semibold transition ${i === selIdx ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/40" : "bg-white/[0.06] text-muted hover:bg-white/[0.1]"}`}>{fmtShort(w.weekStart)}</button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
                <Kpi label="Días entrenados" icon={Dumbbell} value={`${sessionsThisWeek}/4`} sub={<span className="inline-flex items-center gap-1"><Flame size={12} className="text-accent" />Racha: {streak} {streak === 1 ? "sesión" : "sesiones"}</span>} />
                <Kpi label="Mejor día" icon={Trophy} value={cur.bestDay != null ? DAYS[cur.bestDay] : "—"} badge={cur.bestSteps ? fmtInt(cur.bestSteps) : null} sub={cur.bestSteps ? "pasos ese día" : "Sin dato"} />
                <Kpi label="Pasos / día" icon={Footprints} value={fmtInt(cur.avgSteps)} sub={`${fmtInt(cur.totalSteps)} en la semana`} delta={prev ? pct(cur.avgSteps, prev.avgSteps) : null} />
                <Kpi label="Zona activa" icon={Activity} value={fmtInt(cur.azmTotal)} sub="minutos" delta={prev ? pct(cur.azmTotal, prev.azmTotal) : null} />
                <Kpi label="Sueño reparador" icon={Moon} value={cur.sleepAvgMin ? `${Math.floor(cur.sleepAvgMin / 60)}:${pad(cur.sleepAvgMin % 60)}` : "—"} sub="promedio por noche" delta={prev ? pct(cur.sleepAvgMin, prev.sleepAvgMin) : null} />
                <Kpi label="FC en reposo" icon={Zap} value={cur.restingHr ? `${cur.restingHr}` : "—"} sub="lpm (más bajo es mejor)" delta={prev ? pct(cur.restingHr, prev.restingHr) : null} invert />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <SectionTitle aside={`Prom. ${fmtInt(avgAll)} pasos/día`}>Pasos y zona activa por semana</SectionTitle>
                  <Card className="min-w-0">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={trend} margin={{ top: 8, right: 0, left: -14, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                          <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                          <YAxis yAxisId="l" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kTick} />
                          <YAxis yAxisId="r" orientation="right" tick={axisTick} axisLine={false} tickLine={false} width={34} />
                          <Tooltip {...chartTooltip} formatter={(v, n) => [fmtInt(v), n]} />
                          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                          <Bar isAnimationActive={false} yAxisId="l" dataKey="pasos" name="Pasos/día" fill="var(--accent)" radius={[4, 4, 0, 0]} onClick={(_, i) => setSel(offset + i)} cursor="pointer">
                            {trend.map((_, i) => <Cell key={i} fill={offset + i === selIdx ? "var(--accent)" : "var(--accent-dim)"} />)}
                          </Bar>
                          <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="azm" name="Min. zona activa" stroke="var(--good)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--good)" }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-xs text-muted">Toca una barra para ver esa semana. La barra resaltada es la semana seleccionada.</p>
                  </Card>
                </div>

                <div className="min-w-0">
                  <SectionTitle aside={<span className="flex items-center gap-2 text-xs"><span className="h-2 w-3 rounded-full bg-accent" />actual<span className="h-1.5 w-3 rounded-full bg-cool/60" />anterior</span>}>Vs. semana anterior</SectionTitle>
                  <Card className="min-w-0">
                    {prev ? <CompareRows cur={cur} prev={prev} /> : <p className="text-sm text-muted">Es la primera semana del historial.</p>}
                  </Card>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="min-w-0">
                  <SectionTitle aside={!daily ? `Suele ser ${DAYS_LONG[topDay].toLowerCase()}` : null}>{daily ? "Pasos por día" : "Tu mejor día de la semana"}</SectionTitle>
                  <Card className="min-w-0">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        {daily ? (
                          <BarChart data={daily} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                            <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
                            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kTick} />
                            <Tooltip {...chartTooltip} formatter={(v) => [fmtInt(v), "Pasos"]} />
                            <Bar isAnimationActive={false} dataKey="pasos" fill="var(--accent)" radius={[4, 4, 0, 0]}>
                              {daily.map((d, i) => <Cell key={i} fill={d.pasos === Math.max(...cur.steps) ? "var(--accent)" : "var(--accent-dim)"} />)}
                            </Bar>
                          </BarChart>
                        ) : (
                          <BarChart data={bestFreq} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                            <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
                            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip {...chartTooltip} formatter={(v) => [`${v} ${v === 1 ? "semana" : "semanas"}`, "Mejor día"]} />
                            <Bar isAnimationActive={false} dataKey="veces" fill="var(--accent)" radius={[4, 4, 0, 0]}>
                              {bestFreq.map((_, i) => <Cell key={i} fill={i === topDay ? "var(--accent)" : i === cur.bestDay ? "var(--cool)" : "var(--accent-dim)"} />)}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-xs text-muted">{daily ? "Datos diarios que añadiste a mano." : `Cuántas semanas fue cada día tu pico de pasos (${weeks.length} semanas). En azul, el de la semana seleccionada.`}</p>
                  </Card>
                </div>

                <div className="min-w-0">
                  <SectionTitle>Sueño y frecuencia en reposo</SectionTitle>
                  <Card className="min-w-0">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                          <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                          <YAxis yAxisId="l" tick={axisTick} axisLine={false} tickLine={false} domain={[6, 9]} ticks={[6, 7, 8, 9]} tickFormatter={(v) => `${v} h`} />
                          <YAxis yAxisId="r" orientation="right" tick={axisTick} axisLine={false} tickLine={false} domain={[45, 60]} ticks={[45, 50, 55, 60]} width={30} />
                          <Tooltip {...chartTooltip} cursor={{ stroke: "var(--line)" }} formatter={(v, n) => (n === "Sueño" ? [fmtSleep(Math.round(v * 60)), n] : [`${v} lpm`, n])} />
                          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                          <Line isAnimationActive={false} yAxisId="l" type="monotone" dataKey="sueño" name="Sueño" stroke="rgb(var(--c-sleep))" strokeWidth={2.5} dot={{ r: 2.5, fill: "rgb(var(--c-sleep))" }} />
                          <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="fc" name="FC reposo" stroke="var(--warn)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </div>

              <div>
                <SectionTitle>Historial</SectionTitle>
                <Card>
                  <ul className="divide-y divide-line">
                    {[...weeks].reverse().map((w) => (
                      <li key={w.weekStart} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm first:pt-0 last:pb-0">
                        <span className="inline-flex min-w-[8.5rem] items-center gap-1.5 font-mono text-xs font-bold"><CalendarDays size={14} className="text-muted" />{fmtRange(w)}</span>
                        <span className="text-muted">{fmtInt(w.avgSteps)} pasos/día</span>
                        <span className="text-muted">{fmtInt(w.azmTotal)} AZM</span>
                        <span className="text-muted">{fmtSleep(w.sleepAvgMin)}</span>
                        {w.source === "gmail" && <Chip>Correo</Chip>}
                        <span className="ml-auto flex gap-1">
                          <button onClick={() => { setEditing(w); setShowImport(true); }} className="rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-white/[0.08] hover:text-fg">Editar</button>
                          {confirmDel === w.weekStart ? (
                            <button onClick={() => hideWeek(w.weekStart)} className="rounded-xl bg-warn/15 px-2.5 py-1.5 text-xs font-semibold text-warn">¿Quitar? Confirmar</button>
                          ) : (
                            <button onClick={() => setConfirmDel(w.weekStart)} className="rounded-xl p-1.5 text-muted hover:text-warn" aria-label="Quitar semana"><Trash2 size={14} /></button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          )
        )}
      </div>

      {showImport && <ImportPanel initial={editing} onSave={saveWeek} onClose={() => { setShowImport(false); setEditing(null); }} />}
    </div>
  );
}
