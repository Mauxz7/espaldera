import { Cloud, CloudOff } from "lucide-react";
import { useSyncStatus } from "../lib/storage.js";

export function Chip({ children, tone = "plain" }) {
  const tones = {
    plain: "bg-surface2 text-muted border-line",
    accent: "bg-accent/15 text-accent border-accent/30",
    good: "bg-good/15 text-good border-good/30",
    cool: "bg-cool/15 text-cool border-cool/30",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]}`}>{children}</span>;
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
