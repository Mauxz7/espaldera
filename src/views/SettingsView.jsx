import { useState, useEffect } from "react";
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
  HeartPulse,
  RotateCcw,
} from "lucide-react";
import { DEFAULT_REPO, Sync, useSyncStatus, usePersisted } from "../lib/storage.js";
import { hhmm } from "../lib/dates.js";
import { DEFAULT_HABIT_DEFS, getHabitIcon } from "../data/habits.js";
import { DEFAULT_IDENTITIES, habitIdentity } from "../data/identities.js";
import { DEFAULT_DOPAMINE_DEFS } from "../data/dopamine.js";
import { normalizeIdentities } from "../lib/identity.js";
import { DEFAULT_HEALTH_PREFS, normalizeHealthPrefs } from "../lib/bevel.js";
import { IdentityEditor } from "../components/IdentityEditor.jsx";
import { DopamineEditor } from "../components/DopamineEditor.jsx";
import { PushCard } from "../components/PushCard.jsx";
import { HealthIntakeCard } from "../components/HealthIntakeCard.jsx";
import { FitbitShortcutCard } from "../components/FitbitShortcutCard.jsx";
import { Card, SectionTitle, StatusDot, btnCls } from "../components/ui.jsx";

export const SYNC_ERRORS = {
  401: "GitHub rechazó la clave: está mal copiada o venció. Pega una nueva.",
  403: "La clave no tiene permiso de lectura y escritura sobre ese repositorio.",
  404: "No encuentro el repositorio, o la clave no tiene acceso a él.",
  red: "Sin conexión. Tus cambios quedan guardados aquí y se envían al volver la red.",
};

