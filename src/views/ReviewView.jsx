import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2, Check } from "lucide-react";
import { usePersisted } from "../lib/storage.js";
import { dkey, fmtShort } from "../lib/dates.js";
import { fmtSleep } from "../lib/sleep.js";
import { DEFAULT_IDENTITIES } from "../data/identities.js";
import { DEFAULT_DOPAMINE_DEFS } from "../data/dopamine.js";
import {
  currentWeekMonday,
  availableReviewWeeks,
  buildWeekReview,
  addWin,
  removeWin,
  saveReview,
} from "../lib/review.js";

// Vista «Revisión semanal»: cierre de domingo y frasco de logros.
// No aparece en la barra inferior; se abre desde la tarjeta en Inicio o desde el aviso semanal.
export function ReviewView({ wp, log, habits, habitDefs, wins, setWins, reviews, setReviews, onBack }) {
  const [workouts] = usePersisted("workouts", []);
  const [identities] = usePersisted("identities", DEFAULT_IDENTITIES);
  const [dopamine] = usePersisted("dopamine", {});
  const [dopamineDefs] = usePersisted("dopamineDefs", DEFAULT_DOPAMINE_DEFS);
  const [sleep] = usePersisted("sleep", null);
  const [weekPlan] = usePersisted("weekPlan", {});

  const currentMk = currentWeekMonday();
  const weeks = useMemo(() => availableReviewWeeks(reviews, currentMk), [reviews, currentMk]);
  const [weekKey, setWeekKey] = useState(currentMk);
  const activeKey = weeks.includes(weekKey) ? weekKey : currentMk;
  const weekIdx = weeks.indexOf(activeKey);
  const isCurrent = activeKey === currentMk;

  const summary = useMemo(
    () =>
      buildWeekReview({
        mondayKey: activeKey,
        today: dkey(),
        todayIdx: isCurrent ? wp.todayIdx : 6,
        fixed: isCurrent ? wp.fixed : undefined,
        fromFitbit: isCurrent ? wp.fromFitbit : undefined,
        habits,
        habitDefs,
        identities,
        log,
        workouts,
        weekPlan,
        dopamine,
        dopamineDefs,
        sleep,
        wins,
        reviews,
      }),
    [activeKey, isCurrent, wp.todayIdx, wp.fixed, wp.fromFitbit, habits, habitDefs, identities, log, workouts, weekPlan, dopamine, dopamineDefs, sleep, wins, reviews],
  );

  const [winText, setWinText] = useState("");
  const storedReview = (reviews && reviews[activeKey]) || {};
  const [good, setGood] = useState(storedReview.good || "");
  const [adjust, setAdjust] = useState(storedReview.adjust || "");
  const [saveStatus, setSaveStatus] = useState("");

  const timerRef = useRef(null);
  const draftRef = useRef({ weekKey: activeKey, good: storedReview.good || "", adjust: storedReview.adjust || "", dirty: false });

  const flushSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!draftRef.current.dirty) return;
    const { weekKey: wk, good: g, adjust: a } = draftRef.current;
    draftRef.current.dirty = false;
    setReviews((all) => saveReview(all, wk, { good: g, adjust: a }));
    setSaveStatus("Guardado");
  }, [setReviews]);

  // Al cambiar de semana (o llegar cambios externos mientras no editas), sincroniza los campos.
  useEffect(() => {
    if (draftRef.current.weekKey !== activeKey) {
      const nextGood = storedReview.good || "";
      const nextAdjust = storedReview.adjust || "";
      setGood(nextGood);
      setAdjust(nextAdjust);
      setSaveStatus("");
      draftRef.current = { weekKey: activeKey, good: nextGood, adjust: nextAdjust, dirty: false };
    } else if (!draftRef.current.dirty) {
      const nextGood = storedReview.good || "";
      const nextAdjust = storedReview.adjust || "";
      if (nextGood !== good) setGood(nextGood);
      if (nextAdjust !== adjust) setAdjust(nextAdjust);
      draftRef.current.good = nextGood;
      draftRef.current.adjust = nextAdjust;
    }
  }, [activeKey, storedReview.good, storedReview.adjust, good, adjust]);

  // Guarda cambios pendientes si cambias de semana o sales de la vista antes de que venza el debounce.
  useEffect(() => () => flushSave(), [activeKey, flushSave]);

  const onFieldChange = (field, value) => {
    const nextGood = field === "good" ? value : good;
    const nextAdjust = field === "adjust" ? value : adjust;
    if (field === "good") setGood(value);
    else setAdjust(value);
    draftRef.current = { weekKey: activeKey, good: nextGood, adjust: nextAdjust, dirty: true };
    setSaveStatus("Guardando…");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushSave, 400);
  };

  const selectWeek = (nextKey) => {
    flushSave();
    setWeekKey(nextKey);
  };

  const handleBack = () => {
    flushSave();
    onBack();
  };

  const submitWin = (e) => {
    e.preventDefault();
    if (!winText.trim()) return;
    const targetDate = isCurrent ? dkey() : summary.keys[6];
    setWins((all) => addWin(all, winText, targetDate));
    setWinText("");
  };

  const maxVotes = Math.max(1, ...summary.votes.map((r) => r.votes));
  const rangeLabel = `${fmtShort(summary.keys[0])} – ${fmtShort(summary.keys[6])}`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-fg transition hover:border-accent hover:text-accent"
        >
          <ArrowLeft size={16} />Volver a Inicio
        </button>
      </div>

      {/* Encabezado y selector de semana */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => weekIdx > 0 && selectWeek(weeks[weekIdx - 1])}
            disabled={weekIdx <= 0}
            aria-label="Semana anterior"
            className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-xl border border-line bg-surface2 text-fg transition hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {isCurrent ? "Esta semana" : "Semana anterior"}
            </div>
            <h1 className="font-display text-2xl font-semibold uppercase leading-tight">Revisión semanal</h1>
            <div className="text-xs text-muted">{rangeLabel}</div>
          </div>
          <button
            type="button"
            onClick={() => weekIdx < weeks.length - 1 && selectWeek(weeks[weekIdx + 1])}
            disabled={weekIdx < 0 || weekIdx >= weeks.length - 1}
            aria-label="Semana siguiente"
            className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-xl border border-line bg-surface2 text-fg transition hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* Bloque: Votos por identidad */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Identidad</h2>
          <span className="text-[11px] text-muted">Votos de la semana</span>
        </div>
        <p className="mb-3 text-sm font-medium leading-snug">
          {summary.topIdentity && summary.topIdentity.emoji ? <span aria-hidden="true">{summary.topIdentity.emoji} </span> : null}
          {summary.votesPhrase}
        </p>
        {summary.votes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">Agrega identidades en Ajustes.</p>
        ) : (
          <ul className="space-y-2.5">
            {summary.votes.map((r) => (
              <li key={r.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {r.emoji ? <span aria-hidden="true" className="mr-1.5">{r.emoji}</span> : null}
                    {r.label}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                    <span className="font-semibold text-fg">{r.votes}</span> {r.votes === 1 ? "voto" : "votos"}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(r.votes / maxVotes) * 100}%`, backgroundColor: `rgb(var(--c-${r.color}))` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bloques del resumen: entrenos, hábitos, dopamina y sueño */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Sesiones</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-accent">
            {summary.sessions.value}
            <span className="text-sm font-normal text-muted"> / {summary.sessions.goal}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted">Fitbit: {summary.minutes.value} min</div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Hábitos</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-good">
            {summary.habits.value}
            <span className="text-sm font-normal text-muted"> / {summary.habits.goal}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted">días obligatorios</div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Dopamina</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
            <span>
              <span className="font-mono text-xl font-semibold tabular-nums text-good">{summary.dopamine.good}</span>{" "}
              <span className="text-xs text-muted">{summary.dopamine.good === 1 ? "buena" : "buenas"}</span>
            </span>
            <span className="text-muted">·</span>
            <span>
              <span className="font-mono text-xl font-semibold tabular-nums text-warn">{summary.dopamine.cheap}</span>{" "}
              <span className="text-xs text-muted">{summary.dopamine.cheap === 1 ? "barata" : "baratas"}</span>
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted">registro semanal</div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Sueño</div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-cool">
            {summary.sleep.nights7h}
            <span className="text-sm font-normal text-muted"> {summary.sleep.nights7h === 1 ? "noche" : "noches"} ≥ 7 h</span>
          </div>
          <div className="mt-0.5 text-xs text-muted">
            Promedio: {summary.sleep.avgMin != null ? fmtSleep(summary.sleep.avgMin) : "Sin datos"}
          </div>
        </div>
      </section>

      {/* Frasco de logros */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Frasco de logros</h2>
          <span className="font-mono text-xs tabular-nums text-muted">
            {summary.wins.length} {summary.wins.length === 1 ? "logro" : "logros"}
          </span>
        </div>

        <form onSubmit={submitWin} className="mb-3 flex items-center gap-2">
          <input
            type="text"
            value={winText}
            onChange={(e) => setWinText(e.target.value)}
            placeholder="Anotar un logro"
            aria-label="Anotar un logro"
            className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-line bg-surface2 px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!winText.trim()}
            aria-label="Agregar logro al frasco"
            className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-xl border border-accent/40 bg-accent/15 text-accent transition hover:bg-accent/25 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus size={18} />
          </button>
        </form>

        {summary.wins.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
            Todavía no hay logros en el frasco esta semana.
          </p>
        ) : (
          <ul className="space-y-2">
            {summary.wins.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-fg">{w.text}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{fmtShort(w.date)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWins((all) => removeWin(all, w.id))}
                  aria-label={`Quitar logro: ${w.text}`}
                  className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-xl text-muted transition hover:bg-surface hover:text-warn"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Campos de reflexión con guardado automático */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Cierre de semana</h2>
          {saveStatus ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              {saveStatus === "Guardado" ? <Check size={13} className="text-good" /> : null}
              {saveStatus}
            </span>
          ) : null}
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="review-good" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Qué salió bien
            </label>
            <textarea
              id="review-good"
              rows={3}
              value={good}
              onChange={(e) => onFieldChange("good", e.target.value)}
              onBlur={flushSave}
              placeholder="Qué te funcionó esta semana, qué quieres repetir…"
              className="min-h-[88px] w-full rounded-xl border border-line bg-surface2 p-3 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="review-adjust" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Qué ajustar
            </label>
            <textarea
              id="review-adjust"
              rows={3}
              value={adjust}
              onChange={(e) => onFieldChange("adjust", e.target.value)}
              onBlur={flushSave}
              placeholder="Un ajuste pequeño para la próxima semana…"
              className="min-h-[88px] w-full rounded-xl border border-line bg-surface2 p-3 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
