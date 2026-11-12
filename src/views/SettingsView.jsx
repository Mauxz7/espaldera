import { useState } from "react";
import { Cloud, RefreshCw } from "lucide-react";
import { DEFAULT_REPO, Sync, useSyncStatus } from "../lib/storage.js";
import { hhmm } from "../lib/dates.js";

export const SYNC_ERRORS = {
  401: "GitHub rechazó la clave: está mal copiada o venció. Pega una nueva.",
  403: "La clave no tiene permiso de lectura y escritura sobre ese repositorio.",
  404: "No encuentro el repositorio, o la clave no tiene acceso a él.",
  red: "Sin conexión. Tus cambios quedan guardados aquí y se envían al volver la red.",
};

export function SettingsView({ reminderCard }) {
  const st = useSyncStatus();
  const cfg = Sync.cfg();
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState((cfg && cfg.repo) || DEFAULT_REPO);
  const [checking, setChecking] = useState(null);
  const connect = async () => { if (!token.trim() || !repo.trim()) return; await Sync.connect(token.trim(), repo.trim()); setToken(""); };
  const checkUpdate = async () => {
    setChecking("Buscando…");
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (!reg) { setChecking("Las actualizaciones automáticas se activan al abrirla desde su dirección web."); return; }
      await reg.update();
      setChecking(reg.installing || reg.waiting ? "Hay una versión nueva: se instala sola en unos segundos." : "Ya tienes la última versión.");
    } catch (e) { setChecking("No se pudo comprobar. Revisa tu conexión."); }
  };
  let line = "Sin conectar: los datos se guardan solo en este dispositivo.";
  let cls = "text-warn";
  if (cfg && st.state === "syncing") { line = "Sincronizando…"; cls = "text-muted"; }
  else if (cfg && st.state === "ok") { line = `Sincronizado a las ${hhmm(new Date(st.at))}`; cls = "text-good"; }
  else if (cfg && st.state === "error") { line = SYNC_ERRORS[st.code] || `GitHub respondió con el error ${st.code}.`; cls = "text-warn"; }
  else if (cfg) { line = "Conectado."; cls = "text-muted"; }
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Este dispositivo</div>
        <h1 className="font-display text-3xl font-semibold uppercase leading-none md:text-4xl">Ajustes</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-1 font-display text-lg font-semibold uppercase tracking-wide">Sincronizar dispositivos</h2>
          <p className="text-sm text-muted">Tus datos viajan entre Mac, iPad y iPhone por un repositorio privado de tu GitHub. Pega la misma clave en cada dispositivo, una sola vez.</p>
          <p className={`mt-3 text-xs ${cls}`} role="status">{line}</p>
          {cfg ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => Sync.run()} disabled={st.state === "syncing"} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk disabled:opacity-40"><RefreshCw size={15} className={st.state === "syncing" ? "animate-spin" : ""} />Sincronizar ahora</button>
              <button onClick={() => Sync.disconnect()} className="rounded-xl bg-surface2 px-3.5 py-2 text-sm text-muted hover:text-fg">Desconectar este dispositivo</button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-muted">Repositorio privado
                <input value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} className="mt-1 w-full rounded-lg border border-line bg-surface2 px-3 py-2 font-mono text-sm text-fg focus:border-accent focus:outline-none" />
              </label>
              <label className="block text-xs text-muted">Clave de acceso de GitHub
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" placeholder="github_pat_…" className="mt-1 w-full rounded-lg border border-line bg-surface2 px-3 py-2 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none" />
              </label>
              <button onClick={connect} disabled={!token.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk disabled:opacity-40"><Cloud size={15} />Conectar</button>
              <p className="text-[11px] text-muted">La clave se guarda solo en este dispositivo y solo se envía a GitHub.</p>
            </div>
          )}
        </section>
        {reminderCard}
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-1 font-display text-lg font-semibold uppercase tracking-wide">Versión</h2>
          <p className="text-sm text-muted">La app se actualiza sola en todos tus dispositivos cuando hay cambios.</p>
          <p className="mt-2 font-mono text-xs text-muted">Versión {typeof __BUILD__ === "string" ? __BUILD__ : "local"}</p>
          <button onClick={checkUpdate} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-surface2 px-3.5 py-2 text-sm text-muted hover:text-fg"><RefreshCw size={15} />Buscar actualización</button>
          {checking && <p className="mt-2 text-xs text-muted" role="status">{checking}</p>}
        </section>
      </div>
    </div>
  );
}
