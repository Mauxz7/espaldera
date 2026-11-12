import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

// Compila src/lib/reminder.jsx en memoria para probar su lógica pura y componentes en Node.
const bundle = await build({
  entryPoints: ["src/lib/reminder.jsx"],
  bundle: true,
  format: "esm",
  write: false,
  jsx: "automatic",
});
const reminderMod = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const {
  parseRemindAt,
  getScheduledHabits,
  isHabitDue,
  getDueHabits,
  shouldFireReminder,
  buildNotificationPayload,
  resolveCompletedValue,
  ReminderBanner,
} = reminderMod;

test("parseRemindAt valida horas HH:MM y rechaza valores inválidos", () => {
  assert.deepEqual(parseRemindAt("12:00"), {
    hour: 12,
    minute: 0,
    minutes: 720,
    hhmm: "12:00",
  });
  assert.deepEqual(parseRemindAt("08:30"), {
    hour: 8,
    minute: 30,
    minutes: 510,
    hhmm: "08:30",
  });
  assert.deepEqual(parseRemindAt(" 9:05 "), {
    hour: 9,
    minute: 5,
    minutes: 545,
    hhmm: "09:05",
  });
  assert.equal(parseRemindAt(null), null);
  assert.equal(parseRemindAt(undefined), null);
  assert.equal(parseRemindAt(""), null);
  assert.equal(parseRemindAt("24:00"), null);
  assert.equal(parseRemindAt("12:60"), null);
  assert.equal(parseRemindAt("mediodia"), null);
});

test("isHabitDue conserva el comportamiento de la creatina y lo generaliza a cualquier hábito con remindAt", () => {
  const creatine = {
    id: "o_creatine",
    label: "Tomar creatina todos los días.",
    group: "req",
    kind: "check",
    target: 1,
    remindAt: "12:00",
  };
  const water = {
    id: "o_water",
    label: "Tomar 2 botellas de agua.",
    group: "req",
    kind: "count",
    target: 2,
    unit: "botellas",
    remindAt: "14:30",
  };
  const noReminder = {
    id: "f_read",
    label: "Leer 15 min.",
    group: "opt",
    kind: "check",
    target: 1,
    remindAt: null,
  };
  const archived = {
    id: "o_old",
    label: "Hábito archivado.",
    group: "req",
    kind: "check",
    target: 1,
    remindAt: "08:00",
    archived: true,
  };

  const at1159 = new Date(2026, 10, 12, 11, 59, 0);
  const at1200 = new Date(2026, 10, 12, 12, 0, 0);
  const at1429 = new Date(2026, 10, 12, 14, 29, 0);
  const at1430 = new Date(2026, 10, 12, 14, 30, 0);

  // Creatina: antes de las 12:00 no avisa, desde las 12:00 sí, y se apaga al marcarla
  assert.equal(isHabitDue(creatine, {}, at1159), false);
  assert.equal(isHabitDue(creatine, {}, at1200), true);
  assert.equal(isHabitDue(creatine, { o_creatine: true }, at1200), false);

  // Contador (agua a las 14:30 con meta 2): pendiente con 0 o 1, cumplido al llegar a 2
  assert.equal(isHabitDue(water, { o_water: 0 }, at1429), false);
  assert.equal(isHabitDue(water, { o_water: 0 }, at1430), true);
  assert.equal(isHabitDue(water, { o_water: 1 }, at1430), true);
  assert.equal(isHabitDue(water, { o_water: 2 }, at1430), false);
  assert.equal(isHabitDue(water, { o_water: true }, at1430), false);

  // Sin remindAt o archivado nunca están pendientes de aviso
  assert.equal(isHabitDue(noReminder, {}, at1430), false);
  assert.equal(isHabitDue(archived, {}, at1430), false);

  const defs = [creatine, water, noReminder, archived];
  assert.equal(getScheduledHabits(defs).length, 2);
  assert.deepEqual(
    getDueHabits(defs, { o_water: 1 }, at1430).map((d) => d.id),
    ["o_creatine", "o_water"]
  );
  assert.deepEqual(
    getDueHabits(defs, { o_creatine: true, o_water: 1 }, at1430).map((d) => d.id),
    ["o_water"]
  );
});

