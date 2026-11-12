import { useState, useEffect, useRef } from "react";

export const LS = {
  get(k) { try { const r = localStorage.getItem("fitpanel:" + k); return r == null ? undefined : JSON.parse(r); } catch (e) { return undefined; } },
  set(k, v) { try { localStorage.setItem("fitpanel:" + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem("fitpanel:" + k); } catch (e) {} },
};

export const SYNC_KEYS = ["sets", "log", "habits", "health", "block", "swaps", "loads", "lastLoads", "weekPlan", "setLog"];

export const DEFAULT_REPO = "Mauxz7/espaldera-data";

export const b64e = (str) => { const b = new TextEncoder().encode(str); let o = ""; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(o); };

export const b64d = (str) => new TextDecoder().decode(Uint8Array.from(atob(String(str).replace(/\s/g, "")), (c) => c.charCodeAt(0)));

export const keyBus = new Map(); // clave → funciones que reciben el valor que llegó de otro dispositivo

export const emitKey = (k, v) => (keyBus.get(k) || []).forEach((f) => f(v));

// Un solo archivo (data.json) en el repositorio privado. Por cada clave gana la escritura más reciente.
export const Sync = {
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

export function useSyncStatus() {
  const [s, setS] = useState(Sync.status);
  useEffect(() => { const f = (x) => setS(x); Sync.subs.add(f); return () => Sync.subs.delete(f); }, []);
  return s;
}

export function usePersisted(key, initial) {
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
