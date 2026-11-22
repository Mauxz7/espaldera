import { X, Check, Trophy, Clock, Layers, Weight, ChevronRight } from "lucide-react";
import { formatDuration, formatKg } from "../lib/workout.js";
import { btnCls, Chip, StatusDot } from "./ui.jsx";

/**
 * Hoja de resumen al terminar: duración, series hechas, carga total y marcas nuevas frente a la última vez.
 * summary: resultado de buildWorkoutSummary (lib/workout.js) o buildFreeWorkoutSummary (lib/freeWorkout.js).
 */
export function WorkoutSummary({ routine, summary, logged, skippedCount = 0, isFree = false, onRegister, onContinue, onClose, onDone }) {
  const { durationMs, setsDone, setsTotal, volume, records, complete, workedGroups = [], exercisesDone = 0 } = summary;
  const stat = (Icon, label, value, sub) => (
    <div className="min-w-0 rounded-2xl bg-white/[0.06] p-3">
      <div className="flex items-center gap-1 text-xs font-medium text-muted"><Icon size={12} />{label}</div>
      <div className="mt-1 font-mono text-xl font-bold leading-tight text-fg tabular-nums">{value}</div>
      {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );

  const heading = isFree ? "Entreno libre guardado" : complete ? "Rutina completa" : "Entreno terminado";
  const seriesVal = isFree ? `${setsDone}` : `${setsDone}/${setsTotal}`;
  const seriesSub = isFree ? `${exercisesDone} ${exercisesDone === 1 ? "ejercicio" : "ejercicios"}` : undefined;

  return (
    <div className="sheet-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div className="sheet max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[26px] border border-line bg-surface p-5 shadow-2xl md:rounded-[26px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Resumen del entreno">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-accent">{routine.short} · Resumen</div>
            <h2 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">{heading}</h2>
            <p className="mt-1 truncate text-sm text-muted">{routine.name}</p>
            {skippedCount > 0 && <p className="mt-0.5 text-xs text-muted">{skippedCount === 1 ? "1 bloque saltado hoy" : `${skippedCount} bloques saltados hoy`}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg" aria-label="Cerrar resumen"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {stat(Clock, "Duración", formatDuration(durationMs))}
          {stat(Layers, "Series", seriesVal, seriesSub)}
          {stat(Weight, "Carga", volume > 0 ? formatKg(volume) : "—", "reps × carga")}
        </div>

        {workedGroups.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold">Grupos trabajados</div>
            <div className="flex flex-wrap gap-1.5">
              {workedGroups.map((g) => (
                <Chip key={g.group} tone="accent">{g.label} · {g.sets}</Chip>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Trophy size={16} className="text-accent" />Marcas nuevas</div>
          {records.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white/[0.05]">
              {records.map((r) => (
                <li key={r.exerciseId} className="px-3.5 py-2.5">
                  <div className="text-sm font-medium leading-snug">{r.name}</div>
                  <div className="font-mono text-xs font-bold text-accent">{r.text}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin marcas nuevas frente a la última vez. Sumar series también cuenta.</p>
          )}
        </div>

        <div className="mt-5 space-y-2.5">
          {isFree ? (
            <div className="flex min-h-[48px] items-center justify-center rounded-2xl bg-good/12 px-3 text-center">
              <StatusDot tone="good">Guardado en tu historial y grupos musculares</StatusDot>
            </div>
          ) : logged ? (
            <div className="flex min-h-[48px] items-center justify-center rounded-2xl bg-good/12">
              <StatusDot tone="good">Sesión registrada hoy</StatusDot>
            </div>
          ) : (
            <button type="button" onClick={onRegister} className={btnCls("primary", "w-full")}>
              <Check size={20} strokeWidth={3} />Registrar sesión
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {(isFree || !complete) && (
              <button type="button" onClick={onContinue} className={btnCls("ghost", "w-full whitespace-nowrap !gap-1 !px-2.5 text-[13px] sm:!gap-2 sm:!px-4 sm:text-sm")}>Seguir entrenando<ChevronRight size={15} className="shrink-0" /></button>
            )}
            <button type="button" onClick={onDone} className={btnCls(isFree || logged ? "primary" : "ghost", !isFree && complete ? "col-span-2 w-full" : "w-full")}>Listo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