test("shouldFireReminder avisa desde la hora del hábito y repite cada hora en punto sin duplicar dentro de la misma hora", () => {
  const creatine = { id: "o_creatine", label: "Tomar creatina.", remindAt: "12:00" };
  const pills = { id: "o_pills", label: "Tomar pastillas.", remindAt: "12:30" };
  const today = "2026-11-12";

  // 12:00 → dispara para creatina y limpia días viejos
  const step1 = shouldFireReminder(
    [creatine],
    { o_creatine: "2026-11-11-18" },
    today,
    12
  );
  assert.equal(step1.shouldFire, true);
  assert.deepEqual(step1.nextFiredMap, { o_creatine: "2026-11-12-12" });

  // 12:15 → misma hora y mismo hábito pendiente: no vuelve a disparar
  const step2 = shouldFireReminder([creatine], step1.nextFiredMap, today, 12);
  assert.equal(step2.shouldFire, false);

  // 12:30 → entra un segundo hábito con remindAt 12:30 en la misma hora 12: dispara para el nuevo
  const step3 = shouldFireReminder([creatine, pills], step2.nextFiredMap, today, 12);
  assert.equal(step3.shouldFire, true);
  assert.deepEqual(
    step3.newlyDue.map((h) => h.id),
    ["o_pills"]
  );
  assert.deepEqual(step3.nextFiredMap, {
    o_creatine: "2026-11-12-12",
    o_pills: "2026-11-12-12",
  });

  // 13:00 en punto → cambia la hora a 13 y repite el aviso para los que siguen pendientes
  const step4 = shouldFireReminder([creatine, pills], step3.nextFiredMap, today, 13);
  assert.equal(step4.shouldFire, true);
  assert.deepEqual(step4.nextFiredMap, {
    o_creatine: "2026-11-12-13",
    o_pills: "2026-11-12-13",
  });

  // Al marcar todos los hábitos pendientes → no dispara
  const step5 = shouldFireReminder([], step4.nextFiredMap, today, 13);
  assert.equal(step5.shouldFire, false);
});

test("buildNotificationPayload y resolveCompletedValue manejan uno o varios hábitos y contadores", () => {
  const now = new Date(2026, 10, 12, 12, 0, 0);
  const creatine = { id: "o_creatine", label: "Tomar creatina todos los días.", kind: "check", target: 1 };
  const water = { id: "o_water", label: "Tomar 2 botellas de agua.", kind: "count", target: 2 };

  const pSingleCreatine = buildNotificationPayload([creatine], now);
  assert.equal(pSingleCreatine.title, "Creatina pendiente");
  assert.equal(pSingleCreatine.tabTitle, "⏰ Creatina pendiente");

  const pSingleOther = buildNotificationPayload([water], now);
  assert.match(pSingleOther.title, /Tomar 2 botellas de agua/);

  const pMulti = buildNotificationPayload([creatine, water], now);
  assert.equal(pMulti.title, "2 hábitos pendientes");
  assert.match(pMulti.body, /Tomar creatina todos los días/);
  assert.match(pMulti.body, /Tomar 2 botellas de agua/);

  assert.equal(resolveCompletedValue(creatine), true);
  assert.equal(resolveCompletedValue(water), 2);
});

test("ReminderBanner muestra un solo aviso con la lista de pendientes y un botón de marcar por hábito", () => {
  const dueHabits = [
    { id: "o_creatine", label: "Tomar creatina todos los días.", kind: "check", target: 1, remindAt: "12:00" },
    { id: "o_water", label: "Tomar 2 botellas de agua.", kind: "count", target: 2, unit: "botellas", remindAt: "14:00" },
  ];

  // Oculto o sin pendientes no renderiza nada
  assert.equal(
    renderToStaticMarkup(React.createElement(ReminderBanner, { rem: { due: false, dueHabits: [] } })),
    ""
  );
  assert.equal(
    renderToStaticMarkup(React.createElement(ReminderBanner, { rem: { due: true, hidden: true, dueHabits } })),
    ""
  );

  // Con pendientes muestra un único role="alert" listando ambos hábitos y sus botones de marcar
  const html = renderToStaticMarkup(
    React.createElement(ReminderBanner, {
      rem: {
        due: true,
        hidden: false,
        ringing: true,
        dueHabits,
        dayHabits: { o_water: 1 },
        setHidden: () => {},
      },
      onTake: () => {},
    })
  );

  assert.match(html, /2 hábitos pendientes/);
  assert.match(html, /Tomar creatina todos los días\./);
  assert.match(html, /Tomar 2 botellas de agua\./);
  assert.match(html, /1\/2 botellas/);
  assert.match(html, /aria-label="Marcar Tomar creatina todos los días\."/);
  assert.match(html, /aria-label="Marcar Tomar 2 botellas de agua\."/);
});
