# Espaldera

Centro de entrenamiento y hábitos, como app web instalable (PWA) para iPhone, iPad y Mac.

- **Abrir:** https://mauxz7.github.io/espaldera/
- **Instalar:** en Safari, Compartir → "Agregar a pantalla de inicio" (iPhone/iPad) o Archivo → "Agregar al Dock" (Mac).
- **Datos:** se guardan en cada dispositivo y, si se conecta en Ajustes, se sincronizan por un repositorio privado de GitHub. Este repositorio no contiene datos personales.

## Desarrollo

Guía del proyecto en [AGENTS.md](AGENTS.md) y tareas en [ROADMAP.md](ROADMAP.md).

```bash
npm install
```

```bash
npm test
```

```bash
npm run build
```

Cada cambio en `main` se prueba, se compila y se publica solo con GitHub Actions; los dispositivos se actualizan al abrir la app.
