import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ResponsiveContainer, ComposedChart, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { Dumbbell, Activity, Sunrise, Timer, Play, Pause, RotateCcw, X, Check, ChevronDown, Zap, BatteryLow, Trophy, Footprints, ClipboardPaste, Save, Trash2, Moon, Flame, Cloud, CloudOff, TrendingUp, TrendingDown, CalendarDays, Info, Plus, Minus, Droplets, Pill, FlaskConical, PackageCheck, MonitorOff, BookOpen, Milk, Star, ArrowLeftRight, Undo2, Bell, BellRing, BellOff, RefreshCw, History, Shuffle, Building2, Home, AlarmClock, Settings } from "lucide-react";

/* ───────────────────────── Persistencia local + sincronización con tu repositorio privado de GitHub ───────────────────────── */

const LS = {
  get(k) { try { const r = localStorage.getItem("fitpanel:" + k); return r == null ? undefined : JSON.parse(r); } catch (e) { return undefined; } },
  set(k, v) { try { localStorage.setItem("fitpanel:" + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem("fitpanel:" + k); } catch (e) {} },
};

const SYNC_KEYS = ["sets", "log", "habits", "health", "block", "swaps", "loads", "lastLoads", "weekPlan"];
const DEFAULT_REPO = "Mauxz7/espaldera-data";
const b64e = (str) => { const b = new TextEncoder().encode(str); let o = ""; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(o); };
const b64d = (str) => new TextDecoder().decode(Uint8Array.from(atob(String(str).replace(/\s/g, "")), (c) => c.charCodeAt(0)));

const keyBus = new Map(); // clave → funciones que reciben el valor que llegó de otro dispositivo
const emitKey = (k, v) => (keyBus.get(k) || []).forEach((f) => f(v));

// Un solo archivo (data.json) en el repositorio privado. Por cada clave gana la escritura más reciente.
const Sync = {
  status: { state: "off" },
  subs: new Set(),
  sha: null, busy: false, again: false, timer: null,
  set(st) { this.status = st; this.subs.forEach((f) => f(st)); },
  cfg() { const c = LS.get("@gh"); return c && c.token && c.repo ? c : null; },
  req(method, body) {
    const c = this.cfg();
    return fetch(`https://api.github.com/repos/${c.repo}/contents/data.json`, {
      method, cache: "no-store",
      headers: { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      body: body ? JSON.stringify(body) : undefined,
    });
  },
  async pull() {
    const r = await this.req("GET");
    let remote = {};
    if (r.status === 404) this.sha = null;
    else if (!r.ok) throw { status: r.status };
    else { const j = await r.json(); this.sha = j.sha; try { remote = JSON.parse(b64d(j.content || "")) || {}; } catch (e) { remote = {}; } }
    let localNewer = false;
    SYNC_KEYS.forEach((k) => {
      const rem = remote[k];
      const at = LS.get("@at:" + k) || 0;
      if (rem && rem.at > at) { LS.set(k, rem.v); LS.set("@at:" + k, rem.at); emitKey(k, rem.v); }
      else if (at > ((rem && rem.at) || 0)) localNewer = true;
    });
    return localNewer;
  },
  async push() {
    const doc = {};
    SYNC_KEYS.forEach((k) => { const at = LS.get("@at:" + k); const v = LS.get(k); if (at && v !== undefined) doc[k] = { v, at }; });
    const body = { message: "sync " + new Date().toISOString(), content: b64e(JSON.stringify(doc)) };
    if (this.sha) body.sha = this.sha;
    const r = await this.req("PUT", body);
    if (r.status === 409 || r.status === 422) return false; // otro dispositivo escribió primero: se vuelve a leer y mezclar
    if (!r.ok) throw { status: r.status };
    const j = await r.json();
    this.sha = j.content && j.content.sha;
    return true;
  },
  async run() {
    if (!this.cfg()) { this.set({ state: "off" }); return; }
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    this.set({ state: "syncing", at: this.status.at });
    try {
      for (let i = 0; i < 3; i++) { const newer = await this.pull(); if (!newer) break; if (await this.push()) break; }
      this.set({ state: "ok", at: Date.now() });
    } catch (e) {
      this.set({ state: "error", code: e && e.status ? e.status : "red", at: this.status.at });
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.schedule(500); }
    }
  },
  schedule(ms = 3000) { if (!this.cfg()) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), ms); },
  connect(token, repo) { LS.set("@gh", { token, repo }); this.sha = null; return this.run(); },
  disconnect() { LS.del("@gh"); this.sha = null; this.set({ state: "off" }); },
};

function useSyncStatus() {
  const [s, setS] = useState(Sync.status);
  useEffect(() => { const f = (x) => setS(x); Sync.subs.add(f); return () => Sync.subs.delete(f); }, []);
  return s;
}

function usePersisted(key, initial) {
  const [val, setVal] = useState(() => { const v = LS.get(key); return v === undefined ? initial : v; });
  const saved = useRef(JSON.stringify(val));
  // Valor que llega de otro dispositivo: se muestra sin volver a marcarlo como cambio local.
  useEffect(() => {
    const f = (v) => { saved.current = JSON.stringify(v); setVal(v); };
    if (!keyBus.has(key)) keyBus.set(key, []);
    keyBus.get(key).push(f);
    return () => { keyBus.set(key, keyBus.get(key).filter((x) => x !== f)); };
  }, [key]);
  useEffect(() => {
    const j = JSON.stringify(val);
    if (j === saved.current) return;
    saved.current = j;
    LS.set(key, val);
    LS.set("@at:" + key, Date.now());
    Sync.schedule();
  }, [val, key]);
  return [val, setVal];
}

/* ───────────────────────── Fechas ───────────────────────── */

const pad = (n) => String(n).padStart(2, "0");
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const dayDiff = (a, b) => Math.round((fromKey(a) - fromKey(b)) / 86400000);
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DAYS_LONG = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const fmtShort = (k) => fromKey(k).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
const fmtInt = (n) => (n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("es-CR"));
const fmtSleep = (min) => (!min ? "—" : `${Math.floor(min / 60)} h ${pad(Math.round(min % 60))} min`);

/* ───────────────────────── Programa de entrenamiento ───────────────────────── */

const EQ = {
  ladder: "Swedish ladder",
  bar: "Barra 40 kg",
  db: "Mancuernas 10 kg",
  kb: "KB 8 kg",
  mb: "Balón medicinal",
  bw: "Peso corporal",
  run: "Calle o pista",
  bike: "Bici estática",
};

const ROUTINES = [
  {
    id: "d1", short: "Día 1", name: "Torso Fuerza / Calistenia", minutes: 42, weekday: 0,
    focus: "Tracción vertical pesada con excéntricas lentas, emparejada con empuje antagonista.",
    exercises: [
      { id: "d1a1", block: "A1", name: "Dominadas pronas", eq: ["ladder"], sets: 4, reps: "4–6", rir: 2, tempo: "3-1-1-0", rest: 45,
        tips: ["Deprime escápulas antes de tirar; el primer centímetro sale de la espalda, no de los brazos.", "3 s de bajada controlada: ahí está la sobrecarga sin añadir peso.", "Si fallas la última rep, termina con una negativa de 5 s."] },
      { id: "d1a2", block: "A2", name: "Fondos en espaldera", eq: ["ladder"], sets: 4, reps: "6–8", rir: 2, tempo: "3-1-1-0", rest: 90,
        tips: ["Pausa de 1 s abajo con el hombro a la altura del codo, sin rebotar.", "Torso ligeramente inclinado hacia delante para cargar pecho.", "Bloquea arriba apretando tríceps 1 s."] },
      { id: "d1b1", block: "B1", name: "Remo inclinado con barra", eq: ["bar"], sets: 3, reps: "8–10", rir: 2, tempo: "2-0-1-2", rest: 30,
        tips: ["Pausa de 2 s con la barra en el ombligo: convierte 40 kg en un estímulo serio.", "Bisagra de cadera a ~45°, columna neutra y core firme.", "Codos a 45° del torso, no abiertos."] },
      { id: "d1b2", block: "B2", name: "Press de hombro unilateral con mancuerna", eq: ["db"], sets: 3, reps: "8–10 / lado", rir: 2, tempo: "3-0-1-0", rest: 75,
        tips: ["Hazlo en media rodilla: el antirotación suma trabajo de core.", "Bajada de 3 s hasta la oreja.", "No arquees la zona lumbar; glúteo de la pierna de atrás apretado."] },
      { id: "d1c1", block: "C1", name: "Flexiones con déficit (manos sobre discos)", eq: ["bw", "bar"], sets: 2, reps: "10–15", rir: 1, tempo: "3-1-1-0", rest: 20,
        tips: ["Los discos te dan 5–8 cm extra de recorrido: baja el pecho por debajo de las manos.", "Cuerpo en bloque, glúteos apretados.", "Pausa de 1 s abajo."] },
      { id: "d1c2", block: "C2", name: "Elevaciones de piernas colgado", eq: ["ladder"], sets: 2, reps: "8–12", rir: 2, tempo: "2-1-2-0", rest: 60,
        tips: ["Retroversión pélvica al subir: la pelvis sube, no solo las piernas.", "Evita el balanceo; 2 s de bajada.", "Si cuesta, rodillas al pecho."] },
    ],
  },
  {
    id: "d2", short: "Día 2", name: "Pierna & Core", minutes: 45, weekday: 1,
    focus: "Sentadilla, estabilidad de rodilla y tobillo, potencia con balón y bisagra de cadera. Cierra con abdomen colgado.",
    exercises: [
      { id: "d2a", block: "A", name: "Sentadilla (barra o kettlebell)", eq: ["bar", "kb"], sets: 4, reps: "6–10", rir: 2, tempo: "3-1-1-0", rest: 90,
        tips: ["Barra de 40 kg en la espalda o goblet con KB de 8 kg. Si la rodilla está sensible, ese día elige la KB.", "Rodillas en la línea de la punta del pie: no dejes que se vayan hacia dentro.", "3 s de bajada y 1 s de pausa abajo: control antes que profundidad."] },
      { id: "d2b", block: "B", name: "Pistol squat con pausa isométrica", eq: ["ladder", "bw"], sets: 3, reps: "Máx. / pierna", rir: 2, tempo: "3-3-1-0", rest: 60,
        tips: ["Agárrate a la espaldera y baja solo hasta donde la rodilla siga alineada.", "Quédate 3 s quieto en el punto más bajo que controles: ahí trabajan la estabilidad y el tobillo.", "Progresión: sentarte en una caja → bajar más con apoyo → pistol completa."] },
      { id: "d2c1", block: "C1", name: "Zancadas con balón medicinal", eq: ["mb"], sets: 3, reps: "8 / pierna", rir: 2, tempo: "2-1-1-0", rest: 30,
        tips: ["Balón al pecho; opcional: gira el torso hacia la pierna de delante.", "La rodilla trasera roza el piso sin golpearlo.", "Paso largo para cargar glúteo y descargar la rodilla."] },
      { id: "d2c2", block: "C2", name: "Zancadas con salto", eq: ["bw"], sets: 3, reps: "6 / pierna", rir: 2, tempo: "Explosivo", rest: 75,
        tips: ["Aterriza suave en la planta y amortigua: si el aterrizaje hace ruido, baja la altura.", "Rodilla y tobillo alineados al caer.", "Si un día tienes el tobillo débil, cámbialas por zancadas alternas sin salto."] },
      { id: "d2d", block: "D", name: "Peso muerto rumano (RDL)", eq: ["bar"], sets: 3, reps: "8–10", rir: 2, tempo: "3-1-1-0", rest: 75,
        tips: ["Barra de 40 kg pegada a las piernas; las rodillas apenas flexionadas.", "Empuja la cadera hacia atrás hasta sentir el isquio y pausa 1 s.", "Espalda neutra todo el recorrido."] },
      { id: "d2e", block: "E", name: "Farmer's walk (2 KB de 8 kg)", eq: ["kb"], sets: 3, reps: "30 s", rir: 2, tempo: "Marcha", rest: 45,
        tips: ["Hombros atrás y abajo, pasos cortos y firmes.", "Para el tobillo: una de las vueltas, camínala de puntillas.", "Sin dejar que las KB se balanceen."] },
      { id: "d2f1", block: "F1", name: "Toes to bar en espaldera", eq: ["ladder"], sets: 3, reps: "6–10", rir: 2, tempo: "Controlado", rest: 15,
        tips: ["Pelvis hacia arriba, no solo las piernas.", "Sin balanceo: baja en 2 s.", "Si se rompe la técnica, rodillas al pecho."] },
      { id: "d2f2", block: "F2", name: "Elevaciones de piernas", eq: ["ladder"], sets: 3, reps: "10–12", rir: 1, tempo: "2-1-3-0", rest: 60,
        tips: ["Colgado en la espaldera o acostado con las manos en un peldaño.", "3 s de bajada.", "Lumbar pegada si las haces acostado."] },
    ],
  },
  {
    id: "d3", short: "Día 3", name: "Running & Tobillos", minutes: 38, weekday: 3,
    focus: "Trote por intervalos a ritmo conversacional, con preparación y fuerza de tobillo para proteger rodillas y tobillos.",
    exercises: [
      { id: "d3a", block: "A", name: "Activación de tobillo y cadera", eq: ["ladder", "bw"], sets: 2, reps: "8 / lado", rir: 4, tempo: "Controlado", rest: 0,
        tips: ["Círculos de tobillo, 8 elevaciones de talón lentas y 8 balanceos de pierna agarrado a la espaldera.", "Termina con 8 puentes de glúteo: despiertan la cadera para que la rodilla no cargue de más.", "Nada de estiramientos largos antes de correr."] },
      { id: "d3b", block: "B", name: "Caminata rápida de entrada", eq: ["run"], sets: 1, reps: "4 min", rir: 4, tempo: "Ritmo ágil", rest: 0,
        tips: ["Paso largo y brazos activos: sube pulsaciones sin impacto.", "Si algo molesta aquí, hoy cambia el trote por la alternativa sin impacto."] },
      { id: "d3c", block: "C", name: "Intervalos: trote 3 min + caminata 1 min", eq: ["run"], sets: 5, reps: "3 min de trote", rir: 3, tempo: "Conversacional", rest: 60,
        tips: ["Ritmo al que puedas hablar en frases completas: si jadeas, vas muy rápido.", "Pasos cortos y silenciosos, cayendo debajo de la cadera: menos golpe en la rodilla.", "Al marcar cada bloque arranca el minuto de caminata. Progresión: +1 bloque o +30 s de trote por semana solo si rodillas y tobillos van bien.", "Superficie pareja; dolor punzante en rodilla o tobillo = se termina el trote y sigues caminando."] },
      { id: "d3d", block: "D", name: "Caminata de vuelta a la calma", eq: ["run"], sets: 1, reps: "4 min", rir: 4, tempo: "Suave", rest: 0,
        tips: ["Baja el ritmo poco a poco y respira por la nariz.", "No te sientes de golpe al terminar."] },
      { id: "d3e", block: "E", name: "Elevaciones de talón excéntricas en peldaño", eq: ["ladder"], sets: 3, reps: "10–12", rir: 2, tempo: "1-0-3-1", rest: 45,
        tips: ["Sube con las dos piernas y baja en 3 s: es lo que más fortalece el tobillo y el tendón.", "Talones por debajo del peldaño al final de la bajada.", "Agárrate a la espaldera solo para el equilibrio."] },
      { id: "d3f", block: "F", name: "Tibial contra la pared + equilibrio a una pierna", eq: ["bw"], sets: 2, reps: "12 + 30 s / pierna", rir: 3, tempo: "Controlado", rest: 30,
        tips: ["Espalda en la pared, pies adelante: sube las puntas 12 veces (tibial anterior, protege la espinilla).", "Luego 30 s en una pierna con la rodilla apenas flexionada.", "Progresión del equilibrio: ojos cerrados."] },
    ],
  },
  {
    id: "d4", short: "Día 4", name: "Full Body & Kettlebell Flow", minutes: 45, weekday: 5,
    focus: "Potencia y trabajo de cadena completa; ideal para el sábado con más margen.",
    exercises: [
      { id: "d4a", block: "A", name: "Thruster con barra", eq: ["bar"], sets: 4, reps: "6–8", rir: 2, tempo: "2-0-X-0", rest: 90,
        tips: ["Sentadilla frontal profunda y empuje explosivo (X) en un solo movimiento.", "Codos altos en la recepción.", "Respira arriba, no abajo."] },
      { id: "d4b", block: "B", name: "Complejo KB doble: 5 swing + 5 clean + 5 sentadilla frontal + 5 press", eq: ["kb"], sets: 4, reps: "1 ronda (20 reps)", rir: 2, tempo: "Fluido", rest: 60,
        tips: ["No sueltes las KB durante la ronda.", "El swing es bisagra de cadera, no sentadilla.", "En el clean la KB rueda sobre la muñeca, no golpea."] },
      { id: "d4c1", block: "C1", name: "Dominadas negativas lentas", eq: ["ladder"], sets: 3, reps: "4–5", rir: 2, tempo: "5-0-X-0", rest: 30,
        tips: ["Sube con salto o con los pies en un peldaño.", "5 s de bajada.", "Si ya dominas las 5, sujeta una KB de 8 kg entre los pies."] },
      { id: "d4c2", block: "C2", name: "Turkish get-up", eq: ["kb"], sets: 3, reps: "1 / lado", rir: 3, tempo: "Lento", rest: 60,
        tips: ["Mirada siempre en la KB.", "Cada fase con pausa de 1 s.", "Calidad sobre velocidad."] },
      { id: "d4d1", block: "D1", name: "L-sit en espaldera (o tuck)", eq: ["ladder"], sets: 4, reps: "10–20 s", rir: 2, tempo: "Isométrico", rest: 20,
        tips: ["Hombros deprimidos, brazos bloqueados.", "Progresión: tuck → una pierna → L completa.", "Puntas de los pies activas."] },
      { id: "d4d2", block: "D2", name: "Suitcase march (KB 8 kg + mancuerna 10 kg)", eq: ["kb", "db"], sets: 4, reps: "40 s", rir: 2, tempo: "Marcha", rest: 45,
        tips: ["Una carga distinta en cada mano: el core resiste la inclinación.", "Rodilla a la altura de la cadera.", "Hombros nivelados."] },
    ],
  },
  {
    id: "low", short: "Rescate", name: "Modo Baja Energía (20 min)", minutes: 20, weekday: -1, low: true,
    focus: "Para mañanas críticas: 4 rondas, todo con RIR 3–4. Mantienes la racha sin cavar más fatiga.",
    exercises: [
      { id: "lowa", block: "R1", name: "Colgado activo", eq: ["ladder"], sets: 4, reps: "30 s", rir: 4, tempo: "Isométrico", rest: 0,
        tips: ["Despierta hombros y descomprime la columna.", "Escápulas activas, no pasivo."] },
      { id: "lowb", block: "R2", name: "Dominadas", eq: ["ladder"], sets: 4, reps: "3–4", rir: 4, tempo: "2-0-1-0", rest: 0,
        tips: ["Lejos del fallo a propósito.", "Calidad total en cada rep."] },
      { id: "lowc", block: "R3", name: "Flexiones", eq: ["bw"], sets: 4, reps: "8–10", rir: 3, tempo: "2-0-1-0", rest: 0,
        tips: ["Ritmo cómodo, respiración nasal."] },
      { id: "lowd", block: "R4", name: "Sentadilla goblet", eq: ["db"], sets: 4, reps: "10", rir: 3, tempo: "3-1-1-0", rest: 0,
        tips: ["Una mancuerna de 10 kg al pecho.", "Pausa abajo empujando rodillas hacia fuera."] },
      { id: "lowe", block: "R5", name: "Swing con KB", eq: ["kb"], sets: 4, reps: "15", rir: 3, tempo: "Explosivo", rest: 60,
        tips: ["Cadera potente, brazos sueltos.", "Descansa 60 s y empieza la siguiente ronda."] },
    ],
  },
];

