# Espaldera

Centro de entrenamiento y hábitos, como app web instalable (PWA) para iPhone, iPad y Mac.

- **Abrir:** https://mauxz7.github.io/espaldera/
- **Instalar:** en Safari, Compartir → "Agregar a pantalla de inicio" (iPhone/iPad) o Archivo → "Agregar al Dock" (Mac).
- **Datos:** se guardan en cada dispositivo y, si se conecta en Ajustes, se sincronizan por un repositorio privado de GitHub. Este repositorio no contiene datos personales.

## Desarrollo

```bash
npm install
```

```bash
npm run build
```

`npm run build` genera `docs/`, que es lo que publica GitHub Pages. Cada publicación cambia la versión del service worker y los dispositivos se actualizan solos.
