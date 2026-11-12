import { useEffect, useState } from "react";
import { BellRing, BellOff, Smartphone, Loader2 } from "lucide-react";
import { useSyncStatus } from "../lib/storage.js";
import { pushSupported, isStandalone, isIOS, currentSubscription, enablePush, disablePush } from "../lib/push.js";

const ERRORS = {
  "sin-sync": "Primero conecta la sincronización con GitHub (arriba): el aviso se guarda en tu repositorio privado.",
  "permiso-denied": "Bloqueaste las notificaciones. Actívalas en Ajustes del sistema → Notificaciones → Espaldera.",
  "permiso-default": "No diste permiso. Vuelve a tocar «Activar» y elige «Permitir».",
  "no-soportado": "Este navegador no ofrece avisos con la app cerrada.",
};

export function PushCard() {
  const sync = useSyncStatus();
  const [state, setState] = useState("checking"); // checking | on | off | busy
  const [error, setError] = useState("");
  const supported = pushSupported();
  const needsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    let alive = true;
    currentSubscription()
      .then((s) => alive && setState(s ? "on" : "off"))
      .catch(() => alive && setState("off"));
    return () => { alive = false; };
  }, []);

  const run = async (fn, next) => {
    setError("");
    setState("busy");
    try {
      await fn();
      setState(next);
    } catch (e) {
      const code = (e && e.message) || "";
      setError(ERRORS[code] || (code.startsWith("gh-") ? `GitHub respondió ${code.slice(3)}. Revisa la clave de acceso.` : "No se pudo completar. Inténtalo de nuevo."));
      setState(await currentSubscription().then((s) => (s ? "on" : "off")).catch(() => "off"));
    }
  };

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-display text-lg font-semibold uppercase tracking-wide">Avisos con la app cerrada</h2>
      <p className="text-sm text-muted">
        Los hábitos con hora te avisan aunque Espaldera esté cerrada, cada hora hasta que los marques, de 6:00 a.m. a 11:45 p.m. Pueden llegar con unos minutos de retraso. Actívalo en cada dispositivo.
      </p>

      {needsInstall ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface2 p-3 text-xs text-warn">
          <Smartphone size={15} className="mt-0.5 shrink-0" />
          <span>En iPhone y iPad solo funciona con la app instalada: en Safari toca Compartir → «Agregar a pantalla de inicio» y abre Espaldera desde ese ícono.</span>
        </div>
      ) : !supported ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-warn"><BellOff size={14} className="mt-0.5 shrink-0" />{ERRORS["no-soportado"]}</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {state === "on" ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-good"><BellRing size={15} />Activos en este dispositivo</span>
              <button onClick={() => run(disablePush, "off")} className="rounded-xl bg-surface2 px-3 py-1.5 text-xs text-muted hover:text-fg">Desactivar</button>
            </>
          ) : (
            <button
              onClick={() => run(enablePush, "on")}
              disabled={state !== "off" || sync.state === "off"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk disabled:opacity-40"
            >
              {state === "busy" || state === "checking" ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
              Activar en este dispositivo
            </button>
          )}
        </div>
      )}
      {supported && !needsInstall && sync.state === "off" && state !== "on" && <p className="mt-2 text-[11px] text-muted">{ERRORS["sin-sync"]}</p>}
      {error && <p className="mt-2 text-xs text-warn">{error}</p>}
    </section>
  );
}
