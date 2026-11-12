# Lista de tareas

Estado: ⬜ pendiente · 🟨 en curso · ✅ hecha. Una rama por tarea: `tarea/<id>-<nombre-corto>`.

Cada tarea indica los archivos que toca. **Dos tareas que tocan el mismo archivo no se hacen en paralelo.**

## Fase 1 · Base ✅

- ✅ App independiente, sincronización, actualización automática.
- ✅ Código dividido en módulos, pruebas y publicación automática.

## Fase 2 · Hábitos y recordatorios

### ✅ H1 · Hábitos editables y medibles
Hoy los hábitos son una lista fija de casillas en `src/data/habits.js`.
- Nueva clave sincronizada `habitDefs`: lista de `{ id, label, group: "req" | "opt", kind: "check" | "count", target, unit, remindAt: "HH:MM" | null }`. Su valor inicial son los 7 hábitos actuales con sus mismos `id`, más «Comer una fruta» (opcional).
- En Ajustes: agregar, editar, reordenar y archivar hábitos. Archivar no borra el historial.
- `kind: "count"`: en lugar de casilla, un contador (ej. agua 0/2 botellas). En `habits[fecha][id]` se guarda el número; un hábito cuenta como cumplido cuando llega a `target`. Los `true` ya guardados siguen valiendo como cumplido.
- `reqDone` / `optDone` pasan a recibir las definiciones. El % del día sigue contando solo los obligatorios.
- **Archivos:** `data/habits.js`, `components/Habits.jsx`, `views/HabitsView.jsx`, `views/SettingsView.jsx`, `lib/storage.js` (solo `SYNC_KEYS`), `App.jsx`.
- **Listo cuando:** los datos existentes se ven igual que antes; puedes crear «Comer una fruta» y un contador de agua; hay pruebas de la lógica de cumplimiento en `tests/`.

### ✅ H2 · Rachas y cumplimiento por hábito
Depende de H1.
- Función pura en `src/lib/habitStats.js`: racha actual, mejor racha y % de cumplimiento de 30 días por hábito. Con pruebas.
- En la pestaña Hábitos: una fila por hábito con su racha y una tira de los últimos 30 días.
- **Archivos:** `lib/habitStats.js` (nuevo), `views/HabitsView.jsx`.

### ✅ H3 · Recordatorios por hábito con la app abierta
Depende de H1.
- Generalizar `src/lib/reminder.jsx`: hoy solo avisa de la creatina desde las 12:00. Debe avisar de cualquier hábito con `remindAt` que siga pendiente, repitiendo cada hora en punto hasta marcarlo.
- Un solo aviso en pantalla que liste los pendientes, cada uno con su botón de marcar.
- **Archivos:** `lib/reminder.jsx`, `App.jsx`.

### ✅ H4 · Notificaciones con la app cerrada
Depende de H1. **Reservada para Claude** (toca el repositorio privado y la sincronización).
- Web Push para la app instalada, enviada por una tarea programada de GitHub Actions en el repositorio privado, que lee los hábitos pendientes y avisa solo de esos.
- Hecho: `src/lib/push.js` + `components/PushCard.jsx` (suscripción por dispositivo en `push/subs/` del repo privado), avisos en `public/sw.js`, remitente `scripts/recordatorios.mjs` (con pruebas). **El remitente corre como copia en el repo privado**: si cambias `scripts/recordatorios.mjs`, cópialo también allá.

## Fase 3 · Entrenamiento

### ✅ E1 · Registro de repeticiones y carga por serie
Hoy cada serie es una casilla y hay un único campo «Carga» por ejercicio.
- Nueva clave sincronizada `setLog`: `{ [fecha]: { [rutina]: { [ejercicio]: [{ reps, load }] } } }`, recortada a 90 días.
- Al tocar una serie se marca como hoy; un toque largo (o un botón «editar») abre un control compacto para ajustar repeticiones y carga, precargado con lo de la serie anterior.
- El campo «Carga» y «Última vez» se mantienen y se alimentan de este registro.
- **Archivos:** `components/ExerciseCard.jsx`, `views/TrainView.jsx`, `lib/storage.js` (solo `SYNC_KEYS`).
- **Listo cuando:** marcar series sigue siendo un toque; lo registrado aparece al volver a esa rutina otro día.

