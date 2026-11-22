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
| `setLog` | `{ fecha: { rutina: { ejercicio: [{ reps, load }] } } }` | series registradas en Shift |
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

### `muscleFreshness(setLog, dateKey)` → frescura por grupo
```js
[{ group: "lats", label: "Dorsales", pct: 87, lastDate: "2026-11-21", sets: 6 }, ... 11 grupos]
```
Grupos: `MUSCLE_GROUPS` (pecho, dorsales, espalda alta, hombros, bíceps, tríceps, core,
cuádriceps, glúteos, isquios, pantorrillas). `sets` = series efectivas de los últimos 7 días.

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
