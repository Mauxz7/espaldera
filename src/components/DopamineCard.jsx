import { usePersisted } from "../lib/storage.js";
import { dkey, addDays, mondayOf } from "../lib/dates.js";
import { DEFAULT_DOPAMINE_DEFS } from "../data/dopamine.js";
import { DEFAULT_IDENTITIES } from "../data/identities.js";
import { normalizeIdentities } from "../lib/identity.js";
import { dopamineWeekStats, recordDopamine } from "../lib/dopamine.js";

// Tarjeta «Dopamina» en Hábitos: registro honesto de dopamina buena y barata con un toque.
export function DopamineCard() {
  const [dopamine, setDopamine] = usePersisted("dopamine", {});
  const [dopamineDefs] = usePersisted("dopamineDefs", DEFAULT_DOPAMINE_DEFS);
  const [identities] = usePersisted("identities", DEFAULT_IDENTITIES);

  const now = new Date();
  const today = dkey(now);
  const mon = mondayOf(now);
  const keys = Array.from({ length: 7 }, (_, i) => dkey(addDays(mon, i)));
  const todayIdx = (now.getDay() + 6) % 7;

  const { items, goodWeek, cheapWeek } = dopamineWeekStats({
    keys,
    todayIdx,
    dopamine,
    dopamineDefs,
  });

  const idMap = new Map(normalizeIdentities(identities).map((it) => [it.id, it]));
  const goodItems = items.filter((it) => it.kind === "good");
  const cheapItems = items.filter((it) => it.kind === "cheap");

  const adjust = (id, delta) => {
    setDopamine((all) => recordDopamine(all, today, id, delta, 60));
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Dopamina</h2>
        <p className="text-xs text-muted">
          Esta semana:{" "}
          <span className="font-mono font-semibold tabular-nums text-good">{goodWeek}</span>{" "}
          {goodWeek === 1 ? "buena" : "buenas"} ·{" "}
          <span className="font-mono font-semibold tabular-nums text-warn">{cheapWeek}</span>{" "}
          {cheapWeek === 1 ? "barata" : "baratas"}
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Dopamina buena */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-good">
              Dopamina buena
            </span>
            <span className="text-[11px] text-muted">Suma 1 voto por día</span>
          </div>
          <div className="space-y-2">
            {goodItems.map((it) => {
              const idObj = it.identity ? idMap.get(it.identity) : null;
              return (
                <div
                  key={it.id}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${
                    it.today > 0 ? "border-good/40 bg-good/10" : "border-line bg-surface2"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug">
                      {idObj && idObj.emoji ? (
                        <span aria-hidden="true" title={idObj.label} className="mr-1.5">
                          {idObj.emoji}
                        </span>
                      ) : null}
                      {it.label}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span className={`font-mono tabular-nums ${it.today > 0 ? "font-semibold text-good" : ""}`}>
                        hoy {it.today}
                      </span>
                      <span className="font-mono tabular-nums">· sem {it.week}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjust(it.id, -1)}
                      disabled={it.today <= 0}
                      aria-label={`Deshacer último toque de ${it.label}`}
                      className="grid min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-line bg-surface px-2.5 font-mono text-xs font-semibold text-muted transition hover:text-fg active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                    >
                      −1
                    </button>
                    <button
                      type="button"
                      onClick={() => adjust(it.id, 1)}
                      aria-label={`Sumar 1 a ${it.label}`}
                      className="grid min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-good/40 bg-good/15 px-2.5 font-mono text-xs font-semibold text-good transition hover:bg-good/25 active:scale-95"
                    >
                      +1
                    </button>
                  </div>
                </div>
              );
            })}
            {goodItems.length === 0 && (
              <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                Sin elementos de dopamina buena. Agrégalos en Ajustes.
              </p>
            )}
          </div>
        </div>

        {/* Dopamina barata */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-warn">
              Dopamina barata
            </span>
            <span className="text-[11px] text-muted">Registro honesto</span>
          </div>
          <div className="space-y-2">
            {cheapItems.map((it) => (
              <div
                key={it.id}
                className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${
                  it.overLimit ? "border-warn/70 bg-warn/15" : "border-line bg-surface2"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium leading-snug ${it.overLimit ? "text-warn" : ""}`}>
                    {it.label}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                    <span className={`font-mono tabular-nums ${it.overLimit ? "font-semibold text-warn" : "text-muted"}`}>
                      hoy {it.today} de {it.limit}
                    </span>
                    <span className="font-mono tabular-nums text-muted">· sem {it.week}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjust(it.id, -1)}
                    disabled={it.today <= 0}
                    aria-label={`Deshacer último toque de ${it.label}`}
                    className="grid min-h-[44px] min-w-[44px] place-items-center rounded-xl border border-line bg-surface px-2.5 font-mono text-xs font-semibold text-muted transition hover:text-fg active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                  >
                    −1
                  </button>
                  <button
                    type="button"
                    onClick={() => adjust(it.id, 1)}
                    aria-label={`Sumar 1 a ${it.label}`}
                    className={`grid min-h-[44px] min-w-[44px] place-items-center rounded-xl border px-2.5 font-mono text-xs font-semibold transition active:scale-95 ${
                      it.overLimit
                        ? "border-warn/60 bg-warn/20 text-warn hover:bg-warn/30"
                        : "border-line bg-surface text-fg hover:border-warn/50 hover:text-warn"
                    }`}
                  >
                    +1
                  </button>
                </div>
              </div>
            ))}
            {cheapItems.length === 0 && (
              <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                Sin elementos de dopamina barata. Agrégalos en Ajustes.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
