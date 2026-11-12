import { useState } from "react";
import {
  Cloud,
  RefreshCw,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Bell,
} from "lucide-react";
import { DEFAULT_REPO, Sync, useSyncStatus } from "../lib/storage.js";
import { hhmm } from "../lib/dates.js";
import { DEFAULT_HABIT_DEFS, getHabitIcon } from "../data/habits.js";
import { PushCard } from "../components/PushCard.jsx";

export const SYNC_ERRORS = {
  401: "GitHub rechazó la clave: está mal copiada o venció. Pega una nueva.",
  403: "La clave no tiene permiso de lectura y escritura sobre ese repositorio.",
  404: "No encuentro el repositorio, o la clave no tiene acceso a él.",
  red: "Sin conexión. Tus cambios quedan guardados aquí y se envían al volver la red.",
};

export function SettingsView({ habitDefs, setHabitDefs, reminderCard }) {
  const st = useSyncStatus();
  const cfg = Sync.cfg();
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState((cfg && cfg.repo) || DEFAULT_REPO);
  const [checking, setChecking] = useState(null);

  // Gestión de hábitos
  const defs = habitDefs && habitDefs.length ? habitDefs : DEFAULT_HABIT_DEFS;
  const [editingId, setEditingId] = useState(null); // null | "new" | id
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({
    label: "",
    group: "req",
    kind: "check",
    target: 2,
    unit: "",
    remindAt: "",
  });

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

  const startNew = () => {
    setForm({
      label: "",
      group: "req",
      kind: "check",
      target: 2,
      unit: "",
      remindAt: "",
    });
    setEditingId("new");
  };

  const startEdit = (hb) => {
    setForm({
      label: hb.label,
      group: hb.group || "req",
      kind: hb.kind || "check",
      target: hb.target || (hb.kind === "count" ? 2 : 1),
      unit: hb.unit || "",
      remindAt: hb.remindAt || "",
    });
    setEditingId(hb.id);
  };

  const saveHabit = () => {
    if (!form.label.trim() || !setHabitDefs) return;
    const target = form.kind === "count" ? Math.max(1, parseInt(form.target, 10) || 1) : 1;
    const unit = form.kind === "count" ? (form.unit || "").trim() : "";
    const remindAt = form.remindAt ? form.remindAt.trim() : null;

    if (editingId === "new") {
      const prefix = form.group === "req" ? "o_" : "f_";
      const newHabit = {
        id: `${prefix}${Date.now().toString(36)}`,
        label: form.label.trim(),
        group: form.group,
        kind: form.kind,
        target,
        unit,
        remindAt,
        archived: false,
      };
      setHabitDefs([...defs, newHabit]);
    } else {
      setHabitDefs(defs.map((d) => {
        if (d.id !== editingId) return d;
        return {
          ...d,
          label: form.label.trim(),
          group: form.group,
          kind: form.kind,
          target,
          unit,
          remindAt,
        };
      }));
    }
    setEditingId(null);
  };

  const moveHabit = (id, direction) => {
    if (!setHabitDefs) return;
    const current = defs.find((d) => d.id === id);
    if (!current) return;
    const sameGroup = defs.filter((d) => !d.archived && d.group === current.group);
    const groupIdx = sameGroup.findIndex((d) => d.id === id);
    const targetGroupIdx = groupIdx + direction;
    if (targetGroupIdx < 0 || targetGroupIdx >= sameGroup.length) return;
    const targetItem = sameGroup[targetGroupIdx];

    const fromIdx = defs.findIndex((d) => d.id === id);
    const toIdx = defs.findIndex((d) => d.id === targetItem.id);
    const next = [...defs];
    const tmp = next[fromIdx];
    next[fromIdx] = next[toIdx];
    next[toIdx] = tmp;
    setHabitDefs(next);
  };

  const setArchived = (id, archived) => {
    if (!setHabitDefs) return;
    setHabitDefs(defs.map((d) => (d.id === id ? { ...d, archived } : d)));
  };

  const activeReq = defs.filter((d) => !d.archived && (!d.group || d.group === "req"));
  const activeOpt = defs.filter((d) => !d.archived && d.group === "opt");
  const archivedHabits = defs.filter((d) => d.archived);

  let line = "Sin conectar: los datos se guardan solo en este dispositivo.";
  let cls = "text-warn";
  if (cfg && st.state === "syncing") { line = "Sincronizando…"; cls = "text-muted"; }
  else if (cfg && st.state === "ok") { line = `Sincronizado a las ${hhmm(new Date(st.at))}`; cls = "text-good"; }
  else if (cfg && st.state === "error") { line = SYNC_ERRORS[st.code] || `GitHub respondió con el error ${st.code}.`; cls = "text-warn"; }
  else if (cfg) { line = "Conectado."; cls = "text-muted"; }

  const renderHabitRow = (hb, idx, totalInGroup, prefix) => {
    const Icon = getHabitIcon(hb);
    const isFirst = idx === 0;
    const isLast = idx === totalInGroup - 1;
    return (
      <div key={hb.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface2 p-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface text-muted">
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] font-semibold text-accent">{prefix}{idx + 1}</span>
            <span className="truncate text-sm font-medium text-fg">{hb.label}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            {hb.kind === "count" ? (
              <span className="font-mono text-accent">Meta: {hb.target}{hb.unit ? ` ${hb.unit}` : ""}</span>
            ) : (
              <span>Casilla</span>
            )}
            {hb.remindAt && (
              <span className="inline-flex items-center gap-0.5 font-mono text-muted">
                <Bell size={10} />{hb.remindAt}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => moveHabit(hb.id, -1)}
            disabled={isFirst}
            aria-label={`Subir ${hb.label}`}
            className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-muted hover:text-fg disabled:opacity-20"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => moveHabit(hb.id, 1)}
            disabled={isLast}
            aria-label={`Bajar ${hb.label}`}
            className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-muted hover:text-fg disabled:opacity-20"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            onClick={() => startEdit(hb)}
            aria-label={`Editar ${hb.label}`}
            className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-muted hover:text-fg"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => setArchived(hb.id, true)}
            aria-label={`Archivar ${hb.label}`}
            title="Archivar (no borra el historial)"
            className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-muted hover:text-warn"
          >
            <Archive size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Este dispositivo</div>
        <h1 className="font-display text-3xl font-semibold uppercase leading-none md:text-4xl">Ajustes</h1>
      </div>

      {/* Sección Hábitos */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Hábitos</h2>
            <p className="text-sm text-muted">Personaliza tus hábitos, cambia sus metas o agrega nuevos.</p>
          </div>
          {editingId === null && (
            <button
              onClick={startNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk"
            >
              <Plus size={14} />Nuevo hábito
            </button>
          )}
        </div>

        {/* Formulario de agregar o editar */}
        {editingId !== null && (
          <div className="mt-4 rounded-xl border border-accent/40 bg-surface2/80 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-accent">
                {editingId === "new" ? "Nuevo hábito" : "Editar hábito"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg p-1 text-muted hover:text-fg"
                aria-label="Cerrar formulario"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Nombre o descripción
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="ej. Comer una fruta."
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="block text-xs text-muted mb-1">Grupo</span>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, group: "req" })}
                    className={`rounded-md py-1.5 font-medium transition ${
                      form.group === "req" ? "bg-accent text-accentInk font-semibold" : "text-muted hover:text-fg"
                    }`}
                  >
                    Obligatorio
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, group: "opt" })}
                    className={`rounded-md py-1.5 font-medium transition ${
                      form.group === "opt" ? "bg-accent text-accentInk font-semibold" : "text-muted hover:text-fg"
                    }`}
                  >
                    Facultativo
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-xs text-muted mb-1">Tipo de registro</span>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, kind: "check" })}
                    className={`rounded-md py-1.5 font-medium transition ${
                      form.kind === "check" ? "bg-accent text-accentInk font-semibold" : "text-muted hover:text-fg"
                    }`}
                  >
                    Casilla
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, kind: "count" })}
                    className={`rounded-md py-1.5 font-medium transition ${
                      form.kind === "count" ? "bg-accent text-accentInk font-semibold" : "text-muted hover:text-fg"
                    }`}
                  >
                    Contador
                  </button>
                </div>
              </div>
            </div>

            {form.kind === "count" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-muted">Meta diaria
                  <input
                    type="number"
                    min="1"
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-fg focus:border-accent focus:outline-none"
                  />
                </label>
                <label className="block text-xs text-muted">Unidad (ej. botellas, vasos)
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="botellas"
                    className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
                  />
                </label>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs text-muted">Hora de recordatorio (opcional)</label>
                {form.remindAt && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, remindAt: "" })}
                    className="text-[11px] text-muted hover:text-warn"
                  >
                    Quitar hora
                  </button>
                )}
              </div>
              <input
                type="time"
                value={form.remindAt || ""}
                onChange={(e) => setForm({ ...form, remindAt: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-fg focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={saveHabit}
                disabled={!form.label.trim()}
                className="inline-flex items-center gap-1 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accentInk disabled:opacity-40"
              >
                <Check size={15} />Guardar hábito
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-xl bg-surface px-3.5 py-2 text-sm text-muted hover:text-fg"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Listas de hábitos */}
        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-good">
                Obligatorios ({activeReq.length})
              </span>
              <span className="text-[11px] text-muted">Definen el 100 % del día</span>
            </div>
            <div className="space-y-1.5">
              {activeReq.map((hb, i) => renderHabitRow(hb, i, activeReq.length, "O"))}
              {activeReq.length === 0 && (
                <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                  No tienes hábitos obligatorios activos.
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cool">
                Facultativos · bonus ({activeOpt.length})
              </span>
              <span className="text-[11px] text-muted">Bonus opcional</span>
            </div>
            <div className="space-y-1.5">
              {activeOpt.map((hb, i) => renderHabitRow(hb, i, activeOpt.length, "F"))}
              {activeOpt.length === 0 && (
                <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                  No tienes hábitos facultativos activos.
                </p>
              )}
            </div>
          </div>

          {/* Sección de archivados */}
          {archivedHabits.length > 0 && (
            <div className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className="flex w-full items-center justify-between text-xs font-semibold text-muted hover:text-fg"
              >
                <span>Hábitos archivados ({archivedHabits.length})</span>
                {showArchived ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showArchived && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[11px] text-muted mb-1">
                    Los hábitos archivados no aparecen en la lista diaria, pero conservan todo su historial.
                  </p>
                  {archivedHabits.map((hb) => (
                    <div
                      key={hb.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-line/60 bg-surface2/50 p-2.5 opacity-70"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-fg">{hb.label}</div>
                        <span className="text-[10px] text-muted">
                          {hb.group === "req" ? "Obligatorio" : "Facultativo"} · {hb.kind === "count" ? `Contador (meta ${hb.target})` : "Casilla"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setArchived(hb.id, false)}
                          aria-label={`Desarchivar ${hb.label}`}
                          title="Restaurar a hábitos activos"
                          className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 text-xs text-good hover:bg-good/10"
                        >
                          <ArchiveRestore size={13} />Desarchivar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

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
        <PushCard />
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
