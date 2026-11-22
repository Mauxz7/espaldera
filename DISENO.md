# Sistema visual de Shift (v1 «premium»)

Referencia para migrar cada página al look nuevo. La página modelo es **Inicio**
(`src/views/HomeView.jsx`); los componentes viven en `src/components/ui.jsx`.

## Principios
- **Fondo:** degradado azul pizarra (ya global en `body`). No pintar fondos de página.
- **Tarjetas de vidrio:** usar `<Card>` (o la clase `card`). Esquinas 22 px, sin borde marcado.
  `glow="accent" | "good" | "cool"` solo en la tarjeta protagonista de la pantalla.
- **Títulos:** tipo oración, nunca MAYÚSCULAS. Título de página `text-[34px] font-bold tracking-tight`
  con una línea de contexto encima `text-[13px] font-medium text-muted`.
  Títulos de sección **fuera** de la tarjeta con `<SectionTitle aside="dato">`.
- **Números:** `font-mono` (= SF Rounded en iPhone) con `font-bold`. Nada de monoespaciado técnico.
- **Estado:** `<StatusDot tone="good|cool|warn|bad|sleep">Normal</StatusDot>` en lugar de etiquetas con borde.
  `Chip` queda para etiquetas neutras (sin borde, fondo tenue).
- **Botones:** `btnCls("primary")` para la acción principal (una por pantalla), `btnCls("ghost")` para
  secundarias, `btnCls("soft-warn" | "soft-cool")` para avisos. Alto mínimo 48 px.
- **Colores por métrica:** recuperación `good`, sueño `sleep`, strain/cardio `strain`, frío/respiración `cool`,
  marca y entreno `accent`. Anillos con `<Ring size="xl" color=…>` (traen halo).
- **Listas:** filas separadas por `border-line` (borde blanco translúcido) dentro de una sola tarjeta,
  no una tarjeta por fila.
- **Etiquetas pequeñas** (`text-[11px] uppercase tracking-[0.18em]`): reemplazar por `text-[13px] font-medium text-muted`.

## Reglas
- Solo estilo: no cambiar lógica, datos ni textos salvo mayúsculas → tipo oración.
- Probar a **375 px** y en escritorio; la barra inferior flota, deja 110 px abajo (ya está en `.page-main`).
- `npm test` y `npm run build` en verde. PR, nunca merge.
