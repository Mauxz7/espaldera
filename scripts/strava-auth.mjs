// Autoriza Espaldera a leer tus actividades de Strava y guarda los secretos en el repo privado.
// Se corre UNA vez en tu Mac:  node scripts/strava-auth.mjs
// Requisitos: una app de API en https://www.strava.com/settings/api con
// «Authorization Callback Domain» = localhost, y `gh` con sesión iniciada.
// Nada de lo que escribes ni los tokens se muestran en pantalla: van directo a `gh secret set`.
import http from "node:http";
import readline from "node:readline";
import { spawnSync } from "node:child_process";

const REPO = process.env.ESPALDERA_DATA_REPO || "Mauxz7/espaldera-data";
const PORT = 8724;
const REDIRECT = `http://localhost:${PORT}/callback`;

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

function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT);
      if (url.pathname !== "/callback") return res.writeHead(404).end();
      const code = url.searchParams.get("code");
      const scope = url.searchParams.get("scope") || "";
      const ok = code && /activity:read/.test(scope);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(ok
        ? "<h2>Listo. Ya puedes cerrar esta pestaña y volver a la terminal.</h2>"
        : "<h2>Falta el permiso para leer actividades. Vuelve a intentarlo y deja marcada esa casilla.</h2>");
      server.close();
      ok ? resolve(code) : reject(new Error("Strava no dio permiso para leer actividades."));
    });
    server.listen(PORT, "127.0.0.1");
  });
}

async function main() {
  console.log("Conectar Strava con Espaldera\n");
  const clientId = await ask("Client ID de tu app de Strava: ");
  const clientSecret = await ask("Client Secret (no se verá al escribir): ", true);
  if (!/^\d+$/.test(clientId) || !clientSecret) throw new Error("Falta el Client ID (número) o el Client Secret.");

  const auth = new URL("https://www.strava.com/oauth/authorize");
  auth.search = new URLSearchParams({
    client_id: clientId, response_type: "code", redirect_uri: REDIRECT,
    approval_prompt: "force", scope: "activity:read_all",
  }).toString();
  const codeP = waitForCode();
  console.log("\nSe abre Strava en el navegador: toca «Autorizar».");
  spawnSync("open", [auth.toString()]);
  const code = await codeP;

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code" }).toString(),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.refresh_token) throw new Error(`Strava no entregó el token (${res.status}).`);

  setSecret("STRAVA_CLIENT_ID", clientId);
  setSecret("STRAVA_CLIENT_SECRET", clientSecret);
  setSecret("STRAVA_REFRESH_TOKEN", tok.refresh_token);
  console.log("\nTodo listo. La tarea «Strava» del repo privado traerá tus entrenos.");
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
