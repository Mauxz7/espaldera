import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Bell, BellRing, BellOff } from "lucide-react";
import { dkey, hhmm } from "./dates.js";
import { unlockAudio, beep } from "./audio.js";

export const CREATINE_HOUR = 12;

export const notifSupported = () => { try { return typeof window !== "undefined" && "Notification" in window; } catch (e) { return false; } };

export const notifPerm = () => { try { return notifSupported() ? Notification.permission : "unsupported"; } catch (e) { return "unsupported"; } };

export function useCreatineReminder(taken) {
  const [now, setNow] = useState(() => new Date());
  const [perm, setPerm] = useState(notifPerm);
  const [ringing, setRinging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const notifRef = useRef(null);
  const today = dkey(now);
  const hour = now.getHours();
  const due = !taken && hour >= CREATINE_HOUR;

  // Reloj del checker: revisa cada 15 s si toca avisar.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  const fire = useCallback(() => {
    setRinging(true);
    setHidden(false);
    beep();
    if (notifPerm() === "granted") {
      try {
        if (notifRef.current) notifRef.current.close();
        const n = new Notification("Creatina pendiente", {
          body: `Son las ${hhmm(new Date())} y aún no la marcas. Tómala y toca el check en Espaldera.`,
          tag: "espaldera-creatina",
          renotify: true,
          requireInteraction: true,
        });
        n.onclick = () => { try { window.focus(); } catch (e) {} n.close(); };
        notifRef.current = n;
      } catch (e) {}
    }
  }, []);

  // Un aviso por hora (12:00, 13:00, 14:00…) mientras la creatina siga sin marcar.
  useEffect(() => {
    if (!due) return;
    const slot = `${today}-${hour}`;
    let last = null;
    try { last = localStorage.getItem("fitpanel:creatineFired"); } catch (e) {}
    if (last === slot) return;
    try { localStorage.setItem("fitpanel:creatineFired", slot); } catch (e) {}
    fire();
  }, [due, today, hour, fire]);

  // Parpadeo del título de la pestaña durante 60 s tras cada aviso.
  useEffect(() => {
    if (!ringing) return;
    const original = document.title;
    let on = false;
    const id = setInterval(() => { on = !on; document.title = on ? "⏰ Creatina pendiente" : original; }, 1000);
    const stop = setTimeout(() => setRinging(false), 60000);
    return () => { clearInterval(id); clearTimeout(stop); document.title = original; };
  }, [ringing]);

  // Al marcar la creatina se apaga todo al instante.
  useEffect(() => {
    if (!taken) return;
    setRinging(false);
    try { if (notifRef.current) notifRef.current.close(); } catch (e) {}
    notifRef.current = null;
  }, [taken]);

  const ask = useCallback(async () => {
    unlockAudio();
    if (!notifSupported()) { setPerm("unsupported"); return; }
    try { const p = await Notification.requestPermission(); setPerm(p); } catch (e) { setPerm(notifPerm()); }
  }, []);

  const test = useCallback(() => { unlockAudio(); fire(); }, [fire]);

  return { due, ringing, hidden, setHidden, perm, ask, test };
}

export function CreatineBanner({ rem, onTake }) {
  if (!rem.due || rem.hidden) return null;
  return (
    <div className="creatine-banner fixed inset-x-0 z-40 flex justify-center px-4" role="alert">
      <div className={`flex w-full max-w-xl flex-wrap items-center gap-3 rounded-2xl border border-warn/50 bg-surface p-3 shadow-2xl ${rem.ringing ? "flash" : ""}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warn/20 text-warn"><BellRing size={20} className={rem.ringing ? "ring-bell" : ""} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold uppercase leading-none">Creatina pendiente</div>
          <div className="text-xs text-muted">Desde las 12:00 p.m. Te aviso cada hora en punto hasta que la marques.</div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button onClick={onTake} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-good px-3.5 py-2 text-sm font-semibold text-bg sm:flex-none"><Check size={16} strokeWidth={3} />Ya la tomé</button>
          <button onClick={() => rem.setHidden(true)} className="rounded-xl bg-surface2 px-3 py-2 text-xs text-muted hover:text-fg" aria-label="Ocultar hasta el próximo aviso">Ocultar</button>
        </div>
      </div>
    </div>
  );
}

export function ReminderCard({ rem, taken }) {
  const permText = {
    granted: { t: "Notificaciones del sistema activas.", cls: "text-good", icon: Bell },
    denied: { t: "El navegador bloquea las notificaciones del sistema en esta vista. El aviso en pantalla, el sonido y el título que parpadea siguen funcionando.", cls: "text-warn", icon: BellOff },
    default: { t: "Aún no has dado permiso para notificaciones del sistema.", cls: "text-muted", icon: Bell },
    unsupported: { t: "Este navegador no ofrece notificaciones aquí. El aviso en pantalla y el sonido siguen funcionando.", cls: "text-warn", icon: BellOff },
  }[rem.perm] || { t: "", cls: "text-muted", icon: Bell };
  const Icon = permText.icon;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-display text-lg font-semibold uppercase tracking-wide">Recordatorio de creatina</h2>
      <p className="text-sm text-muted">A partir de las 12:00 p.m., si «Tomar creatina» sigue sin marcar, Espaldera te avisa en punto cada 60 minutos con notificación, sonido y aviso en pantalla. Se detiene apenas marcas el check.</p>
      <div className={`mt-3 flex items-start gap-2 text-xs ${permText.cls}`}><Icon size={14} className="mt-0.5 shrink-0" />{permText.t}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {rem.perm === "default" && (
          <button onClick={rem.ask} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk"><Bell size={15} />Activar notificaciones</button>
        )}
        <button onClick={rem.test} className="inline-flex items-center gap-1.5 rounded-xl bg-surface2 px-3.5 py-2 text-sm text-muted hover:text-fg"><BellRing size={15} />Probar aviso</button>
      </div>
      <p className="mt-2 text-[11px] text-muted">Hoy: {taken ? "creatina marcada, sin avisos." : rem.due ? "pendiente: avisos activos." : "los avisos empiezan a las 12:00 p.m."} Funciona mientras Espaldera esté abierta en alguna pestaña.</p>
    </section>
  );
}
