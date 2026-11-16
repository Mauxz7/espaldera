// Autoriza a leer tus entrenos de Google Health (Fitbit) y a usar Google Calendar; guarda los secretos en el repo privado.
// Se corre en tu Mac:  node scripts/google-health-auth.mjs
// Requisitos: un proyecto de Google Cloud con la «Google Health API» activada y un cliente OAuth
// de tipo «Desktop app» (la guía está en Ajustes → Entrenos de Fitbit), y `gh` con sesión iniciada.
// Nada de lo que escribes ni los tokens se muestran en pantalla: van directo a `gh secret set`.
import http from "node:http";
import crypto from "node:crypto";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { SCOPES, fetchExercises, fetchSleep, toSleep } from "./google-health.mjs";

// Calendario (Fase 7): crear y editar solo el calendario «Shift» que hace la app + leer eventos para sugerir noches ocupadas y exámenes.
// Va en un token APARTE: la Google Health API rechaza tokens que traen otros permisos (DISALLOWED_OAUTH_SCOPES).
export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.events.readonly",
].join(" ");

const REPO = process.env.ESPALDERA_DATA_REPO || "Mauxz7/espaldera-data";

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else if (s.includes("\n") || s.includes("\r")) rl.output.write("\n");
      };
    }
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    });
  });
}

function setSecret(name, value) {
  const r = spawnSync("gh", ["secret", "set", name, "-R", REPO], { input: value, stdio: ["pipe", "ignore", "inherit"] });
  if (r.status !== 0) throw new Error(`No se pudo guardar ${name} (¿gh tiene sesión iniciada?).`);
  console.log(`✓ ${name} guardado en ${REPO}`);
}

// Servidor local de un solo uso que recibe el código de Google (redirección «loopback» de apps Desktop).
function listen(mustInclude, what) {
  return new Promise((resolve) => {
    let done;
    const code = new Promise((ok, fail) => (done = { ok, fail }));
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/") return res.writeHead(404).end();
      const c = url.searchParams.get("code");
      const granted = (url.searchParams.get("scope") || "").includes(mustInclude);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(c && granted
        ? "<h2>Listo. Ya puedes cerrar esta pestaña y volver a la terminal.</h2>"
        : `<h2>Falta el permiso de ${what}. Vuelve a intentarlo y deja marcadas todas las casillas.</h2>`);
      server.close();
      c && granted ? done.ok(c) : done.fail(new Error(`Google no dio permiso de ${what}.`));
    });
    server.listen(0, "127.0.0.1", () => resolve({ port: server.address().port, code }));
  });
}

// Un viaje completo a Google para un conjunto de permisos; devuelve los tokens.
async function authorize(clientId, clientSecret, scope, mustInclude, what) {
  const { port, code: codeP } = await listen(mustInclude, what);
  const redirect = `http://127.0.0.1:${port}`;
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirect, response_type: "code", scope,
    access_type: "offline", prompt: "consent", code_challenge: challenge, code_challenge_method: "S256",
  }).toString();
  console.log(`\n→ Permiso de ${what}. Se abre Google en el navegador. Elige tu cuenta; si dice «Google no verificó esta app»,`);
  console.log("  toca «Avanzado» → «Ir a Espaldera», marca todas las casillas y toca «Continuar».");
  console.log("\nSi el navegador no se abre solo, copia este enlace completo y pégalo en Chrome o Safari:\n");
  console.log(auth.toString());
  console.log("\nEsperando la respuesta de Google… (deja esta ventana abierta)");
  // Navegador: ESPALDERA_BROWSER (p. ej. "Safari"); si no, el predeterminado del sistema.
  const browser = process.env.ESPALDERA_BROWSER;
  spawnSync("open", browser ? ["-a", browser, auth.toString()] : [auth.toString()]);
  const code = await codeP;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret, code, code_verifier: verifier,
      grant_type: "authorization_code", redirect_uri: redirect,
    }).toString(),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.refresh_token) {
    const hint = tok.error === "invalid_client" ? " El Client secret no coincide: cópialo de nuevo desde Google Cloud." : "";
    throw new Error(`Google no entregó el token (${res.status} ${tok.error || ""}).${hint}`);
  }
  return tok;
}

async function healthStep(clientId, clientSecret) {
  const tok = await authorize(clientId, clientSecret, SCOPES, "googlehealth.activity_and_fitness", "actividad, ejercicio y sueño (Fitbit)");
  // Prueba real antes de guardar: ¿la API responde con tus entrenos?
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const points = await fetchExercises(fetch, tok.access_token, since);
  console.log(`\nGoogle Health respondió: ${points.length} entrenos en los últimos 30 días.`);
  try {
    const nights = (await fetchSleep(fetch, tok.access_token, since)).map(toSleep).filter(Boolean);
    console.log(`Sueño: ${nights.length} noches en los últimos 30 días.`);
  } catch (e) {
    console.log("Sueño: sin permiso (¿quedó sin marcar la casilla de sueño?). Los entrenos funcionan igual; puedes repetir con --solo-fitbit.");
  }
  setSecret("GOOGLE_HEALTH_CLIENT_ID", clientId);
  setSecret("GOOGLE_HEALTH_CLIENT_SECRET", clientSecret);
  setSecret("GOOGLE_HEALTH_REFRESH_TOKEN", tok.refresh_token);
}

async function calendarStep(clientId, clientSecret) {
  const tok = await authorize(clientId, clientSecret, CALENDAR_SCOPES, "calendar", "calendario");
  const cal = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&singleEvents=true&timeMin=" + encodeURIComponent(new Date().toISOString()), {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!cal.ok) {
    const body = await cal.text();
    if (/accessNotConfigured|SERVICE_DISABLED|has not been used/.test(body)) throw new Error("Falta activar la Google Calendar API en tu proyecto de Google Cloud (APIs y servicios → Biblioteca → Google Calendar API → Habilitar). Actívala y corre: node scripts/google-health-auth.mjs --solo-calendario");
    throw new Error(`Google Calendar respondió ${cal.status}. ${body.replace(/\s+/g, " ").slice(0, 300)}`);
  }
  console.log("\nGoogle Calendar respondió: permiso de calendario listo.");
  setSecret("GOOGLE_CLIENT_ID", clientId);
  setSecret("GOOGLE_CLIENT_SECRET", clientSecret);
  setSecret("GOOGLE_CALENDAR_REFRESH_TOKEN", tok.refresh_token);
}

// Uso:  node scripts/google-health-auth.mjs                    → Fitbit y luego calendario (dos pantallas de Google)
//       node scripts/google-health-auth.mjs --solo-calendario  → solo el calendario
//       node scripts/google-health-auth.mjs --solo-fitbit      → solo Fitbit (renovar cada 7 días)
async function main() {
  const args = process.argv.slice(2);
  const doHealth = !args.includes("--solo-calendario");
  const doCalendar = !args.includes("--solo-fitbit");
  console.log("Conectar Google (Fitbit y Calendario) con Shift\n");
  const clientId = await ask("Client ID (termina en .apps.googleusercontent.com): ");
  const clientSecret = await ask("Client secret (no se verá al escribir): ", true);
  if (!clientId.endsWith(".apps.googleusercontent.com") || !clientSecret) throw new Error("Revisa el Client ID y el Client secret.");

  if (doHealth) await healthStep(clientId, clientSecret);
  if (doCalendar) await calendarStep(clientId, clientSecret);
  console.log("\nTodo listo.");
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
