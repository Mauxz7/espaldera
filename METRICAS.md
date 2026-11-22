# Contrato de métricas estilo Bevel

Este archivo es la referencia común entre Claude (lógica) y Antigravity (pantallas).
**Regla:** la UI no calcula nada. Solo llama a estas funciones y pinta lo que devuelven.
Si una pantalla necesita otra cifra, se pide aquí y la agrega quien lleva la lógica.

Todo está en `src/lib/metrics.js` (nuevo) y `src/lib/bevel.js` (ya existente). Las fechas son
claves locales `"YYYY-MM-DD"` (`dkey()` de `src/lib/dates.js`).

## Datos de entrada (ya sincronizados, `usePersisted` en `App.jsx`)

| Clave | Forma | Notas |
|---|---|---|
| `vitals` | `{ fecha: { hrv, rhr, resp, spo2, tempDev, steps, sleepHr, awakeHr, hrDip } }` | de Fitbit; un día puede traer solo `steps` hasta que llega la noche |
| `sleep` | `{ fecha_despertar: { min, bed, wake, inBedMin, deepMin, remMin, lightMin, awakeMin, awakenings, eff } }` | |
| `workouts` | `[{ id, type, kind, start, end, min, zones?, avgHr? }]` | `zones` aún no llega en los datos reales → la UI debe tolerar `null` |
| `setLog` | `{ fecha: { rutina: { ejercicio: [{ reps, load, rir? }] } } }` | series registradas en Shift (`free` para entreno libre) |
| `soreness` | `{ fecha: { grupo: true } }` | marca manual «Lo siento cargado» (fuerza ≤ 65 % por 24 h) |
| `bevelHistory` | `computeBevelHistory(...)` → `{ byDate, today, latestDate }` | ya se calcula en `App.jsx` |

## Funciones y lo que devuelven

### `trendCard(seriesByDate, dateKey)` → tarjeta de tendencia
```js
{ value: 113, status: "below" | "normal" | "above" | "calibrating" | "missing",
  range: { low: 116.7, high: 139.5 } | null,
  changes: { d3: -8.1, d7: 0.5, d14: null, d30: null, d90: null },   // cambio del promedio móvil de 7 d
  spark: [{ date: "2026-10-23", value: 120.4 | null }, ...30] }
```
Usar con `seriesOf(vitals, "hrv" | "rhr" | "resp" | "spo2" | "tempDev" | "steps")` o `seriesOf(sleep, "min")`.
Pills: below = «Bajo lo normal», normal = «Rango normal», above = «Sobre lo normal»,
calibrating = «Calibrando», missing = «Sin datos». Ojo: para RHR y estrés, «above» es malo;
para HRV y sueño, «below» es malo (el color lo decide la pantalla según la métrica).

### `dailyStress(vitals[fecha], { age, maxHr, hrvRange })` → estrés del día
```js
{ score: 24, level: "low" | "medium" | "high" | null, sleepScore: 0 | null }
```
`age`/`maxHr` salen de `bevelHistory.prefs`; `hrvRange` = `trendCard(seriesOf(vitals,"hrv"), fecha).range`.
Bandas: bajo < 30, medio 30–60, alto > 60 (`STRESS_LEVELS`). Es diario (Fitbit no da pulso por minuto).

### `trainingLoads(bevelHistory, dateKey)` → `{ cardio, muscular }`
Cada uno:
```js
{ value: 58, optimal: { min: 33, max: 54 }, ratio: 1.37,
  status: "calibrating" | "detraining" | "maintaining" | "productive" | "peaking" | "fatigued" | "overtraining",
  breakdown: { detraining: 1, maintaining: 5, ... },          // días en cada estado (últimos 30)
  history: [{ date, value, low, high, status }, ...30] }        // para el gráfico con banda óptima
```
Etiquetas: Calibrando, Desentrenando, Manteniendo, Productivo, En pico, Fatigado, Sobreentrenando.

### `exerciseMuscles(exId, customExercises?)` → mapa muscular por ejercicio
Devuelve `{ grupo: peso }` (1 = motor principal). Respeta el campo `muscles` en ejercicios de `program.js`, `EXERCISE_LIBRARY`, `SUBS` o `customExercises` (y `primaryGroup`/`secondaryGroups`), y cae a `PATTERN_MUSCLES[pattern]` solo si no hay mapa explícito. `routineMuscles(rid, variantId)` también usa `exerciseMuscles`.

### `muscleFreshness(setLog, dateKey, opts?)` → frescura por grupo
```js
[{ group: "lats", label: "Dorsales", pct: 87, lastDate: "2026-11-21", sets: 6 }, ... 11 grupos]
```
Grupos: `MUSCLE_GROUPS` (pecho, dorsales, espalda alta, hombros, bíceps, tríceps, core,
cuádriceps, glúteos, isquios, pantorrillas). `sets` = volumen ponderado real de los últimos 7 días.

