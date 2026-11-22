import { Cloud, CloudOff } from "lucide-react";
import { useSyncStatus } from "../lib/storage.js";

export function Chip({ children, tone = "plain" }) {
  const tones = {
    plain: "bg-surface2 text-muted border-line",
    accent: "bg-accent/15 text-accent border-accent/30",
    good: "bg-good/15 text-good border-good/30",
    cool: "bg-cool/15 text-cool border-cool/30",
    warn: "bg-warn/15 text-warn border-warn/30",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone] || tones.plain}`}>{children}</span>;
}

// Anillo de progreso reutilizable (Inicio y Salud): valor sobre meta, rango objetivo opcional (Strain) y subtítulo compacto a 375 px.
export function Ring({
  value,
  goal,
  label,
  sub,
  color = "accent",
  display,
  srText,
  targetRange = null,
  size = "md",
}) {
  const numVal = typeof value === "number" && Number.isFinite(value) ? value : null;
  const pct = numVal != null && goal ? Math.max(0, Math.min(1, numVal / goal)) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  const strokeColor = color === "muted" ? "rgb(var(--c-muted))" : `rgb(var(--c-${color}))`;

  let targetArc = null;
  if (
    targetRange
    && typeof targetRange.min === "number"
    && typeof targetRange.max === "number"
    && goal > 0
  ) {
    const startFrac = Math.max(0, Math.min(1, targetRange.min / goal));
    const endFrac = Math.max(startFrac, Math.min(1, targetRange.max / goal));
    const spanFrac = endFrac - startFrac;
    if (spanFrac > 0) {
      targetArc = {
        angle: startFrac * 360,
        dashTrack: `${spanFrac * c} ${c}`,
        outerR: 31.5,
        outerDash: `${spanFrac * 2 * Math.PI * 31.5} ${2 * Math.PI * 31.5}`,
      };
    }
  }

  const boxCls = size === "lg" ? "h-[78px] w-[78px] sm:h-[86px] sm:w-[86px]" : "h-[68px] w-[68px]";
  const centerCls = size === "lg" ? "font-display text-2xl font-semibold leading-none tabular-nums" : "font-mono text-sm font-semibold tabular-nums";
  const shown = display !== undefined ? display : (numVal != null ? numVal : "—");
  const sr = srText !== undefined ? srText : (goal ? ` de ${goal}` : "");

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div className={`relative ${boxCls}`}>
        <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="34" cy="34" r={r} fill="none" strokeWidth="6.5" className="stroke-surface2" />
          {targetArc && (
            <>
              <circle
                cx="34"
                cy="34"
                r={r}
                fill="none"
                strokeWidth="6.5"
                stroke="rgb(var(--c-good) / 0.22)"
                strokeDasharray={targetArc.dashTrack}
                transform={`rotate(${targetArc.angle} 34 34)`}
              />
              <circle
                cx="34"
                cy="34"
                r={targetArc.outerR}
                fill="none"
                strokeWidth="1.8"
                strokeLinecap="round"
                stroke="rgb(var(--c-good) / 0.8)"
                strokeDasharray={targetArc.outerDash}
                transform={`rotate(${targetArc.angle} 34 34)`}
              />
            </>
          )}
          {pct > 0 && (
            <circle
              cx="34"
              cy="34"
              r={r}
              fill="none"
              strokeWidth="6.5"
              strokeLinecap="round"
              stroke={strokeColor}
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              style={{ transition: "stroke-dashoffset .5s" }}
            />
          )}
        </svg>
        <div className={`absolute inset-0 grid place-items-center ${centerCls}`}>
          <span>{shown}</span>
          {sr && <span className="sr-only">{sr}</span>}
        </div>
      </div>
      {label && <div className="mt-1.5 text-xs font-semibold leading-tight text-fg">{label}</div>}
      {sub && <div className="mt-0.5 max-w-full text-[10px] leading-tight text-muted">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin="0" aria-valuemax="100">
      <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function SyncBadge() {
  const s = useSyncStatus();
  const map = {
    off: { icon: CloudOff, text: "Solo en este dispositivo", cls: "text-warn" },
    syncing: { icon: Cloud, text: "Sincronizando…", cls: "text-muted" },
    ok: { icon: Cloud, text: "Sincronizado", cls: "text-good" },
    error: { icon: CloudOff, text: s.code === "red" ? "Sin conexión" : "Error al sincronizar", cls: "text-warn" },
  };
  const m = map[s.state] || map.off;
  const Icon = m.icon;
  return <span className={`inline-flex items-center gap-1.5 text-xs ${m.cls}`}><Icon size={14} />{m.text}</span>;
}
