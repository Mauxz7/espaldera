import { useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Dumbbell, Plus, Search, X } from "lucide-react";
import { EQ } from "../data/program.js";
import { MUSCLE_GROUPS } from "../lib/metrics.js";
import { FREE_MUSCLE_ORDER, buildExerciseCatalog, filterExerciseCatalog } from "../lib/freeWorkout.js";
import { SheetDialog } from "./SheetDialog.jsx";
import { Chip, btnCls } from "./ui.jsx";

/**
 * Hoja modal para elegir varios ejercicios del catálogo (biblioteca + rutinas + personalizados)
 * o crear un ejercicio nuevo guardado en `customExercises`.
 */
export function ExercisePickerSheet({
  customExercises = [],
  existingExIds = [],
  onAddExercises,
  onCreateExercise,
  onClose,
}) {
  const [mode, setMode] = useState("pick"); // "pick" | "create"
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);

  // Estado del formulario «Crear ejercicio»
  const [newName, setNewName] = useState("");
  const [primaryGroup, setPrimaryGroup] = useState("biceps");
  const [secondaryGroups, setSecondaryGroups] = useState([]);
  const [nameError, setNameError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  const searchId = useId();
  const nameInputId = useId();
  const nameErrorId = useId();
  const nameInputRef = useRef(null);

  const existingSet = useMemo(() => new Set(existingExIds || []), [existingExIds]);
  const catalog = useMemo(() => buildExerciseCatalog(customExercises), [customExercises]);
  const filtered = useMemo(
    () => filterExerciseCatalog(catalog, { query, group: groupFilter }),
    [catalog, query, groupFilter],
  );

  const toggleSelect = (id) => {
    if (existingSet.has(id)) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const openCreateMode = (prefillName = "") => {
    setNewName(prefillName);
    setPrimaryGroup(groupFilter !== "all" ? groupFilter : "biceps");
    setSecondaryGroups([]);
    setNameError("");
    setNameTouched(false);
    setMode("create");
  };

  const toggleSecondary = (g) => {
    if (g === primaryGroup) return;
    setSecondaryGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const selectPrimary = (g) => {
    setPrimaryGroup(g);
    setSecondaryGroups((prev) => prev.filter((x) => x !== g));
  };

  const validateName = (value) => {
    if (!String(value || "").trim()) return "Escribe el nombre del ejercicio.";
    return "";
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const err = validateName(newName);
    setNameTouched(true);
    if (err) {
      setNameError(err);
      nameInputRef.current?.focus();
      return;
    }
    const created = onCreateExercise({
      name: newName,
      primaryGroup,
      secondaryGroups,
    });
    if (!created || created.error) {
      setNameError(created?.error || "No se pudo guardar el ejercicio.");
      nameInputRef.current?.focus();
      return;
    }
    // Si no había selección múltiple en curso, lo añade y cierra de inmediato; si había, lo suma a la selección.
    if (selectedIds.length === 0) {
      onAddExercises([created.id]);
      onClose();
    } else {
      setSelectedIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
      setNewName("");
      setNameError("");
      setNameTouched(false);
      setMode("pick");
    }
  };

  const confirmAdd = () => {
    if (!selectedIds.length) return;
    onAddExercises(selectedIds);
    onClose();
  };

  const footer = mode === "pick" ? (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onClose} className={btnCls("ghost", "px-4")}>
        Cancelar
      </button>
      <button
        type="button"
        onClick={confirmAdd}
        disabled={selectedIds.length === 0}
        className={btnCls("primary", "min-w-0 flex-1")}
      >
        <Plus size={18} />
        {selectedIds.length === 0
          ? "Elige ejercicios"
          : selectedIds.length === 1
            ? "Añadir 1 ejercicio"
            : `Añadir ${selectedIds.length} ejercicios`}
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setMode("pick")}
        className={btnCls("ghost", "px-4")}
      >
        <ArrowLeft size={16} />Volver
      </button>
      <button
        type="submit"
        form="create-free-exercise-form"
        className={btnCls("primary", "min-w-0 flex-1")}
      >
        <Check size={18} />Guardar y añadir
      </button>
    </div>
  );

  return (
    <SheetDialog
      eyebrow="Entreno libre"
      icon={Dumbbell}
      title={mode === "pick" ? "Añadir ejercicio" : "Crear ejercicio"}
      headerExtra={mode === "pick" ? (
        <button
          type="button"
          onClick={() => openCreateMode("")}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-accent/15 px-3 text-xs font-semibold text-accent transition hover:bg-accent/25"
        >
          <Plus size={14} />Crear ejercicio
        </button>
      ) : null}
      footer={footer}
      onClose={onClose}
    >
      {mode === "pick" ? (
        <div className="space-y-3">
          <search>
            <form onSubmit={(e) => e.preventDefault()} className="relative">
              <label htmlFor={searchId} className="sr-only">Buscar ejercicio por nombre, músculo o equipo</label>
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                id={searchId}
                name="q"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar ejercicio o músculo…"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                className="min-h-[48px] w-full rounded-2xl border border-line bg-white/[0.06] pl-10 pr-10 text-base text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-white/[0.1] hover:text-fg"
                >
                  <X size={15} />
                </button>
              )}
            </form>
          </search>

          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por grupo muscular">
            <button
              type="button"
              onClick={() => setGroupFilter("all")}
              aria-pressed={groupFilter === "all"}
              className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                groupFilter === "all" ? "bg-accent/18 text-accent ring-1 ring-inset ring-accent/45" : "bg-white/[0.06] text-muted hover:text-fg"
              }`}
            >
              Todos
            </button>
            {FREE_MUSCLE_ORDER.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupFilter(g)}
                aria-pressed={groupFilter === g}
                className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  groupFilter === g ? "bg-accent/18 text-accent ring-1 ring-inset ring-accent/45" : "bg-white/[0.06] text-muted hover:text-fg"
                }`}
              >
                {MUSCLE_GROUPS[g]}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 px-0.5 text-xs text-muted">
            <span>{filtered.length} {filtered.length === 1 ? "opción" : "opciones"} · elige uno o varios</span>
            <button
              type="button"
              onClick={() => openCreateMode(query.trim())}
              className="font-semibold text-accent hover:underline"
            >
              + Nuevo ejercicio
            </button>
          </div>

          {filtered.length > 0 ? (
            <ul className="space-y-2">
              {filtered.map((ex) => {
                const alreadyAdded = existingSet.has(ex.id);
                const checked = selectedIds.includes(ex.id);
                const primaryLabel = (ex.primaryGroups || []).map((g) => MUSCLE_GROUPS[g]).filter(Boolean).join(" · ");
                const secondaryLabel = (ex.secondaryGroupsResolved || []).map((g) => MUSCLE_GROUPS[g]).filter(Boolean).join(" · ");
                return (
                  <li key={ex.id}>
                    <label
                      className={`flex min-h-[52px] cursor-pointer items-start gap-3 rounded-2xl p-3.5 transition ${
                        alreadyAdded
                          ? "cursor-default bg-white/[0.03] opacity-55"
                          : checked
                            ? "bg-accent/15 ring-1 ring-inset ring-accent/55"
                            : "bg-white/[0.05] hover:bg-white/[0.09]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={alreadyAdded}
                        onChange={() => toggleSelect(ex.id)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition ${
                          alreadyAdded
                            ? "border-line bg-white/[0.06] text-muted"
                            : checked
                              ? "border-accent bg-accent text-accentInk"
                              : "border-white/20 bg-white/[0.04] text-transparent"
                        }`}
                      >
                        <Check size={14} strokeWidth={3} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[15px] font-semibold leading-snug text-fg">{ex.name}</span>
                          {ex.custom && <Chip tone="cool">Personalizado</Chip>}
                          {alreadyAdded && <Chip>Ya añadido</Chip>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          {primaryLabel && <span className="font-medium text-fg/85">{primaryLabel}</span>}
                          {secondaryLabel && <span className="text-faint">+ {secondaryLabel}</span>}
                          {(ex.eq || []).map((e) => EQ[e]).filter(Boolean).map((lbl) => (
                            <span key={lbl} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px]">{lbl}</span>
                          ))}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-line p-5 text-center">
              <p className="text-sm text-muted">No encontramos «{query.trim()}» en la biblioteca.</p>
              <button
                type="button"
                onClick={() => openCreateMode(query.trim())}
                className={btnCls("ghost", "mt-3 w-full text-accent")}
              >
                <Plus size={16} />Crear «{query.trim() || "ejercicio"}»
              </button>
            </div>
          )}
        </div>
      ) : (
        <form id="create-free-exercise-form" onSubmit={handleCreateSubmit} noValidate className="space-y-4">
          <p className="text-xs leading-relaxed text-muted">
            Tu ejercicio se guarda en tu biblioteca y alimenta la frescura y carga de sus grupos musculares.
          </p>

          <div>
            <label htmlFor={nameInputId} className="mb-1.5 block text-[13px] font-medium text-fg">
              Nombre del ejercicio <span className="text-accent" aria-hidden="true">*</span>
            </label>
            <input
              ref={nameInputRef}
              id={nameInputId}
              name="exerciseName"
              type="text"
              required
              maxLength={60}
              value={newName}
              onChange={(e) => {
                const v = e.target.value;
                setNewName(v);
                if (nameError && !validateName(v)) setNameError("");
              }}
              onBlur={() => {
                setNameTouched(true);
                setNameError(validateName(newName));
              }}
              placeholder="Ej. Curl concentrado con mancuerna"
              aria-invalid={nameTouched && Boolean(nameError)}
              aria-describedby={nameError ? nameErrorId : undefined}
              autoFocus
              className={`min-h-[48px] w-full rounded-2xl border bg-white/[0.06] px-3.5 py-2.5 text-base text-fg placeholder:text-muted/60 focus:outline-none ${
                nameTouched && nameError ? "border-warn focus:border-warn" : "border-line focus:border-accent"
              }`}
            />
            {nameTouched && nameError && (
              <p id={nameErrorId} role="alert" className="mt-1.5 text-xs font-medium text-warn">
                {nameError}
              </p>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-fg">
              Grupo muscular principal <span className="text-accent" aria-hidden="true">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {FREE_MUSCLE_ORDER.map((g) => {
                const active = primaryGroup === g;
                return (
                  <label
                    key={g}
                    className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl px-2.5 py-2 text-center text-xs font-semibold transition ${
                      active
                        ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/55"
                        : "bg-white/[0.06] text-muted hover:bg-white/[0.1] hover:text-fg"
                    }`}
                  >
                    <input
                      type="radio"
                      name="primaryGroup"
                      value={g}
                      checked={active}
                      onChange={() => selectPrimary(g)}
                      className="sr-only"
                    />
                    {MUSCLE_GROUPS[g]}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-muted">
              Grupos secundarios (opcional)
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {FREE_MUSCLE_ORDER.filter((g) => g !== primaryGroup).map((g) => {
                const active = secondaryGroups.includes(g);
                return (
                  <label
                    key={g}
                    className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-cool/18 text-cool ring-1 ring-inset ring-cool/45"
                        : "bg-white/[0.06] text-muted hover:bg-white/[0.1] hover:text-fg"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleSecondary(g)}
                      className="sr-only"
                    />
                    {active && <Check size={12} strokeWidth={3} />}
                    {MUSCLE_GROUPS[g]}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </form>
      )}
    </SheetDialog>
  );
}
