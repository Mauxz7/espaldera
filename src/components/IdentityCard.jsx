import { useMemo } from "react";
import { Vote } from "lucide-react";
import { usePersisted } from "../lib/storage.js";
import { DEFAULT_IDENTITIES } from "../data/identities.js";
import { DEFAULT_DOPAMINE_DEFS } from "../data/dopamine.js";
import { weekVotes, topIdentity, votesPhrase } from "../lib/identity.js";

// Tarjeta de Inicio: votos de la semana por identidad (barras horizontales)
// y la frase de la identidad con más votos.
export function IdentityCard({ wp, log, habits, habitDefs }) {
  const [identities] = usePersisted("identities", DEFAULT_IDENTITIES);
  const [dopamine] = usePersisted("dopamine", {});
  const [dopamineDefs] = usePersisted("dopamineDefs", DEFAULT_DOPAMINE_DEFS);
  const [sleep] = usePersisted("sleep", null);
  const rows = useMemo(
    () => weekVotes({ keys: wp.keys, todayIdx: wp.todayIdx, habits, habitDefs, identities, log, fromFitbit: wp.fromFitbit, dopamine, dopamineDefs, sleep }),
    [wp.keys, wp.todayIdx, habits, habitDefs, identities, log, wp.fromFitbit, dopamine, dopamineDefs, sleep],
  );
  const top = topIdentity(rows);
  const max = Math.max(1, ...rows.map((r) => r.votes));

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Identidad</h2>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted"><Vote size={13} />Votos de la semana</span>
      </div>
      <p className="mb-3 text-sm font-medium leading-snug">
        {top && top.emoji ? <span aria-hidden="true">{top.emoji} </span> : null}
        {votesPhrase(top)}
      </p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">Agrega identidades en Ajustes.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {r.emoji ? <span aria-hidden="true" className="mr-1.5">{r.emoji}</span> : null}{r.label}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                  <span className="font-semibold text-fg">{r.votes}</span> {r.votes === 1 ? "voto" : "votos"}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(r.votes / max) * 100}%`, backgroundColor: `rgb(var(--c-${r.color}))` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted">Cada hábito cumplido, cada sesión (en Shift o con Fitbit) y cada día con dopamina buena y cada noche de buen sueño (Fitbit) es un voto.</p>
    </section>
  );
}