const WARMUP = [
  { name: "Colgado + retracciones escapulares", detail: "30 s colgado activo, luego 8 retracciones lentas en la espaldera.", eq: "Swedish ladder" },
  { name: "Halos con KB + círculos de cadera", detail: "5 halos por lado con KB de 8 kg y 10 círculos de cadera.", eq: "KB 8 kg" },
  { name: "Sentadilla goblet con pausa", detail: "Mantén la posición baja con la KB y empuja las rodillas con los codos. Sube y repite 5 veces.", eq: "KB 8 kg" },
  { name: "World's greatest stretch", detail: "3 por lado: zancada, codo al empeine, rotación torácica hacia arriba.", eq: "Peso corporal" },
  { name: "Swings ligeros + flexiones inclinadas", detail: "2 × 10 swings y 5 flexiones con las manos en un peldaño alto.", eq: "KB 8 kg + espaldera" },
];

const BLOCK_WEEKS = [
  { n: 1, label: "Reactivación", note: "RIR +1 sobre lo indicado. Cuida el SNC: técnica y tempo, nada al fallo.", rir: 1, sets: 0 },
  { n: 2, label: "Base", note: "RIR tal como está escrito. Sube 1 rep por serie donde puedas.", rir: 0, sets: 0 },
  { n: 3, label: "Sobrecarga", note: "RIR −1. Alarga las pausas 1 s o añade 1 s a la excéntrica.", rir: -1, sets: 0 },
  { n: 4, label: "Descarga", note: "Una serie menos y RIR +2. Recupera antes del siguiente bloque.", rir: 2, sets: -1 },
];

// Hábitos Obligatorios: definen el 100 % del día. Hábitos Facultativos: bonus aparte.
// `notion` es el nombre exacto de la columna en la base "Registro diario".
const HABITS_REQ = [
  { id: "o_creatine", code: "O1", label: "Tomar creatina todos los días.", icon: FlaskConical, notion: "O1 · Tomar creatina" },
  { id: "o_prep", code: "O2", label: "Alistar la creatina del día siguiente.", icon: PackageCheck, notion: "O2 · Alistar creatina de mañana" },
  { id: "o_water", code: "O3", label: "Tomar 2 botellas de agua (2L en total).", icon: Droplets, notion: "O3 · 2 botellas de agua (2 L)" },
  { id: "o_pills", code: "O4", label: "Tomar pastillas (magnesio, omega 3, vitamina C).", icon: Pill, notion: "O4 · Pastillas (Mg, Ω3, Vit C)" },
  { id: "o_screens", code: "O5", label: "Dejar dispositivos electrónicos a las 10:30 p.m.", icon: MonitorOff, notion: "O5 · Pantallas off 10:30 p.m." },
];
const HABITS_OPT = [
  { id: "f_read", code: "F1", label: "Leer 15 min de libro personal.", icon: BookOpen, notion: "F1 · Leer 15 min" },
  { id: "f_shake", code: "F2", label: "Tomar batido de proteína.", icon: Milk, notion: "F2 · Batido de proteína" },
];
const HABITS_ALL = [...HABITS_REQ, ...HABITS_OPT];
const CREATINE_ID = "o_creatine";
const reqDone = (h) => HABITS_REQ.filter((x) => h && h[x.id]).length;
const optDone = (h) => HABITS_OPT.filter((x) => h && h[x.id]).length;

/* ───────────────────────── Sustituciones (solo tu equipo) ───────────────────────── */
// kind "eq": equivalente biomecánico (mismos músculos). kind "imp": mismo patrón con otro implemento.
// reps, tempo y RIR reemplazan a los del ejercicio original; las series se mantienen.

const SUB_KIND = { eq: "Equivalente biomecánico", imp: "Mismo patrón, otro implemento" };

