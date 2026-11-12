import { HeartPulse, ChevronDown } from "lucide-react";
import { usePersisted, DEFAULT_REPO, LS } from "../lib/storage.js";
import { fmtShort, dkey } from "../lib/dates.js";

const KIND = { run: "Running", bike: "Bici", walk: "Caminata", strength: "Fuerza", other: "Otro" };

// Guía para armar el Atajo del iPhone que manda los entrenos de Apple Health (tarea S1).
// Google Health / Fitbit escribe los entrenos en Apple Health; el Atajo los lee y los deja
// en la bandeja del repositorio privado, donde una tarea de GitHub los pasa a la clave «workouts».
export function HealthIntakeCard() {
  const [workouts] = usePersisted("workouts", []);
  const list = Array.isArray(workouts) ? workouts : [];
  const last = list[0];
  const repo = (LS.get("@gh") || {}).repo || DEFAULT_REPO;
  const url = `https://api.github.com/repos/${repo}/contents/health/inbox/`;

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-display text-lg font-semibold uppercase tracking-wide">Entrenos de Apple Health</h2>
      <p className="text-sm text-muted">
        Fitbit/Google Health guarda tus entrenos en Apple Health. Un Atajo del iPhone los envía a tu repositorio privado y aparecen aquí en todos tus dispositivos.
      </p>
      <div className="mt-3 flex items-start gap-2 text-xs">
        <HeartPulse size={14} className={`mt-0.5 shrink-0 ${list.length ? "text-good" : "text-muted"}`} />
        {list.length ? (
          <span className="min-w-0 text-fg">
            {list.length} entrenos recibidos · último: {KIND[last.kind] || last.type} el {fmtShort(dkey(new Date(last.start)))}
            {last.min ? ` (${last.min} min)` : ""}
          </span>
        ) : (
          <span className="text-muted">Aún no llega ningún entreno. Arma el Atajo con la guía de abajo.</span>
        )}
      </div>

      <details className="group mt-3 rounded-xl bg-surface2 p-3 text-xs text-muted">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-fg">
          Cómo armar el Atajo (una vez, en el iPhone)
          <ChevronDown size={15} className="shrink-0 transition group-open:rotate-180" />
        </summary>
        <ol className="mt-2 list-decimal space-y-2 pl-4 leading-relaxed">
          <li>Abre <b className="text-fg">Atajos</b> → <b className="text-fg">+</b> y llámalo «Enviar entrenos a Espaldera».</li>
          <li>
            Agrega <b className="text-fg">Buscar muestras de salud</b>: tipo <b className="text-fg">Entrenamientos</b>, filtro «Fecha de inicio está en los últimos 7 días», ordenar por fecha de inicio, límite 50.
          </li>
          <li>
            Agrega <b className="text-fg">Repetir con cada</b> elemento. Dentro, una acción <b className="text-fg">Texto</b> con esta línea (toca «Elemento repetido» para elegir cada dato):
            <code className="mt-1 block break-words rounded-lg bg-surface p-2 font-mono text-[11px] text-fg">Tipo | Fecha de inicio | Fecha de finalización | Duración</code>
            En las dos fechas elige formato <b className="text-fg">ISO 8601</b> con hora. Deja las barras «|» tal cual.
          </li>
          <li>Después del bloque, agrega <b className="text-fg">Combinar texto</b> con «Nueva línea».</li>
          <li>Agrega <b className="text-fg">Codificar en Base64</b> (saltos de línea: Ninguno).</li>
          <li>
            Agrega <b className="text-fg">Fecha actual</b> y <b className="text-fg">Formatear fecha</b> con formato personalizado <code className="font-mono text-fg">yyyyMMdd-HHmmss</code>.
          </li>
          <li>
            Agrega <b className="text-fg">Obtener contenido de URL</b>:
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>URL: <code className="break-all font-mono text-fg">{url}</code> + la fecha formateada + <code className="font-mono text-fg">.txt</code></li>
              <li>Método: <b className="text-fg">PUT</b></li>
              <li>Encabezados: <code className="font-mono text-fg">Authorization</code> = <code className="font-mono text-fg">Bearer</code> + tu clave de GitHub (la misma que pegaste en Ajustes), y <code className="font-mono text-fg">Accept</code> = <code className="font-mono text-fg">application/vnd.github+json</code></li>
              <li>Cuerpo JSON: <code className="font-mono text-fg">message</code> = «entrenos» y <code className="font-mono text-fg">content</code> = el texto en Base64.</li>
            </ul>
          </li>
          <li>Pruébalo una vez con ▶. En un minuto los entrenos aparecen aquí.</li>
          <li>
            Para que sea automático: <b className="text-fg">Automatización</b> → <b className="text-fg">+</b> → «Hora del día», 9:30 p.m., diario, <b className="text-fg">Ejecutar inmediatamente</b>, y elige este atajo.
          </li>
        </ol>
        <p className="mt-2">Mandar la misma semana dos veces no duplica nada. Tu clave queda solo dentro del Atajo en tu iPhone.</p>
      </details>
    </section>
  );
}
