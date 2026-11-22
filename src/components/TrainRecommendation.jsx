import { Sparkles, Check, ChevronRight, BatteryLow } from "lucide-react";
import { routineById } from "../data/program.js";
import { resolveVariantId } from "../lib/routines.js";
import { Card, StatusDot, btnCls } from "./ui.jsx";

const TONE = { recovered: "good", fatigued: "accent", depleted: "warn" };

/**
 * Tarjeta «Recomendado hoy» de Entreno. La lógica vive en metrics.recommendTraining();
 * aquí solo se pinta y se ofrece cambiar a la rutina sugerida.
 */
export function TrainRecommendation({ rec, rid, plannedRid, routineVariants, runLevel, onPick }) {
  if (!rec) return null;
  if (rec.kind === "done") {
    return (
      <Card className="py-3.5">
        <div className="flex items-center gap-2 text-sm">
          <Check size={16} className="shrink-0 text-good" />
          <p className="min-w-0 text-muted"><span className="font-semibold text-fg">Ya entrenaste hoy.</span> Mañana te sugiero según cómo amanezcan tus músculos.</p>
        </div>
      </Card>
    );
  }
  const routine = routineById(rec.rid, runLevel, resolveVariantId(rec.rid, routineVariants));
  const selected = rec.rid === rid;
  const isLow = rec.kind === "low";
  return (
    <Card glow={isLow ? "cool" : "good"}>
      <div className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${isLow ? "text-cool" : "text-good"}`}>
        {isLow ? <BatteryLow size={14} /> : <Sparkles size={14} />}Recomendado hoy
        {plannedRid && plannedRid !== rec.rid && <span className="font-normal text-faint">· tu plan decía {routineById(plannedRid).short}</span>}
      </div>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-bold leading-tight tracking-tight">{routine.short} · {routine.name}</h2>
          <p className="mt-1 text-sm leading-snug text-muted">{rec.reason}</p>
        </div>
        {rec.readiness != null && !isLow && (
          <div className="shrink-0 text-right">
            <div className="font-mono text-[26px] font-bold leading-none text-good">{rec.readiness}%</div>
            <div className="mt-0.5 text-[11px] text-muted">listos</div>
          </div>
        )}
      </div>
      {rec.fresh.length > 0 && !isLow && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {rec.fresh.map((g) => <StatusDot key={g.group} tone={TONE[g.status]}>{g.label} {g.pct}%</StatusDot>)}
        </div>
      )}
      {selected ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-good"><Check size={15} />Es la que tienes abierta</p>
      ) : (
        <button type="button" onClick={() => onPick(rec.rid)} className={btnCls(isLow ? "soft-cool" : "ghost", "mt-3 w-full")}>
          Abrir {routine.short}<ChevronRight size={16} />
        </button>
      )}
    </Card>
  );
}
