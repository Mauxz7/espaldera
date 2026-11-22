import { BLOCK_WEEKS } from "../data/program.js";
import { Card, SectionTitle } from "./ui.jsx";

// Bloque de 4 semanas: en qué semana vas y qué cambia en las series y el RIR.
export function BlockCard({ block, setBlock }) {
  const week = (block && block.week) || 1;
  const bw = BLOCK_WEEKS[week - 1];
  return (
    <div>
      <SectionTitle aside={`Semana ${week} de 4`}>Bloque de 4 semanas</SectionTitle>
      <Card>
        <div className="grid grid-cols-4 gap-1.5">
          {BLOCK_WEEKS.map((b) => (
            <button key={b.n} onClick={() => setBlock({ week: b.n })} aria-pressed={b.n === week}
              className={`rounded-xl py-2.5 text-center transition ${b.n === week ? "bg-accent/18 text-accent ring-1 ring-inset ring-accent/45" : b.n < week ? "bg-white/[0.06] text-fg/75 hover:bg-white/[0.1]" : "bg-white/[0.05] text-muted hover:bg-white/[0.09]"}`}>
              <div className="font-mono text-sm font-bold">S{b.n}</div>
              <div className="text-[10px]">{b.label}</div>
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-xs text-muted">{bw.note}</p>
      </Card>
    </div>
  );
}
