import { useState } from "react";
import { Sparkles, Plus, ChevronRight } from "lucide-react";
import { dkey } from "../lib/dates.js";
import { addWin, winsForWeek, isSundayReviewPending, currentWeekMonday, weekKeys } from "../lib/review.js";

// Tarjeta en Inicio: muestra cuántos logros lleva el frasco esta semana,
// permite anotar uno rápido y abre la vista «Revisión semanal».
export function ReviewCard({ wins, setWins, reviews, onOpenReview }) {
  const [text, setText] = useState("");
  const now = new Date();
  const today = dkey(now);
  const mk = currentWeekMonday(now);
  const weekWins = winsForWeek(wins, weekKeys(mk));
  const sundayPending = isSundayReviewPending(reviews, now);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setWins((all) => addWin(all, text, today));
    setText("");
  };

  return (
    <section
      className={`rounded-2xl border p-4 transition ${
        sundayPending ? "border-accent bg-accent/10" : "border-line bg-surface"
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Revisión semanal</h2>
        {sundayPending ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent">
            <Sparkles size={12} />Domingo
          </span>
        ) : null}
      </div>

      <p className="text-sm text-muted">
        Frasco:{" "}
        <span className="font-mono font-semibold tabular-nums text-fg">{weekWins.length}</span>{" "}
        {weekWins.length === 1 ? "logro" : "logros"} esta semana
      </p>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Anotar un logro"
          aria-label="Anotar un logro"
          className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-line bg-surface2 px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Agregar logro al frasco"
          className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-xl border border-accent/40 bg-accent/15 text-accent transition hover:bg-accent/25 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
      </form>

      <button
        type="button"
        onClick={onOpenReview}
        className={`mt-3 flex min-h-[44px] w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
          sundayPending
            ? "bg-accent text-accentInk shadow-lg hover:brightness-105"
            : "border border-line bg-surface2 text-fg hover:border-accent hover:text-accent"
        }`}
      >
        <span>{sundayPending ? "Cerrar la semana" : "Abrir revisión"}</span>
        <ChevronRight size={16} />
      </button>
    </section>
  );
}
