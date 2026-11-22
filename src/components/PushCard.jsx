import { useEffect, useState } from "react";
import { BellRing, BellOff, Smartphone, Loader2 } from "lucide-react";
import { useSyncStatus } from "../lib/storage.js";
import { pushSupported, isStandalone, isIOS, currentSubscription, enablePush, disablePush } from "../lib/push.js";
import { Card, SectionTitle, StatusDot, btnCls } from "./ui.jsx";

const ERRORS = {
  "sin-sync": "Primero conecta la sincronización con GitHub (arriba): el aviso se guarda en tu repositorio privado.",
  "permiso-denied": "Bloqueaste las notificaciones. Actívalas en Ajustes del sistema → Notificaciones → Shift.",
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
    <div className="min-w-0">
      <SectionTitle>Avisos con la app cerrada</SectionTitle>
      <Card className="min-w-0">
        <p className="text-sm text-muted">
          Los hábitos con hora te avisan aunque Shift esté cerrada, cada hora hasta que los marques, de 6:00 a.m. a 11:45 p.m. Pueden llegar con unos minutos de retraso. Actívalo en cada dispositivo.
        </p>

        {needsInstall ? (
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-warn/12 p-3 text-xs text-warn">
            <Smartphone size={15} className="mt-0.5 shrink-0" />
            <span>En iPhone y iPad solo funciona con la app instalada: en Safari toca Compartir → «Agregar a pantalla de inicio» y abre Shift desde ese ícono.</span>
          </div>
        ) : !supported ? (
          <p className="mt-3 flex items-start gap-2 text-xs text-warn"><BellOff size={14} className="mt-0.5 shrink-0" />{ERRORS["no-soportado"]}</p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {state === "on" ? (
              <>
                <StatusDot tone="good">Activos en este dispositivo</StatusDot>
                <button onClick={() => run(disablePush, "off")} className={btnCls("ghost", "min-h-[40px] px-3.5 text-xs text-muted")}>Desactivar</button>
              </>
            ) : (
              <button
                onClick={() => run(enablePush, "on")}
                disabled={state !== "off" || sync.state === "off"}
                className={btnCls("ghost", "min-h-[44px] bg-accent/15 px-4 text-sm text-accent hover:bg-accent/25")}
              >
                {state === "busy" || state === "checking" ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />}
                Activar en este dispositivo
              </button>
            )}
          </div>
        )}
        {supported && !needsInstall && sync.state === "off" && state !== "on" && <p className="mt-2 text-xs text-muted">{ERRORS["sin-sync"]}</p>}
        {error && <p className="mt-2 text-xs text-warn">{error}</p>}
      </Card>
    </div>
  );
}
