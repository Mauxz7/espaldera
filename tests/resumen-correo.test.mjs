import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  resolveSummaryWeek,
  buildWeeklyReport,
  buildWeeklyEmail,
  parseCliArgs,
  resolveSmtpConfig,
  escapeHtml,
  main,
} from "../scripts/resumen-correo.mjs";

const at = (iso) => new Date(iso);

test("resolveSummaryWeek devuelve la última semana completa lunes–domingo o la semana actual", () => {
  // Lunes 23 nov 2026 8:00 a.m. CR (= 14:00Z) → semana anterior: 16..22 nov
  const mon = resolveSummaryWeek(at("2026-11-23T14:00:00Z"), "last");
  assert.equal(mon.mondayKey, "2026-11-16");
  assert.equal(mon.startDate, "2026-11-16");
  assert.equal(mon.endDate, "2026-11-22");
  assert.equal(mon.keys.length, 7);

  // Domingo 22 nov 2026 7:00 p.m. CR → esa misma semana 16..22 nov
  const sun = resolveSummaryWeek(at("2026-11-23T01:00:00Z"), "last");
  assert.equal(sun.startDate, "2026-11-16");
  assert.equal(sun.endDate, "2026-11-22");

  // Martes 24 nov 2026 → sigue devolviendo 16..22 nov como última semana cerrada
  const tue = resolveSummaryWeek(at("2026-11-24T15:00:00Z"), "last");
  assert.equal(tue.startDate, "2026-11-16");
  assert.equal(tue.endDate, "2026-11-22");

  // Modo current el jueves 19 nov → 16..19 nov (4 días)
  const cur = resolveSummaryWeek(at("2026-11-19T15:00:00Z"), "current");
  assert.equal(cur.startDate, "2026-11-16");
  assert.equal(cur.endDate, "2026-11-19");
  assert.deepEqual(cur.keys, ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
});

test("buildWeeklyReport integra entrenos, hábitos, sueño, dopamina, identidades, logros y cierre", () => {
  const habitDefs = [
    { id: "o_creatine", label: "Creatina.", group: "req", kind: "check", target: 1, identity: "atleta" },
    { id: "o_water", label: "Agua 2L.", group: "req", kind: "count", target: 2, identity: "atleta" },
    { id: "f_read", label: "Leer.", group: "opt", kind: "check", target: 1, identity: "lector" },
  ];
  const fullDay = { o_creatine: true, o_water: 2 };
  const data = {
    habitDefs: { v: habitDefs, at: 1 },
    habits: {
      v: {
        "2026-11-16": fullDay,
        "2026-11-17": { o_creatine: true, _mini: { o_water: true }, f_read: true },
        "2026-11-18": { o_creatine: true, o_water: 1 },
        "2026-11-19": fullDay,
        "2026-11-20": fullDay,
        "2026-11-21": fullDay,
        "2026-11-22": fullDay,
      },
      at: 1,
    },
    log: {
      v: {
        "2026-11-16": { r: "d1", at: 1 },
        "2026-11-18": { r: "d3", at: 1 },
      },
      at: 1,
    },
    workouts: {
      v: [
        { id: "w1", kind: "strength", min: 45, start: "2026-11-16T12:30:00Z" },
        { id: "w2", kind: "strength", min: 40, start: "2026-11-20T12:30:00Z" }, // cubre otra sesión por Fitbit
        { id: "w3", kind: "walk", min: 25, start: "2026-11-21T16:00:00Z" },
      ],
      at: 1,
    },
    sleep: {
      v: {
        "2026-11-16": { min: 450, bed: "22:45", wake: "06:15" }, // >=7h
        "2026-11-17": { min: 390, bed: "22:50", wake: "05:20" }, // <7h pero antes de 11pm -> rested
        "2026-11-18": { min: 360, bed: "00:10", wake: "06:10" }, // no rested
      },
      at: 1,
    },
    dopamineDefs: {
      v: [
        { id: "d_shorts", label: "Videos", kind: "cheap", limit: 0 },
        { id: "d_read", label: "Leer", kind: "good", identity: "lector", goal: 0 },
      ],
      at: 1,
    },
    dopamine: {
      v: {
        "2026-11-16": { d_read: 1 },
        "2026-11-18": { d_shorts: 1 },
      },
      at: 1,
    },
    wins: {
      v: [
        { id: "old", date: "2026-11-10", text: "Semana pasada" },
        { id: "w1", date: "2026-11-19", text: "Dominadas limpias" },
      ],
      at: 1,
    },
    reviews: {
      v: {
        "2026-11-16": { good: "Constancia en la mañana", adjust: "Acostarme antes los miércoles" },
      },
      at: 1,
    },
  };

  // Lunes 23 nov 8:00 a.m. CR → reporta 16..22 nov
  const rep = buildWeeklyReport(data, { now: at("2026-11-23T14:00:00Z") });
  assert.equal(rep.sessions.done, 3); // d1 + d3 (log) + d4 (Fitbit fuerza)
  assert.equal(rep.workouts.count, 3);
  assert.equal(rep.workouts.totalMin, 110);
  assert.equal(rep.habits.daysDone, 6); // todos excepto miércoles 18
  assert.equal(rep.habits.pct, 86);
  assert.equal(rep.habits.streak, 4); // 19, 20, 21, 22
  assert.equal(rep.sleep.nights, 3);
  assert.equal(rep.sleep.nights7h, 1);
  assert.equal(rep.sleep.restedNights, 2);
  assert.equal(rep.sleep.avgMin, 400);
  assert.equal(rep.dopamine.good, 1);
  assert.equal(rep.dopamine.cheap, 1);
  assert.equal(rep.dopamine.failedDays, 1);
  assert.equal(rep.identities.top.id, "atleta");
  assert.equal(rep.wins.length, 1);
  assert.equal(rep.wins[0].text, "Dominadas limpias");
  assert.equal(rep.review.good, "Constancia en la mañana");
});

test("buildWeeklyEmail escapa HTML y maneja data.json vacío", () => {
  const empty = buildWeeklyEmail({}, { now: at("2026-11-23T14:00:00Z") });
  assert.match(empty.subject, /^Shift · Resumen semanal/);
  assert.match(empty.text, /Sesiones del plan: 0 \/ 4/);
  assert.match(empty.html, /Abrir revisión semanal en Shift/);

  const xss = buildWeeklyEmail({
    wins: { v: [{ id: "1", date: "2026-11-18", text: "<script>alert('x')</script> & \"más\"" }] },
    reviews: { v: { "2026-11-16": { good: "<b>Bien</b>", adjust: "" } } },
  }, { now: at("2026-11-23T14:00:00Z") });

  assert.ok(!xss.html.includes("<script>"));
  assert.ok(xss.html.includes("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;más&quot;"));
  assert.ok(xss.html.includes("&lt;b&gt;Bien&lt;/b&gt;"));
  assert.equal(escapeHtml("<a&\"'>"), "&lt;a&amp;&quot;&#39;&gt;");
});

test("parseCliArgs, resolveSmtpConfig y main (--test, sin secretos, y con sendMail)", async () => {
  assert.deepEqual(
    parseCliArgs(["--test", "--html", "--semana", "actual", "--root", "/tmp/x"]),
    { test: true, htmlOnly: true, week: "current", root: "/tmp/x" },
  );
  const cfg = resolveSmtpConfig({ SMTP_USER: "usuario@example.com", SMTP_PASS: "abcd efgh ijkl mnop" });
  assert.equal(cfg.to, "usuario@example.com");
  assert.equal(cfg.pass, "abcdefghijklmnop");
  assert.equal(cfg.host, "smtp.gmail.com");
  assert.equal(cfg.port, 465);
  assert.equal(cfg.secure, true);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "espaldera-mail-"));
  fs.writeFileSync(path.join(root, "data.json"), JSON.stringify({
    habits: { v: { "2026-11-20": { o_creatine: true } }, at: 1 },
  }));

  // CLI real en modo --test no requiere secretos ni nodemailer
  const out = execFileSync(process.execPath, [path.resolve("scripts/resumen-correo.mjs"), "--test"], { cwd: root, encoding: "utf8" });
  assert.match(out, /^Shift · Resumen semanal/);
  assert.match(out, /Abrir revisión semanal en Shift:/);

  // Sin secretos sale limpio
  const missing = await main({ root, env: {}, now: at("2026-11-23T14:00:00Z") });
  assert.equal(missing.sent, false);
  assert.equal(missing.skipped, true);

  // Con sendMail inyectado envía asunto, destinatario, texto y HTML
  const sentMails = [];
  const ok = await main({
    root,
    now: at("2026-11-23T14:00:00Z"),
    env: { SMTP_USER: "remitente@example.com", SMTP_PASS: "clave123", SUMMARY_EMAIL: "usuario@example.com" },
    sendMail: async (m) => { sentMails.push(m); },
  });
  assert.equal(ok.sent, true);
  assert.equal(sentMails.length, 1);
  assert.equal(sentMails[0].to, "usuario@example.com");
  assert.equal(sentMails[0].from, "Shift <remitente@example.com>");
  assert.match(sentMails[0].subject, /16 nov – 22 nov/);
  assert.ok(sentMails[0].html.includes("<!doctype html>"));
});
