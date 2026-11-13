import { X, Check, Trophy, Clock, Layers, Weight, ChevronRight } from "lucide-react";
import { formatDuration, formatKg } from "../lib/workout.js";

/**
 * Hoja de resumen al terminar: duración, series hechas, carga total y marcas nuevas frente a la última vez.
 * summary: resultado de buildWorkoutSummary (lib/workout.js).
 */
export function WorkoutSummary({ routine, summary, logged, onRegister, onContinue, onClose, onDone }) {
  const { durationMs, setsDone, setsTotal, volume, records, complete } = summary;
  const stat = (Icon, label, value, sub) => (
    <div className="min-w-0 rounded-2xl bg-surface2 p-3">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted"><Icon size={12} />{label}</div>
      <div className="mt-0.5 font-mono text-lg leading-tight tabular-nums">{value}</div>
      {sub && <div className="truncate text-[11px] text-muted">{sub}</div>}
    </div>
  );

  return (
    <div className="sheet-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-black/70 md:items-center" onClick={onClose}>
      <div className="sheet max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 md:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Resumen del entreno">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{routine.short} · Resumen</div>
            <h2 className="font-display text-3xl font-semibold uppercase leading-none">{complete ? "Rutina completa" : "Entreno terminado"}</h2>
            <p className="mt-1 truncate text-sm text-muted">{routine.name}</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 -mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-full text-muted hover:text-fg" aria-label="Cerrar resumen"><X size={22} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {stat(Clock, "Duración", formatDuration(durationMs))}
          {stat(Layers, "Series", `${setsDone}/${setsTotal}`)}
          {stat(Weight, "Carga", volume > 0 ? formatKg(volume) : "—", "reps × carga")}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold"><Trophy size={16} className="text-accent" />Marcas nuevas</div>
          {records.length ? (
            <ul className="space-y-1.5">
              {records.map((r) => (
                <li key={r.exerciseId} className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
                  <div className="text-sm font-medium leading-snug">{r.name}</div>
                  <div className="font-mono text-xs text-accent">{r.text}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Sin marcas nuevas frente a la última vez. Sumar series también cuenta.</p>
          )}
        </div>

        <div className="mt-5 space-y-2">
          {logged ? (
            <div className="flex h-12 items-center justify-center gap-2 rounded-xl border border-good/40 bg-good/10 text-sm font-semibold text-good"><Check size={18} />Sesión registrada hoy</div>
          ) : (
            <button type="button" onClick={onRegister} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-good font-semibold text-bg shadow-lg">
              <Check size={20} strokeWidth={3} />Registrar sesión
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {!complete && (
              <button type="button" onClick={onContinue} className="inline-flex h-12 items-center justify-center gap-1 rounded-xl border border-line bg-surface2 text-sm font-medium">Seguir entrenando<ChevronRight size={16} /></button>
            )}
            <button type="button" onClick={onDone} className={`h-12 rounded-xl text-sm font-semibold ${complete ? "col-span-2" : ""} ${logged ? "bg-accent text-accentInk" : "border border-line bg-surface2"}`}>Listo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
