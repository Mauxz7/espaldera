import { HeartPulse, ChevronDown } from "lucide-react";
import { usePersisted, DEFAULT_REPO, LS } from "../lib/storage.js";
import { fmtShort, dkey } from "../lib/dates.js";

const KIND = { run: "Running", bike: "Bici", walk: "Caminata", strength: "Fuerza", other: "Otro" };

// Entrenos de Fitbit (tareas S1 y S3). Camino: Fitbit → app Google Health → conexión oficial con Strava
// (sube cada entreno nuevo) → tarea «Strava» del repositorio privado → clave «workouts».
// (Atajos de iOS no puede leer entrenamientos de Apple Health: «Buscar muestras de salud» no trae ese tipo.)
export function HealthIntakeCard() {
  const [workouts] = usePersisted("workouts", []);
  const list = Array.isArray(workouts) ? workouts : [];
  const last = list[0];
  const repo = (LS.get("@gh") || {}).repo || DEFAULT_REPO;

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-display text-lg font-semibold uppercase tracking-wide">Entrenos de Fitbit</h2>
      <p className="text-sm text-muted">
        Google Health manda cada entreno de tu Fitbit a Strava, y una tarea de tu repositorio privado los trae aquí cuatro veces al día, en todos tus dispositivos. No necesitas usar Strava: solo sirve de puente.
      </p>
      <div className="mt-3 flex items-start gap-2 text-xs">
        <HeartPulse size={14} className={`mt-0.5 shrink-0 ${list.length ? "text-good" : "text-muted"}`} />
        {list.length ? (
          <span className="min-w-0 text-fg">
            {list.length} entrenos recibidos · último: {KIND[last.kind] || last.type} el {fmtShort(dkey(new Date(last.start)))}
            {last.min ? ` (${last.min} min)` : ""}
          </span>
        ) : (
          <span className="text-muted">Aún no llega ningún entreno. Conecta Strava con la guía de abajo.</span>
        )}
      </div>

      <details className="group mt-3 rounded-xl bg-surface2 p-3 text-xs text-muted">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-fg">
          Cómo conectarlo (una vez)
          <ChevronDown size={15} className="shrink-0 transition group-open:rotate-180" />
        </summary>
        <ol className="mt-2 list-decimal space-y-2 pl-4 leading-relaxed">
          <li>
            En la app <b className="text-fg">Google Health</b> del iPhone: ícono de <b className="text-fg">Conexiones</b> → <b className="text-fg">Strava</b> → sigue los pasos y deja activados los tipos de entreno que haces. Solo se suben los entrenos nuevos.
          </li>
          <li>
            En la compu, abre <code className="break-all font-mono text-fg">strava.com/settings/api</code> y crea una app: nombre «Espaldera», sitio <code className="font-mono text-fg">https://mauxz7.github.io/espaldera/</code> y <b className="text-fg">Authorization Callback Domain</b> = <code className="font-mono text-fg">localhost</code>.
          </li>
          <li>
            En la terminal, dentro de la carpeta del proyecto, corre <code className="font-mono text-fg">node scripts/strava-auth.mjs</code>. Pega el Client ID y el Client Secret y toca «Autorizar» en Strava. Los secretos se guardan solos en <code className="break-all font-mono text-fg">{repo}</code>.
          </li>
          <li>Haz un entreno con el Fitbit (o espera al próximo). Aparece aquí en unas horas, o al instante si lanzas la tarea «Strava» a mano en GitHub → Actions.</li>
        </ol>
        <p className="mt-2">Un mismo entreno nunca se duplica. Tus claves quedan solo en los secretos de tu repositorio privado.</p>
      </details>
    </section>
  );
}
