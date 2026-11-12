export const pad = (n) => String(n).padStart(2, "0");

export const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };

export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export const dayDiff = (a, b) => Math.round((fromKey(a) - fromKey(b)) / 86400000);

export const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const DAYS_LONG = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const fmtShort = (k) => fromKey(k).toLocaleDateString("es-CR", { day: "numeric", month: "short" });

export const fmtInt = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("es-CR"));

export const fmtSleep = (min) => (!min ? "—" : `${Math.floor(min / 60)} h ${pad(Math.round(min % 60))} min`);

export const pruneDays = (obj, n) => Object.fromEntries(Object.keys(obj).sort().slice(-n).map((k) => [k, obj[k]]));

export const clockAm = (min) => `${Math.floor(min / 60)}:${pad(min % 60)} a.m.`;
// Mañana según el plan: 6:30 si entrenas, 7:00 si no; con salida a las 7:50 los días de oficina.

export const hhmm = (d) => d.toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" });
