import { ChevronLeft, ChevronRight, AlertTriangle, BatteryCharging, Info, RefreshCw, ExternalLink, X } from "lucide-react";
import { dkey, fromKey, addDays, DAYS, fmtShort, hhmm } from "../lib/dates.js";
import { Ring, Card, SectionTitle } from "./ui.jsx";

function fmtHM(min) {
  if (typeof min !== "number" || !Number.isFinite(min) || min <= 0) return "—";
  const t = Math.round(min);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDayLabel(dateKey, todayKey = dkey()) {
  if (!dateKey) return "Hoy";
  if (dateKey === todayKey) return `Hoy · ${fmtShort(dateKey)}`;
  const yesterday = dkey(addDays(fromKey(todayKey), -1));
  if (dateKey === yesterday) return `Ayer · ${fmtShort(dateKey)}`;
  const d = fromKey(dateKey);
  const dow = DAYS[(d.getDay() + 6) % 7];
  return `${dow} · ${fmtShort(dateKey)}`;
}

export function recoveryTone(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "muted";
  if (score >= 67) return "good";
  if (score >= 34) return "accent";
  return "warn";
}

export function recoverySubtitle(rec, isToday = false) {
  if (!rec || rec.mode === "missing" || rec.score == null) return isToday ? "Esperando a Fitbit" : "Sin datos";
  if (rec.mode === "estimated") return "Estimada";
  if (rec.calibration === "ready") return "Base 60d";
  if (rec.calibration === "provisional") return "Provisional";
  return "Calibrando";
}

export function hasAnyBiometricVitals(vitals) {
  if (!vitals || typeof vitals !== "object") return false;
  return Object.values(vitals).some(
    (v) => v && typeof v === "object" && (
      (typeof v.hrv === "number" && v.hrv > 0)
      || (typeof v.rhr === "number" && v.rhr > 0)
    ),
  );
}

export function HealthRings({
  day,
  selectedDate,
  todayKey,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onToday,
  onOpenSheet,
  vitals,
  fitbitSync = null,
  onSyncFitbit = null,
  onDismissFitbitMessage = null,
  hasSyncConfig = false,
  onOpenSettings = null,
}) {
  const sleep = day?.sleep || null;
  const recovery = day?.recovery || null;
  const strain = day?.strain || null;
  const bank = day?.energyBank || null;

  const isToday = selectedDate === todayKey;
  const recScore = recovery && typeof recovery.score === "number" ? recovery.score : null;
  const recColor = recoveryTone(recScore);
  const recSub = recoverySubtitle(recovery, isToday);

  const sleepScore = sleep && typeof sleep.score === "number" ? sleep.score : null;
  const sleepSub = sleep && sleep.min > 0
    ? `${fmtHM(sleep.min)} / ${fmtHM(sleep.need?.needMin)}`
    : (sleep?.need?.needMin ? `Meta ${fmtHM(sleep.need.needMin)}` : "Sin registro");

  const strainScore = strain && typeof strain.score === "number" ? strain.score : 0;
  const strainTarget = strain?.target || { min: 35, max: 60, zone: "mid", label: "Moderado" };
  const strainSub = `Meta ${strainTarget.min}–${strainTarget.max}%`;

  const hasBiometrics = hasAnyBiometricVitals(vitals);

  const bankNow = bank && typeof bank.now === "number" ? bank.now : null;
  const bankStart = bank && typeof bank.start === "number" ? bank.start : null;
  const bankBarColor = bankNow == null
    ? "bg-muted"
    : bankNow >= 50
      ? "bg-good"
      : bankNow >= 25
        ? "bg-accent"
        : "bg-warn";
  const bankTextColor = bankNow == null
    ? "text-muted"
    : bankNow >= 50
      ? "text-good"
      : bankNow >= 25
        ? "text-accent"
        : "text-warn";

  const fitbitSyncing = Boolean(fitbitSync?.syncing);
  let fitbitStatusLabel = hasSyncConfig ? "Fitbit bajo demanda" : "Conecta GitHub en Ajustes";
  let fitbitStatusTone = "muted";
  if (fitbitSyncing) {
    fitbitStatusLabel = fitbitSync?.statusText || "Enviando…";
    fitbitStatusTone = "accent";
  } else if (fitbitSync?.statusText) {
    fitbitStatusLabel = fitbitSync.statusText;
    fitbitStatusTone = "good";
  } else if (fitbitSync?.lastSyncedAt) {
    fitbitStatusLabel = `Fitbit · ${hhmm(new Date(fitbitSync.lastSyncedAt))}`;
    fitbitStatusTone = "muted";
  }

  return (
    <div className="space-y-4">
      {/* Selector compacto de fecha (últimos 30 días) + sincronización Fitbit */}
      <div className="card space-y-2 px-2.5 py-2 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="flex min-w-0 items-center justify-between gap-2 sm:flex-1 sm:justify-start">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Día anterior"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-fg transition hover:bg-white/[0.12] hover:text-accent disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex min-w-0 items-center gap-2 text-center">
            <span className="truncate font-mono text-xs font-bold text-fg sm:text-sm">
              {formatDayLabel(selectedDate, todayKey)}
            </span>
            {!isToday && (
              <button
                type="button"
                onClick={onToday}
                className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/25"
              >
                Hoy
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            aria-label="Día siguiente"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-fg transition hover:bg-white/[0.12] hover:text-accent disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {onSyncFitbit && (
          <div className="flex min-w-0 items-center justify-between gap-2 border-t border-line pt-2 sm:shrink-0 sm:justify-end sm:border-t-0 sm:pt-0">
            <span
              role="status"
              aria-live="polite"
              className={`min-w-0 truncate text-xs ${
                fitbitStatusTone === "good"
                  ? "font-medium text-good"
                  : fitbitStatusTone === "accent"
                    ? "font-medium text-accent"
                    : "text-muted"
              }`}
            >
              {fitbitStatusLabel}
            </span>
            <button
              type="button"
              onClick={onSyncFitbit}
              disabled={fitbitSyncing}
              aria-busy={fitbitSyncing}
              className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-fg transition hover:bg-white/[0.14] hover:text-accent active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
            >
              <RefreshCw size={13} className={fitbitSyncing ? "animate-spin text-accent" : "text-accent"} />
              <span>Sincronizar Fitbit</span>
            </button>
          </div>
        )}
      </div>

      {/* Aviso discreto y accionable si falta permiso, falló el workflow o Fitbit aún no sube el sueño */}
      {fitbitSync?.error && (
        <div role="alert" className="rounded-2xl border border-warn/30 bg-warn/10 px-3.5 py-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="leading-relaxed text-fg/95">{fitbitSync.error.message}</p>
              <div className="flex flex-wrap items-center gap-2">
                {(fitbitSync.error.code === "forbidden" || fitbitSync.error.code === "unauthorized" || fitbitSync.error.code === "no_config") && onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="rounded-lg bg-warn/20 px-2.5 py-1 text-[11px] font-semibold text-warn transition hover:bg-warn/30"
                  >
                    Abrir Ajustes
                  </button>
                )}
                {fitbitSync.error.runUrl && (
                  <a
                    href={fitbitSync.error.runUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-fg/90 hover:bg-white/[0.14]"
                  >
                    <ExternalLink size={11} />Ver corrida en GitHub
                  </a>
                )}
              </div>
            </div>
            {onDismissFitbitMessage && (
              <button
                type="button"
                onClick={onDismissFitbitMessage}
                aria-label="Cerrar aviso"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-white/[0.08] hover:text-fg"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {!fitbitSync?.error && fitbitSync?.notice && (
        <div role="status" className="flex items-start gap-2.5 rounded-2xl bg-white/[0.05] px-3.5 py-3 text-xs text-muted">
          <Info size={15} className="mt-0.5 shrink-0 text-cool" />
          <p className="min-w-0 flex-1 leading-relaxed text-fg/90">{fitbitSync.notice.message}</p>
          {onDismissFitbitMessage && (
            <button
              type="button"
              onClick={onDismissFitbitMessage}
              aria-label="Cerrar aviso"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-white/[0.08] hover:text-fg"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Hero de 3 anillos interactivos */}
      <Card glow="good" className="p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-1 pt-1">
          <button
            type="button"
            onClick={() => onOpenSheet("recovery")}
            aria-label={`Recuperación: ${recScore != null ? `${recScore}%` : "sin datos"}. ${recSub}. Ver detalle`}
            className="flex min-w-0 flex-col items-center rounded-2xl px-1 py-2 transition hover:bg-white/[0.05] active:scale-[0.98]"
          >
            <Ring
              value={recScore}
              goal={100}
              display={recScore != null ? `${recScore}%` : "—"}
              srText=""
              label="Recuperación"
              sub={recSub}
              color={recColor}
              size="xl"
            />
          </button>

          <button
            type="button"
            onClick={() => onOpenSheet("sleep")}
            aria-label={`Sueño: ${sleepScore != null ? `${sleepScore}%` : "sin datos"}. ${sleepSub}. Ver detalle`}
            className="flex min-w-0 flex-col items-center rounded-2xl px-1 py-2 transition hover:bg-white/[0.05] active:scale-[0.98]"
          >
            <Ring
              value={sleepScore}
              goal={100}
              display={sleepScore != null ? `${sleepScore}%` : "—"}
              srText=""
              label="Sueño"
              sub={sleepSub}
              color={sleepScore == null ? "muted" : "sleep"}
              size="xl"
            />
          </button>

          <button
            type="button"
            onClick={() => onOpenSheet("strain")}
            aria-label={`Strain: ${strainScore}%. ${strainSub}. Ver detalle`}
            className="flex min-w-0 flex-col items-center rounded-2xl px-1 py-2 transition hover:bg-white/[0.05] active:scale-[0.98]"
          >
            <Ring
              value={strainScore}
              goal={100}
              display={`${strainScore}%`}
              srText=""
              label="Strain"
              sub={strainSub}
              color="strain"
              targetRange={{ min: strainTarget.min, max: strainTarget.max }}
              size="xl"
            />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          Toca un anillo para abrir el desglose y la tendencia de 14 días.
        </p>
      </Card>

      {/* Banner de alerta biométrica (biometrics_off) */}
      {recovery?.alert === "biometrics_off" && (
        <div role="alert" className="rounded-[22px] border border-warn/30 bg-warn/10 p-4 text-sm">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-warn">
                Señales biométricas fuera de rango{recovery.penalty > 0 ? ` (−${recovery.penalty} pts)` : ""}
              </div>
              {Array.isArray(recovery.alertReasons) && recovery.alertReasons.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-fg/90">
                  {recovery.alertReasons.map((reason) => (
                    <li key={reason}>· {reason}</li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-muted">
                Conviene bajar la carga hoy (meta de Strain {strainTarget.min}–{strainTarget.max}%), hidratarte bien y priorizar el sueño.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tarjeta compacta de Energy Bank */}
      <div>
        <SectionTitle aside={bankStart != null && bankNow != null ? `Inicio ${bankStart}%` : null}>Energy Bank</SectionTitle>
        <Card>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BatteryCharging size={18} className={bankTextColor} />
              <span className="text-sm font-semibold text-fg">Reserva del día</span>
            </div>
            {bankStart != null && bankNow != null ? (
              <div className="flex items-baseline gap-1.5 font-mono text-xs tabular-nums">
                <span className="text-muted">Inicio {bankStart}%</span>
                <span className="text-muted">→</span>
                <span className={`font-bold ${bankTextColor}`}>Ahora {bankNow}%</span>
              </div>
            ) : (
              <span className="text-xs text-muted">Sin datos de recuperación</span>
            )}
          </div>
          <div
            className="relative mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.07]"
            role="progressbar"
            aria-label="Energy Bank actual"
            aria-valuenow={bankNow ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {bankStart != null && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-fg/15"
                style={{ width: `${Math.min(100, Math.max(0, bankStart))}%` }}
              />
            )}
            {bankNow != null && (
              <div
                className={`relative h-full rounded-full transition-all duration-500 ${bankBarColor}`}
                style={{ width: `${Math.min(100, Math.max(0, bankNow))}%` }}
              />
            )}
          </div>
          <p className="mt-2 text-xs text-muted">
            {bankStart != null && bankNow != null
              ? "Arranca con tu Recuperación matutina y baja conforme acumulas Strain durante el día."
              : "Registra tu sueño o sincroniza Fitbit para calcular tu reserva diaria de energía."}
          </p>
        </Card>
      </div>

      {/* Aviso discreto si aún no hay vitals sincronizados */}
      {!hasBiometrics && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-white/[0.05] px-4 py-3 text-xs text-muted">
          <Info size={15} className="mt-0.5 shrink-0 text-cool" />
          <p className="min-w-0 leading-relaxed">
            La Recuperación está en modo <strong className="font-semibold text-fg">Estimada</strong> (sueño y carga reciente). Cuando actualices los scripts en <span className="font-mono text-fg/90">espaldera-data</span> y ejecutes <span className="font-mono text-fg/90">--solo-fitbit</span>, pasará automáticamente a biométrica real (HRV, RHR, SpO₂, FR y temperatura).
          </p>
        </div>
      )}
    </div>
  );
}