function HealthPrefsCard({ healthPrefs, setHealthPrefs }) {
  const norm = normalizeHealthPrefs(healthPrefs);
  const [sleepH, setSleepH] = useState(String(Math.floor(norm.sleepBaseMin / 60)));
  const [sleepM, setSleepM] = useState(String(norm.sleepBaseMin % 60));
  const [age, setAge] = useState(norm.age != null ? String(norm.age) : "");
  const [maxHr, setMaxHr] = useState(norm.maxHr != null ? String(norm.maxHr) : "");

  useEffect(() => {
    const n = normalizeHealthPrefs(healthPrefs);
    setSleepH(String(Math.floor(n.sleepBaseMin / 60)));
    setSleepM(String(n.sleepBaseMin % 60));
    setAge(n.age != null ? String(n.age) : "");
    setMaxHr(n.maxHr != null ? String(n.maxHr) : "");
  }, [healthPrefs]);

  const commit = (patch) => {
    if (!setHealthPrefs) return;
    const next = normalizeHealthPrefs({
      sleepBaseMin: norm.sleepBaseMin,
      age: norm.age,
      maxHr: norm.maxHr,
      hrvKind: norm.hrvKind,
      ...patch,
    });
    setHealthPrefs({
      sleepBaseMin: next.sleepBaseMin,
      age: next.age,
      maxHr: next.maxHr,
      hrvKind: next.hrvKind,
    });
  };

  const onSleepChange = (nextH, nextM) => {
    setSleepH(nextH);
    setSleepM(nextM);
    const h = parseInt(nextH, 10);
    const m = nextM === "" ? 0 : parseInt(nextM, 10);
    if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) return;
    const total = Math.max(240, Math.min(720, h * 60 + m));
    commit({ sleepBaseMin: total });
  };

  const onAgeChange = (val) => {
    setAge(val);
    if (val.trim() === "") {
      commit({ age: null });
      return;
    }
    const n = parseInt(val, 10);
    if (Number.isFinite(n) && n >= 10 && n <= 110) commit({ age: n });
  };

  const onMaxHrChange = (val) => {
    setMaxHr(val);
    if (val.trim() === "") {
      commit({ maxHr: null });
      return;
    }
    const n = parseInt(val, 10);
    if (Number.isFinite(n) && n >= 120 && n <= 230) commit({ maxHr: n });
  };

  const resetDefaults = () => {
    if (!setHealthPrefs) return;
    setHealthPrefs({ ...DEFAULT_HEALTH_PREFS });
  };

  const isDefault = norm.sleepBaseMin === DEFAULT_HEALTH_PREFS.sleepBaseMin
    && norm.age === DEFAULT_HEALTH_PREFS.age
    && norm.maxHr === DEFAULT_HEALTH_PREFS.maxHr;

  const maxHrSource = norm.maxHr != null
    ? "manual"
    : norm.age != null
      ? "208 − 0.7 × edad"
      : "valor por defecto";

  const inputCls = "mt-1 w-full min-w-0 rounded-xl border border-line bg-white/[0.06] px-3 py-2 font-mono text-sm font-bold tabular-nums text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none";

  return (
    <div>
      <SectionTitle
        aside={
          <button
            type="button"
            onClick={resetDefaults}
            disabled={isDefault}
            className="inline-flex items-center gap-1 rounded-xl bg-white/[0.07] px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-white/[0.12] hover:text-fg disabled:opacity-40"
          >
            <RotateCcw size={13} />Restablecer
          </button>
        }
      >
        Metas de salud (Bevel)
      </SectionTitle>
      <Card className="min-w-0">
        <div className="flex items-start gap-2">
          <HeartPulse size={16} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-sm text-muted">
            Ajusta tu sueño base y tu FC máxima para calibrar Sleep Need y Strain. Los cambios se guardan al instante.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="min-w-0">
            <span className="block text-xs text-muted">Sueño base diario</span>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="min-w-0">
                <span className="sr-only">Horas de sueño base</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="4"
                  max="12"
                  value={sleepH}
                  onChange={(e) => onSleepChange(e.target.value, sleepM)}
                  placeholder="7"
                  aria-label="Horas de sueño base"
                  className={inputCls}
                />
                <span className="mt-0.5 block text-[10px] text-muted">horas</span>
              </label>
              <label className="min-w-0">
                <span className="sr-only">Minutos de sueño base</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="59"
                  step="5"
                  value={sleepM}
                  onChange={(e) => onSleepChange(sleepH, e.target.value)}
                  placeholder="30"
                  aria-label="Minutos de sueño base"
                  className={inputCls}
                />
                <span className="mt-0.5 block text-[10px] text-muted">min</span>
              </label>
            </div>
          </div>

          <label className="block min-w-0 text-xs text-muted">
            Edad (opcional)
            <input
              type="number"
              inputMode="numeric"
              min="10"
              max="110"
              value={age}
              onChange={(e) => onAgeChange(e.target.value)}
              placeholder="ej. 30"
              className={inputCls}
            />
            <span className="mt-0.5 block text-[10px] text-muted">Para estimar FC máx.</span>
          </label>

          <label className="block min-w-0 text-xs text-muted">
            FC máxima manual (opcional)
            <input
              type="number"
              inputMode="numeric"
              min="120"
              max="230"
              value={maxHr}
              onChange={(e) => onMaxHrChange(e.target.value)}
              placeholder="ej. 188"
              className={inputCls}
            />
            <span className="mt-0.5 block text-[10px] text-muted">lpm (120–230)</span>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.05] px-3.5 py-2.5 text-xs">
          <span className="text-muted">FC máx. efectiva</span>
          <span className="font-mono font-bold tabular-nums text-fg">
            {norm.effectiveMaxHr} lpm <span className="font-sans font-normal text-muted">({maxHrSource})</span>
          </span>
        </div>
      </Card>
    </div>
  );
}

