export const RUN_PLAN = [
  {
    level: 1,
    reps: 6,
    runMin: 1,
    walkMin: 2,
    warmupMin: 5,
    cooldownMin: 5,
    note: "Contacto suave: trote corto y mucha caminata para adaptar tobillos y rodillas.",
  },
  {
    level: 2,
    reps: 6,
    runMin: 1,
    walkMin: 1,
    warmupMin: 5,
    cooldownMin: 5,
    note: "Igualamos trote y caminata manteniendo pasos cortos y silenciosos.",
  },
  {
    level: 3,
    reps: 5,
    runMin: 2,
    walkMin: 2,
    warmupMin: 4,
    cooldownMin: 4,
    note: "Subimos a 2 min de trote con 2 min de caminata para absorber el cambio sin impacto extra.",
  },
  {
    level: 4,
    reps: 5,
    runMin: 2,
    walkMin: 1,
    warmupMin: 4,
    cooldownMin: 4,
    note: "Reducimos la caminata a 1 min; prioriza cadencia ágil sin alargar la zancada.",
  },
  {
    level: 5,
    reps: 5,
    runMin: 3,
    walkMin: 2,
    warmupMin: 4,
    cooldownMin: 4,
    note: "Primer contacto con bloques de 3 min y pausa amplia para cuidar tendones.",
  },
  {
    level: 6,
    reps: 5,
    runMin: 3,
    walkMin: 1,
    warmupMin: 4,
    cooldownMin: 4,
    note: "Base clásica de 5 × 3 min con 1 min de caminata a ritmo conversacional.",
  },
  {
    level: 7,
    reps: 5,
    runMin: 4,
    walkMin: 1,
    warmupMin: 4,
    cooldownMin: 4,
    note: "20 min totales de trote repartidos en 5 bloques estables y controlados.",
  },
  {
    level: 8,
    reps: 4,
    runMin: 5,
    walkMin: 1,
    warmupMin: 4,
    cooldownMin: 4,
    note: "Menos bloques pero más largos: 4 × 5 min sosteniendo postura y estabilidad de rodilla.",
  },
  {
    level: 9,
    reps: 4,
    runMin: 6,
    walkMin: 1,
    warmupMin: 4,
    cooldownMin: 4,
    note: "Meta del plan: 4 × 6 min de trote cómodo y continuo con articulaciones sólidas.",
  },
];

export const MIN_RUN_LEVEL = 1;
export const MAX_RUN_LEVEL = RUN_PLAN.length;

export function getRunLevel(level = 1) {
  const n = typeof level === "object" && level !== null ? Number(level.level) : Number(level);
  const clamped = Number.isFinite(n)
    ? Math.min(MAX_RUN_LEVEL, Math.max(MIN_RUN_LEVEL, Math.round(n)))
    : MIN_RUN_LEVEL;
  return RUN_PLAN[clamped - 1] || RUN_PLAN[0];
}
