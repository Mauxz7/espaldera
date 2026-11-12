import { BLOCK_WEEKS } from "../data/program.js";

// Bloque de 4 semanas: en qué semana vas y qué cambia en las series y el RIR.
export function BlockCard({ block, setBlock }) {
  const week = (block && block.week) || 1;
  const bw = BLOCK_WEEKS[week - 1];
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Bloque de 4 semanas</h2>
        <span className="font-mono text-xs text-muted">Semana {week} de 4</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {BLOCK_WEEKS.map((b) => (
          <button key={b.n} onClick={() => setBlock({ week: b.n })} aria-pressed={b.n === week}
            className={`rounded-lg border py-2 text-center transition ${b.n === week ? "border-accent bg-accent/15 text-accent" : b.n < week ? "border-line bg-surface2 text-fg/70" : "border-line bg-surface2 text-muted"}`}>
            <div className="font-mono text-sm">S{b.n}</div>
            <div className="text-[10px]">{b.label}</div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{bw.note}</p>
    </section>
  );
}
