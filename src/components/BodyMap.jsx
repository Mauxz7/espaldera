// Mapa corporal anatómico (frente y espalda) coloreado por grupo muscular de metrics.js.
// Los trazos viven en src/data/bodyPaths.js (MIT, ver cabecera de ese archivo).
import { BODY_FRONT, BODY_BACK } from "../data/bodyPaths.js";

const BASE = "rgb(255 255 255 / 0.075)";
const HAIR = "rgb(255 255 255 / 0.035)";
const SEAM = "rgb(var(--c-bg) / 0.9)";

function Figure({ body, colorFor, label, onPick }) {
  return (
    <figure className="m-0 flex min-w-0 flex-1 flex-col items-center">
      <svg viewBox={body.viewBox} className="h-auto w-full max-w-[170px]" role="img" aria-label={label}>
        {body.parts.map(([group, d], i) => {
          const muscle = group !== "neutral" && group !== "hair";
          const c = muscle ? colorFor(group) : null;
          return (
            <path
              key={i}
              d={d}
              fill={c ? c.fill : group === "hair" ? HAIR : BASE}
              fillOpacity={c ? c.opacity ?? 1 : 1}
              stroke={SEAM}
              strokeWidth="2.5"
              strokeLinejoin="round"
              style={c && onPick ? { cursor: "pointer" } : undefined}
              onClick={c && onPick ? () => onPick(group) : undefined}
            >
              {c?.title && <title>{c.title}</title>}
            </path>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-[11px] font-medium text-faint">{label}</figcaption>
    </figure>
  );
}

/**
 * @param {{ colorFor: (group: string) => ({ fill: string, opacity?: number, title?: string } | null),
 *           onPick?: (group: string) => void, className?: string }} props
 */
export function BodyMap({ colorFor, onPick, className = "" }) {
  return (
    <div className={`flex items-start justify-center gap-1 ${className}`}>
      <Figure body={BODY_FRONT} colorFor={colorFor} onPick={onPick} label="Frente" />
      <Figure body={BODY_BACK} colorFor={colorFor} onPick={onPick} label="Espalda" />
    </div>
  );
}

export const TONE_RGB = {
  good: "rgb(var(--c-good))",
  accent: "rgb(var(--c-accent))",
  warn: "rgb(var(--c-warn))",
  strain: "rgb(var(--c-strain))",
  cool: "rgb(var(--c-cool))",
};
