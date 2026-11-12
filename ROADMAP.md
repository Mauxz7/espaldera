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

### ⬜ H3 · Recordatorios por hábito con la app abierta
Depende de H1.
- Generalizar `src/lib/reminder.jsx`: hoy solo avisa de la creatina desde las 12:00. Debe avisar de cualquier hábito con `remindAt` que siga pendiente, repitiendo cada hora en punto hasta marcarlo.
- Un solo aviso en pantalla que liste los pendientes, cada uno con su botón de marcar.
- **Archivos:** `lib/reminder.jsx`, `App.jsx`.

### ⬜ H4 · Notificaciones con la app cerrada
Depende de H1. **Reservada para Claude** (toca el repositorio privado y la sincronización).
- Web Push para la app instalada, enviada por una tarea programada de GitHub Actions en el repositorio privado, que lee los hábitos pendientes y avisa solo de esos.

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

### ⬜ E3 · Plan de running por semanas
Hoy el día de running tiene intervalos fijos (5 × 3 min de trote + 1 min de caminata).
- `src/data/runPlan.js`: progresión de caminata-trote de 8 a 9 semanas, de bajo impacto.
- `src/lib/runProgress.js` con pruebas: avanza de nivel al completar la sesión, repite si no se completó, retrocede un nivel tras dos semanas sin correr.
- Nueva clave sincronizada `runLevel`. El bloque de intervalos del Día 3 toma sus series y tiempos del nivel actual.
- **Archivos:** `data/runPlan.js` (nuevo), `lib/runProgress.js` (nuevo), `data/program.js`, `views/TrainView.jsx`.
- **No en paralelo con E1** (ambas tocan `views/TrainView.jsx`).

## Fase 4 · Datos de salud

### ⬜ S1 · Recepción de entrenos · **Reservada para Claude**
Formato y canal para que un Atajo del iPhone envíe los entrenos de Apple Health al repositorio privado.

### ⬜ S2 · Vista de entrenos
Depende de S1. Lista y resumen semanal de entrenos (Fitbit y Strava) en la pestaña Salud.

## Qué se puede hacer en paralelo ahora

- **H1** y **E1** no comparten archivos de interfaz (solo una línea en `SYNC_KEYS`, fácil de unir).
- Después: **H2 + H3** en paralelo con **E2**; luego **E3**.
