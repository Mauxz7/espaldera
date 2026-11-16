// Elementos de dopamina buena y barata (editables; clave persistida `dopamineDefs`).
// `kind: "cheap"` tiene límite diario (`limit`); `kind: "good"` vota por una identidad (`identity`).
export const DEFAULT_DOPAMINE_DEFS = [
  { id: "d_social", label: "Redes sociales (15 min)", kind: "cheap", limit: 2 },
  { id: "d_shorts", label: "Videos cortos (reels/TikTok)", kind: "cheap", limit: 1 },
  { id: "d_binge", label: "Series en maratón (1 episodio extra)", kind: "cheap", limit: 1 },
  { id: "d_walk", label: "Caminar afuera", kind: "good", identity: "descanso" },
  { id: "d_study", label: "Estudiar sin celular (25 min)", kind: "good", identity: "estudiante" },
  { id: "d_read", label: "Leer por gusto", kind: "good", identity: "lector" },
  { id: "d_sport", label: "Entrenar o deporte", kind: "good", identity: "atleta" },
];