### `muscleGroups(setLog, dateKey, { log, workouts, customExercises, soreness, now, sessionHour: 7, days: 7 })` → hoja «Grupos musculares»
```js
{ groups: [{ group, label, pct: 66, status: "fatigued", sets: 10, reps: 90, lastDate, trained: true, manual: false }, ...],
  counts: { recovered: 8, fatigued: 3, depleted: 0 } }
```
Modelo de fatiga realista (`MUSCLE_PROFILE`):
- **Series efectivas:** cada serie multiplica por RIR (`≤1 → 1,2`, `2 → 1,0`, `≥3 → 0,75`, usando `s.rir` si existe o el del ejercicio), excéntrica lenta (primer dígito del `tempo ≥ 4 → ×1,3`) y novedad (`×1,25` si el grupo no se entrenó en los 10 días previos).
- **Capacidad y recuperación por tamaño:**
  - Grandes (`chest`, `lats`, `quads`, `glutes`, `hamstrings`): capacidad 7, recuperación 72 h.
  - Medianos (`shoulders`, `upperBack`, `core`): capacidad 6, recuperación 60 h.
  - Chicos (`biceps`, `triceps`, `calves`): capacidad 6 (ajustada de 5 → 6 para que el estímulo indirecto de dominadas recupere a ≥ 80 % en 30 h), recuperación 48 h.
- **Saturación diaria:** la carga efectiva acumulada de un día sobre un grupo entra como `1 - exp(-eff / capacidad)` (suave, evita saturar en 0 % con un solo día compuesto).
- **Curva no lineal (`recoveryDecay`):** la fatiga restante permanece en `1` las primeras 12 h (agujetas iniciales) y baja con `0.5·(1 + cos(π·t))` hasta `0` en `recoveryHours`.
- **Marca manual (`toggleSoreness`):** si `soreness[fecha][grupo]` está activo (o dentro de las 24 h previas si se pasa `now`), fuerza `pct ≤ 65` (Fatigado) y devuelve `manual: true`.
- `status` con `freshnessStatus(pct)`: ≥80 `recovered`, ≥50 `fatigued`, si no `depleted` (`FRESH_STATUS` trae etiqueta y tono).
Sesiones de `log` sin series registradas cuentan con las series planeadas de la rutina; entrenos
de Fitbit `kind: "run"` cuentan como trote en días sin sesión de Shift. `reps` = carga (repeticiones
ponderadas), `sets` = volumen. `muscleFreshness()` es un atajo con la forma anterior.

### `recommendTraining({ groups, recovery, plannedRid, doneToday, weekDone, routineVariants })` → Entreno
```js
{ rid: "d3", kind: "train" | "low" | "done", readiness: 92, reason: "…", fresh: [grupo], tired: [grupo], ranking: [{ rid, readiness, score }] }
```
Ordena d1–d4 por la frescura media de sus músculos principales (`routineMuscles(rid)`, peso ≥ 0,4),
+6 si es la del plan, +6 si aún no se hizo esta semana, −10 por cada vez que ya se hizo.
Recuperación < 34 (o < 50 con readiness < 70) → `low`. Si ya hay sesión hoy → `done`.

### `cardioFocus(workouts, dateKey, { days: 30 })` → zonas de los entrenos
```js
{ minutes: { light, moderate, vigorous, peak }, focus: { lowAerobic: 45, highAerobic: 17, anaerobic: 38 } } | null
```
`null` = ningún entreno trae zonas todavía → mostrar «Sin datos de pulso de los entrenos».

### Ya existentes en `bevelHistory.byDate[fecha]`
`recovery` (score, mode, biomarkers), `sleep` (score, need, deep/rem…), `strain` (score, target,
cardioLoad, muscularLoad, zones), `energyBank`, `vitals`. `recovery.mode === "missing"` en la
mañana = la noche aún no llega de Fitbit → mostrar «Esperando a Fitbit», nunca un número.

## Reglas para las pantallas
- Español, mismo estilo visual de Shift (tokens de `app.css`, `font-display` en títulos, tarjetas `rounded-2xl border-line bg-surface`).
- Probar a **375 px** de ancho (iPhone) además de escritorio; nada se corta arriba (usa la safe-area).
- No tocar `src/lib/bevel.js`, `src/lib/metrics.js` ni `src/lib/baselines.js`. Si falta algo, anotarlo en el PR.
- No usar Journal, Nutrición ni nada «Pro» de Bevel.
- `npm test` y `npm run build` en verde; abrir PR, nunca hacer merge.
