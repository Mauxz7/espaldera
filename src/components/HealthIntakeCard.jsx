import { HeartPulse, ChevronDown } from "lucide-react";
import { usePersisted, DEFAULT_REPO, LS } from "../lib/storage.js";
import { fmtShort, dkey } from "../lib/dates.js";

const KIND = { run: "Running", bike: "Bici", walk: "Caminata", strength: "Fuerza", other: "Otro" };

// Entrenos de Fitbit (tareas S1 y S3). Camino: Fitbit → Google Health → Google Health API (proyecto personal
// y gratuito de Google Cloud) → tarea «Google Health» del repositorio privado → clave «workouts».
// (Atajos de iOS no puede leer entrenamientos de Apple Health, y la API de Strava es de pago.)
export function HealthIntakeCard() {
  const [workouts] = usePersisted("workouts", []);
  const list = Array.isArray(workouts) ? workouts : [];
  const last = list[0];
  const repo = (LS.get("@gh") || {}).repo || DEFAULT_REPO;

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-display text-lg font-semibold uppercase tracking-wide">Entrenos de Fitbit</h2>
      <p className="text-sm text-muted">
        Una tarea de tu repositorio privado lee tus entrenos de Fitbit directo de Google Health cuatro veces al día, y aparecen aquí en todos tus dispositivos.
      </p>
      <div className="mt-3 flex items-start gap-2 text-xs">
        <HeartPulse size={14} className={`mt-0.5 shrink-0 ${list.length ? "text-good" : "text-muted"}`} />
        {list.length ? (
          <span className="min-w-0 text-fg">
            {list.length} entrenos recibidos · último: {KIND[last.kind] || last.type} el {fmtShort(dkey(new Date(last.start)))}
            {last.min ? ` (${last.min} min)` : ""}
          </span>
        ) : (
          <span className="text-muted">Aún no llega ningún entreno. Conéctalo con la guía de abajo.</span>
        )}
      </div>

      <details className="group mt-3 rounded-xl bg-surface2 p-3 text-xs text-muted">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-fg">
          Cómo conectarlo (una vez)
          <ChevronDown size={15} className="shrink-0 transition group-open:rotate-180" />
        </summary>
        <ol className="mt-2 list-decimal space-y-2 pl-4 leading-relaxed">
          <li>
            En la compu abre <code className="break-all font-mono text-fg">console.cloud.google.com</code> con tu cuenta de Google y crea un proyecto llamado «Espaldera». Es gratis: si en algún paso te pide tarjeta, detente.
          </li>
          <li>Menú → <b className="text-fg">APIs y servicios</b> → <b className="text-fg">Biblioteca</b> → busca «Google Health API» → <b className="text-fg">Habilitar</b>.</li>
          <li>
            <b className="text-fg">Pantalla de consentimiento</b> (Google Auth Platform): nombre «Espaldera», tipo <b className="text-fg">Externo</b>, tu correo. En <b className="text-fg">Público</b>, agrégate como usuario de prueba y luego toca <b className="text-fg">Publicar app</b> (si te deja; si no, la autorización vence cada 7 días y se renueva repitiendo el paso 5).
          </li>
          <li><b className="text-fg">Credenciales</b> → Crear credenciales → <b className="text-fg">ID de cliente de OAuth</b> → tipo <b className="text-fg">App de escritorio</b>. Deja abierta la ventana con el Client ID y el Client secret.</li>
          <li>
            En la terminal, dentro de la carpeta del proyecto, corre <code className="font-mono text-fg">node scripts/google-health-auth.mjs</code>, pega los dos datos y acepta en Google (si dice «no verificada»: Avanzado → Ir a Espaldera). Los secretos se guardan solos en <code className="break-all font-mono text-fg">{repo}</code>.
          </li>
          <li>Los entrenos aparecen aquí en unas horas, o al instante si lanzas la tarea «Google Health» a mano en GitHub → Actions.</li>
        </ol>
        <p className="mt-2">Un mismo entreno nunca se duplica. Tus claves quedan solo en los secretos de tu repositorio privado, y el permiso es de solo lectura.</p>
      </details>
    </section>
  );
}
