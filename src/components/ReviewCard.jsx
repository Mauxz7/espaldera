import { useState } from "react";
import { Sparkles, Plus, ChevronRight } from "lucide-react";
import { dkey } from "../lib/dates.js";
import { addWin, winsForWeek, isSundayReviewPending, currentWeekMonday, weekKeys } from "../lib/review.js";
import { Card, SectionTitle, Chip, btnCls } from "./ui.jsx";

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
    <div>
      <SectionTitle
        aside={
          sundayPending ? (
            <Chip tone="accent">
              <Sparkles size={12} />Domingo
            </Chip>
          ) : null
        }
      >
        Revisión semanal
      </SectionTitle>
      <Card className={sundayPending ? "ring-1 ring-inset ring-accent/40" : ""}>
        <p className="text-sm text-muted">
          Frasco:{" "}
          <span className="font-mono font-bold tabular-nums text-fg">{weekWins.length}</span>{" "}
          {weekWins.length === 1 ? "logro" : "logros"} esta semana
        </p>

        <form onSubmit={submit} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Anotar un logro"
            aria-label="Anotar un logro"
            className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-line bg-white/[0.06] px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Agregar logro al frasco"
            className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-xl bg-accent/15 text-accent transition hover:bg-accent/25 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus size={18} />
          </button>
        </form>

        <button
          type="button"
          onClick={onOpenReview}
          className={btnCls("ghost", sundayPending ? "mt-3 w-full justify-between bg-accent/15 text-accent hover:bg-accent/25" : "mt-3 w-full justify-between")}
        >
          <span>{sundayPending ? "Cerrar la semana" : "Abrir revisión"}</span>
          <ChevronRight size={16} />
        </button>
      </Card>
    </div>
  );
}
