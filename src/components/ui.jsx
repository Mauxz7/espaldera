import { Cloud, CloudOff } from "lucide-react";
import { useSyncStatus } from "../lib/storage.js";

export function Chip({ children, tone = "plain" }) {
  const tones = {
    plain: "bg-white/[0.07] text-muted",
    accent: "bg-accent/15 text-accent",
    good: "bg-good/15 text-good",
    cool: "bg-cool/15 text-cool",
    warn: "bg-warn/15 text-warn",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone] || tones.plain}`}>{children}</span>;
}

// ───────── Sistema visual premium (v1) ─────────
// Tarjeta de vidrio. `glow` añade un halo de color arriba a la derecha (p. ej. "accent" en la tarjeta de entreno).
export function Card({ as: Tag = "section", className = "", glow = null, children, ...rest }) {
  return (
    <Tag className={`card relative overflow-hidden p-4 md:p-5 ${className}`} {...rest}>
      {glow && (
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full"
          style={{ background: `radial-gradient(circle, rgb(var(--c-${glow}) / .26), transparent 65%)` }} />
      )}
      <div className="relative">{children}</div>
    </Tag>
  );
}

// Título de sección fuera de la tarjeta, en tipo oración, con dato opcional a la derecha.
export function SectionTitle({ children, aside = null, className = "" }) {
  return (
    <div className={`mb-2.5 mt-1 flex items-baseline justify-between gap-2 px-1 ${className}`}>
      <h2 className="text-xl font-bold tracking-tight text-fg">{children}</h2>
      {aside != null && <span className="text-[13px] font-medium text-muted">{aside}</span>}
    </div>
  );
}

// Estado con punto de color: «● Normal».
export function StatusDot({ tone = "muted", children }) {
  const cls = { good: "text-good", cool: "text-cool", warn: "text-warn", bad: "text-bad", accent: "text-accent", sleep: "text-sleep", muted: "text-muted" }[tone] || "text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cls}`}>
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />{children}
    </span>
  );
}

// Botones: primary = degradado ámbar con sombra; ghost = vidrio; soft-<tono> = fondo tenue del tono.
export const btnCls = (variant = "primary", extra = "") => {
  const base = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0";
  const v = {
    primary: "bg-gradient-to-b from-[#f3c582] to-[#e2a95a] text-accentInk shadow-[0_8px_24px_rgb(232_181_110/.3)] hover:brightness-105",
    ghost: "bg-white/[0.08] text-fg hover:bg-white/[0.12]",
    "soft-warn": "bg-warn/15 text-warn hover:bg-warn/25",
    "soft-cool": "bg-cool/15 text-cool hover:bg-cool/25",
  }[variant] || "";
  return `${base} ${v} ${extra}`;
};

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

  const boxCls = size === "xl" ? "h-[92px] w-[92px] sm:h-[100px] sm:w-[100px]" : size === "lg" ? "h-[78px] w-[78px] sm:h-[86px] sm:w-[86px]" : "h-[68px] w-[68px]";
  const centerCls = size === "xl" ? "font-mono text-[22px] font-bold leading-none" : size === "lg" ? "font-mono text-xl font-bold leading-none" : "font-mono text-sm font-bold";
  const glow = color === "muted" ? "none" : `drop-shadow(0 0 7px rgb(var(--c-${color}) / .45))`;
  const shown = display !== undefined ? display : (numVal != null ? numVal : "—");
  const sr = srText !== undefined ? srText : (goal ? ` de ${goal}` : "");

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div className={`relative ${boxCls}`}>
        <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90 overflow-visible" aria-hidden="true">
          <circle cx="34" cy="34" r={r} fill="none" strokeWidth="7" stroke={color === "muted" ? "rgb(255 255 255 / .08)" : `rgb(var(--c-${color}) / .16)`} />
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
              strokeWidth="7"
              strokeLinecap="round"
              stroke={strokeColor}
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              style={{ transition: "stroke-dashoffset .5s", filter: glow }}
            />
          )}
        </svg>
        <div className={`absolute inset-0 grid place-items-center ${centerCls}`}>
          <span>{shown}</span>
          {sr && <span className="sr-only">{sr}</span>}
        </div>
      </div>
      {label && <div className="mt-2 text-[13px] font-semibold leading-tight text-fg">{label}</div>}
      {sub && <div className="mt-0.5 max-w-full text-[10px] leading-tight text-muted">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ value }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin="0" aria-valuemax="100">
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
