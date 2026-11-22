export const TREND_STATUS_LABELS = Object.freeze({
  below: "Bajo lo normal",
  normal: "Rango normal",
  above: "Sobre lo normal",
  calibrating: "Calibrando",
  missing: "Sin datos",
});

const TONE_DOT_CLS = Object.freeze({
  good: "bg-good",
  warn: "bg-warn",
  cool: "bg-cool",
  accent: "bg-accent",
  plain: "bg-muted",
});

/**
 * Traduce el estado de `trendCard` a etiqueta en español y tono semántico según la métrica.
 * @param {"below"|"normal"|"above"|"calibrating"|"missing"} status
 * @param {"higherGood"|"lowerGood"|"aboveWarn"} polarity
 */
export function trendPill(status, polarity = "higherGood") {
  const text = TREND_STATUS_LABELS[status] || TREND_STATUS_LABELS.missing;
  if (status === "missing") return { text, tone: "plain" };
  if (status === "calibrating") return { text, tone: "cool" };
  if (status === "normal") return { text, tone: "good" };
  if (status === "above") {
    if (polarity === "higherGood") return { text, tone: "good" };
    return { text, tone: "warn" };
  }
  if (status === "below") {
    if (polarity === "lowerGood") return { text, tone: "good" };
    if (polarity === "aboveWarn") return { text, tone: "cool" };
    return { text, tone: "warn" };
  }
  return { text, tone: "plain" };
}

/**
 * Color de cambio en la tabla de tendencias según la polaridad de la métrica.
 */
export function deltaClass(delta, polarity = "higherGood") {
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) return "text-muted";
  if (polarity === "higherGood") return delta > 0 ? "text-good" : "text-warn";
  return delta < 0 ? "text-good" : "text-warn";
}

/**
 * Minibarra horizontal que sitúa el valor actual respecto a la banda normal [low, high].
 */
export function RangeMiniBar({ value, range, status, polarity = "higherGood", tall = false }) {
  const hasVal = typeof value === "number" && Number.isFinite(value);
  const hasRange = range
    && typeof range.low === "number" && Number.isFinite(range.low)
    && typeof range.high === "number" && Number.isFinite(range.high);

  const pill = trendPill(status, polarity);
  const dotCls = TONE_DOT_CLS[pill.tone] || TONE_DOT_CLS.plain;
  const trackCls = tall ? "h-2.5" : "h-1.5";
  const markerCls = tall ? "h-3.5 w-3.5" : "h-2.5 w-2.5";

  let leftPct = 50;
  if (hasVal && hasRange) {
    const span = Math.max(range.high - range.low, 0.1);
    const domainMin = range.low - 0.75 * span;
    const domainMax = range.high + 0.75 * span;
    const rawPct = ((value - domainMin) / (domainMax - domainMin)) * 100;
    leftPct = Math.max(4, Math.min(96, rawPct));
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-full bg-white/[0.08] ${trackCls}`} aria-hidden="true">
      {hasRange && (
        <div
          className="absolute inset-y-0 border-x border-good/50 bg-good/25"
          style={{ left: "30%", width: "40%" }}
        />
      )}
      {hasVal && (
        <span
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${markerCls} ${hasRange ? dotCls : "bg-cool"}`}
          style={{ left: `${leftPct}%` }}
        />
      )}
    </div>
  );
}

/**
 * Sparkline compacto en SVG con banda normal opcional.
 */
export function MiniSparkline({ spark = [], range = null, stroke = "var(--accent)", height = 34, ariaLabel }) {
  // Recorta los días vacíos del inicio: con pocas semanas de datos, una ventana de 90 d
  // dejaba la línea apretada contra el borde derecho.
  const rawPoints = Array.isArray(spark) ? spark : [];
  const firstIdx = rawPoints.findIndex((p) => p && typeof p.value === "number" && Number.isFinite(p.value));
  const points = firstIdx > 0 ? rawPoints.slice(firstIdx) : rawPoints;
  const nums = [];
  for (const p of points) {
    if (p && typeof p.value === "number" && Number.isFinite(p.value)) nums.push(p.value);
  }
  const hasRange = range
    && typeof range.low === "number" && Number.isFinite(range.low)
    && typeof range.high === "number" && Number.isFinite(range.high);

  if (nums.length === 0) {
    return (
      <svg
        viewBox="0 0 120 36"
        className="block w-full"
        style={{ height }}
        role={ariaLabel ? "img" : undefined}
        aria-label={ariaLabel}
        aria-hidden={ariaLabel ? undefined : true}
      >
        <line x1="2" y1="18" x2="118" y2="18" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  const all = [...nums];
  if (hasRange) all.push(range.low, range.high);
  let min = Math.min(...all);
  let max = Math.max(...all);
  const rawSpan = max - min;
  const pad = rawSpan > 0 ? rawSpan * 0.16 : 1;
  min -= pad;
  max += pad;
  const span = Math.max(max - min, 1e-6);

  const W = 120;
  const H = 36;
  const px = 3;
  const py = 3;
  const innerW = W - px * 2;
  const innerH = H - py * 2;

  const toX = (idx) => (points.length <= 1 ? W / 2 : px + (idx / (points.length - 1)) * innerW);
  const toY = (v) => py + (1 - (v - min) / span) * innerH;

  let bandTop = 0;
  let bandH = 0;
  if (hasRange) {
    const yHigh = toY(range.high);
    const yLow = toY(range.low);
    bandTop = Math.min(yHigh, yLow);
    bandH = Math.max(2, Math.abs(yLow - yHigh));
  }

  const paths = [];
  const isolated = [];
  let cur = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p && typeof p.value === "number" && Number.isFinite(p.value)) {
      cur.push({ x: toX(i), y: toY(p.value) });
    } else if (cur.length) {
      if (cur.length === 1) isolated.push(cur[0]);
      else paths.push(cur);
      cur = [];
    }
  }
  if (cur.length) {
    if (cur.length === 1) isolated.push(cur[0]);
    else paths.push(cur);
  }

  let lastPt = null;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p && typeof p.value === "number" && Number.isFinite(p.value)) {
      lastPt = { x: toX(i), y: toY(p.value) };
      break;
    }
  }

  return (
    <svg
      viewBox="0 0 120 36"
      className="block w-full"
      style={{ height }}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {hasRange && (
        <rect
          x={px}
          y={bandTop}
          width={innerW}
          height={bandH}
          rx="2"
          fill="rgb(var(--c-good) / 0.16)"
          stroke="rgb(var(--c-good) / 0.35)"
          strokeWidth="0.75"
        />
      )}
      {paths.map((seg, idx) => (
        <path
          key={idx}
          d={seg.map((pt, j) => `${j === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {isolated.map((pt, idx) => (
        <circle key={`dot-${idx}`} cx={pt.x} cy={pt.y} r="2.2" fill={stroke} />
      ))}
      {lastPt && (
        <circle cx={lastPt.x} cy={lastPt.y} r="2.8" fill={stroke} stroke="rgb(var(--c-surface))" strokeWidth="1.2" />
      )}
    </svg>
  );
}
