import { Watch, Eye, EyeOff, ChevronDown, ExternalLink } from "lucide-react";
import { usePersisted } from "../lib/storage.js";

export const DEFAULT_FITBIT_SHORTCUT_NAME = "Entreno Fitbit";

export const DEFAULT_FITBIT_SHORTCUT = {
  name: DEFAULT_FITBIT_SHORTCUT_NAME,
  hidden: false,
};

export function normalizeFitbitShortcut(cfg) {
  const rawName = cfg && typeof cfg.name === "string" ? cfg.name : DEFAULT_FITBIT_SHORTCUT_NAME;
  const cleanName = rawName.trim() || DEFAULT_FITBIT_SHORTCUT_NAME;
  return {
    name: cleanName,
    rawName,
    hidden: Boolean(cfg && cfg.hidden),
  };
}

export function buildFitbitShortcutUrl(name = DEFAULT_FITBIT_SHORTCUT_NAME) {
  const clean = typeof name === "string" && name.trim() ? name.trim() : DEFAULT_FITBIT_SHORTCUT_NAME;
  return `shortcuts://run-shortcut?name=${encodeURIComponent(clean)}`;
}

export function useFitbitShortcut() {
  const [raw, setRaw] = usePersisted("fitbitShortcut", DEFAULT_FITBIT_SHORTCUT);
  const cfg = normalizeFitbitShortcut(raw);
  return [cfg, setRaw];
}

export function FitbitShortcutCard() {
  const [cfg, setRaw] = useFitbitShortcut();
  const shortcutUrl = buildFitbitShortcutUrl(cfg.name);

  const setName = (value) => {
    setRaw({
      name: value,
      hidden: cfg.hidden,
    });
  };

  const commitName = () => {
    setRaw({
      name: cfg.name,
      hidden: cfg.hidden,
    });
  };

  const toggleHidden = () => {
    setRaw({
      name: cfg.name,
      hidden: !cfg.hidden,
    });
  };

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="mb-1 font-display text-lg font-semibold uppercase tracking-wide">Empezar con Fitbit</h2>
          <p className="text-sm text-muted">
            El botón del encabezado de tu rutina lanza un Atajo de iOS para abrir Fitbit e iniciar tu ejercicio sin salir a buscar la app.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <label className="block text-xs text-muted">
          Nombre del Atajo en iOS
          <input
            type="text"
            value={cfg.rawName}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            placeholder={DEFAULT_FITBIT_SHORTCUT_NAME}
            className="mt-1 w-full rounded-lg border border-line bg-surface2 px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleHidden}
            aria-pressed={!cfg.hidden}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              cfg.hidden
                ? "bg-surface2 text-muted hover:text-fg"
                : "border border-good/40 bg-good/15 text-good"
            }`}
          >
            {cfg.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            {cfg.hidden ? "Botón oculto en Entreno (toca para mostrar)" : "Visible en Entreno (toca para ocultar)"}
          </button>

          <a
            href={shortcutUrl}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface2 px-3 py-2 text-xs text-muted hover:text-fg"
          >
            <ExternalLink size={13} />
            Probar «{cfg.name}»
          </a>
        </div>
      </div>

      <details className="group mt-3 rounded-xl bg-surface2 p-3 text-xs text-muted">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-fg">
          <span className="inline-flex items-center gap-1.5">
            <Watch size={14} className=" shrink-0 text-accent" />
            Cómo crear el Atajo (1 minuto)
          </span>
          <ChevronDown size={15} className="shrink-0 transition group-open:rotate-180" />
        </summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 leading-relaxed">
          <li>
            Abre la app <b className="text-fg">Atajos</b> en tu iPhone o iPad y toca <b className="text-fg">+</b> para crear un atajo nuevo.
          </li>
          <li>
            Toca <b className="text-fg">Agregar acción</b> y elige <b className="text-fg">Abrir app</b> → <b className="text-fg">Fitbit</b> (o, si Fitbit ofrece en Atajos una acción para iniciar un ejercicio, usa esa).
          </li>
          <li>
            Arriba, cámbiale el nombre a <code className="font-mono text-fg">{cfg.name}</code> y toca <b className="text-fg">Listo</b>.
          </li>
          <li>
            Cuando toques <b className="text-fg">Empezar con Fitbit</b> en tu rutina, inicia el ejercicio en Fitbit y vuelve a Espaldera con el gesto de volver de iOS (deslizando la barra inferior o tocando volver arriba a la izquierda).
          </li>
        </ol>
        <p className="mt-2">
          En Mac o si el Atajo no existe no se rompe nada: el botón es solo un enlace (<code className="break-all font-mono text-fg">{shortcutUrl}</code>).
        </p>
      </details>
    </section>
  );
}