### ✅ E2 · Sugerencia de progresión
Depende de E1.
- Función pura `src/lib/progression.js` con pruebas: dado el historial de un ejercicio y su rango de reps, sugiere la meta de hoy (subir una repetición, subir carga al llegar al tope del rango, o repetir si no se completó).
- La tarjeta del ejercicio muestra la sugerencia en una línea.
- **Archivos:** `lib/progression.js` (nuevo), `components/ExerciseCard.jsx`.

### ✅ E3 · Plan de running por semanas
Hoy el día de running tiene intervalos fijos (5 × 3 min de trote + 1 min de caminata).
- `src/data/runPlan.js`: progresión de caminata-trote de 8 a 9 semanas, de bajo impacto.
- `src/lib/runProgress.js` con pruebas: avanza de nivel al completar la sesión, repite si no se completó, retrocede un nivel tras dos semanas sin correr.
- Nueva clave sincronizada `runLevel`. El bloque de intervalos del Día 3 toma sus series y tiempos del nivel actual.
- **Archivos:** `data/runPlan.js` (nuevo), `lib/runProgress.js` (nuevo), `data/program.js`, `views/TrainView.jsx`.
- **No en paralelo con E1** (ambas tocan `views/TrainView.jsx`).

## Fase 4 · Datos de salud

### ✅ S1 · Recepción de entrenos · **Reservada para Claude**
Formato y canal para que un Atajo del iPhone envíe los entrenos de Apple Health al repositorio privado.
- Hecho: el Atajo crea `health/inbox/<marca>.txt` (una línea por entreno: `tipo | inicio | fin | duración`); el workflow «Entrenos» del repo privado corre `scripts/entrenos.mjs` (copia de la de este repo, con pruebas) y deja la lista en la clave sincronizada `workouts` (`[{ id, type, kind: run|bike|walk|strength|other, start, end, min }]`, del más reciente al más viejo). La guía del Atajo está en Ajustes (`components/HealthIntakeCard.jsx`).
- Para S2: leer `usePersisted("workouts", [])`; no escribir esa clave desde la app.
- Límite descubierto: en iOS, Atajos no puede leer entrenamientos («Buscar muestras de salud» no tiene ese tipo). La bandeja sigue funcionando para otros envíos, pero los entrenos de Fitbit llegan por S3.

### ✅ S2 · Vista de entrenos
Depende de S1. Lista y resumen semanal de entrenos (Fitbit y Strava) en la pestaña Salud.

### ✅ S3 · Entrenos de Fitbit vía Google Health API · **Reservada para Claude**
Proyecto personal y gratuito de Google Cloud con la Google Health API (cliente OAuth «Desktop», permiso de solo lectura
`googlehealth.activity_and_fitness.readonly`) → workflow «Google Health» del repo privado (4 veces al día) → clave `workouts`.
- `scripts/google-health.mjs` (copia en el repo privado junto con `scripts/entrenos.mjs`, que exporta `applyWorkouts`). Lee `users/me/dataTypes/exercise/dataPoints` filtrando por `exercise.interval.civil_start_time`. Entrenos con `source: "google"` y `km` opcional; mismo `id` que el Atajo, así nada se duplica.
- Autorización con `node scripts/google-health-auth.mjs` (guarda los secretos `GOOGLE_HEALTH_*` con `gh secret set`). Con la app en modo prueba, Google vence el acceso cada 7 días: la tarea falla con un mensaje claro y se repite el script.
- Descartados: Atajos (iOS no lee entrenamientos), la API vieja de Fitbit (apagada en noviembre de 2026) y Strava (su API es de pago).

## Fase 5 · Entrenos reales y avisos

