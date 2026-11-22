import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Hoja modal accesible basada en <dialog> nativo con light-dismiss y cierre por teclado/gesto.
 */
export function SheetDialog({
  eyebrow,
  icon: Icon,
  accent = "text-accent",
  title,
  subtitle,
  headerExtra,
  onClose,
  children,
}) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.setAttribute("closedby", "any");
    if (!dialog.open) dialog.showModal();
    const onNativeClose = () => onCloseRef.current?.();
    dialog.addEventListener("close", onNativeClose);

    // Respaldo de light-dismiss para Safari y navegadores sin dialog.closedBy.
    let cleanupFallback;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const outside = (e) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      const onDown = (e) => { pressedOutside = outside(e); };
      const onUp = (e) => { if (pressedOutside && outside(e)) dialog.close(); };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      cleanupFallback = () => {
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", onNativeClose);
      if (cleanupFallback) cleanupFallback();
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="sheet-dialog sheet">
      <div className="flex min-h-0 flex-1 flex-col p-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:p-5">
        <div className="mb-3 flex shrink-0 items-start justify-between gap-2">
          <div className="min-w-0">
            {eyebrow && (
              <div className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accent}`}>
                {Icon && <Icon size={12} aria-hidden="true" />}
                <span>{eyebrow}</span>
              </div>
            )}
            <h2 id={titleId} className="font-display text-2xl font-semibold uppercase leading-none text-fg">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 font-mono text-[11px] text-muted">{subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerExtra}
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-surface2 hover:text-fg"
              aria-label="Cerrar"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          {children}
        </div>
      </div>
    </dialog>
  );
}
