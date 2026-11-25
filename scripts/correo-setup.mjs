// Configura el resumen semanal por correo en el repositorio privado (`Mauxz7/espaldera-data`).
// Se corre en tu Mac:
//   node scripts/correo-setup.mjs              → configura correo y contraseña de aplicación
//   node scripts/correo-setup.mjs --solo-clave → solo guarda SMTP_PASS (cuando el correo ya está configurado)
//
// Requisitos:
//   1. Verificación en 2 pasos activada en tu cuenta de Google.
//   2. Una «Contraseña de aplicación» creada en https://myaccount.google.com/apppasswords
//   3. `gh` con sesión iniciada.
import readline from "node:readline";
import { spawnSync } from "node:child_process";

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

async function main() {
  const soloClave = process.argv.includes("--solo-clave");
  console.log("Configurar resumen semanal por correo en Shift\n");
  console.log("1. Abre https://myaccount.google.com/apppasswords");
  console.log("2. Crea una contraseña de aplicación llamada «Shift» (16 caracteres).\n");

  if (!soloClave) {
    const fromEmail = await ask("Correo Gmail remitente (ej. tu-correo@ejemplo.com): ");
    if (!fromEmail.includes("@") || !fromEmail.includes(".")) throw new Error("Correo remitente inválido.");
    const toEmailInput = await ask("Correo destino (Enter para usar el mismo): ");
    const toEmail = toEmailInput || fromEmail;
    if (!toEmail.includes("@") || !toEmail.includes(".")) throw new Error("Correo destino inválido.");
    setSecret("SMTP_USER", fromEmail);
    setSecret("SUMMARY_EMAIL", toEmail);
  }

  const rawPass = await ask("Contraseña de aplicación de Google (16 letras, no se verá al escribir): ", true);
  const pass = rawPass.replace(/\s+/g, "");
  if (pass.length < 12) throw new Error("La contraseña de aplicación parece incompleta.");
  setSecret("SMTP_PASS", pass);

  const runNow = await ask("\n¿Quieres enviar un correo de prueba ahora mismo? (s/N): ");
  if (/^s(i|í)?$/i.test(runNow)) {
    const r = spawnSync("gh", ["workflow", "run", "resumen-correo.yml", "-R", REPO, "-f", "semana=actual"], { stdio: "inherit" });
    if (r.status === 0) console.log("\n✓ Prueba lanzada. Revisa tu bandeja en ~30 segundos.");
    else console.log("\nNo se pudo lanzar el flujo automáticamente; puedes ejecutarlo desde GitHub Actions.");
  }

  console.log("\nTodo listo.");
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
