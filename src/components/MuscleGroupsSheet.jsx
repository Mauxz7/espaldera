import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown, Dumbbell, Flame } from "lucide-react";
import { muscleGroups, toggleSoreness, FRESH_STATUS } from "../lib/metrics.js";
import { dkey, fromKey, addDays, fmtShort, DAYS } from "../lib/dates.js";
import { SheetDialog } from "./SheetDialog.jsx";
import { StatusDot, btnCls } from "./ui.jsx";
import { BodyMap, TONE_RGB } from "./BodyMap.jsx";

const TABS = [
  { id: "fresh", label: "Frescura" },
  { id: "load", label: "Carga" },
  { id: "volume", label: "Volumen" },
];
const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "recovered", label: "Recuperado", tone: "good" },
  { id: "fatigued", label: "Fatigado", tone: "accent" },
  { id: "depleted", label: "Agotado", tone: "warn" },
];
const DOT = { good: "bg-good", accent: "bg-accent", warn: "bg-warn" };
const SEG = { good: "bg-good", accent: "bg-accent", warn: "bg-warn", strain: "bg-strain", cool: "bg-cool" };

const shiftKey = (k, n) => dkey(addDays(fromKey(k), n));
const dayLabel = (k, today) => {
  if (k === today) return `Hoy, ${fmtShort(k)}`;
  if (k === shiftKey(today, -1)) return `Ayer, ${fmtShort(k)}`;
  return `${DAYS[(fromKey(k).getDay() + 6) % 7]}, ${fmtShort(k)}`;
};

/** Cinco segmentos tipo Bevel: cuántos se llenan según 0–1. */
function Segments({ frac, tone }) {
  const n = Math.max(0, Math.min(5, Math.ceil(frac * 5 - 0.001)));
  return (
    <div className="flex shrink-0 gap-1" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`h-6 w-2.5 rounded-full ${i < n ? SEG[tone] : "bg-white/[0.08]"} ${i < n && i < n - 1 ? "opacity-70" : ""}`} />
      ))}
    </div>
  );
}

/**
 * Hoja «Grupos musculares»: mapa corporal + lista con Frescura / Carga / Volumen,
 * filtro por estado y navegación por días.
 */
