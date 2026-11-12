// Receptor de entrenos de Apple Health (tarea S1).
// Corre en GitHub Actions dentro del repositorio PRIVADO (copia de este archivo en scripts/).
//
// Canal: un Atajo del iPhone crea un archivo nuevo health/inbox/<marca>.txt con la API de GitHub
// (crear un archivo nuevo no necesita sha, así el Atajo queda simple). Formato, una línea por entreno:
//   tipo | inicio | fin | duración
// p. ej. «Correr | 2026-11-12T06:40:00-06:00 | 2026-11-12T07:12:00-06:00 | 32 min»
// Las líneas que no se entienden se ignoran. Este script fusiona todo en la clave «workouts»
// de data.json ({ v: [...], at }) y borra los archivos procesados.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const KEEP_DAYS = 400;

export function classify(type) {
  const t = String(type || "").toLowerCase();
  if (/run|corr|carrera|trote/.test(t)) return "run";
  if (/cycl|bici|ciclis|spinning/.test(t)) return "bike";
  if (/walk|camin|hik|senderis/.test(t)) return "walk";
  if (/strength|fuerza|funcional|functional|hiit|core|cross|calisten|pesas|weight/.test(t)) return "strength";
  return "other";
}

export function parseDuration(text, start, end) {
  const s = String(text || "").trim().toLowerCase().replace(",", ".");
  let min = null;
  const hms = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (hms) min = hms[3] != null ? Number(hms[1]) * 60 + Number(hms[2]) + Number(hms[3]) / 60 : Number(hms[1]) + Number(hms[2]) / 60;
  else {
    const h = /(\d+(?:\.\d+)?)\s*(h|hr|hora)/.exec(s);
    const m = /(\d+(?:\.\d+)?)\s*(min|m\b)/.exec(s);
    const sec = /(\d+(?:\.\d+)?)\s*(s|seg|sec)\b/.exec(s);
    if (h || m || sec) min = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0) + (sec ? Number(sec[1]) / 60 : 0);
    else if (/^\d+(?:\.\d+)?$/.test(s)) min = Number(s) > 600 ? Number(s) / 60 : Number(s); // número solo: segundos si es grande
  }
  if ((min == null || !Number.isFinite(min) || min <= 0) && start && end) min = (new Date(end) - new Date(start)) / 60000;
  return Number.isFinite(min) && min > 0 ? Math.round(min) : null;
}

export function parseLine(line) {
  const parts = String(line).split("|").map((x) => x.trim());
  if (parts.length < 2 || !parts[0]) return null;
  const [type, startRaw, endRaw = "", durRaw = ""] = parts;
  const start = new Date(startRaw);
  if (isNaN(start)) return null;
  const end = endRaw && !isNaN(new Date(endRaw)) ? new Date(endRaw) : null;
  const min = parseDuration(durRaw, start, end);
  const iso = start.toISOString();
  return {
    id: `${iso.slice(0, 16)}-${classify(type)}`,
    type,
    kind: classify(type),
    start: iso,
    end: end ? end.toISOString() : null,
    min,
  };
}

export function parseInbox(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(parseLine)
    .filter(Boolean);
}

export function mergeWorkouts(current, incoming, now = new Date()) {
  const byId = new Map((Array.isArray(current) ? current : []).map((w) => [w.id, w]));
  let added = 0;
  for (const w of incoming) {
    if (!byId.has(w.id)) added++;
    byId.set(w.id, { ...byId.get(w.id), ...w });
  }
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86400000).toISOString();
  const list = [...byId.values()].filter((w) => w.start >= cutoff).sort((a, b) => b.start.localeCompare(a.start));
  return { list, added };
}

export function main({ root = process.cwd(), now = new Date() } = {}) {
  const inbox = path.join(root, "health", "inbox");
  const files = fs.existsSync(inbox) ? fs.readdirSync(inbox).filter((f) => !f.startsWith(".")) : [];
  const incoming = files.flatMap((f) => parseInbox(fs.readFileSync(path.join(inbox, f), "utf8")));
  const dataPath = path.join(root, "data.json");
  const data = fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, "utf8")) : {};
  // health/workouts.json es la copia maestra: si un dispositivo con una versión vieja de la app
  // borra la clave de data.json al sincronizar, aquí se repone.
  const storePath = path.join(root, "health", "workouts.json");
  const stored = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, "utf8")) : [];
  const base = mergeWorkouts(stored, (data.workouts && data.workouts.v) || [], now).list;
  const { list, added } = mergeWorkouts(base, incoming, now);
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(list, null, 1) + "\n");
  const inData = (data.workouts && data.workouts.v) || null;
  const repaired = !inData || inData.length !== list.length;
  if (added > 0 || repaired) {
    data.workouts = { v: list, at: now.getTime() };
    fs.writeFileSync(dataPath, JSON.stringify(data));
  }
  for (const f of files) fs.unlinkSync(path.join(inbox, f));
  // Solo conteos en el registro.
  console.log(`archivos: ${files.length} · líneas válidas: ${incoming.length} · nuevos: ${added} · total: ${list.length}${repaired && !added ? " · data.json reparado" : ""}`);
  return { files: files.length, added, total: list.length, repaired };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