export function SettingsView({ habitDefs, setHabitDefs, reminderCard, healthPrefs, setHealthPrefs }) {
  const st = useSyncStatus();
  const cfg = Sync.cfg();
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState((cfg && cfg.repo) || DEFAULT_REPO);
  const [checking, setChecking] = useState(null);

  // Gestión de hábitos
  const defs = habitDefs && habitDefs.length ? habitDefs : DEFAULT_HABIT_DEFS;
  const [editingId, setEditingId] = useState(null); // null | "new" | id
  const [showArchived, setShowArchived] = useState(false);
  const [identities, setIdentities] = usePersisted("identities", DEFAULT_IDENTITIES);
  const [dopamineDefs, setDopamineDefs] = usePersisted("dopamineDefs", DEFAULT_DOPAMINE_DEFS);
  const idList = normalizeIdentities(identities);
  const identityOf = (hb) => idList.find((it) => it.id === habitIdentity(hb)) || null;
  const [form, setForm] = useState({
    label: "",
    group: "req",
    kind: "check",
    target: 2,
    unit: "",
    remindAt: "",
    identity: "",
    after: "",
    mini: "",
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
      identity: "",
      after: "",
      mini: "",
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
      identity: (identityOf(hb) || {}).id || "",
      after: hb.after || "",
      mini: hb.mini || "",
    });
    setEditingId(hb.id);
  };

  const saveHabit = () => {
    if (!form.label.trim() || !setHabitDefs) return;
    const target = form.kind === "count" ? Math.max(1, parseInt(form.target, 10) || 1) : 1;
    const unit = form.kind === "count" ? (form.unit || "").trim() : "";
    const remindAt = form.remindAt ? form.remindAt.trim() : null;
    const identity = form.identity || null;
    const after = form.after ? form.after.trim() : null;
    const mini = form.mini ? form.mini.trim() : null;

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
        identity,
        after,
        mini,
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
          identity,
          after,
          mini,
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
  let syncTone = "warn";
  if (cfg && st.state === "syncing") { line = "Sincronizando…"; syncTone = "muted"; }
  else if (cfg && st.state === "ok") { line = `Sincronizado a las ${hhmm(new Date(st.at))}`; syncTone = "good"; }
  else if (cfg && st.state === "error") { line = SYNC_ERRORS[st.code] || `GitHub respondió con el error ${st.code}.`; syncTone = "warn"; }
  else if (cfg) { line = "Conectado."; syncTone = "muted"; }

  const renderHabitRow = (hb, idx, totalInGroup, prefix) => {
    const Icon = getHabitIcon(hb);
    const isFirst = idx === 0;
    const isLast = idx === totalInGroup - 1;
    return (
      <div key={hb.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-2 py-3 first:pt-0 last:pb-0 sm:flex-nowrap">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-muted">
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1 basis-[12rem]">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] font-bold text-accent">{prefix}{idx + 1}</span>
            <span className="text-sm font-medium leading-snug text-fg sm:truncate">{hb.label}</span>
          </div>
          {hb.after && hb.after.trim() && (
            <div className="truncate text-xs text-muted">{hb.after.trim()}</div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            {hb.kind === "count" ? (
              <span className="font-mono font-semibold text-accent">Meta: {hb.target}{hb.unit ? ` ${hb.unit}` : ""}</span>
            ) : (
              <span>Casilla</span>
            )}
            {hb.mini && hb.mini.trim() && (
              <span>2 min: {hb.mini.trim()}</span>
            )}
            {hb.remindAt && (
              <span className="inline-flex items-center gap-0.5 font-mono text-muted">
                <Bell size={10} />{hb.remindAt}
              </span>
            )}
            {identityOf(hb) && (
              <span>{identityOf(hb).emoji ? `${identityOf(hb).emoji} ` : ""}{identityOf(hb).label}</span>
            )}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => moveHabit(hb.id, -1)}
            disabled={isFirst}
            aria-label={`Subir ${hb.label}`}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg disabled:opacity-20"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => moveHabit(hb.id, 1)}
            disabled={isLast}
            aria-label={`Bajar ${hb.label}`}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg disabled:opacity-20"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            onClick={() => startEdit(hb)}
            aria-label={`Editar ${hb.label}`}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => setArchived(hb.id, true)}
            aria-label={`Archivar ${hb.label}`}
            title="Archivar (no borra el historial)"
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-warn"
          >
            <Archive size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="px-1">
        <div className="text-[13px] font-medium text-muted">Este dispositivo</div>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">Ajustes</h1>
      </div>

      {/* Sección Hábitos */}
      <div>
        <SectionTitle>Hábitos</SectionTitle>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-sm text-muted">Personaliza tus hábitos, cambia sus metas o agrega nuevos.</p>
            {editingId === null && (
              <button
                onClick={startNew}
                className={btnCls("ghost", "min-h-[44px] px-4 text-sm")}
              >
                <Plus size={15} />Nuevo hábito
              </button>
            )}
          </div>

          {/* Formulario de agregar o editar */}
          {editingId !== null && (
            <div className="mt-4 space-y-3 rounded-2xl border border-accent/30 bg-white/[0.05] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold tracking-tight text-accent">
                  {editingId === "new" ? "Nuevo hábito" : "Editar hábito"}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="grid h-9 w-9 place-items-center rounded-xl text-muted hover:text-fg"
                  aria-label="Cerrar formulario"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted">Nombre o descripción
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="ej. Comer una fruta."
                    className="mt-1 w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs text-muted">Grupo</span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.06] p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, group: "req" })}
                      className={`rounded-lg py-1.5 font-medium transition ${
                        form.group === "req" ? "bg-accent text-accentInk font-semibold" : "text-muted hover:text-fg"
                      }`}
                    >
                      Obligatorio
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, group: "opt" })}
                      className={`rounded-lg py-1.5 font-medium transition ${
                        form.group === "opt" ? "bg-accent text-accentInk font-semibold" : "text-muted hover:text-fg"
                      }`}
                    >
                      Facultativo
                    </button>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-xs text-muted">Tipo de registro</span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.06] p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, kind: "check" })}
                      className={`rounded-lg py-1.5 font-medium transition ${
                        form.kind === "check" ? "bg-accent text-accentInk font-semibold" : "text-muted hover:text-fg"
                      }`}
                    >
                      Casilla
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, kind: "count" })}
                      className={`rounded-lg py-1.5 font-medium transition ${
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
                      className="mt-1 w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2 font-mono text-sm font-bold text-fg focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="block text-xs text-muted">Unidad (ej. botellas, vasos)
                    <input
                      type="text"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      placeholder="botellas"
                      className="mt-1 w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
                    />
                  </label>
                </div>
              )}

              <label className="block text-xs text-muted">Apilar después de (opcional)
                <input
                  type="text"
                  value={form.after}
                  onChange={(e) => setForm({ ...form, after: e.target.value })}
                  placeholder="ej. Después de lavarme los dientes"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
                />
              </label>

              <label className="block text-xs text-muted">Versión de 2 minutos (opcional)
                <input
                  type="text"
                  value={form.mini}
                  onChange={(e) => setForm({ ...form, mini: e.target.value })}
                  placeholder="ej. Leer 1 página"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
                />
              </label>

              <label className="block text-xs text-muted">Identidad (cada vez que lo cumples es un voto)
                <select
                  value={form.identity}
                  onChange={(e) => setForm({ ...form, identity: e.target.value })}
                  className="mt-1 h-11 w-full rounded-xl border border-line bg-white/[0.06] px-3 text-sm text-fg focus:border-accent focus:outline-none"
                >
                  <option value="">Sin identidad (no vota)</option>
                  {idList.map((it) => (
                    <option key={it.id} value={it.id}>{it.emoji ? `${it.emoji} ` : ""}{it.label}</option>
                  ))}
                </select>
              </label>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs text-muted">Hora de recordatorio (opcional)</label>
                  {form.remindAt && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, remindAt: "" })}
                      className="text-xs text-muted hover:text-warn"
                    >
                      Quitar hora
                    </button>
                  )}
                </div>
                <input
                  type="time"
                  value={form.remindAt || ""}
                  onChange={(e) => setForm({ ...form, remindAt: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2 font-mono text-sm text-fg focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={saveHabit}
                  disabled={!form.label.trim()}
                  className={btnCls("primary", "min-h-[44px] px-4 text-sm")}
                >
                  <Check size={15} />Guardar hábito
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className={btnCls("ghost", "min-h-[44px] px-4 text-sm text-muted")}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Listas de hábitos */}
          <div className="mt-4 space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-good">
                  Obligatorios ({activeReq.length})
                </span>
                <span className="text-xs text-muted">Definen el 100 % del día</span>
              </div>
              <div className="divide-y divide-line">
                {activeReq.map((hb, i) => renderHabitRow(hb, i, activeReq.length, "O"))}
                {activeReq.length === 0 && (
                  <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
                    No tienes hábitos obligatorios activos.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-line pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-cool">
                  Facultativos · bonus ({activeOpt.length})
                </span>
                <span className="text-xs text-muted">Bonus opcional</span>
              </div>
              <div className="divide-y divide-line">
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
                  <div className="mt-2">
                    <p className="mb-2 text-xs text-muted">
                      Los hábitos archivados no aparecen en la lista diaria, pero conservan todo su historial.
                    </p>
                    <div className="divide-y divide-line">
                      {archivedHabits.map((hb) => (
                        <div
                          key={hb.id}
                          className="flex items-center justify-between gap-2 py-2.5 opacity-75 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-fg">{hb.label}</div>
                            <span className="text-[11px] text-muted">
                              {hb.group === "req" ? "Obligatorio" : "Facultativo"} · {hb.kind === "count" ? `Contador (meta ${hb.target})` : "Casilla"}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setArchived(hb.id, false)}
                              aria-label={`Desarchivar ${hb.label}`}
                              title="Restaurar a hábitos activos"
                              className="inline-flex items-center gap-1 rounded-xl bg-good/15 px-3 py-1.5 text-xs font-semibold text-good hover:bg-good/25"
                            >
                              <ArchiveRestore size={13} />Desarchivar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <IdentityEditor identities={identities} setIdentities={setIdentities} />

      <DopamineEditor defs={dopamineDefs} setDefs={setDopamineDefs} identities={idList} />

      <HealthPrefsCard healthPrefs={healthPrefs} setHealthPrefs={setHealthPrefs} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionTitle>Sincronizar dispositivos</SectionTitle>
          <Card className="min-w-0">
            <p className="text-sm text-muted">Tus datos viajan entre Mac, iPad y iPhone por un repositorio privado de tu GitHub. Pega la misma clave en cada dispositivo, una sola vez.</p>
            <div className="mt-3" role="status"><StatusDot tone={syncTone}>{line}</StatusDot></div>
            {cfg ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => Sync.run()} disabled={st.state === "syncing"} className={btnCls("primary")}><RefreshCw size={15} className={st.state === "syncing" ? "animate-spin" : ""} />Sincronizar ahora</button>
                <button onClick={() => Sync.disconnect()} className={btnCls("ghost", "text-muted")}>Desconectar este dispositivo</button>
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                <label className="block text-xs text-muted">Repositorio privado
                  <input value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} className="mt-1 w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2.5 font-mono text-sm text-fg focus:border-accent focus:outline-none" />
                </label>
                <label className="block text-xs text-muted">Clave de acceso de GitHub
                  <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" placeholder="github_pat_…" className="mt-1 w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2.5 font-mono text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none" />
                </label>
                <button onClick={connect} disabled={!token.trim()} className={btnCls("primary")}><Cloud size={15} />Conectar</button>
                <p className="text-xs text-muted">La clave se guarda solo en este dispositivo y solo se envía a GitHub.</p>
              </div>
            )}
            <p className="mt-3 rounded-2xl bg-white/[0.05] px-3.5 py-2.5 text-xs leading-relaxed text-muted">
              Activa el permiso <strong className="font-semibold text-fg">Actions: Read and write</strong> en tu token de GitHub para habilitar el botón <strong className="font-semibold text-fg">«Sincronizar Fitbit»</strong> desde la pestaña Salud.
            </p>
          </Card>
        </div>
        {reminderCard}
        <PushCard />
        <HealthIntakeCard />
        <FitbitShortcutCard />
        <div className="min-w-0">
          <SectionTitle>Versión</SectionTitle>
          <Card className="min-w-0">
            <p className="text-sm text-muted">La app se actualiza sola en todos tus dispositivos cuando hay cambios.</p>
            <p className="mt-2 font-mono text-xs text-muted">Versión {typeof __BUILD__ === "string" ? __BUILD__ : "local"}</p>
            <button onClick={checkUpdate} className={btnCls("ghost", "mt-3")}><RefreshCw size={15} />Buscar actualización</button>
            {checking && <p className="mt-2 text-xs text-muted" role="status">{checking}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