export function MuscleGroupsSheet({ setLog, log, workouts, customExercises = [], soreness = {}, setSoreness = null, initialDate, todayKey, onClose }) {
  const today = todayKey || dkey();
  const [date, setDate] = useState(initialDate || today);
  const [tab, setTab] = useState("fresh");
  const [filter, setFilter] = useState("all");
  const [asc, setAsc] = useState(true);
  const [picked, setPicked] = useState(null);

  const { groups, counts } = useMemo(
    () => muscleGroups(setLog, date, { log, workouts, customExercises, soreness }),
    [setLog, log, workouts, customExercises, soreness, date],
  );
  const maxSets = Math.max(1, ...groups.map((g) => g.sets));
  const maxReps = Math.max(1, ...groups.map((g) => g.reps));

  const valueOf = (g) => (tab === "fresh" ? g.pct : tab === "load" ? g.reps : g.sets);
  const fracOf = (g) => (tab === "fresh" ? g.pct / 100 : tab === "load" ? g.reps / maxReps : g.sets / maxSets);
  const toneOf = (g) => (tab === "fresh" ? FRESH_STATUS[g.status].tone : tab === "load" ? "strain" : "cool");
  const visible = (g) => tab !== "fresh" || filter === "all" || g.status === filter;

  const colorFor = (group) => {
    const g = groups.find((x) => x.group === group);
    if (!g) return null;
    const dim = !visible(g) || (picked && picked !== group);
    if (tab === "fresh") {
      if (!g.trained && !g.manual) return { fill: "rgb(255 255 255)", opacity: dim ? 0.04 : 0.1, title: `${g.label}: sin entrenar en 7 días` };
      return { fill: TONE_RGB[FRESH_STATUS[g.status].tone], opacity: dim ? 0.15 : 0.35 + 0.6 * (g.pct / 100), title: `${g.label}: ${g.pct} %` };
    }
    const f = fracOf(g);
    if (f <= 0) return { fill: "rgb(255 255 255)", opacity: dim ? 0.04 : 0.1, title: `${g.label}: 0` };
    return { fill: TONE_RGB[toneOf(g)], opacity: dim ? 0.12 : 0.25 + 0.75 * f, title: `${g.label}: ${valueOf(g)}` };
  };

  const pickedGroup = picked ? groups.find((g) => g.group === picked) || null : null;
  const isMarked = Boolean(picked && soreness?.[date]?.[picked]);
  const handleToggleSoreness = () => {
    if (!picked || !setSoreness) return;
    setSoreness((prev) => toggleSoreness(prev, { date, group: picked }));
    if (filter !== "all" && filter !== "fatigued") setFilter("all");
  };

  const rows = groups
    .filter(visible)
    .filter((g) => !picked || g.group === picked)
    .sort((a, b) => (asc ? valueOf(a) - valueOf(b) : valueOf(b) - valueOf(a)) || a.label.localeCompare(b.label));

  const summary = tab === "fresh"
    ? `${counts.recovered} recuperados · ${counts.fatigued} fatigados · ${counts.depleted} agotados`
    : tab === "load"
      ? "Repeticiones de trabajo en 7 días (ponderadas por grupo)"
      : "Series de trabajo en 7 días (ponderadas por grupo)";

  return (
    <SheetDialog eyebrow="Fitness" icon={Dumbbell} accent="text-good" title="Grupos musculares" onClose={onClose}>
      <div className="space-y-4">
        {/* Pestañas */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/[0.05] p-1" role="tablist" aria-label="Métrica">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setPicked(null); }}
              className={`min-h-[40px] rounded-xl text-sm font-semibold transition ${tab === t.id ? "bg-white/[0.12] text-fg" : "text-muted hover:text-fg"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <BodyMap colorFor={colorFor} onPick={(g) => setPicked((p) => (p === g ? null : g))} className="px-2" />

        {/* Filtros por estado (solo Frescura) */}
        {tab === "fresh" && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => { setFilter(f.id); setPicked(null); }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${filter === f.id ? "bg-white/[0.14] text-fg" : "bg-white/[0.05] text-muted hover:text-fg"}`}
              >
                {f.tone && <span className={`h-2 w-2 rounded-full ${DOT[f.tone]}`} aria-hidden="true" />}
                {f.label}
                {f.id !== "all" && <span className="font-mono text-faint">{counts[f.id]}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Día */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDate((d) => shiftKey(d, -1))} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-muted hover:text-fg" aria-label="Día anterior">
            <ChevronLeft size={18} />
          </button>
          <div className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-full bg-white/[0.05] text-sm font-semibold">{dayLabel(date, today)}</div>
          <button type="button" disabled={date >= today} onClick={() => setDate((d) => shiftKey(d, 1))} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-muted hover:text-fg disabled:opacity-30" aria-label="Día siguiente">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Lista */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">{pickedGroup ? pickedGroup.label : "Todos los músculos"}</div>
              <div className="text-xs text-muted">{summary}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {picked && (
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="min-h-[36px] rounded-full bg-white/[0.07] px-3 text-xs font-semibold text-muted hover:text-fg"
                >
                  Ver todos
                </button>
              )}
              <button type="button" onClick={() => setAsc((v) => !v)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-muted hover:text-fg" aria-label={asc ? "Ordenar de mayor a menor" : "Ordenar de menor a mayor"}>
                <ArrowUpDown size={16} />
              </button>
            </div>
          </div>

          {pickedGroup && setSoreness && (
            <div className="mb-3 rounded-2xl bg-white/[0.05] p-3.5">
              <button
                type="button"
                aria-pressed={isMarked}
                aria-describedby="soreness-hint"
                onClick={handleToggleSoreness}
                className={btnCls(isMarked ? "soft-warn" : "ghost", `w-full ${isMarked ? "!bg-accent/15 !text-accent hover:!bg-accent/25" : ""}`)}
              >
                <Flame size={16} aria-hidden="true" />
                {date === today ? "Lo siento cargado" : "Lo sentí cargado este día"}
              </button>
              <p id="soreness-hint" className="mt-2 px-1 text-center text-xs text-muted">
                {isMarked
                  ? "Marcado como cargado · toca para quitar."
                  : "Lo marca como fatigado (≤ 65 %) durante 24 h."}
              </p>
            </div>
          )}

          <ul className="space-y-2">
            {rows.map((g) => {
              const tone = toneOf(g);
              return (
                <li key={g.group}>
                  <button
                    type="button"
                    aria-pressed={picked === g.group}
                    onClick={() => setPicked((p) => (p === g.group ? null : g.group))}
                    className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3 text-left transition hover:bg-white/[0.08]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-semibold">{g.label}</span>
                        {g.manual && (
                          <>
                            <span className="h-2 w-2 shrink-0 rounded-full bg-accent ring-2 ring-accent/25" aria-hidden="true" title="Marcado como cargado" />
                            <span className="sr-only"> (marcado manualmente)</span>
                          </>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                        {tab === "fresh" ? (
                          <>
                            <StatusDot tone={tone}>{FRESH_STATUS[g.status].label}</StatusDot>
                            <span className="font-mono font-bold text-fg">{g.pct} %</span>
                          </>
                        ) : (
                          <span className="font-mono font-bold text-fg">{tab === "load" ? `${g.reps} reps` : `${g.sets} series`}</span>
                        )}
                        <span className="text-faint">{g.lastDate ? `Último: ${fmtShort(g.lastDate)}` : "Sin entrenar en 7 d"}</span>
                      </div>
                    </div>
                    <Segments frac={fracOf(g)} tone={tone} />
                  </button>
                </li>
              );
            })}
            {!rows.length && <li className="rounded-2xl bg-white/[0.05] px-4 py-6 text-center text-sm text-muted">Ningún grupo en este estado.</li>}
          </ul>
          <p className="mt-3 px-1 text-xs leading-snug text-faint">
            Frescura: pondera músculos por ejercicio, RIR, excéntricas lentas y novedad. Se recuperan entre 48 y 72 h. El punto ámbar indica marca manual.
          </p>
        </div>
      </div>
    </SheetDialog>
  );
}
