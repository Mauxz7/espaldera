// Avisos con la app cerrada (Web Push).
// Cada dispositivo guarda su suscripción como un archivo propio en el repositorio privado
// (push/subs/<dispositivo>.json). Una tarea programada de GitHub Actions en ese repositorio
// lee los hábitos pendientes y envía el aviso firmado con la llave VAPID privada.
import { LS, Sync, b64e } from "./storage.js";

// Llave pública VAPID: es pública por diseño; la privada vive solo como secreto del repositorio privado.
export const VAPID_PUBLIC_KEY = "BGl6kMDD3_60wM0vIturpvY9g9kJ9LYfCgOllZ5iTBlzqA_CADXwl5HOGEwsAq9a85TGCa8Zmyr3iKufOx4r728";

export const SUBS_DIR = "push/subs";

export function urlBase64ToUint8Array(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
  try {
    return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  } catch (e) {
    return false;
  }
}

// En iPhone y iPad, Web Push solo existe si la app se abrió desde el ícono de la pantalla de inicio.
export function isStandalone() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch (e) {
    return false;
  }
}

export function isIOS() {
  try {
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  } catch (e) {
    return false;
  }
}

export function deviceId() {
  let id = LS.get("@device");
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    LS.set("@device", id);
  }
  return id;
}

export function deviceLabel() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  return "Otro";
}

// Lo que se guarda en el repositorio privado: solo lo necesario para enviar el aviso.
export function subscriptionRecord(sub, id = deviceId(), label = deviceLabel(), now = Date.now()) {
  const json = typeof sub.toJSON === "function" ? sub.toJSON() : sub;
  return { id, device: label, endpoint: json.endpoint, keys: json.keys, at: now };
}

async function gh(path, method = "GET", body) {
  const c = Sync.cfg();
  if (!c) throw new Error("sin-sync");
  return fetch(`https://api.github.com/repos/${c.repo}/contents/${path}`, {
    method,
    cache: "no-store",
    headers: { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function fileSha(path) {
  const r = await gh(path);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("gh-" + r.status);
  return (await r.json()).sha;
}

async function saveSubscription(record) {
  const path = `${SUBS_DIR}/${record.id}.json`;
  const sha = await fileSha(path);
  const body = { message: `aviso: suscribe ${record.device}`, content: b64e(JSON.stringify(record, null, 2)) };
  if (sha) body.sha = sha;
  const r = await gh(path, "PUT", body);
  if (!r.ok) throw new Error("gh-" + r.status);
}

async function deleteSubscription(id) {
  const path = `${SUBS_DIR}/${id}.json`;
  const sha = await fileSha(path);
  if (!sha) return;
  const r = await gh(path, "DELETE", { message: "aviso: quita dispositivo", sha });
  if (!r.ok && r.status !== 404) throw new Error("gh-" + r.status);
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("no-soportado");
  if (!Sync.cfg()) throw new Error("sin-sync");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("permiso-" + perm);
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  }
  await saveSubscription(subscriptionRecord(sub));
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) await sub.unsubscribe();
  if (Sync.cfg()) await deleteSubscription(deviceId());
}
