import { useState, useMemo } from "react";
import { ResponsiveContainer, ComposedChart, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { Dumbbell, Activity, X, Zap, Trophy, Footprints, ClipboardPaste, Save, Trash2, Moon, Flame, TrendingUp, TrendingDown, CalendarDays } from "lucide-react";
import { pad, dkey, fromKey, addDays, mondayOf, DAYS, DAYS_LONG, fmtShort, fmtInt, fmtSleep } from "../lib/dates.js";
import { GH_SEED, SAMPLE_EMAIL, parseHealth, deriveWeek, fmtRange } from "../lib/health.js";
import { computeStreak } from "../lib/planner.js";
import { Chip } from "../components/ui.jsx";

export function Kpi({ label, value, sub, icon: Icon, badge, delta, invert }) {
  const good = delta != null && (invert ? delta <= 0 : delta >= 0);
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between text-muted">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</span>
        <Icon size={16} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="font-display text-3xl font-semibold leading-none tabular-nums">{value}</span>
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
              <span className="flex items-baseline gap-2 font-mono tabular-nums">
                <span className="text-fg">{m.fmt(a)}</span>
                {d != null && <span className={good ? "text-good" : "text-warn"}>{d >= 0 ? "+" : ""}{Math.round(d)}%</span>}
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-surface2"><div className="h-full rounded-full bg-accent" style={{ width: `${(a / max) * 100}%` }} /></div>
              <div className="h-1.5 rounded-full bg-surface2"><div className="h-full rounded-full bg-cool/60" style={{ width: `${(b / max) * 100}%` }} /></div>
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

  const input = "w-full min-w-0 rounded-lg border border-line bg-surface2 px-2.5 py-2 font-mono text-sm tabular-nums focus:border-accent focus:outline-none";
  const field = (id, label, key, extra) => (
    <div className="min-w-0"><label htmlFor={id} className="mb-1 block text-xs text-muted">{label}</label>
      <input id={id} inputMode="decimal" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className={input} {...extra} /></div>
  );

  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="sheet max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Google Health · reporte semanal</div>
            <h2 className="font-display text-3xl font-semibold uppercase leading-none">{initial ? "Editar semana" : "Importar semana"}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:text-fg" aria-label="Cerrar"><X size={22} /></button>
        </div>

        <label htmlFor="fb-paste" className="mb-1 block text-xs font-medium text-muted">Pega el texto del correo «Your weekly progress report from Google Health»</label>
        <textarea id="fb-paste" value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Abre el correo en Gmail, selecciona todo (⌘A), copia y pega aquí…" className="w-full rounded-xl border border-line bg-surface2 p-3 text-sm focus:border-accent focus:outline-none" />
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={analyze} disabled={!text.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk disabled:opacity-40"><ClipboardPaste size={15} />Analizar texto</button>
          <button onClick={() => setText(SAMPLE_EMAIL)} className="rounded-lg border border-line px-3.5 py-2 text-sm text-muted hover:text-fg">Probar con un ejemplo</button>
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

        <button onClick={save} disabled={!f.weekStart} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-accentInk disabled:opacity-40"><Save size={17} />Guardar semana en el historial</button>
      </div>
    </div>
  );
}

export function DashboardView({ health, setHealth, log }) {
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [sel, setSel] = useState(null);

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

  if (!cur) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-sm text-muted">No hay semanas en el historial.</p>
        <button onClick={() => setShowImport(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk"><ClipboardPaste size={16} />Importar correo</button>
        {showImport && <ImportPanel onSave={saveWeek} onClose={() => setShowImport(false)} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Google Health · {weeks.length} semanas</div>
          <h1 className="font-display text-3xl font-semibold uppercase leading-none md:text-4xl">Actividad & progreso</h1>
          <p className="mt-1 text-sm text-muted">Semana {fmtRange(cur)} <span className="text-muted/70">(sáb – vie)</span></p>
        </div>
        <button onClick={() => { setEditing(null); setShowImport(true); }} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk"><ClipboardPaste size={16} />Importar correo nuevo</button>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {weeks.map((w, i) => (
          <button key={w.weekStart} onClick={() => setSel(i)} aria-pressed={i === selIdx} className={`shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs ${i === selIdx ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface text-muted"}`}>{fmtShort(w.weekStart)}</button>
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Pasos y zona activa por semana</h2>
            <Chip>Prom. {fmtInt(avgAll)} pasos/día</Chip>
          </div>
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
        </section>

        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Vs. semana anterior</h2>
            <span className="flex items-center gap-2 text-[11px] text-muted"><span className="h-2 w-3 rounded-full bg-accent" />actual<span className="h-1.5 w-3 rounded-full bg-cool/60" />anterior</span>
          </div>
          {prev ? <CompareRows cur={cur} prev={prev} /> : <p className="text-sm text-muted">Es la primera semana del historial.</p>}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide">{daily ? "Pasos por día" : "Tu mejor día de la semana"}</h2>
            {!daily && <Chip tone="accent">Suele ser {DAYS_LONG[topDay].toLowerCase()}</Chip>}
          </div>
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
        </section>

        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide">Sueño y frecuencia en reposo</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                <YAxis yAxisId="l" tick={axisTick} axisLine={false} tickLine={false} domain={[6, 9]} ticks={[6, 7, 8, 9]} tickFormatter={(v) => `${v} h`} />
                <YAxis yAxisId="r" orientation="right" tick={axisTick} axisLine={false} tickLine={false} domain={[45, 60]} ticks={[45, 50, 55, 60]} width={30} />
                <Tooltip {...chartTooltip} cursor={{ stroke: "var(--line)" }} formatter={(v, n) => (n === "Sueño" ? [fmtSleep(Math.round(v * 60)), n] : [`${v} lpm`, n])} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                <Line isAnimationActive={false} yAxisId="l" type="monotone" dataKey="sueño" name="Sueño" stroke="var(--cool)" strokeWidth={2.5} dot={{ r: 2.5, fill: "var(--cool)" }} />
                <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="fc" name="FC reposo" stroke="var(--warn)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide">Historial</h2>
        <ul className="divide-y divide-line">
          {[...weeks].reverse().map((w) => (
            <li key={w.weekStart} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="inline-flex min-w-[8.5rem] items-center gap-1.5 font-mono text-xs"><CalendarDays size={14} className="text-muted" />{fmtRange(w)}</span>
              <span className="text-muted">{fmtInt(w.avgSteps)} pasos/día</span>
              <span className="text-muted">{fmtInt(w.azmTotal)} AZM</span>
              <span className="text-muted">{fmtSleep(w.sleepAvgMin)}</span>
              {w.source === "gmail" && <Chip>Correo</Chip>}
              <span className="ml-auto flex gap-1">
                <button onClick={() => { setEditing(w); setShowImport(true); }} className="rounded-lg px-2.5 py-1 text-xs text-muted hover:bg-surface2 hover:text-fg">Editar</button>
                {confirmDel === w.weekStart ? (
                  <button onClick={() => hideWeek(w.weekStart)} className="rounded-lg bg-warn/20 px-2.5 py-1 text-xs text-warn">¿Quitar? Confirmar</button>
                ) : (
                  <button onClick={() => setConfirmDel(w.weekStart)} className="rounded-lg p-1.5 text-muted hover:text-warn" aria-label="Quitar semana"><Trash2 size={14} /></button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {showImport && <ImportPanel initial={editing} onSave={saveWeek} onClose={() => { setShowImport(false); setEditing(null); }} />}
    </div>
  );
}