const SUBS = {
  d1a1: [
    { id: "chin", kind: "eq", name: "Dominadas supinas", eq: ["ladder"], reps: "5–7", tempo: "3-1-1-0", rir: 2, why: "Mismo dorsal con más bíceps; suelen salir 1–2 reps más." },
    { id: "neg", kind: "eq", name: "Dominadas negativas lentas", eq: ["ladder"], reps: "4–5", tempo: "5-0-X-0", rir: 2, why: "Si hoy no salen completas: solo la bajada de 5 s." },
    { id: "dbrow", kind: "imp", name: "Remo unilateral con mancuerna", eq: ["db"], reps: "10–12 / lado", tempo: "3-1-1-1", rir: 1, why: "Tracción con carga externa; más reps porque 10 kg pesan menos que tu cuerpo." },
  ],
  d1a2: [
    { id: "deficit", kind: "eq", name: "Flexiones con déficit", eq: ["bw", "bar"], reps: "10–15", tempo: "3-1-1-0", rir: 2, why: "Pecho y tríceps con más recorrido, sin cargar el hombro arriba." },
    { id: "diamond", kind: "eq", name: "Flexiones diamante", eq: ["bw"], reps: "8–12", tempo: "2-1-1-0", rir: 2, why: "Más tríceps, como el fondo." },
    { id: "floorpress", kind: "imp", name: "Press de suelo con barra", eq: ["bar"], reps: "8–10", tempo: "3-1-1-0", rir: 2, why: "Mismo empuje con barra; el suelo limita el rango si el hombro molesta." },
  ],
  d1b1: [
    { id: "pendlay", kind: "eq", name: "Remo Pendlay con barra", eq: ["bar"], reps: "6–8", tempo: "1-0-X-1", rir: 2, why: "Desde el piso cada rep: más potencia y espalda media." },
    { id: "dbrow2", kind: "imp", name: "Remo inclinado con 2 mancuernas", eq: ["db"], reps: "12–15", tempo: "2-0-1-2", rir: 1, why: "Mismo ángulo; compensa los 10 kg con más reps y la pausa." },
    { id: "kbrow", kind: "imp", name: "Remo inclinado con 2 KB", eq: ["kb"], reps: "12–15", tempo: "2-0-1-2", rir: 1, why: "Agarre neutro, más amable para codos." },
  ],
  d1b2: [
    { id: "pike", kind: "eq", name: "Flexiones pike (pies en peldaño)", eq: ["ladder", "bw"], reps: "6–10", tempo: "3-1-1-0", rir: 2, why: "Empuje vertical con tu peso; deltoide anterior y tríceps." },
    { id: "kbpress", kind: "imp", name: "Press de hombro unilateral con KB", eq: ["kb"], reps: "10–12 / lado", tempo: "3-0-1-0", rir: 2, why: "La KB cuelga detrás del antebrazo: más estabilidad de hombro." },
    { id: "ohp", kind: "imp", name: "Press militar con barra (carga parcial)", eq: ["bar"], reps: "6–8", tempo: "3-0-1-0", rir: 2, why: "Ambos brazos a la vez; usa solo los discos que controles." },
  ],
  d1c1: [
    { id: "pausepu", kind: "eq", name: "Flexiones con pausa de 2 s", eq: ["bw"], reps: "12–20", tempo: "3-2-1-0", rir: 1, why: "Sin discos: la pausa compensa el menor recorrido." },
    { id: "dbfloor", kind: "imp", name: "Press de suelo con mancuernas", eq: ["db"], reps: "12–15", tempo: "3-1-1-0", rir: 1, why: "Mismo pecho y tríceps con carga externa." },
    { id: "mbpu", kind: "imp", name: "Flexiones con una mano sobre el balón", eq: ["mb"], reps: "6–8 / lado", tempo: "2-1-1-0", rir: 2, why: "Recorrido extra en un lado y más estabilidad." },
  ],
  d1c2: [
    { id: "knees", kind: "eq", name: "Rodillas al pecho colgado", eq: ["ladder"], reps: "10–15", tempo: "2-1-2-0", rir: 2, why: "Mismo abdomen con palanca corta." },
    { id: "lyinglr", kind: "eq", name: "Elevaciones de piernas acostado", eq: ["ladder", "bw"], reps: "12–15", tempo: "2-1-3-0", rir: 1, why: "Manos en un peldaño; sin fatiga de agarre." },
    { id: "deadbugmb", kind: "imp", name: "Dead bug con balón medicinal", eq: ["mb"], reps: "8 / lado", tempo: "Lento", rir: 2, why: "Antiextensión del core sostenido el balón con brazos y rodillas." },
  ],
  d2a: [
    { id: "front", kind: "eq", name: "Sentadilla frontal con barra", eq: ["bar"], reps: "5–8", tempo: "3-1-1-0", rir: 2, why: "Más cuádriceps y torso erguido; menos carga en la espalda baja." },
    { id: "boxmb", kind: "eq", name: "Sentadilla a caja con balón al pecho", eq: ["mb"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Profundidad fija: la mejor opción si la rodilla está sensible." },
    { id: "gobletdb", kind: "imp", name: "Sentadilla goblet con mancuerna", eq: ["db"], reps: "12–15", tempo: "3-2-1-0", rir: 2, why: "Mismo patrón con 10 kg; la pausa de 2 s compensa la carga." },
  ],
  d2b: [
    { id: "bulgariso", kind: "eq", name: "Sentadilla búlgara con pausa isométrica", eq: ["ladder", "bw"], reps: "6–8 / pierna", tempo: "3-3-1-0", rir: 2, why: "Pie de atrás en un peldaño bajo; misma estabilidad de rodilla con más apoyo." },
    { id: "boxpistol", kind: "eq", name: "Pistol a caja (sentarse y subir)", eq: ["bw"], reps: "5–8 / pierna", tempo: "3-2-1-0", rir: 2, why: "Unilateral con tope de profundidad." },
    { id: "stepup", kind: "imp", name: "Step-up lento al peldaño con KB", eq: ["kb", "ladder"], reps: "8 / pierna", tempo: "3-1-1-0", rir: 2, why: "Control de rodilla y tobillo con carga en la mano." },
  ],
  d2c1: [
    { id: "splitmb", kind: "eq", name: "Split squat estático con balón", eq: ["mb"], reps: "10 / pierna", tempo: "2-1-1-0", rir: 2, why: "Mismo patrón sin pasos: menos fuerza de cizalla en la rodilla." },
    { id: "revdb", kind: "imp", name: "Zancadas inversas con mancuernas", eq: ["db"], reps: "8 / pierna", tempo: "2-1-1-0", rir: 2, why: "Pasar hacia atrás descarga la rodilla delantera." },
    { id: "rackkb", kind: "imp", name: "Zancadas con 2 KB en rack", eq: ["kb"], reps: "8 / pierna", tempo: "2-1-1-0", rir: 2, why: "Carga frontal: más core y torso erguido." },
  ],
  d2c2: [
    { id: "altfast", kind: "eq", name: "Zancadas alternas rápidas sin salto", eq: ["bw"], reps: "10 / pierna", tempo: "Rápido controlado", rir: 2, why: "Mismo patrón sin impacto: para días de tobillo débil." },
    { id: "swing", kind: "imp", name: "Swing con KB", eq: ["kb"], reps: "15", tempo: "Explosivo", rir: 2, why: "Potencia de cadera sin aterrizajes." },
    { id: "mbthrow", kind: "imp", name: "Lanzamiento de balón desde sentadilla", eq: ["mb"], reps: "8", tempo: "Explosivo", rir: 2, why: "Extensión explosiva de cadera y rodilla; no saltas, lanzas." },
  ],
  d2d: [
    { id: "slrdl", kind: "eq", name: "RDL a una pierna con KB", eq: ["kb"], reps: "8 / pierna", tempo: "3-1-1-0", rir: 2, why: "Isquio y glúteo con trabajo extra de tobillo." },
    { id: "goodmorning", kind: "eq", name: "Good morning con barra", eq: ["bar"], reps: "10–12", tempo: "3-1-1-0", rir: 3, why: "Misma bisagra con la barra en la espalda; carga moderada." },
    { id: "dbrdl", kind: "imp", name: "RDL con mancuernas", eq: ["db"], reps: "12–15", tempo: "3-1-1-0", rir: 1, why: "Mismo patrón con 2 × 10 kg y más reps." },
  ],
  d2e: [
    { id: "suitcase", kind: "eq", name: "Suitcase carry (1 KB)", eq: ["kb"], reps: "30 s / lado", tempo: "Marcha", rir: 2, why: "Carga en una mano: el core resiste la inclinación." },
    { id: "rackcarry", kind: "eq", name: "Front rack carry (2 KB)", eq: ["kb"], reps: "30 s", tempo: "Marcha", rir: 2, why: "Mismo paseo con las KB en el pecho: más core, menos agarre." },
    { id: "dbfarmer", kind: "imp", name: "Farmer's walk con 2 mancuernas", eq: ["db"], reps: "30 s", tempo: "Marcha", rir: 2, why: "10 kg por mano: un poco más de carga." },
  ],
  d2f1: [
    { id: "kneeschest", kind: "eq", name: "Rodillas al pecho colgado", eq: ["ladder"], reps: "10–12", tempo: "Controlado", rir: 2, why: "Mismo abdomen colgado con palanca corta." },
    { id: "vupmb", kind: "imp", name: "V-ups con balón medicinal", eq: ["mb"], reps: "10–12", tempo: "2-0-1-0", rir: 2, why: "Flexión de cadera y tronco en el piso, pasando el balón de manos a pies." },
  ],
  d2f2: [
    { id: "revcrunch", kind: "eq", name: "Crunch invertido en el piso", eq: ["bw"], reps: "12–15", tempo: "2-1-2-0", rir: 1, why: "Retroversión pélvica sin colgar." },
    { id: "lrmb", kind: "imp", name: "Elevaciones de piernas con balón entre los pies", eq: ["mb"], reps: "10–12", tempo: "2-1-3-0", rir: 1, why: "Más palanca con el mismo gesto." },
    { id: "deadbugkb", kind: "imp", name: "Dead bug con KB (brazos estirados)", eq: ["kb"], reps: "8 / lado", tempo: "Lento", rir: 2, why: "Antiextensión con carga arriba." },
  ],
  d3a: [
    { id: "gobletank", kind: "imp", name: "Sentadilla goblet con pausa + círculos de tobillo", eq: ["kb"], reps: "6 + 8 / lado", tempo: "Lento", rir: 4, why: "La pausa abajo con la KB abre tobillo y cadera a la vez." },
    { id: "slbridge", kind: "eq", name: "Puente de glúteo a una pierna", eq: ["bw"], reps: "10 / lado", tempo: "2-1-1-0", rir: 4, why: "Activa el glúteo, que es el que estabiliza la rodilla al correr." },
  ],
  d3b: [
    { id: "march", kind: "eq", name: "Marcha en el sitio con rodillas altas", eq: ["bw"], reps: "3 min", tempo: "Ritmo ágil", rir: 4, why: "Mismo calentamiento sin salir de casa." },
    { id: "bikein", kind: "imp", name: "Bici estática suave", eq: ["bike"], reps: "5 min", tempo: "Cadencia cómoda", rir: 4, why: "Sube pulsaciones sin ningún impacto." },
  ],
  d3c: [
    { id: "powerwalk", kind: "eq", name: "Caminata rápida continua", eq: ["run"], reps: "4 min", tempo: "Ritmo fuerte", rir: 3, why: "Mismo trabajo aeróbico con mucho menos golpe: para días de rodilla o tobillo sensibles." },
    { id: "bikeint", kind: "imp", name: "Bici estática: 3 min fuerte + 1 min suave", eq: ["bike"], reps: "3 min fuertes", tempo: "Cadencia alta", rir: 3, why: "Mismos intervalos sin impacto." },
    { id: "kbcardio", kind: "imp", name: "Circuito sin impacto: swing 30 s + marcha 30 s", eq: ["kb"], reps: "3 min", tempo: "Continuo", rir: 3, why: "Cardio en casa si llueve: la cadera trabaja y los pies no despegan." },
  ],
  d3d: [
    { id: "marchcool", kind: "eq", name: "Marcha suave en el sitio + respiración nasal", eq: ["bw"], reps: "4 min", tempo: "Suave", rir: 4, why: "Misma vuelta a la calma en casa." },
    { id: "bikecool", kind: "imp", name: "Bici estática muy suave", eq: ["bike"], reps: "4 min", tempo: "Sin resistencia", rir: 4, why: "Baja pulsaciones sin cargar las piernas." },
  ],
  d3e: [
    { id: "slcalf", kind: "eq", name: "Elevaciones de talón a una pierna", eq: ["ladder"], reps: "8 / pierna", tempo: "1-0-3-1", rir: 2, why: "Más carga por tobillo cuando las de dos piernas ya son fáciles." },
    { id: "kbcalf", kind: "imp", name: "Elevaciones de talón con 2 KB", eq: ["kb"], reps: "12–15", tempo: "1-1-3-0", rir: 2, why: "En el piso y con carga en las manos: más estable." },
    { id: "isocalf", kind: "eq", name: "Isométrico de gemelo en peldaño", eq: ["ladder"], reps: "30 s", tempo: "Isométrico", rir: 2, why: "Sin movimiento: la opción si el tendón está cargado." },
  ],
  d3f: [
    { id: "heelwalk", kind: "eq", name: "Caminar de talones + equilibrio a una pierna", eq: ["bw"], reps: "30 s + 30 s / pierna", tempo: "Controlado", rir: 3, why: "El mismo tibial, caminando con las puntas arriba." },
    { id: "mbbalance", kind: "imp", name: "Equilibrio a una pierna pasando el balón", eq: ["mb"], reps: "30 s / pierna", tempo: "Controlado", rir: 3, why: "El balón alrededor de la cintura obliga al tobillo a corregir." },
  ],
  d4a: [
    { id: "kbthr", kind: "imp", name: "Thruster con 2 KB", eq: ["kb"], reps: "8–10", tempo: "2-0-X-0", rir: 2, why: "Mismo patrón con KB en rack." },
    { id: "dbthr", kind: "imp", name: "Thruster con mancuernas", eq: ["db"], reps: "8–10", tempo: "2-0-X-0", rir: 2, why: "Cada brazo libre; más fácil para la muñeca." },
    { id: "wallball", kind: "imp", name: "Wall ball con balón medicinal", eq: ["mb"], reps: "12–15", tempo: "2-0-X-0", rir: 2, why: "Sentadilla y empuje lanzando el balón a la pared; recíbelo sin saltar." },
  ],
  d4b: [
    { id: "dbcomplex", kind: "imp", name: "Complejo con mancuernas: 5 swing + 5 clean + 5 sentadilla + 5 press", eq: ["db"], reps: "1 ronda (20 reps)", tempo: "Fluido", rir: 2, why: "Misma secuencia con mancuernas." },
    { id: "barcomplex", kind: "imp", name: "Complejo con barra: 5 RDL + 5 remo + 5 sentadilla frontal + 5 press", eq: ["bar"], reps: "1 ronda (20 reps)", tempo: "Fluido", rir: 2, why: "Cadena completa sin soltar la barra; carga parcial." },
    { id: "kbsingle", kind: "eq", name: "Complejo con una KB, alternando lados", eq: ["kb"], reps: "1 ronda / lado", tempo: "Fluido", rir: 2, why: "Mismo flujo con la mitad de carga y más core." },
  ],
  d4c1: [
    { id: "assisted", kind: "eq", name: "Dominadas asistidas con pies en peldaño", eq: ["ladder"], reps: "6–8", tempo: "3-0-1-0", rir: 2, why: "Recorrido completo con ayuda de las piernas." },
    { id: "dbrowslow", kind: "imp", name: "Remo unilateral con mancuerna, bajada de 4 s", eq: ["db"], reps: "10 / lado", tempo: "4-0-1-1", rir: 2, why: "Mismo énfasis excéntrico en horizontal." },
  ],
  d4c2: [
    { id: "halftgu", kind: "eq", name: "Medio get-up (hasta la mano)", eq: ["kb"], reps: "3 / lado", tempo: "Lento", rir: 3, why: "La parte más técnica, repetida." },
    { id: "windmill", kind: "eq", name: "Windmill con KB", eq: ["kb"], reps: "5 / lado", tempo: "Lento", rir: 3, why: "Hombro estable arriba y bisagra lateral." },
    { id: "dbtgu", kind: "imp", name: "Turkish get-up con mancuerna", eq: ["db"], reps: "1 / lado", tempo: "Lento", rir: 3, why: "Mismo movimiento con otra carga." },
  ],
  d4d1: [
    { id: "tuck", kind: "eq", name: "Tuck hold en espaldera", eq: ["ladder"], reps: "15–25 s", tempo: "Isométrico", rir: 2, why: "La versión con rodillas recogidas del L-sit." },
    { id: "hollow", kind: "eq", name: "Hollow hold en el piso", eq: ["bw"], reps: "20–30 s", tempo: "Isométrico", rir: 2, why: "Misma tensión abdominal sin cargar las muñecas." },
    { id: "mbplank", kind: "imp", name: "Plancha con antebrazos sobre el balón", eq: ["mb"], reps: "20–30 s", tempo: "Isométrico", rir: 2, why: "Base inestable: el core trabaja más." },
  ],
  d4d2: [
    { id: "suitcase4", kind: "eq", name: "Suitcase carry (1 KB)", eq: ["kb"], reps: "40 s / lado", tempo: "Marcha", rir: 2, why: "Carga a un solo lado: misma antiinclinación." },
    { id: "rackmarch", kind: "eq", name: "Marcha con KB en rack unilateral", eq: ["kb"], reps: "40 s / lado", tempo: "Marcha", rir: 2, why: "La carga en el pecho exige más estabilidad." },
    { id: "ohcarry", kind: "imp", name: "Marcha con mancuerna sobre la cabeza", eq: ["db"], reps: "30 s / lado", tempo: "Marcha", rir: 2, why: "Core y hombro estables con el brazo arriba." },
  ],
  lowa: [
    { id: "scap", kind: "eq", name: "Retracciones escapulares colgado", eq: ["ladder"], reps: "8–10", tempo: "Lento", rir: 4, why: "Mismo despertar de hombros, con movimiento." },
    { id: "farmerhold", kind: "imp", name: "Farmer hold estático (2 KB)", eq: ["kb"], reps: "30 s", tempo: "Isométrico", rir: 4, why: "Agarre y postura sin colgarte." },
  ],
  lowb: [
    { id: "neglow", kind: "eq", name: "Dominadas negativas", eq: ["ladder"], reps: "2–3", tempo: "4-0-X-0", rir: 4, why: "Tracción vertical aún más suave." },
    { id: "dbrowlow", kind: "imp", name: "Remo unilateral con mancuerna", eq: ["db"], reps: "8 / lado", tempo: "2-0-1-0", rir: 4, why: "Tracción con carga ligera." },
  ],
  lowc: [
    { id: "inclow", kind: "eq", name: "Flexiones inclinadas en peldaño", eq: ["ladder", "bw"], reps: "10–12", tempo: "2-0-1-0", rir: 3, why: "Mismo empuje, más fácil." },
    { id: "dbfloorlow", kind: "imp", name: "Press de suelo con mancuernas", eq: ["db"], reps: "10–12", tempo: "2-0-1-0", rir: 3, why: "Empuje acostado, sin cargar muñecas." },
  ],
  lowd: [
    { id: "kbgoblet", kind: "imp", name: "Sentadilla goblet con KB", eq: ["kb"], reps: "10", tempo: "3-1-1-0", rir: 3, why: "Mismo ejercicio con la KB." },
    { id: "boxlow", kind: "eq", name: "Sentadilla a caja con balón", eq: ["mb"], reps: "10", tempo: "3-1-1-0", rir: 3, why: "Profundidad controlada para días de rodilla sensible." },
  ],
  lowe: [
    { id: "dbrdllow", kind: "imp", name: "RDL con mancuernas", eq: ["db"], reps: "12", tempo: "2-0-1-0", rir: 3, why: "Misma bisagra de cadera sin el impulso." },
    { id: "dbswing", kind: "imp", name: "Swing con mancuerna", eq: ["db"], reps: "15", tempo: "Explosivo", rir: 3, why: "Mismo swing con la mancuerna a dos manos." },
    { id: "bridgemb", kind: "eq", name: "Puente de glúteo con balón entre las rodillas", eq: ["mb"], reps: "15", tempo: "2-1-1-0", rir: 3, why: "Extensión de cadera sin carga en la espalda." },
  ],
};

const altFor = (exId, altId) => (altId ? (SUBS[exId] || []).find((a) => a.id === altId) || null : null);

/* ───────────────────────── Google Health: historial real, parser y métricas ───────────────────────── */

// El historial vive en tus datos (clave "health"), no en el código.
const GH_SEED_ROWS = [];
const GH_SEED = GH_SEED_ROWS.map(([weekStart, totalSteps, avgSteps, bestDay, bestSteps, floors, distanceKm, caloriesAvg, azmTotal, sleepAvgMin, activeHours, restingHr, weightKg]) => ({
  weekStart, totalSteps, avgSteps, bestDay, bestSteps, floors, distanceKm, caloriesAvg, azmTotal, sleepAvgMin, activeHours, restingHr, weightKg, source: "gmail",
}));

const SAMPLE_EMAIL = `Weekly stats

Here are your stats for Jan 3 - Jan 9

Sun Mon Tue Wed Thu Best day!
9,000 Sat

42,000

total steps

best day Best day · 9,000

hourly activity Avg 6,000 steps/day

total floors

40

total floors

total distance

30.00

total kilometers

total calories

2,500

avg. calories burned

total active zone minutes

300

total active zone minutes

total sleep

7h 30m

avg. restful sleep

hourly activity

4 of 9h

avg. hrs with 250+ steps

55 bpm

avg. resting heart rate

weight

70.0kg
`;

const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// Índice en DAYS (Lun=0 … Dom=6) para cada abreviatura inglesa del correo
const EN_DAY = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

function parseNum(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  const n = Number(s.replace(",", "."));
  return isNaN(n) ? null : n;
}
const NUM = "(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d+)?)";

// Infiere el año: el reporte siempre es de una semana pasada
function inferDate(monTxt, day) {
  const m = monTxt.toLowerCase().slice(0, 3);
  let mi = MONTHS_EN.indexOf(m);
  if (mi < 0) mi = MONTHS_ES.indexOf(m);
  if (mi < 0) return null;
  const now = new Date();
  let d = new Date(now.getFullYear(), mi, Number(day));
  if (d > addDays(now, 7)) d = new Date(now.getFullYear() - 1, mi, Number(day));
  return dkey(d);
}

function parseHealth(text) {
  const low = text.replace(/ /g, " ").toLowerCase();
  const out = {};
  const pick = (re) => { const m = low.match(re); return m ? parseNum(m[1]) : null; };
  const ws = "[\\s·:]*";

  const range = low.match(/stats for\s+([a-z]{3})[a-z]*\.?\s+(\d{1,2})\s*[-–]\s*([a-z]{3})[a-z]*\.?\s+(\d{1,2})/);
  if (range) out.weekStart = inferDate(range[1], range[2]);

  out.totalSteps = pick(new RegExp(NUM + "\\s+total steps")) ?? pick(new RegExp("(?:pasos totales|total de pasos)" + ws + NUM));
  out.avgSteps = pick(new RegExp("avg\\.?\\s+" + NUM + "\\s+steps\\s*/\\s*day")) ?? pick(new RegExp("(?:promedio diario|promedio)" + ws + NUM + "\\s*pasos"));
  out.bestSteps = pick(new RegExp("best day\\s*·\\s*" + NUM)) ?? pick(new RegExp("mejor d[ií]a[^\\d]{0,30}" + NUM));
  out.floors = pick(new RegExp("total floors\\s+" + NUM + "\\s+total floors"));
  out.distanceKm = pick(new RegExp("total distance\\s+" + NUM + "\\s+total kilometers")) ?? pick(new RegExp(NUM + "\\s*(?:km|kil[oó]metros)"));
  out.caloriesAvg = pick(new RegExp("total calories\\s+" + NUM + "\\s+avg\\.? calories")) ?? pick(new RegExp("calor[ií]as[^\\d]{0,20}" + NUM));
  out.azmTotal = pick(new RegExp("total active zone minutes\\s+" + NUM + "\\s+total active zone minutes")) ??
    pick(new RegExp(NUM + "[ \\t]*(?:active zone minutes|minutos en zona activa)")) ??
    pick(new RegExp("(?:minutos en zona activa|active zone minutes)" + ws + NUM));
  out.activeHours = pick(/(\d+)\s+of\s+\d+\s*h/);
  out.restingHr = pick(/(\d{2,3})\s*bpm/);
  out.weightKg = pick(/(\d{2,3}(?:\.\d)?)\s*kg/);

  const sl = low.match(/(?:total sleep|sueño|sleep)[^\d]{0,30}(\d{1,2})\s*(?:h|hr|hrs|horas?)\s*(\d{1,2})?\s*(?:m|min)?/);
  if (sl) out.sleepAvgMin = Number(sl[1]) * 60 + (sl[2] ? Number(sl[2]) : 0);

  // Mejor día: en la fila del gráfico su nombre se sustituye por "Best day!", así que es el que falta
  const a = range ? low.indexOf(range[0]) + range[0].length : 0;
  const b = low.indexOf("total steps", a);
  if (b > a) {
    const seen = new Set((low.slice(a, b).match(/\b(sun|mon|tue|wed|thu|fri|sat)\b/g) || []).map((d) => EN_DAY[d]));
    if (seen.size === 6) out.bestDay = [0, 1, 2, 3, 4, 5, 6].find((i) => !seen.has(i));
  }
  if (out.bestDay == null) {
    const m = low.match(/(?:mejor día|mejor dia)[^a-záéíóú]*(?:fue\s+)?(?:el\s+)?(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/);
    if (m) out.bestDay = ["lunes", "martes", "mi", "jueves", "viernes", "s", "domingo"].findIndex((p) => m[1].startsWith(p));
  }
  Object.keys(out).forEach((k) => out[k] == null && delete out[k]);
  return out;
}

function deriveWeek(w) {
  if (!w) return null;
  const steps = (w.steps || []).map((n) => Number(n) || 0);
  const hasDaily = steps.some((n) => n > 0);
  const totalSteps = Number(w.totalSteps) || (hasDaily ? steps.reduce((a, b) => a + b, 0) : 0);
  const avgSteps = Number(w.avgSteps) || totalSteps / 7;
  const start = fromKey(w.weekStart);
  // Etiquetas de los 7 días reales del reporte (Google Health empieza en sábado)
  const dayLabels = Array.from({ length: 7 }, (_, i) => DAYS[(addDays(start, i).getDay() + 6) % 7]);
  return { ...w, steps, hasDaily, totalSteps, avgSteps, dayLabels, weekEnd: dkey(addDays(start, 6)) };
}

const fmtRange = (w) => `${fmtShort(w.weekStart)} – ${fmtShort(dkey(addDays(fromKey(w.weekStart), 6)))}`;

/* ───────────────────────── Utilidades del programa ───────────────────────── */

const effSets = (ex, week) => Math.max(1, ex.sets + (BLOCK_WEEKS[week - 1]?.sets || 0));
const effRir = (ex, week) => Math.max(0, ex.rir + (BLOCK_WEEKS[week - 1]?.rir || 0));
const routineById = (id) => ROUTINES.find((r) => r.id === id) || ROUTINES[0];
const pruneDays = (obj, n) => Object.fromEntries(Object.keys(obj).sort().slice(-n).map((k) => [k, obj[k]]));

/* ───────────────────────── Planificador semanal (oficina / casa, fatiga) ───────────────────────── */

const MAIN = ["d1", "d2", "d3", "d4"];
const TAG = { d1: "TOR", d2: "PIE", d3: "RUN", d4: "FUL", low: "RES" };
const DEFAULT_OFFICE = [true, false, true, true, true, false, false]; // Lun…Dom: true = voy a la oficina

// Puntaje de una semana (menor es mejor). arr[i] = rutina del día i o null.
// Un día de oficina con la noche libre (sin clase) se entrena de noche: no compite con la mañana corta.
const isEvening = (office, night, i) => !!(night && night[i] && office[i]);
function scorePlan(arr, office, night) {
  let s = 0;
  for (let i = 0; i < 7; i++) {
    const r = arr[i];
    if (!r) continue;
    const prev = i > 0 ? arr[i - 1] : null;
    const eve = isEvening(office, night, i);
    if (eve) s -= 8; // marcaste esa noche libre para entrenar: se aprovecha
    if (prev && isEvening(office, night, i - 1) && !eve) s += office[i] ? 6 : 3; // de noche y otra vez al amanecer: poca recuperación (en casa puedes empezar más tarde)
    if (office[i] && !eve) s += 6 + Math.max(0, routineById(r).minutes - 35) * 0.4; // mañana corta: mejor descansar o sesión breve
    if (i === 6) s += 3; // el domingo se prefiere libre
    if (prev) {
      s += 2; // días seguidos
      if (r === "d3" && prev === "d2") s += 1000; // nunca correr el día después de pierna
      if (r === "d3" && prev === "d4") s += 12; // full body también carga piernas
      if (r === "d2" && prev === "d3") s += 8; // pierna con las piernas del trote
      if ((r === "d4" && prev === "d2") || (r === "d2" && prev === "d4")) s += 6;
      if (i > 1 && arr[i - 2]) s += 8; // tres días seguidos
    }
  }
  s += MAIN.filter((m) => !arr.includes(m)).length * 100; // sesión que no cabe
  return s;
}

// Todas las formas de colocar las sesiones pendientes en los días libres desde fromIdx, de mejor a peor.
function rankPlans(office, fixed, fromIdx, night) {
  const done = Object.values(fixed);
  const left = MAIN.filter((m) => !done.includes(m));
  const free = [];
  for (let i = fromIdx; i < 7; i++) if (!fixed[i]) free.push(i);
  const base = Array(7).fill(null);
  Object.keys(fixed).forEach((i) => { base[i] = fixed[i]; });
  const out = [];
  const rec = (si, arr) => {
    if (si === left.length) { out.push({ arr: arr.slice(), score: scorePlan(arr, office, night) }); return; }
    for (const d of free) if (!arr[d]) { arr[d] = left[si]; rec(si + 1, arr); arr[d] = null; }
    rec(si + 1, arr);
  };
  rec(0, base);
  out.sort((a, b) => a.score - b.score || a.arr.join().localeCompare(b.arr.join()));
  return out;
}

function weekState(weekPlan, log, mk) {
  const keys = Array.from({ length: 7 }, (_, i) => dkey(addDays(fromKey(mk), i)));
  const stored = (weekPlan || {})[mk];
  const lastKey = Object.keys(weekPlan || {}).filter((k) => k <= mk && weekPlan[k] && weekPlan[k].office).sort().pop();
  const office = (stored && stored.office) || (lastKey && weekPlan[lastKey].office) || DEFAULT_OFFICE;
  const night = (stored && Array.isArray(stored.night) && stored.night) || Array(7).fill(false); // las cancelaciones no se heredan de otra semana
  const fixed = {};
  keys.forEach((k, i) => { if (log[k]) fixed[i] = log[k].r; });
  let arr;
  if (stored && Array.isArray(stored.plan)) {
    const done = Object.values(fixed);
    arr = stored.plan.map((r, i) => (r && !fixed[i] && !done.includes(r) ? r : null));
    Object.keys(fixed).forEach((i) => { arr[i] = fixed[i]; });
  } else arr = rankPlans(office, fixed, 0, night)[0].arr;
  return { keys, office, night, fixed, arr };
}

function useWeekPlan(log) {
  const [weekPlan, setWeekPlan] = usePersisted("weekPlan", {});
  const today = dkey();
  const mk = dkey(mondayOf(new Date()));
  const todayIdx = dayDiff(today, mk);
  const ws = useMemo(() => weekState(weekPlan, log, mk), [weekPlan, log, mk]);

  const save = (all, office, plan, night) => pruneDays({ ...(all || {}), [mk]: { office, plan, night } }, 8);
  // Reacomodar: recoloca lo pendiente de hoy en adelante y, en cada toque, pasa a la siguiente mejor opción.
  const shuffle = () => setWeekPlan((all) => {
    const cur = weekState(all, log, mk);
    const ranked = rankPlans(cur.office, cur.fixed, todayIdx, cur.night);
    const ok = ranked.filter((p) => p.score < 1000);
    const pool = (ok.length ? ok : ranked).slice(0, 6);
    const idx = pool.findIndex((p) => p.arr.join() === cur.arr.join());
    return save(all, cur.office, pool[(idx + 1) % pool.length].arr, cur.night);
  });
  const toggleOffice = (i) => setWeekPlan((all) => {
    const cur = weekState(all, log, mk);
    const office = cur.office.map((v, k) => (k === i ? !v : v));
    return save(all, office, rankPlans(office, cur.fixed, todayIdx, cur.night)[0].arr, cur.night);
  });
  const toggleNight = (i) => setWeekPlan((all) => {
    const cur = weekState(all, log, mk);
    const night = cur.night.map((v, k) => (k === i ? !v : v));
    return save(all, cur.office, rankPlans(cur.office, cur.fixed, todayIdx, night)[0].arr, night);
  });
  const info = (dateKey) => {
    const m = dkey(mondayOf(fromKey(dateKey)));
    const w = m === mk ? ws : weekState(weekPlan, log, m);
    const i = dayDiff(dateKey, m);
    const rid = w.arr[i] || null;
    const evening = !!rid && isEvening(w.office, w.night, i);
    return { date: dateKey, office: !!w.office[i], night: !!w.night[i], rid, evening, wake: rid && !evening ? "6:30" : "7:00" };
  };
  const nextRid = ws.arr.slice(todayIdx).find((r, k) => r && !ws.fixed[todayIdx + k]) || null;
  const late = ws.arr.some((r, i) => r && i < todayIdx && !ws.fixed[i]);
  return { ...ws, todayIdx, shuffle, toggleOffice, toggleNight, info, nextRid, late };
}

function WeekCard({ wp, log }) {
  const today = dkey();
  const t = wp.info(today);
  const tm = wp.info(dkey(addDays(new Date(), 1)));
  const line = (x) => `${x.office ? "oficina" : "casa"} · ${x.rid ? routineById(x.rid).name + (x.evening ? " (de noche)" : "") : "descanso"} · despertar ${x.wake}`;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Mi semana</h2>
        <button onClick={wp.shuffle} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-xs font-medium hover:border-accent hover:text-accent"><Shuffle size={13} />Reacomodar</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {wp.keys.map((k, i) => {
          const l = log[k];
          const planned = wp.arr[i];
          const isToday = k === today;
          const missed = !l && planned && i < wp.todayIdx;
          const ring = l ? (routineById(l.r).low ? "bg-cool text-bg" : "bg-accent text-accentInk")
            : planned ? `border border-dashed ${missed ? "border-line text-muted/60" : "border-accent text-accent"}`
            : isToday ? "border border-line text-muted" : "bg-surface2 text-muted";
          return (
            <div key={k} className="text-center">
              <div className={`text-[10px] ${isToday ? "font-semibold text-accent" : "text-muted"}`}>{DAYS[i]}</div>
              <div className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full font-mono text-[9px] font-semibold ${ring}`}>{l ? TAG[l.r] : planned ? TAG[planned] : ""}</div>
              <button onClick={() => wp.toggleOffice(i)} aria-pressed={wp.office[i]} aria-label={`${DAYS_LONG[i]}: ${wp.office[i] ? "oficina" : "casa"}. Tocar para cambiar`} title={wp.office[i] ? "Oficina" : "Casa"}
                className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-md border ${wp.office[i] ? "border-warn/40 bg-warn/10 text-warn" : "border-line bg-surface2 text-muted"}`}>
                {wp.office[i] ? <Building2 size={13} /> : <Home size={13} />}
              </button>
              <button onClick={() => wp.toggleNight(i)} aria-pressed={wp.night[i]} aria-label={`${DAYS_LONG[i]}: noche ${wp.night[i] ? "libre, sin clase" : "con clase"}. Tocar para cambiar`} title={wp.night[i] ? "Noche libre" : "Noche con clase"}
                className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-md border ${wp.night[i] ? "border-cool/50 bg-cool/15 text-cool" : "border-line bg-surface2 text-muted/50"}`}>
                <Moon size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1"><Building2 size={11} className="text-warn" />oficina</span>
        <span className="inline-flex items-center gap-1"><Home size={11} />casa</span>
        <span className="inline-flex items-center gap-1"><Moon size={11} className="text-cool" />noche libre (sin clase)</span>
        <span>Toca un ícono para cambiarlo.</span>
      </p>
      <div className="mt-2 space-y-1 rounded-xl bg-surface2 px-3 py-2 text-xs">
        <div><span className="text-muted">Hoy:</span> {line(t)}</div>
        <div><span className="text-muted">Mañana:</span> {line(tm)}</div>
      </div>
      {wp.late && <p className="mt-2 text-xs text-warn">Quedó una sesión atrás. Toca «Reacomodar» para repartirla en lo que queda de la semana.</p>}
      <p className="mt-2 text-[11px] text-muted">Running nunca cae el día después de pierna, se evitan tres días seguidos y los días de oficina se dejan para descanso o la sesión más corta. Si un día de oficina tiene la noche libre, la sesión va de noche y se evita madrugar a entrenar al día siguiente si también es de oficina.</p>
    </section>
  );
}

function computeStreak(log) {
  const keys = Object.keys(log || {}).sort().reverse();
  if (!keys.length) return 0;
  if (dayDiff(dkey(), keys[0]) > 3) return 0;
  let n = 1;
  for (let i = 1; i < keys.length; i++) {
    if (dayDiff(keys[i - 1], keys[i]) <= 3) n++;
    else break;
  }
  return n;
}

let audioCtx = null;
function unlockAudio() {
  try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === "suspended") audioCtx.resume(); } catch (e) {}
}
function beep() {
  try {
    if (!audioCtx) return;
    [0, 0.25, 0.5].forEach((t) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.18);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
}

/* ───────────────────────── Componentes pequeños ───────────────────────── */

function Chip({ children, tone = "plain" }) {
  const tones = {
    plain: "bg-surface2 text-muted border-line",
    accent: "bg-accent/15 text-accent border-accent/30",
    good: "bg-good/15 text-good border-good/30",
    cool: "bg-cool/15 text-cool border-cool/30",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]}`}>{children}</span>;
}

function ProgressBar({ value }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin="0" aria-valuemax="100">
      <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

function SyncBadge() {
  const s = useSyncStatus();
  const map = {
    off: { icon: CloudOff, text: "Solo en este dispositivo", cls: "text-warn" },
    syncing: { icon: Cloud, text: "Sincronizando…", cls: "text-muted" },
    ok: { icon: Cloud, text: "Sincronizado", cls: "text-good" },
    error: { icon: CloudOff, text: s.code === "red" ? "Sin conexión" : "Error al sincronizar", cls: "text-warn" },
  };
  const m = map[s.state] || map.off;
  const Icon = m.icon;
  return <span className={`inline-flex items-center gap-1.5 text-xs ${m.cls}`}><Icon size={14} />{m.text}</span>;
}

/* ───────────────────────── Temporizador de descanso ───────────────────────── */

function RestTimer({ timer, setTimer }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [doneFlash, setDoneFlash] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!timer || timer.paused) return;
    fired.current = false;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timer]);

  const remaining = timer ? (timer.paused ? timer.left : Math.max(0, timer.endAt - now)) : 0;
  useEffect(() => {
    if (timer && !timer.paused && remaining <= 0 && !fired.current) {
      fired.current = true;
      beep();
      setDoneFlash(true);
      setTimer(null);
      setTimeout(() => setDoneFlash(false), 6000);
    }
  }, [remaining, timer, setTimer]);

  const start = (sec) => { unlockAudio(); setDoneFlash(false); setNow(Date.now()); setTimer({ endAt: Date.now() + sec * 1000, duration: sec * 1000 }); };
  const togglePause = () => {
    if (!timer) return;
    if (timer.paused) setTimer({ endAt: Date.now() + timer.left, duration: timer.duration });
    else setTimer({ ...timer, paused: true, left: remaining });
  };
  const secs = Math.ceil(remaining / 1000);
  const frac = timer ? remaining / timer.duration : 0;
  const R = 22, C = 2 * Math.PI * R;

  return (
    <div className="timer-dock fixed z-40 flex flex-col items-end gap-2">
      {doneFlash && (
        <button onClick={() => setDoneFlash(false)} className="flash rounded-2xl bg-accent px-4 py-3 text-left text-accentInk shadow-xl">
          <div className="font-display text-xl font-semibold uppercase leading-none">Descanso terminado</div>
          <div className="text-xs opacity-80">Siguiente serie. Toca para cerrar.</div>
        </button>
      )}
      {open && (
        <div className="w-64 rounded-2xl border border-line bg-surface p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-lg font-semibold uppercase tracking-wide">Descanso</span>
            <button onClick={() => setOpen(false)} className="rounded-full p-1 text-muted hover:text-fg" aria-label="Cerrar temporizador"><X size={18} /></button>
          </div>
          <div className="mb-3 text-center font-mono text-5xl tabular-nums">{timer ? `${Math.floor(secs / 60)}:${pad(secs % 60)}` : "0:00"}</div>
          <div className="grid grid-cols-4 gap-2">
            {[45, 60, 90, 120].map((s) => (
              <button key={s} onClick={() => start(s)} className="rounded-lg border border-line bg-surface2 py-2 font-mono text-sm hover:border-accent hover:text-accent">{s < 120 ? `${s}s` : "2m"}</button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={togglePause} disabled={!timer} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-surface2 py-2 text-sm disabled:opacity-40">
              {timer?.paused ? <Play size={15} /> : <Pause size={15} />}{timer?.paused ? "Seguir" : "Pausa"}
            </button>
            <button onClick={() => setTimer(null)} disabled={!timer} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-surface2 py-2 text-sm disabled:opacity-40"><RotateCcw size={15} />Reset</button>
          </div>
        </div>
      )}
      <button onClick={() => { unlockAudio(); setOpen((o) => !o); }} className="relative grid h-16 w-16 place-items-center rounded-full border border-line bg-surface shadow-2xl" aria-label="Abrir temporizador de descanso">
        <svg width="56" height="56" className="absolute -rotate-90">
          <circle cx="28" cy="28" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="4" />
          <circle cx="28" cy="28" r={R} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: "stroke-dashoffset .2s linear" }} />
        </svg>
        {timer ? <span className="relative font-mono text-sm font-medium tabular-nums">{secs}</span> : <Timer size={22} className="relative text-accent" />}
      </button>
    </div>
  );
}

/* ───────────────────────── Modo Arranque (5 min) ───────────────────────── */

function WarmupSheet({ onClose }) {
  const [idx, setIdx] = useState(0);
  const [endAt, setEndAt] = useState(null);
  const [left, setLeft] = useState(60000);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!endAt) return;
    const id = setInterval(() => {
      const l = endAt - Date.now();
      if (l <= 0) {
        beep();
        if (idx < WARMUP.length - 1) { setIdx((i) => i + 1); setEndAt(Date.now() + 60000); setLeft(60000); }
        else { setEndAt(null); setFinished(true); setLeft(0); }
      } else setLeft(l);
    }, 200);
    return () => clearInterval(id);
  }, [endAt, idx]);

  const run = () => { unlockAudio(); if (endAt) { setEndAt(null); } else { setEndAt(Date.now() + left); } };
  const step = WARMUP[idx];
  const s = Math.ceil(left / 1000);

  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="sheet w-full max-w-lg rounded-t-3xl border border-line bg-surface p-5 md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Modo Arranque · 5 min</div>
            <h2 className="font-display text-3xl font-semibold uppercase leading-none">Rompe la inercia</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:text-fg" aria-label="Cerrar"><X size={22} /></button>
        </div>
        <div className="mb-4 flex gap-1.5">
          {WARMUP.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i < idx || finished ? "bg-accent" : i === idx ? "bg-accent/50" : "bg-surface2"}`} />)}
        </div>
        {finished ? (
          <div className="py-6 text-center">
            <Check size={40} className="mx-auto mb-2 text-good" />
            <div className="font-display text-2xl font-semibold uppercase">Cuerpo encendido</div>
            <p className="mt-1 text-sm text-muted">Ve directo al bloque A de tu rutina.</p>
            <button onClick={onClose} className="mt-4 rounded-xl bg-accent px-5 py-2.5 font-semibold text-accentInk">Empezar rutina</button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-surface2 p-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted"><span>Ejercicio {idx + 1} de {WARMUP.length}</span><span>{step.eq}</span></div>
              <div className="text-lg font-semibold">{step.name}</div>
              <p className="mt-1 text-sm text-muted">{step.detail}</p>
            </div>
            <div className="my-5 text-center font-mono text-6xl tabular-nums">0:{pad(s)}</div>
            <div className="flex gap-2">
              <button onClick={() => { if (idx > 0) { setIdx(idx - 1); setLeft(60000); setEndAt(endAt ? Date.now() + 60000 : null); } }} className="rounded-xl bg-surface2 px-4 py-3 text-sm" aria-label="Anterior"><Minus size={16} /></button>
              <button onClick={run} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-accentInk">{endAt ? <Pause size={18} /> : <Play size={18} />}{endAt ? "Pausa" : idx === 0 && left === 60000 ? "Arrancar" : "Seguir"}</button>
              <button onClick={() => { if (idx < WARMUP.length - 1) { setIdx(idx + 1); setLeft(60000); setEndAt(endAt ? Date.now() + 60000 : null); } else { setFinished(true); setEndAt(null); } }} className="rounded-xl bg-surface2 px-4 py-3 text-sm" aria-label="Siguiente"><Plus size={16} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Tarjeta de ejercicio ───────────────────────── */

function SwapModal({ ex, week, current, onPick, onClose }) {
  const alts = SUBS[ex.id] || [];
  const row = (item, isOriginal) => {
    const active = isOriginal ? !current : current === item.id;
    const rirOrig = effRir(ex, week);
    const rirNew = effRir({ rir: item.rir }, week);
    return (
      <button key={isOriginal ? "original" : item.id} onClick={() => onPick(isOriginal ? null : item.id)} aria-pressed={active}
        className={`w-full rounded-2xl border p-3 text-left transition ${active ? "border-accent bg-accent/10" : "border-line bg-surface2 hover:border-muted"}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {isOriginal ? <Chip>Original</Chip> : <Chip tone={item.kind === "eq" ? "good" : "cool"}>{SUB_KIND[item.kind]}</Chip>}
          {active && <Chip tone="accent"><Check size={11} />En uso</Chip>}
        </div>
        <div className="mt-1.5 text-[15px] font-semibold leading-snug">{item.name}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">{item.eq.map((e) => <Chip key={e}>{EQ[e]}</Chip>)}</div>
        <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-surface px-3 py-1.5 text-center font-mono text-xs">
          <div><div className="text-[10px] uppercase tracking-widest text-muted">Reps</div><div className={!isOriginal && item.reps !== ex.reps ? "text-accent" : ""}>{item.reps}</div></div>
          <div><div className="text-[10px] uppercase tracking-widest text-muted">Tempo</div><div className={!isOriginal && item.tempo !== ex.tempo ? "text-accent" : ""}>{item.tempo}</div></div>
          <div><div className="text-[10px] uppercase tracking-widest text-muted">RIR</div><div className={!isOriginal && rirNew !== rirOrig ? "text-accent" : ""}>{isOriginal ? rirOrig : rirNew}</div></div>
        </div>
        {!isOriginal && <p className="mt-2 text-xs text-muted">{item.why}</p>}
      </button>
    );
  };
  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="sheet max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 md:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Sustituir ejercicio">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Sustituir / Alternativa · {ex.block}</div>
            <h2 className="font-display text-2xl font-semibold uppercase leading-none">{ex.name}</h2>
            <p className="mt-1 text-xs text-muted">Las series se mantienen ({effSets(ex, week)}). Reps, tempo y RIR se ajustan solos.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:text-fg" aria-label="Cerrar"><X size={22} /></button>
        </div>
        <div className="space-y-2">
          {row(ex, true)}
          {alts.map((a) => row(a, false))}
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({ ex: original, alt, week, done, onToggle, onSwap, onRevert, load, onLoad, last }) {
  const [open, setOpen] = useState(false);
  const ex = alt ? { ...original, name: alt.name, eq: alt.eq, reps: alt.reps, tempo: alt.tempo, rir: alt.rir, tips: [alt.why, ...original.tips.slice(0, 1)] } : original;
  const n = effSets(original, week);
  const count = done.filter(Boolean).length;
  const complete = count >= n;
  return (
    <article className={`rounded-2xl border bg-surface p-4 transition-colors ${complete ? "border-good/40" : alt ? "border-cool/40" : "border-line"}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-display text-base font-semibold ${complete ? "bg-good/15 text-good" : "bg-surface2 text-accent"}`}>{ex.block}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug">{ex.name}</h3>
          {alt && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-cool">
              <span>Sustituye a: {original.name}</span>
              <button onClick={onRevert} className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-fg hover:underline"><Undo2 size={12} />Volver al original</button>
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">{ex.eq.map((e) => <Chip key={e}>{EQ[e]}</Chip>)}</div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[0.8fr_1.6fr_0.6fr_1.2fr] gap-2 rounded-xl bg-surface2 px-3 py-2 text-center">
        <div><dt className="text-[10px] uppercase tracking-widest text-muted">Series</dt><dd className="font-mono text-sm tabular-nums">{n}</dd></div>
        <div className="min-w-0"><dt className="text-[10px] uppercase tracking-widest text-muted">Reps</dt><dd className="truncate font-mono text-sm" title={ex.reps}>{ex.reps}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-widest text-muted">RIR</dt><dd className="font-mono text-sm tabular-nums">{effRir(ex, week)}</dd></div>
        <div><dt className="text-[10px] uppercase tracking-widest text-muted">Tempo</dt><dd className="whitespace-nowrap font-mono text-sm">{ex.tempo}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={onSwap} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface2 px-3 py-1.5 text-xs font-medium hover:border-cool hover:text-cool">
          <ArrowLeftRight size={14} />Sustituir / Alternativa
        </button>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          Carga
          <input value={load || ""} onChange={(e) => onLoad(e.target.value)} placeholder="ej. 40 kg" maxLength={24}
            className="w-24 rounded-lg border border-line bg-surface2 px-2 py-1.5 font-mono text-xs text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none" />
        </label>
      </div>
      {last && last.v && !load && (
        <button onClick={() => onLoad(last.v)} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent">
          <History size={13} />Última vez ({fmtShort(last.d)}): <span className="font-mono text-fg">{last.v}</span> · usar
        </button>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {Array.from({ length: n }).map((_, i) => (
          <button key={i} onClick={() => onToggle(i, n)} aria-pressed={!!done[i]} aria-label={`Serie ${i + 1}`}
            className={`grid h-10 w-10 place-items-center rounded-full border font-mono text-sm transition ${done[i] ? "border-accent bg-accent text-accentInk" : "border-line bg-surface2 text-muted hover:border-accent/60"}`}>
            {done[i] ? <Check size={16} strokeWidth={3} /> : i + 1}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">{ex.emom ? "EMOM" : ex.rest ? `Desc. ${ex.rest}s` : "Sin descanso"}</span>
      </div>
      <button onClick={() => setOpen((o) => !o)} className="mt-3 flex w-full items-center justify-between text-xs font-medium text-muted hover:text-fg" aria-expanded={open}>
        <span className="inline-flex items-center gap-1"><Info size={13} />Tips técnicos</span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <ul className="mt-2 space-y-1.5 border-t border-line pt-2 text-sm text-muted">{ex.tips.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />{t}</li>)}</ul>}
    </article>
  );
}

/* ───────────────────────── Módulo 1: Entrenamiento ───────────────────────── */

function HabitItem({ hb, bonus, on, onToggle }) {
  const Icon = hb.icon;
  const onCls = bonus ? "border-cool/40 bg-cool/10" : "border-good/40 bg-good/10";
  const dotCls = bonus ? "bg-cool text-bg" : "bg-good text-bg";
  return (
    <button onClick={onToggle} aria-pressed={on} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${on ? onCls : "border-line bg-surface2"}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${on ? dotCls : "bg-surface text-muted"}`}>{on ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}</span>
      <span className="min-w-0 flex-1 text-sm font-medium">{hb.label}</span>
      <span className="shrink-0 font-mono text-[10px] text-muted">{hb.code}</span>
    </button>
  );
}

function HabitsMini({ habits, setHabits }) {
  const today = dkey();
  const h = habits[today] || {};
  const toggle = (id) => setHabits((all) => {
    const next = { ...all, [today]: { ...(all[today] || {}), [id]: !(all[today] || {})[id] } };
    const keep = Object.keys(next).sort().slice(-60);
    return Object.fromEntries(keep.map((k) => [k, next[k]]));
  });
  const r = reqDone(h);
  const o = optDone(h);
  const pct = Math.round((r / HABITS_REQ.length) * 100);
  const item = (hb, bonus) => <HabitItem key={hb.id} hb={hb} bonus={bonus} on={!!h[hb.id]} onToggle={() => toggle(hb.id)} />;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-good">Hábitos Obligatorios</span>
          <span className="font-mono text-xs tabular-nums text-muted">{r}/{HABITS_REQ.length} · {pct}%</span>
        </div>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-good transition-all duration-500" style={{ width: `${pct}%` }} /></div>
        <div className="space-y-2">{HABITS_REQ.map((hb) => item(hb, false))}</div>
      </div>
      <div className="rounded-xl border border-dashed border-line p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cool"><Star size={12} />Hábitos Facultativos · bonus</span>
          <span className="font-mono text-xs tabular-nums text-muted">+{o}/{HABITS_OPT.length}</span>
        </div>
        <div className="space-y-2">{HABITS_OPT.map((hb) => item(hb, true))}</div>
        <p className="mt-2 px-0.5 text-[11px] text-muted">No cuentan para el 100 % del día.</p>
      </div>
    </div>
  );
}

function TrainView({ sets, setSets, log, setLog, block, setBlock, habits, setHabits, swaps, setSwaps, loads, setLoads, lastLoads, setLastLoads, startTimer, openWarmup, wp }) {
  const today = dkey();
  const [rid, setRid] = useState(() => wp.arr[wp.todayIdx] || wp.nextRid || "d1");
  const [swapFor, setSwapFor] = useState(null);
  const routine = routineById(rid);
  const week = block.week || 1;
  const daySets = (sets[today] || {})[rid] || {};
  const daySwaps = (swaps[today] || {})[rid] || {};
  const dayLoads = (loads[today] || {})[rid] || {};

  const setSwap = (exId, altId) => setSwaps((all) => {
    const day = { ...(all[today] || {}) };
    const r = { ...(day[rid] || {}) };
    if (altId) r[exId] = altId; else delete r[exId];
    day[rid] = r;
    return pruneDays({ ...all, [today]: day }, 21);
  });
  // Última carga usada en un día anterior, por ejercicio (o por su sustituto si hay uno activo).
  const loadKey = (exId) => (daySwaps[exId] ? `${exId}:${daySwaps[exId]}` : exId);
  const lastFor = (exId) => { const l = (lastLoads || {})[loadKey(exId)]; return l && l.d !== today ? l : (l && l.prev) || null; };
  const rememberLoad = (exId, v) => setLastLoads((all) => {
    const k = loadKey(exId);
    const cur = (all || {})[k];
    const prev = cur && cur.d !== today ? { v: cur.v, d: cur.d } : (cur && cur.prev) || null;
    const next = { ...(all || {}) };
    if (v) next[k] = { v, d: today, prev }; else if (prev) next[k] = prev; else delete next[k];
    return next;
  });
  const setLoad = (exId, v) => { rememberLoad(exId, v); setLoadRaw(exId, v); };
  const setLoadRaw = (exId, v) => setLoads((all) => {
    const day = { ...(all[today] || {}) };
    const r = { ...(day[rid] || {}) };
    if (v) r[exId] = v; else delete r[exId];
    day[rid] = r;
    return pruneDays({ ...all, [today]: day }, 21);
  });
  const swapEx = swapFor ? routine.exercises.find((e) => e.id === swapFor) : null;

  const total = routine.exercises.reduce((a, ex) => a + effSets(ex, week), 0);
  const done = routine.exercises.reduce((a, ex) => a + (daySets[ex.id] || []).slice(0, effSets(ex, week)).filter(Boolean).length, 0);
  const progress = total ? done / total : 0;
  const logged = log[today];

  useEffect(() => {
    if (progress >= 1 && (!logged || logged.r !== rid)) setLog((l) => ({ ...l, [today]: { r: rid, at: Date.now() } }));
  }, [progress, logged, rid, today, setLog]);

  const toggle = (ex, i, n) => {
    const was = !!(daySets[ex.id] || [])[i];
    setSets((all) => {
      const day = { ...(all[today] || {}) };
      const r = { ...(day[rid] || {}) };
      const arr = Array.from({ length: n }, (_, k) => !!(r[ex.id] || [])[k]);
      arr[i] = !arr[i];
      r[ex.id] = arr; day[rid] = r;
      const next = { ...all, [today]: day };
      const keep = Object.keys(next).sort().slice(-21);
      return Object.fromEntries(keep.map((k) => [k, next[k]]));
    });
    if (!was && ex.rest) startTimer(ex.rest);
    if (!was && ex.emom) startTimer(60);
  };

  const bw = BLOCK_WEEKS[week - 1];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {ROUTINES.map((r) => (
            <button key={r.id} onClick={() => setRid(r.id)} aria-pressed={r.id === rid}
              className={`shrink-0 rounded-xl border px-3.5 py-2 text-left transition ${r.id === rid ? (r.low ? "border-cool bg-cool/15" : "border-accent bg-accent/15") : "border-line bg-surface hover:border-muted"}`}>
              <div className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest ${r.id === rid ? (r.low ? "text-cool" : "text-accent") : "text-muted"}`}>{r.low && <BatteryLow size={12} />}{r.short}{log[today]?.r === r.id && <Check size={12} />}</div>
              <div className="whitespace-nowrap text-sm font-medium">{r.low ? "Baja energía · 20 min" : r.name}</div>
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{routine.short} · ~{routine.minutes} min · Semana {week} {bw.label}</div>
              <h1 className="font-display text-3xl font-semibold uppercase leading-[0.95] md:text-4xl">{routine.name}</h1>
              <p className="mt-1 max-w-prose text-sm text-muted">{routine.focus}</p>
            </div>
            <button onClick={openWarmup} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk shadow-lg"><Zap size={16} />Modo Arranque (5 min)</button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <ProgressBar value={progress} />
            <span className="shrink-0 font-mono text-sm tabular-nums">{done}/{total}</span>
          </div>
          {logged ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-good"><Trophy size={14} />Sesión registrada hoy: {routineById(logged.r).name}</span>
              <button onClick={() => setLog((l) => { const n = { ...l }; delete n[today]; return n; })} className="rounded-lg px-2 py-1 text-muted hover:bg-surface2 hover:text-fg">Quitar registro</button>
            </div>
          ) : (
            <button onClick={() => setLog((l) => ({ ...l, [today]: { r: rid, at: Date.now() } }))} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-good/40 px-3 py-1.5 text-xs text-good hover:bg-good/10">
              <Check size={14} />Ya la hice: registrar sesión de hoy
            </button>
          )}
        </section>

        <div className="grid gap-3 2xl:grid-cols-2">
          {routine.exercises.map((ex) => (
            <ExerciseCard key={ex.id + week} ex={ex} alt={altFor(ex.id, daySwaps[ex.id])} week={week} done={daySets[ex.id] || []} onToggle={(i, n) => toggle(ex, i, n)}
              onSwap={() => setSwapFor(ex.id)} onRevert={() => setSwap(ex.id, null)} load={dayLoads[ex.id]} onLoad={(v) => setLoad(ex.id, v)} last={lastFor(ex.id)} />
          ))}
        </div>
        {swapEx && <SwapModal ex={swapEx} week={week} current={daySwaps[swapEx.id]} onPick={(altId) => { setSwap(swapEx.id, altId); setSwapFor(null); }} onClose={() => setSwapFor(null)} />}
      </div>

      <aside className="grid min-w-0 content-start gap-4 md:grid-cols-2 xl:grid-cols-1">
        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 font-display text-lg font-semibold uppercase tracking-wide">Bloque de 4 semanas</h2>
          <div className="grid grid-cols-4 gap-1.5">
            {BLOCK_WEEKS.map((b) => (
              <button key={b.n} onClick={() => setBlock({ week: b.n })} aria-pressed={b.n === week} className={`rounded-lg border py-2 text-center transition ${b.n === week ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface2 text-muted"}`}>
                <div className="font-mono text-sm">S{b.n}</div>
                <div className="text-[10px]">{b.label}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{bw.note}</p>
        </section>

        <WeekCard wp={wp} log={log} />

        <section className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 font-display text-lg font-semibold uppercase tracking-wide">Hábitos de hoy</h2>
          <HabitsMini habits={habits} setHabits={setHabits} />
        </section>

      </aside>
    </div>
  );
}

/* ───────────────────────── Módulo 2: Dashboard Google Health ───────────────────────── */

function Kpi({ label, value, sub, icon: Icon, badge, delta, invert }) {
  const good = delta != null && (invert ? delta <= 0 : delta >= 0);
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between text-muted">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</span>
        <Icon size={16} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="font-display text-3xl font-semibold leading-none tabular-nums">{value}</span>
        {badge && <Chip tone="accent"><Trophy size={11} />{badge}</Chip>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
        {sub}
        {delta != null && isFinite(delta) && (
          <span className={`inline-flex items-center gap-0.5 ${good ? "text-good" : "text-warn"}`}>
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{delta >= 0 ? "+" : ""}{Math.round(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}

const chartTooltip = {
  contentStyle: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--fg)", fontSize: 12 },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--fg)" },
  cursor: { fill: "var(--surface-2)" },
};
const axisTick = { fill: "var(--muted)", fontSize: 11 };
const kTick = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v);

const COMPARE = [
  { key: "avgSteps", label: "Pasos / día", fmt: fmtInt },
  { key: "azmTotal", label: "Min. zona activa", fmt: fmtInt },
  { key: "sleepAvgMin", label: "Sueño reparador", fmt: fmtSleep },
  { key: "distanceKm", label: "Distancia", fmt: (v) => (v ? `${v.toFixed(1)} km` : "—") },
  { key: "caloriesAvg", label: "Calorías / día", fmt: fmtInt },
  { key: "floors", label: "Pisos", fmt: fmtInt },
  { key: "restingHr", label: "FC en reposo", fmt: (v) => (v ? `${v} lpm` : "—"), invert: true },
];

function CompareRows({ cur, prev }) {
  return (
    <ul className="space-y-3">
      {COMPARE.map((m) => {
        const a = Number(cur?.[m.key]) || 0;
        const b = Number(prev?.[m.key]) || 0;
        const max = Math.max(a, b) || 1;
        const d = b ? ((a - b) / b) * 100 : null;
        const good = d != null && (m.invert ? d <= 0 : d >= 0);
        return (
          <li key={m.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-muted">{m.label}</span>
              <span className="flex items-baseline gap-2 font-mono tabular-nums">
                <span className="text-fg">{m.fmt(a)}</span>
                {d != null && <span className={good ? "text-good" : "text-warn"}>{d >= 0 ? "+" : ""}{Math.round(d)}%</span>}
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-surface2"><div className="h-full rounded-full bg-accent" style={{ width: `${(a / max) * 100}%` }} /></div>
              <div className="h-1.5 rounded-full bg-surface2"><div className="h-full rounded-full bg-cool/60" style={{ width: `${(b / max) * 100}%` }} /></div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ImportPanel({ onSave, onClose, initial }) {
  const lastSat = (() => { const d = new Date(); const back = ((d.getDay() + 1) % 7) + 7; return dkey(addDays(d, -back)); })();
  const blank = { weekStart: lastSat, totalSteps: "", avgSteps: "", bestDay: "", bestSteps: "", azmTotal: "", sleepH: "", sleepM: "", caloriesAvg: "", distanceKm: "", floors: "", restingHr: "", weightKg: "", activeHours: "", steps: Array(7).fill("") };
  const [text, setText] = useState("");
  const [f, setF] = useState(() => {
    if (!initial) return blank;
    const s = initial.sleepAvgMin;
    return { ...blank, ...Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ""])), steps: (initial.steps || Array(7).fill("")).map((n) => n || ""), sleepH: s ? Math.floor(s / 60) : "", sleepM: s ? s % 60 : "" };
  });
  const [msg, setMsg] = useState("");
  const labels = deriveWeek({ weekStart: f.weekStart || lastSat }).dayLabels;

  const analyze = () => {
    const p = parseHealth(text);
    const names = { weekStart: "fechas", totalSteps: "pasos", avgSteps: "promedio", bestDay: "mejor día", bestSteps: "pasos del mejor día", azmTotal: "zona activa", sleepAvgMin: "sueño", caloriesAvg: "calorías", distanceKm: "distancia", floors: "pisos", restingHr: "FC reposo", weightKg: "peso", activeHours: "horas activas" };
    setF((cur) => {
      const n = { ...cur };
      Object.entries(p).forEach(([k, v]) => { if (k === "sleepAvgMin") { n.sleepH = Math.floor(v / 60); n.sleepM = v % 60; } else n[k] = v; });
      return n;
    });
    const found = Object.keys(p).map((k) => names[k]).filter(Boolean);
    setMsg(found.length ? `Detecté ${found.length} datos: ${found.join(", ")}. Revisa y guarda.` : "No encontré cifras reconocibles. Escríbelas abajo a mano.");
  };

  const save = () => {
    const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
    const sleep = (num(f.sleepH) || 0) * 60 + (num(f.sleepM) || 0);
    const steps = f.steps.map((v) => num(v) || 0);
    onSave({
      weekStart: f.weekStart, source: "manual",
      totalSteps: num(f.totalSteps), avgSteps: num(f.avgSteps), bestDay: num(f.bestDay), bestSteps: num(f.bestSteps),
      azmTotal: num(f.azmTotal), sleepAvgMin: sleep || null, caloriesAvg: num(f.caloriesAvg), distanceKm: num(f.distanceKm),
      floors: num(f.floors), restingHr: num(f.restingHr), weightKg: num(f.weightKg), activeHours: num(f.activeHours),
      steps: steps.some((n) => n > 0) ? steps : undefined, savedAt: Date.now(),
    });
  };

  const input = "w-full min-w-0 rounded-lg border border-line bg-surface2 px-2.5 py-2 font-mono text-sm tabular-nums focus:border-accent focus:outline-none";
  const field = (id, label, key, extra) => (
    <div className="min-w-0"><label htmlFor={id} className="mb-1 block text-xs text-muted">{label}</label>
      <input id={id} inputMode="decimal" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className={input} {...extra} /></div>
  );

  return (
    <div className="sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="sheet max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Google Health · reporte semanal</div>
            <h2 className="font-display text-3xl font-semibold uppercase leading-none">{initial ? "Editar semana" : "Importar semana"}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:text-fg" aria-label="Cerrar"><X size={22} /></button>
        </div>

        <label htmlFor="fb-paste" className="mb-1 block text-xs font-medium text-muted">Pega el texto del correo «Your weekly progress report from Google Health»</label>
        <textarea id="fb-paste" value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Abre el correo en Gmail, selecciona todo (⌘A), copia y pega aquí…" className="w-full rounded-xl border border-line bg-surface2 p-3 text-sm focus:border-accent focus:outline-none" />
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={analyze} disabled={!text.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk disabled:opacity-40"><ClipboardPaste size={15} />Analizar texto</button>
          <button onClick={() => setText(SAMPLE_EMAIL)} className="rounded-lg border border-line px-3.5 py-2 text-sm text-muted hover:text-fg">Probar con un ejemplo</button>
        </div>
        {msg && <p className="mt-2 text-xs text-cool">{msg}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="min-w-0"><label htmlFor="fb-week" className="mb-1 block text-xs text-muted">Inicio de semana (sábado)</label><input id="fb-week" type="date" value={f.weekStart} onChange={(e) => setF({ ...f, weekStart: e.target.value })} className={input} /></div>
          {field("fb-total", "Pasos totales", "totalSteps")}
          {field("fb-avg", "Promedio pasos/día", "avgSteps")}
          <div className="min-w-0"><label htmlFor="fb-best" className="mb-1 block text-xs text-muted">Mejor día</label>
            <select id="fb-best" value={f.bestDay} onChange={(e) => setF({ ...f, bestDay: e.target.value })} className={input}>
              <option value="">—</option>
              {DAYS_LONG.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          {field("fb-bests", "Pasos del mejor día", "bestSteps")}
          {field("fb-azm", "Min. zona activa", "azmTotal")}
          <div className="min-w-0">
            <span className="mb-1 block text-xs text-muted">Sueño promedio</span>
            <div className="flex gap-1.5">
              <input id="fb-sh" aria-label="Horas de sueño" inputMode="numeric" placeholder="h" value={f.sleepH} onChange={(e) => setF({ ...f, sleepH: e.target.value })} className={input} />
              <input id="fb-sm" aria-label="Minutos de sueño" inputMode="numeric" placeholder="min" value={f.sleepM} onChange={(e) => setF({ ...f, sleepM: e.target.value })} className={input} />
            </div>
          </div>
          {field("fb-cal", "Calorías / día", "caloriesAvg")}
          {field("fb-km", "Distancia (km)", "distanceKm")}
          {field("fb-floors", "Pisos", "floors")}
          {field("fb-hr", "FC reposo (lpm)", "restingHr")}
          {field("fb-kg", "Peso (kg)", "weightKg")}
        </div>

        <details className="mt-4 rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted">Pasos por día (opcional: el correo no los trae, cópialos de la app si quieres la gráfica diaria)</summary>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {labels.map((d, i) => (
              <div key={i} className="min-w-0 text-center">
                <label htmlFor={`fb-s${i}`} className="mb-1 block text-[10px] text-muted">{d}</label>
                <input id={`fb-s${i}`} inputMode="numeric" value={f.steps[i]} onChange={(e) => { const a = [...f.steps]; a[i] = e.target.value; setF({ ...f, steps: a }); }} className={input + " px-1 text-center text-xs"} />
              </div>
            ))}
          </div>
        </details>

        <button onClick={save} disabled={!f.weekStart} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-accentInk disabled:opacity-40"><Save size={17} />Guardar semana en el historial</button>
      </div>
    </div>
  );
}

function DashboardView({ health, setHealth, log }) {
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [sel, setSel] = useState(null);

  // Historial = semanas reales de Gmail + lo que importes; lo guardado gana si coincide la fecha. "hidden" oculta una semana.
  const weeks = useMemo(() => {
    const map = new Map(GH_SEED.map((w) => [w.weekStart, w]));
    (health || []).forEach((w) => (w.hidden ? map.delete(w.weekStart) : map.set(w.weekStart, w)));
    return [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).map(deriveWeek);
  }, [health]);

  const selIdx = sel != null && weeks[sel] ? sel : weeks.length - 1;
  const cur = weeks[selIdx];
  const prev = weeks[selIdx - 1];
  const pct = (a, b) => (a != null && b ? ((a - b) / b) * 100 : null);

  const thisMonday = mondayOf(new Date());
  const sessionsThisWeek = Object.keys(log).filter((k) => { const d = fromKey(k); return d >= thisMonday && d < addDays(thisMonday, 7); }).length;
  const streak = computeStreak(log);

  const recent = weeks.slice(-12);
  const offset = weeks.length - recent.length;
  const trend = recent.map((w) => ({ week: fmtShort(w.weekStart), pasos: Math.round(w.avgSteps), azm: w.azmTotal || 0, sueño: w.sleepAvgMin ? +(w.sleepAvgMin / 60).toFixed(2) : null, fc: w.restingHr || null }));
  const bestFreq = DAYS.map((d, i) => ({ day: d, veces: weeks.filter((w) => w.bestDay === i).length }));
  const topDay = bestFreq.reduce((a, b, i) => (b.veces > bestFreq[a].veces ? i : a), 0);
  const avgAll = weeks.reduce((a, w) => a + w.avgSteps, 0) / (weeks.length || 1);
  const daily = cur?.hasDaily ? cur.dayLabels.map((d, i) => ({ day: d, pasos: cur.steps[i] })) : null;

  const saveWeek = (rec) => {
    setHealth((list) => [...(list || []).filter((w) => w.weekStart !== rec.weekStart), rec].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).slice(-156));
    setShowImport(false); setEditing(null); setSel(null);
  };

  if (!cur) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-sm text-muted">No hay semanas en el historial.</p>
        <button onClick={() => setShowImport(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk"><ClipboardPaste size={16} />Importar correo</button>
        {showImport && <ImportPanel onSave={saveWeek} onClose={() => setShowImport(false)} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Google Health · {weeks.length} semanas</div>
          <h1 className="font-display text-3xl font-semibold uppercase leading-none md:text-4xl">Actividad & progreso</h1>
          <p className="mt-1 text-sm text-muted">Semana {fmtRange(cur)} <span className="text-muted/70">(sáb – vie)</span></p>
        </div>
        <button onClick={() => { setEditing(null); setShowImport(true); }} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk"><ClipboardPaste size={16} />Importar correo nuevo</button>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {weeks.map((w, i) => (
          <button key={w.weekStart} onClick={() => setSel(i)} aria-pressed={i === selIdx} className={`shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs ${i === selIdx ? "border-accent bg-accent/15 text-accent" : "border-line bg-surface text-muted"}`}>{fmtShort(w.weekStart)}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="Días entrenados" icon={Dumbbell} value={`${sessionsThisWeek}/4`} sub={<span className="inline-flex items-center gap-1"><Flame size={12} className="text-accent" />Racha: {streak} {streak === 1 ? "sesión" : "sesiones"}</span>} />
        <Kpi label="Mejor día" icon={Trophy} value={cur.bestDay != null ? DAYS[cur.bestDay] : "—"} badge={cur.bestSteps ? fmtInt(cur.bestSteps) : null} sub={cur.bestSteps ? "pasos ese día" : "Sin dato"} />
        <Kpi label="Pasos / día" icon={Footprints} value={fmtInt(cur.avgSteps)} sub={`${fmtInt(cur.totalSteps)} en la semana`} delta={prev ? pct(cur.avgSteps, prev.avgSteps) : null} />
        <Kpi label="Zona activa" icon={Activity} value={fmtInt(cur.azmTotal)} sub="minutos" delta={prev ? pct(cur.azmTotal, prev.azmTotal) : null} />
        <Kpi label="Sueño reparador" icon={Moon} value={cur.sleepAvgMin ? `${Math.floor(cur.sleepAvgMin / 60)}:${pad(cur.sleepAvgMin % 60)}` : "—"} sub="promedio por noche" delta={prev ? pct(cur.sleepAvgMin, prev.sleepAvgMin) : null} />
        <Kpi label="FC en reposo" icon={Zap} value={cur.restingHr ? `${cur.restingHr}` : "—"} sub="lpm (más bajo es mejor)" delta={prev ? pct(cur.restingHr, prev.restingHr) : null} invert />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Pasos y zona activa por semana</h2>
            <Chip>Prom. {fmtInt(avgAll)} pasos/día</Chip>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 0, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                <YAxis yAxisId="l" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kTick} />
                <YAxis yAxisId="r" orientation="right" tick={axisTick} axisLine={false} tickLine={false} width={34} />
                <Tooltip {...chartTooltip} formatter={(v, n) => [fmtInt(v), n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                <Bar isAnimationActive={false} yAxisId="l" dataKey="pasos" name="Pasos/día" fill="var(--accent)" radius={[4, 4, 0, 0]} onClick={(_, i) => setSel(offset + i)} cursor="pointer">
                  {trend.map((_, i) => <Cell key={i} fill={offset + i === selIdx ? "var(--accent)" : "var(--accent-dim)"} />)}
                </Bar>
                <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="azm" name="Min. zona activa" stroke="var(--good)" strokeWidth={2} dot={{ r: 2.5, fill: "var(--good)" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted">Toca una barra para ver esa semana. La barra resaltada es la semana seleccionada.</p>
        </section>

        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Vs. semana anterior</h2>
            <span className="flex items-center gap-2 text-[11px] text-muted"><span className="h-2 w-3 rounded-full bg-accent" />actual<span className="h-1.5 w-3 rounded-full bg-cool/60" />anterior</span>
          </div>
          {prev ? <CompareRows cur={cur} prev={prev} /> : <p className="text-sm text-muted">Es la primera semana del historial.</p>}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide">{daily ? "Pasos por día" : "Tu mejor día de la semana"}</h2>
            {!daily && <Chip tone="accent">Suele ser {DAYS_LONG[topDay].toLowerCase()}</Chip>}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {daily ? (
                <BarChart data={daily} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kTick} />
                  <Tooltip {...chartTooltip} formatter={(v) => [fmtInt(v), "Pasos"]} />
                  <Bar isAnimationActive={false} dataKey="pasos" fill="var(--accent)" radius={[4, 4, 0, 0]}>
                    {daily.map((d, i) => <Cell key={i} fill={d.pasos === Math.max(...cur.steps) ? "var(--accent)" : "var(--accent-dim)"} />)}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={bestFreq} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...chartTooltip} formatter={(v) => [`${v} ${v === 1 ? "semana" : "semanas"}`, "Mejor día"]} />
                  <Bar isAnimationActive={false} dataKey="veces" fill="var(--accent)" radius={[4, 4, 0, 0]}>
                    {bestFreq.map((_, i) => <Cell key={i} fill={i === topDay ? "var(--accent)" : i === cur.bestDay ? "var(--cool)" : "var(--accent-dim)"} />)}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted">{daily ? "Datos diarios que añadiste a mano." : `Cuántas semanas fue cada día tu pico de pasos (${weeks.length} semanas). En azul, el de la semana seleccionada.`}</p>
        </section>

        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide">Sueño y frecuencia en reposo</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                <YAxis yAxisId="l" tick={axisTick} axisLine={false} tickLine={false} domain={[6, 9]} ticks={[6, 7, 8, 9]} tickFormatter={(v) => `${v} h`} />
                <YAxis yAxisId="r" orientation="right" tick={axisTick} axisLine={false} tickLine={false} domain={[45, 60]} ticks={[45, 50, 55, 60]} width={30} />
                <Tooltip {...chartTooltip} cursor={{ stroke: "var(--line)" }} formatter={(v, n) => (n === "Sueño" ? [fmtSleep(Math.round(v * 60)), n] : [`${v} lpm`, n])} />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                <Line isAnimationActive={false} yAxisId="l" type="monotone" dataKey="sueño" name="Sueño" stroke="var(--cool)" strokeWidth={2.5} dot={{ r: 2.5, fill: "var(--cool)" }} />
                <Line isAnimationActive={false} yAxisId="r" type="monotone" dataKey="fc" name="FC reposo" stroke="var(--warn)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide">Historial</h2>
        <ul className="divide-y divide-line">
          {[...weeks].reverse().map((w) => (
            <li key={w.weekStart} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="inline-flex min-w-[8.5rem] items-center gap-1.5 font-mono text-xs"><CalendarDays size={14} className="text-muted" />{fmtRange(w)}</span>
              <span className="text-muted">{fmtInt(w.avgSteps)} pasos/día</span>
              <span className="text-muted">{fmtInt(w.azmTotal)} AZM</span>
              <span className="text-muted">{fmtSleep(w.sleepAvgMin)}</span>
              {w.source === "gmail" && <Chip>Correo</Chip>}
              <span className="ml-auto flex gap-1">
                <button onClick={() => { setEditing(w); setShowImport(true); }} className="rounded-lg px-2.5 py-1 text-xs text-muted hover:bg-surface2 hover:text-fg">Editar</button>
                {confirmDel === w.weekStart ? (
                  <button onClick={() => hideWeek(w.weekStart)} className="rounded-lg bg-warn/20 px-2.5 py-1 text-xs text-warn">¿Quitar? Confirmar</button>
                ) : (
                  <button onClick={() => setConfirmDel(w.weekStart)} className="rounded-lg p-1.5 text-muted hover:text-warn" aria-label="Quitar semana"><Trash2 size={14} /></button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {showImport && <ImportPanel initial={editing} onSave={saveWeek} onClose={() => { setShowImport(false); setEditing(null); }} />}
    </div>
  );
}

/* ───────────────────────── Módulo 3: Nutrición y hábitos ───────────────────────── */

const NIGHT = [
  { t: "9:30 p.m.", h: "Antes de salir de la U", d: "Luz del celular al mínimo y modo noche activo. Decide hoy la rutina de mañana (la app te la sugiere)." },
  { t: "10:00 p.m.", h: "Llegada: cena sin decidir", d: "Cena ya preparada (táper) o la cena de 10 minutos. Nada de pantallas brillantes mientras comes." },
  { t: "10:20 p.m.", h: "Escenario listo", d: "Ropa de entreno sobre la silla, KB y mancuernas junto a la espaldera, botella de agua llena en la cocina." },
  { t: "10:30 p.m.", h: "Apagado (hábito O5)", d: "Dispositivos fuera: celular cargando lejos de la cama. Ducha tibia, cuarto fresco y oscuro." },
  { t: "10:50 p.m.", h: "Luces fuera", d: "De 10:50 p.m. a 6:30 a.m. son 7 h 40 min en cama, cerca de tu promedio de sueño reparador. Los días sin entreno la alarma pasa a las 7:00." },
];

const clockAm = (min) => `${Math.floor(min / 60)}:${pad(min % 60)} a.m.`;
// Mañana según el plan: 6:30 si entrenas, 7:00 si no; con salida a las 7:50 los días de oficina.
function morningSteps(info) {
  const r = info.rid ? routineById(info.rid) : null;
  const leave = { t: "7:50 a.m.", h: "Salida a la oficina", d: "Traslado de 7:50 a 8:45." };
  if (r && info.evening) {
    return [
      { t: "7:00 a.m.", h: "Despertar", d: "Hoy entrenas de noche: sin madrugar." },
      { t: "7:15 a.m.", h: "Desayuno proteico", d: "30–40 g de proteína antes de salir." },
      leave,
      { t: "Noche", h: `Entreno: ${r.name}`, d: `~${r.minutes} min al llegar a casa, sin clase. Termina al menos una hora antes de las 10:30 p.m. y cena con proteína después.` },
    ];
  }
  if (r) {
    const steps = [
      { t: "6:30 a.m.", h: "Despertar sin negociar", d: "Alarma lejos de la cama. Agua + sal, luz encendida y Modo Arranque inmediato." },
      { t: "6:40 a.m.", h: `Entreno: ${r.name}`, d: `~${r.minutes} min. ${info.office ? "Día de oficina: respeta los descansos del temporizador, sin alargarlos." : "Día en casa: sin traslado, tienes margen si una serie se alarga."}` },
      { t: clockAm(6 * 60 + 40 + r.minutes), h: "Ducha y desayuno proteico", d: info.office ? "30–40 g de proteína. Tienes hasta las 7:50." : "30–40 g de proteína, sin prisa: hoy no hay traslado." },
    ];
    if (info.office) steps.push(leave);
    return steps;
  }
  const steps = [
    { t: "7:00 a.m.", h: "Despertar", d: "Día sin entreno: media hora más de sueño para recuperar." },
    { t: "7:15 a.m.", h: "Desayuno proteico", d: "30–40 g de proteína antes de empezar el día." },
  ];
  if (info.office) steps.push(leave);
  return steps;
}

const PROTEIN_RULES = [
  { h: "Ancla de 30–40 g en cada comida", d: "Antes de las 8:30 a.m.: batido de whey con leche y avena, o 3 huevos + 1 yogur griego. Si una comida no tiene ancla proteica, no está completa." },
  { h: "Cocina dos veces por semana, no siete", d: "Domingo y miércoles: 1,5 kg de pollo o carne molida, arroz o papa y vegetales congelados. 5 tápers listos para almuerzo y cena de las 10:00 p.m." },
  { h: "Kit de emergencia anti comida rápida", d: "En la mochila: batido listo para tomar, atún en lata, maní y fruta. En casa: huevos, queso cottage, tortillas y frijoles para una cena de 10 minutos." },
];

function HabitsView({ habits, setHabits, tomorrow, tonight }) {
  const last7 = Array.from({ length: 7 }, (_, i) => dkey(addDays(new Date(), i - 6)));
  let streak = 0;
  for (let i = 6; i >= 0; i--) {
    const h = habits[last7[i]] || {};
    const all = reqDone(h) === HABITS_REQ.length;
    if (all) streak++;
    else if (i !== 6) break;
  }
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Nutrición rápida y hábitos</div>
        <h1 className="font-display text-3xl font-semibold uppercase leading-none md:text-4xl">Fricción cero</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Checklist de hoy</h2>
            <Chip tone={streak ? "good" : "plain"}><Flame size={11} />{streak} {streak === 1 ? "día" : "días"} completos</Chip>
          </div>
          <HabitsMini habits={habits} setHabits={setHabits} />
          <div className="mt-4 grid grid-cols-7 gap-1">
            {last7.map((k) => {
              const h = habits[k] || {};
              const n = reqDone(h);
              const b = optDone(h);
              return (
                <div key={k} className="text-center">
                  <div className="text-[10px] text-muted">{DAYS[(fromKey(k).getDay() + 6) % 7]}</div>
                  <div className="mx-auto mt-1 flex h-10 w-6 flex-col-reverse overflow-hidden rounded-md bg-surface2">
                    <div className={n === HABITS_REQ.length ? "bg-good" : "bg-accent"} style={{ height: `${(n / HABITS_REQ.length) * 100}%` }} />
                  </div>
                  <div className="mt-1 flex justify-center gap-0.5">
                    {HABITS_OPT.map((x, i) => <span key={x.id} className={`h-1.5 w-1.5 rounded-full ${i < b ? "bg-cool" : "bg-surface2"}`} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide">3 reglas de proteína</h2>
          <ol className="space-y-3">
            {PROTEIN_RULES.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 font-display text-sm font-semibold text-accent">{i + 1}</span>
                <div className="min-w-0"><div className="text-sm font-semibold">{r.h}</div><p className="text-sm text-muted">{r.d}</p></div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide">De las 10:00 p.m. a la espaldera</h2>
        {tonight.rid && tonight.evening && (
          <p className="mb-3 rounded-xl border border-cool/40 bg-cool/10 px-3 py-2 text-sm">
            <span className="font-semibold text-cool">Hoy entrenas de noche:</span> {routineById(tonight.rid).name}. Sin clase, entrena al llegar, termina al menos una hora antes de las 10:30 p.m. y retoma esta rutina desde la cena.
          </p>
        )}
        <ol className="relative space-y-4 border-l border-line pl-5">
          {NIGHT.map((s) => (
            <li key={s.t} className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-sm text-accent">{s.t}</span>
                <span className="text-sm font-semibold">{s.h}</span>
              </div>
              <p className="max-w-prose text-sm text-muted">{s.d}</p>
              {s.t === "10:30 p.m." && (
                <p className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-sm">
                  <AlarmClock size={14} className="text-accent" />
                  <span className="text-muted">Antes de soltar el celular, dile:</span>
                  <span className="font-semibold">«Alexa, pon una alarma a las {tomorrow.wake} de la mañana»</span>
                </p>
              )}
            </li>
          ))}
                </ol>
        <h3 className="mb-3 mt-5 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <AlarmClock size={15} className="text-accent" />Mañana, {DAYS_LONG[(fromKey(tomorrow.date).getDay() + 6) % 7].toLowerCase()}
          <Chip tone={tomorrow.office ? "accent" : "plain"}>{tomorrow.office ? "Oficina" : "Casa"}</Chip>
          <Chip tone={tomorrow.rid ? "good" : "plain"}>{tomorrow.rid ? (tomorrow.evening ? "Entreno de noche · 7:00" : "Entreno · 6:30") : "Descanso · 7:00"}</Chip>
        </h3>
        <ol className="relative space-y-4 border-l border-line pl-5">
          {morningSteps(tomorrow).map((s) => (
            <li key={s.t} className="relative">
              <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-sm text-accent">{s.t}</span>
                <span className="text-sm font-semibold">{s.h}</span>
              </div>
              <p className="max-w-prose text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/* ───────────────────────── Recordatorio de creatina (sin IA: solo el navegador) ───────────────────────── */

const CREATINE_HOUR = 12;
const notifSupported = () => { try { return typeof window !== "undefined" && "Notification" in window; } catch (e) { return false; } };
const notifPerm = () => { try { return notifSupported() ? Notification.permission : "unsupported"; } catch (e) { return "unsupported"; } };
const hhmm = (d) => d.toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" });

function useCreatineReminder(taken) {
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

function CreatineBanner({ rem, onTake }) {
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

function ReminderCard({ rem, taken }) {
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

/* ───────────────────────── Ajustes: sincronización y versión ───────────────────────── */

const SYNC_ERRORS = {
  401: "GitHub rechazó la clave: está mal copiada o venció. Pega una nueva.",
  403: "La clave no tiene permiso de lectura y escritura sobre ese repositorio.",
  404: "No encuentro el repositorio, o la clave no tiene acceso a él.",
  red: "Sin conexión. Tus cambios quedan guardados aquí y se envían al volver la red.",
};

function SettingsView({ reminderCard }) {
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

/* ───────────────────────── App ───────────────────────── */

const TABS = [
  { id: "train", label: "Entreno", icon: Dumbbell },
  { id: "fitbit", label: "Salud", icon: Activity },
  { id: "habits", label: "Hábitos", icon: Sunrise },
  { id: "settings", label: "Ajustes", icon: Settings },
];

export default function App() {
  const [tab, setTab] = useState(() => { try { return localStorage.getItem("fitpanel:tab") || "train"; } catch (e) { return "train"; } });
  const [sets, setSets] = usePersisted("sets", {});
  const [log, setLog] = usePersisted("log", {});
  const [habits, setHabits] = usePersisted("habits", {});
  const [health, setHealth] = usePersisted("health", []);
  const [block, setBlock] = usePersisted("block", { week: 1 });
  const [swaps, setSwaps] = usePersisted("swaps", {});
  const [loads, setLoads] = usePersisted("loads", {});
  const [lastLoads, setLastLoads] = usePersisted("lastLoads", {});
  const wp = useWeekPlan(log);
  const [timer, setTimer] = useState(null);
  const [warmup, setWarmup] = useState(false);

  useEffect(() => { try { localStorage.setItem("fitpanel:tab", tab); } catch (e) {} }, [tab]);
  // El navegador solo deja sonar audio después de un toque: se desbloquea con el primero.
  useEffect(() => { window.addEventListener("pointerdown", unlockAudio); return () => window.removeEventListener("pointerdown", unlockAudio); }, []);
  const startTimer = useCallback((sec) => { unlockAudio(); setTimer({ endAt: Date.now() + sec * 1000, duration: sec * 1000 }); }, []);

  // Sincroniza al abrir, al volver a la app y cada minuto mientras está a la vista.
  useEffect(() => {
    Sync.run();
    const onVis = () => { if (!document.hidden) Sync.run(); };
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(() => { if (!document.hidden) Sync.run(); }, 60000);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(id); };
  }, []);

  const today = dkey();
  const creatineTaken = !!(habits[today] || {})[CREATINE_ID];
  const rem = useCreatineReminder(creatineTaken);
  const takeCreatine = () => setHabits((all) => pruneDays({ ...all, [today]: { ...(all[today] || {}), [CREATINE_ID]: true } }, 60));

  return (
    <div className="min-h-full md:flex">
      <nav className="side-nav hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-line md:p-4 lg:w-64">
        <div className="mb-6 px-2">
          <div className="font-display text-2xl font-semibold uppercase leading-none">Espaldera</div>
          <div className="text-xs text-muted">Centro de entrenamiento</div>
        </div>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${tab === t.id ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface hover:text-fg"}`}>
              <Icon size={18} />{t.label}
            </button>
          );
        })}
        <div className="mt-auto px-2"><SyncBadge /></div>
      </nav>

      <main className="page-main min-w-0 flex-1">
        <header className="mb-4 flex items-center justify-between md:hidden">
          <div className="font-display text-xl font-semibold uppercase">Espaldera</div>
          <SyncBadge />
        </header>
        <div className="mx-auto max-w-6xl">
          {tab === "train" && <TrainView sets={sets} setSets={setSets} log={log} setLog={setLog} block={block} setBlock={setBlock} habits={habits} setHabits={setHabits} swaps={swaps} setSwaps={setSwaps} loads={loads} setLoads={setLoads} lastLoads={lastLoads} setLastLoads={setLastLoads} startTimer={startTimer} openWarmup={() => setWarmup(true)} wp={wp} />}
          {tab === "fitbit" && <DashboardView health={health} setHealth={setHealth} log={log} />}
          {tab === "settings" && <SettingsView reminderCard={<ReminderCard rem={rem} taken={creatineTaken} />} />}
          {tab === "habits" && <HabitsView habits={habits} setHabits={setHabits} tomorrow={wp.info(dkey(addDays(new Date(), 1)))} tonight={wp.info(dkey())} />}
        </div>
      </main>

      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${tab === t.id ? "text-accent" : "text-muted"}`}>
              <Icon size={21} />{t.label}
            </button>
          );
        })}
      </nav>

      <RestTimer timer={timer} setTimer={setTimer} />
      <CreatineBanner rem={rem} onTake={takeCreatine} />
      {warmup && <WarmupSheet onClose={() => setWarmup(false)} />}
    </div>
  );
}
