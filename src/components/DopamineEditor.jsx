import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { normalizeDopamineDefs, newDopamineItem, parseDopamineCount } from "../lib/dopamine.js";
import { Card, SectionTitle, StatusDot, btnCls } from "./ui.jsx";

// Editor de elementos de dopamina buena y barata. Vive en Ajustes.
export function DopamineEditor({ defs, setDefs, identities }) {
  const list = normalizeDopamineDefs(defs);
  const idList = Array.isArray(identities) ? identities : [];
  const idMap = new Map(idList.map((it) => [it.id, it]));

  const [editingId, setEditingId] = useState(null); // null | "new" | id
  const [confirmId, setConfirmId] = useState(null);
  // `limit` y `goal` se guardan como texto mientras se escriben, para poder borrar el campo o poner 0.
  const [form, setForm] = useState({ label: "", kind: "good", limit: "1", goal: "0", identity: "" });

  const startNew = () => {
    setForm({ label: "", kind: "good", limit: "1", goal: "0", identity: "" });
    setEditingId("new");
    setConfirmId(null);
  };

  const startEdit = (it) => {
    setForm({
      label: it.label,
      kind: it.kind,
      limit: String(it.kind === "cheap" ? it.limit : 1),
      goal: String(it.kind === "good" ? it.goal : 0),
      identity: it.identity || "",
    });
    setEditingId(it.id);
    setConfirmId(null);
  };

  const save = () => {
    const label = form.label.trim();
    if (!label) return;
    const isCheap = form.kind === "cheap";
    const base = isCheap
      ? { label, kind: "cheap", limit: parseDopamineCount(form.limit, 1) }
      : { label, kind: "good", identity: form.identity || null, goal: parseDopamineCount(form.goal, 0) };

    if (editingId === "new") {
      const created = { ...newDopamineItem(list, form.kind), ...base };
      setDefs([...list, created]);
    } else {
      setDefs(list.map((it) => (it.id === editingId ? { id: it.id, ...base } : it)));
    }
    setEditingId(null);
  };

  const remove = (id) => {
    setDefs(list.filter((it) => it.id !== id));
    setConfirmId(null);
    if (editingId === id) setEditingId(null);
  };

  return (
    <div>
      <SectionTitle>Dopamina</SectionTitle>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted">
            Edita tu lista de dopamina buena y barata, sus límites y metas diarias o la identidad por la que vota.
          </p>
          {editingId === null && (
            <button
              type="button"
              onClick={startNew}
              className={btnCls("ghost", "min-h-[44px] px-4 text-sm")}
            >
              <Plus size={16} />Nuevo elemento
            </button>
          )}
        </div>

        {editingId !== null && (
          <div className="mt-4 space-y-3 rounded-2xl border border-accent/30 bg-white/[0.05] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold tracking-tight text-accent">
                {editingId === "new" ? "Nuevo elemento" : "Editar elemento"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                aria-label="Cerrar formulario"
                className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:text-fg"
              >
                <X size={16} />
              </button>
            </div>

            <label className="block text-xs text-muted">
              Nombre
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="ej. Leer por gusto"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none"
              />
            </label>

            <div>
              <span className="mb-1 block text-xs text-muted">Tipo</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.06] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, kind: "good" })}
                  className={`min-h-[44px] rounded-lg font-medium transition ${
                    form.kind === "good" ? "bg-good text-bg font-semibold" : "text-muted hover:text-fg"
                  }`}
                >
                  Buena
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, kind: "cheap" })}
                  className={`min-h-[44px] rounded-lg font-medium transition ${
                    form.kind === "cheap" ? "bg-warn text-bg font-semibold" : "text-muted hover:text-fg"
                  }`}
                >
                  Barata
                </button>
              </div>
            </div>

            {form.kind === "cheap" ? (
              <label className="block text-xs text-muted">
                Límite diario (veces)
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: e.target.value })}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2 font-mono text-sm font-bold text-fg focus:border-accent focus:outline-none"
                />
                <span className="mt-1 block">
                  {parseDopamineCount(form.limit, 1) === 0
                    ? "Límite 0 = tolerancia cero: si lo marcas, el día queda fallado."
                    : "Pasarte del límite lo marca en naranja. Con 0, marcarlo falla el día."}
                </span>
              </label>
            ) : (
              <>
              <label className="block text-xs text-muted">
                Meta diaria (veces)
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={form.goal}
                  onChange={(e) => setForm({ ...form, goal: e.target.value })}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white/[0.06] px-3 py-2 font-mono text-sm font-bold text-fg focus:border-accent focus:outline-none"
                />
                <span className="mt-1 block">
                  {parseDopamineCount(form.goal, 0) === 0
                    ? "Meta 0 = sin meta: con registrarlo una vez ya suma el voto del día."
                    : "Suma el voto del día cuando llegas a la meta."}
                </span>
              </label>
              <label className="block text-xs text-muted">
                Identidad (1 voto por día que lo registres)
                <select
                  value={form.identity}
                  onChange={(e) => setForm({ ...form, identity: e.target.value })}
                  className="mt-1 h-11 w-full rounded-xl border border-line bg-white/[0.06] px-3 text-sm text-fg focus:border-accent focus:outline-none"
                >
                  <option value="">Sin identidad (no vota)</option>
                  {idList.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.emoji ? `${it.emoji} ` : ""}{it.label}
                    </option>
                  ))}
                </select>
              </label>
              </>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={save}
                disabled={!form.label.trim()}
                className={btnCls("primary", "min-h-[44px] px-4 text-sm")}
              >
                <Check size={15} />Guardar
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

        <ul className="mt-4 divide-y divide-line">
          {list.map((it) => {
            const idObj = it.kind === "good" && it.identity ? idMap.get(it.identity) : null;
            return (
              <li key={it.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-fg">{it.label}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <StatusDot tone={it.kind === "cheap" ? "warn" : "good"}>
                        {it.kind === "cheap" ? "Barata" : "Buena"}
                      </StatusDot>
                      {it.kind === "cheap" ? (
                        it.limit === 0 ? (
                          <span className="font-semibold text-warn">· tolerancia cero</span>
                        ) : (
                          <span className="font-mono">· límite {it.limit}/día</span>
                        )
                      ) : (
                        <>
                          {idObj ? (
                            <span>· {idObj.emoji ? `${idObj.emoji} ` : ""}{idObj.label}</span>
                          ) : (
                            <span>· sin identidad</span>
                          )}
                          {it.goal > 0 && <span className="font-mono">· meta {it.goal}/día</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(it)}
                      aria-label={`Editar ${it.label}`}
                      className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-fg"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(confirmId === it.id ? null : it.id)}
                      aria-label={`Quitar ${it.label}`}
                      aria-expanded={confirmId === it.id}
                      className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.07] text-muted hover:bg-white/[0.12] hover:text-warn"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {confirmId === it.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 px-0.5">
                    <span className="min-w-0 flex-1 text-xs text-muted">
                      ¿Quitar «{it.label}»? El historial ya guardado se conserva.
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(it.id)}
                      className={btnCls("soft-warn", "min-h-[44px] px-3.5 text-sm")}
                    >
                      Quitar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className={btnCls("ghost", "min-h-[44px] px-3.5 text-sm text-muted")}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {list.length === 0 && (
            <li className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
              No tienes elementos de dopamina. Toca «Nuevo elemento».
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
