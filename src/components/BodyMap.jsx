// Mapa corporal propio (frente y espalda) con una región por grupo muscular de metrics.js.
// Dibujo estilizado: cada región es un path; las zonas sin grupo (manos, rodillas, pies) van neutras.
// Solo se dibuja la mitad izquierda y se refleja para la derecha.

const NEUTRAL = "neutral";

// Mitad izquierda (x < 50) del frente.
const DELT = "M39 35 Q30 34 26 41 Q23.5 48 25 56 Q28 50 33 47 Q36 44 39 41 Z";
const UPPER_ARM = "M25.5 58 Q22.5 66 23 76 Q25.5 80 28.5 77 Q31.5 70 32 60 Q30 55.5 25.5 58 Z";
const FOREARM = "M22.5 80 Q19.5 92 18.5 104 Q21 106.5 23.5 104.5 Q27.5 93 28.5 81 Q25.5 78.5 22.5 80 Z";
const HAND = "M17 108 Q15.5 116 18.5 120 Q22.5 119.5 23.5 113 Q23.5 108 20 107 Z";
const FOOT = "M37.5 199 Q35 205 37.5 207.5 L45.5 207.5 Q46.5 203 44.5 199 Z";

const FRONT_HALF = [
  ["shoulders", DELT],
  ["chest", "M49.5 40 Q43 37.5 38.5 40 Q34 44 34.5 51 Q38 56 44 56 Q48 55.5 49.5 53 Z"],
  ["biceps", UPPER_ARM],
  [NEUTRAL, FOREARM],
  [NEUTRAL, HAND],
  ["core", "M35 55 Q34 68 36.5 84 Q38.5 88 41.5 88 L41 59 Q38 58 35 55 Z"],
  [NEUTRAL, "M36.5 88 Q40 96 49.5 99 L49.5 104 Q41 102 36 96 Z"],
  ["quads", "M36 97 Q32.5 112 34 132 Q36 145 41 148 Q46 146 47.5 136 Q49.5 120 49 104 Q41 102 36 97 Z"],
  [NEUTRAL, "M36.5 149 Q37 155 41 157 Q45 155 46.5 149 Q41.5 151.5 36.5 149 Z"],
  ["calves", "M36.5 158 Q34.5 170 36.5 184 Q38.5 196 41 197 Q43.5 196 45 184 Q47 170 46 158 Q41.5 160.5 36.5 158 Z"],
  [NEUTRAL, FOOT],
];

// Piezas del frente que cruzan el centro (no se reflejan).
const FRONT_CENTER = [
  ["core", "M42.5 58 Q50 60 57.5 58 L57.5 86 Q55 94 50 96 Q45 94 42.5 86 Z"],
];
// Líneas decorativas (abdominales), sin interacción.
const FRONT_DECOR = "M50 59.5 L50 95.5 M43 67 Q50 68.5 57 67 M43 75.5 Q50 77 57 75.5 M43 84 Q50 85.5 57 84";

// Mitad izquierda de la espalda.
const BACK_HALF = [
  ["shoulders", DELT],
  ["lats", "M35.5 44 Q33 54 35.5 66 Q39 78 45 85 L49.5 86 L49.5 64 Q44 56 41 49 Z"],
  ["triceps", UPPER_ARM],
  [NEUTRAL, FOREARM],
  [NEUTRAL, HAND],
  ["glutes", "M36.5 96 Q33.5 106 36.5 116 Q42 122 49.5 118 L49.5 99 Q42 99 36.5 96 Z"],
  ["hamstrings", "M35.5 119 Q33.5 132 35.5 144 Q40 150 45 147 Q48.5 136 49 121 Q42 123 35.5 119 Z"],
  [NEUTRAL, "M36.5 149 Q37 154 41 155.5 Q45 154 46.5 149 Q41.5 151 36.5 149 Z"],
  ["calves", "M36 157 Q32 168 35.5 180 Q39 186 41 186 Q44 186 46.5 179 Q49 168 46.5 157 Q41.5 159.5 36 157 Z"],
  [NEUTRAL, "M38.5 188 Q38 194 39 198 L43.5 198 Q44.5 194 44 188 Q41 189.5 38.5 188 Z"],
  [NEUTRAL, FOOT],
];

const BACK_CENTER = [
  ["upperBack", "M44 27 L56 27 Q60 33 66 37 Q62 42 58 48 L50 60 L42 48 Q38 42 34 37 Q40 33 44 27 Z"],
  ["core", "M44 86 L56 86 Q58 92 58 96 Q50 99 42 96 Q42 92 44 86 Z"],
];
const BACK_DECOR = "M50 60 L50 86";

const HEAD = (
  <>
    <ellipse cx="50" cy="13.5" rx="8.5" ry="10.5" />
    <path d="M45.5 22.5 L54.5 22.5 L55.5 30 Q50 32 44.5 30 Z" />
  </>
);

function Figure({ half, center, decor, colorFor, label, onPick }) {
  const region = ([group, d], i, mirror) => {
    const neutral = group === NEUTRAL;
    const c = neutral ? null : colorFor(group);
    return (
      <path
        key={`${mirror ? "r" : "l"}${i}`}
        d={d}
        fill={c ? c.fill : "rgb(255 255 255 / 0.06)"}
        fillOpacity={c ? c.opacity ?? 1 : 1}
        stroke="rgb(255 255 255 / 0.10)"
        strokeWidth="0.5"
        style={c && onPick ? { cursor: "pointer" } : undefined}
        onClick={c && onPick ? () => onPick(group) : undefined}
      >
        {!neutral && c?.title && <title>{c.title}</title>}
      </path>
    );
  };
  return (
    <figure className="m-0 flex min-w-0 flex-1 flex-col items-center">
      <svg viewBox="12 0 76 210" className="h-auto w-full max-w-[170px]" role="img" aria-label={label}>
        <g fill="rgb(255 255 255 / 0.06)" stroke="rgb(255 255 255 / 0.10)" strokeWidth="0.5">{HEAD}</g>
        {half.map((r, i) => region(r, i, false))}
        <g transform="translate(100 0) scale(-1 1)">{half.map((r, i) => region(r, i, true))}</g>
        {center.map((r, i) => region(r, `c${i}`, false))}
        {decor && <path d={decor} fill="none" stroke="rgb(0 0 0 / 0.28)" strokeWidth="0.7" strokeLinecap="round" pointerEvents="none" />}
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
    <div className={`flex items-start justify-center gap-2 ${className}`}>
      <Figure half={FRONT_HALF} center={FRONT_CENTER} decor={FRONT_DECOR} colorFor={colorFor} onPick={onPick} label="Frente" />
      <Figure half={BACK_HALF} center={BACK_CENTER} decor={BACK_DECOR} colorFor={colorFor} onPick={onPick} label="Espalda" />
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
