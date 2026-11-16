import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DEFAULT_IDENTITIES, IDENTITY_COLORS } from "../data/identities.js";
import { newIdentity, lastGrapheme } from "../lib/identity.js";

const COLOR_NAMES = { accent: "ámbar", good: "verde", cool: "azul", warn: "coral" };

// Editor de identidades (nombre, emoji y color; agregar y quitar). Vive en Ajustes.
export function IdentityEditor({ identities, setIdentities }) {
  const list = Array.isArray(identities) ? identities.filter((it) => it && it.id) : DEFAULT_IDENTITIES;
  const [confirmId, setConfirmId] = useState(null);

  const update = (id, patch) => setIdentities(list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const nextColor = (c) => IDENTITY_COLORS[(IDENTITY_COLORS.indexOf(c) + 1) % IDENTITY_COLORS.length];
  const add = () => setIdentities([...list, newIdentity(list)]);
  const remove = (id) => { setIdentities(list.filter((it) => it.id !== id)); setConfirmId(null); };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Identidades</h2>
          <p className="text-sm text-muted">Cada hábito cumplido es un voto por quien quieres ser. Asigna la identidad al editar cada hábito.</p>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accentInk"
        >
          <Plus size={16} />Nueva identidad
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {list.map((it) => (
          <li key={it.id} className="rounded-xl border border-line bg-surface2 p-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={it.emoji || ""}
                onChange={(e) => update(it.id, { emoji: lastGrapheme(e.target.value) })}
                onFocus={(e) => e.target.select()}
                aria-label={`Emoji de ${it.label || "la identidad"}`}
                placeholder="🙂"
                className="h-11 w-11 shrink-0 rounded-lg border border-line bg-surface text-center text-lg focus:border-accent focus:outline-none"
              />
              <input
                type="text"
                value={it.label || ""}
                onChange={(e) => update(it.id, { label: e.target.value })}
                onBlur={(e) => { if (!e.target.value.trim()) update(it.id, { label: "Identidad" }); }}
                aria-label="Nombre de la identidad"
                className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-fg focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => update(it.id, { color: nextColor(it.color) })}
                aria-label={`Color de ${it.label}: ${COLOR_NAMES[it.color] || "sin color"}. Toca para cambiarlo`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface"
              >
                <span className="h-5 w-5 rounded-full" style={{ backgroundColor: `rgb(var(--c-${IDENTITY_COLORS.includes(it.color) ? it.color : "muted"}))` }} />
              </button>
              <button
                type="button"
                onClick={() => setConfirmId(confirmId === it.id ? null : it.id)}
                aria-label={`Quitar ${it.label}`}
                aria-expanded={confirmId === it.id}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface text-muted hover:text-warn"
              >
                <Trash2 size={16} />
              </button>
            </div>
            {confirmId === it.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
                <span className="min-w-0 flex-1 text-xs text-muted">¿Quitar «{it.label}»? Sus hábitos dejarán de votar.</span>
                <button type="button" onClick={() => remove(it.id)} className="min-h-[44px] rounded-xl bg-warn/15 px-3.5 text-sm font-semibold text-warn">Quitar</button>
                <button type="button" onClick={() => setConfirmId(null)} className="min-h-[44px] rounded-xl bg-surface px-3.5 text-sm text-muted hover:text-fg">Cancelar</button>
              </div>
            )}
          </li>
        ))}
        {list.length === 0 && (
          <li className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">No tienes identidades. Toca «Nueva identidad».</li>
        )}
      </ul>
    </section>
  );
}
