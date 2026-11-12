# Guía para agentes de IA

Lee este archivo completo antes de tocar el código. Las tareas están en [ROADMAP.md](ROADMAP.md).

## Qué es

Espaldera es una app web instalable (PWA) de entrenamiento y hábitos para **un solo usuario**, que la usa en iPhone, iPad y Mac. Está publicada en https://mauxz7.github.io/espaldera/ y cada cambio que llega a `main` se instala solo en sus dispositivos.

## Restricciones que no se negocian

1. **Costo cero.** Nada de servicios de pago, cuentas de desarrollador de Apple ni Xcode. Todo corre en el navegador y en GitHub (plan gratuito).
2. **Este repositorio es público.** No escribas aquí datos personales: nombres, correos, métricas de salud reales, claves ni identificadores de otras cuentas. Los datos del usuario viven en sus dispositivos y en un repositorio privado aparte.
3. **`main` es producción.** Un merge a `main` publica a los dispositivos del usuario en minutos. Trabaja en una rama por tarea y abre un pull request; no hagas push directo a `main`. **Nunca unas tu propio pull request** (`gh pr merge`, botón Merge ni equivalente), aunque las pruebas pasen: lo revisa y lo une otra persona. Tu trabajo termina al abrir el pull request.
4. **No rompas los datos guardados.** El usuario ya tiene datos. Puedes agregar claves nuevas; no renombres ni cambies la forma de las existentes sin una migración que conserve lo guardado.
5. **Texto en español, tratando al usuario de «tú»** (toca, marca, elige), nunca voseo ni «usted».
6. **Bajo impacto.** Las rutinas priorizan estabilidad de rodilla y tobillo y siempre ofrecen una alternativa sin saltos.

## Cómo está organizado

```
src/
  main.jsx              arranque y actualización automática (service worker)
  App.jsx               pestañas y estado global
  app.css               Tailwind + tokens de color (--c-*) y estilos propios
  lib/                  lógica sin interfaz
    storage.js          localStorage + sincronización con GitHub (usePersisted, Sync)
    dates.js            fechas y formatos
    planner.js          planificador semanal (scorePlan, rankPlans, useWeekPlan)
    health.js           lector del correo semanal de Google Health
    audio.js            sonido del temporizador
    reminder.jsx        recordatorio de creatina (aviso, tarjeta y lógica)
  data/                 contenido: rutinas, sustituciones, hábitos
  components/           piezas de interfaz compartidas
  views/                una vista por pestaña
public/                 index.html, manifest, service worker, iconos
tests/                  pruebas con node:test (solo módulos .js sin JSX)
build.mjs               genera dist/ (no se versiona)
```

## Comandos

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

```bash
npm run serve
```

`npm run serve` sirve `dist/` en http://localhost:8765 después de compilar.

## Reglas de código

- **Persistencia:** todo estado que deba sobrevivir usa `usePersisted(clave, valorInicial)`. Si la clave debe viajar entre dispositivos, agrégala a `SYNC_KEYS` en `src/lib/storage.js`. Los objetos por fecha se recortan con `pruneDays`.
- **Sincronización:** `src/lib/storage.js` es delicado (mezcla por clave, gana el cambio más reciente). No lo modifiques salvo que tu tarea lo pida, y si lo haces amplía `tests/sync.test.mjs`.
- **Lógica pura aparte:** cálculos y reglas van en `src/lib/*.js` sin JSX y con pruebas en `tests/`. Los componentes solo muestran.
- **Estilo:** Tailwind con los colores del tema (`bg-surface`, `text-muted`, `text-accent`, `text-good`, `text-warn`, `text-cool`). Solo tema oscuro. Iconos de `lucide-react`.
- **Móvil primero:** debe verse bien a 375 px de ancho sin desplazamiento horizontal, y respetar las áreas seguras del iPhone (clases `.page-main`, `.bottom-nav`, `.timer-dock`).
- **Gráficas (Recharts):** usa `isAnimationActive={false}`; para mezclar barras y líneas usa `ComposedChart`.
- **Sin dependencias nuevas** salvo que la tarea lo justifique; cada una pesa en la descarga del teléfono.

## Antes de pedir revisión

1. `npm test` y `npm run build` pasan.
2. Abriste la app compilada y probaste tu cambio a 375 px y en escritorio.
3. Revisaste la consola del navegador: sin errores.
4. El pull request dice qué tarea del ROADMAP resuelve, qué probaste y qué no pudiste probar.