### ✅ N1 · Avisos del servidor: renovar Google Health y resumen semanal
Solo toca `scripts/recordatorios.mjs` y `tests/`. El repo privado y sus workflows los actualiza Claude después; no los toques.
- `scripts/recordatorios.mjs` gana dos modos por línea de comandos, reutilizando el envío Web Push que ya existe:
  - `--aviso "<título>" "<texto>"`: envía ese aviso a todos los dispositivos suscritos, sin horario silencioso. Lo usará la tarea «Google Health» cuando Google rechace la autorización («Renueva Google Health: corre el script en tu Mac»).
  - `--resumen`: arma y envía un resumen de los últimos 7 días leyendo `data.json`: entrenos y minutos por tipo (clave `workouts`), % de días con todos los hábitos obligatorios cumplidos y la racha actual (reusa `src/lib/habitStats.js` si se importa sin interfaz; si no, función pura propia). Máximo ~3 líneas.
- Funciones puras exportadas (`buildWeeklySummary(data, now)`, …) con pruebas. El modo normal (recordatorios por hora) no cambia. Ambos modos aceptan `--test` para imprimir sin enviar.
- **Listo cuando:** `npm test` pasa y `--resumen --test` imprime un resumen con un `data.json` de ejemplo.
- Hecho: el repo privado tiene la copia del script, el workflow «Resumen semanal» (domingos 7:00 p.m.) y el aviso de renovar en «Google Health» (una vez al día, solo si Google rechazó la autorización).

### 🟨 N2 · El plan semanal cuenta los entrenos de Fitbit
- Los entrenos reales (`usePersisted("workouts", [])`, solo lectura; formato en S1/S3) se cruzan con la semana del plan: un día con un entreno `strength` o `run` de 20 min o más cuenta como sesión hecha aunque no se haya marcado en Espaldera; uno `other` (raqueta, fútbol, «Activity») de 30 min o más cuenta como esfuerzo para las reglas de fatiga (no poner el Día 2 de pierna al día siguiente).
- La tarjeta de la semana marca con un ícono distinto los días cubiertos por un entreno de Fitbit, con tipo y minutos.
- Lógica pura en `src/lib/planner.js` (o archivo nuevo en `lib/`) con pruebas; no escribir la clave `workouts`.
- **Archivos:** `lib/planner.js`, `components/WeekCard.jsx`, pruebas. No toques `views/TrainView.jsx` (lo usa N3).
- **Listo cuando:** se ve bien a 375 px y «Reacomodar» respeta lo ya hecho en Fitbit.

### ✅ N3 · Empezar el entreno en Fitbit desde Espaldera
Hoy el usuario abre Fitbit, inicia el ejercicio y luego vuelve a Espaldera para hacer su rutina.
- Botón «Empezar con Fitbit» en el encabezado de la rutina del día (`views/TrainView.jsx`) que abre `shortcuts://run-shortcut?name=<nombre>` para correr un Atajo de iOS del usuario. Nombre configurable en Ajustes (por defecto «Entreno Fitbit»); el botón se puede ocultar.
- Tarjeta en Ajustes con la guía corta para crear el Atajo: acción «Abrir app» → Fitbit (o, si Fitbit ofrece en Atajos una acción para iniciar un ejercicio, usar esa). Al terminar, el usuario vuelve a Espaldera con el gesto de volver de iOS.
- En Mac o si el Atajo no existe no se rompe nada (el botón es solo un enlace).
- **Archivos:** `views/TrainView.jsx`, componente nuevo en `components/`, `views/SettingsView.jsx`.
- **Listo cuando:** se ve bien a 375 px de ancho.

## Qué se puede hacer en paralelo ahora

- **N1, N2 y N3** no comparten archivos: van en paralelo.

- **H1** y **E1** no comparten archivos de interfaz (solo una línea en `SYNC_KEYS`, fácil de unir).
- Después: **H2 + H3** en paralelo con **E2**; luego **E3**.
