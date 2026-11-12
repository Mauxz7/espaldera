import { getRunLevel } from "./runPlan.js";

export const EQ = {
  ladder: "Swedish ladder",
  bar: "Barra 40 kg",
  db: "Mancuernas 10 kg",
  kb: "KB 8 kg",
  mb: "Balón medicinal",
  bw: "Peso corporal",
  run: "Calle o pista",
  bike: "Bici estática",
};

export function day3Exercises(level = 1) {
  const lvl = getRunLevel(level);
  const walkLabel = lvl.walkMin === 1 ? "el minuto" : `los ${lvl.walkMin} min`;
  return [
    { id: "d3a", block: "A", name: "Activación de tobillo y cadera", eq: ["ladder", "bw"], sets: 2, reps: "8 / lado", rir: 4, tempo: "Controlado", rest: 0,
      tips: ["Círculos de tobillo, 8 elevaciones de talón lentas y 8 balanceos de pierna agarrado a la espaldera.", "Termina con 8 puentes de glúteo: despiertan la cadera para que la rodilla no cargue de más.", "Nada de estiramientos largos antes de correr."] },
    { id: "d3b", block: "B", name: "Caminata rápida de entrada", eq: ["run"], sets: 1, fixedSets: true, reps: `${lvl.warmupMin} min`, rir: 4, tempo: "Ritmo ágil", rest: 0,
      tips: ["Paso largo y brazos activos: sube pulsaciones sin impacto.", "Si algo molesta aquí, hoy cambia el trote por la alternativa sin impacto."] },
    { id: "d3c", block: "C", name: `Intervalos: trote ${lvl.runMin} min + caminata ${lvl.walkMin} min`, eq: ["run"], sets: lvl.reps, fixedSets: true, reps: `${lvl.runMin} min de trote`, rir: 3, tempo: "Conversacional", rest: lvl.walkMin * 60,
      tips: [
        lvl.note,
        "Ritmo al que puedas hablar en frases completas: si jadeas, vas muy rápido.",
        "Pasos cortos y silenciosos, cayendo debajo de la cadera: menos golpe en la rodilla.",
        `Al marcar cada bloque arranca ${walkLabel} de caminata.`,
        "Superficie pareja; dolor punzante en rodilla o tobillo = se termina el trote y sigues caminando.",
      ] },
    { id: "d3d", block: "D", name: "Caminata de vuelta a la calma", eq: ["run"], sets: 1, fixedSets: true, reps: `${lvl.cooldownMin} min`, rir: 4, tempo: "Suave", rest: 0,
      tips: ["Baja el ritmo poco a poco y respira por la nariz.", "No te sientes de golpe al terminar."] },
    { id: "d3e", block: "E", name: "Elevaciones de talón excéntricas en peldaño", eq: ["ladder"], sets: 3, reps: "10–12", rir: 2, tempo: "1-0-3-1", rest: 45,
      tips: ["Sube con las dos piernas y baja en 3 s: es lo que más fortalece el tobillo y el tendón.", "Talones por debajo del peldaño al final de la bajada.", "Agárrate a la espaldera solo para el equilibrio."] },
    { id: "d3f", block: "F", name: "Tibial contra la pared + equilibrio a una pierna", eq: ["bw"], sets: 2, reps: "12 + 30 s / pierna", rir: 3, tempo: "Controlado", rest: 30,
      tips: ["Espalda en la pared, pies adelante: sube las puntas 12 veces (tibial anterior, protege la espinilla).", "Luego 30 s en una pierna con la rodilla apenas flexionada.", "Progresión del equilibrio: ojos cerrados."] },
  ];
}

export const ROUTINES = [
  {
    id: "d1", short: "Día 1", name: "Torso Fuerza / Calistenia", minutes: 42, weekday: 0,
    focus: "Tracción vertical pesada con excéntricas lentas, emparejada con empuje antagonista.",
    exercises: [
      { id: "d1a1", block: "A1", name: "Dominadas pronas", eq: ["ladder"], sets: 4, reps: "4–6", rir: 2, tempo: "3-1-1-0", rest: 45,
        tips: ["Deprime escápulas antes de tirar; el primer centímetro sale de la espalda, no de los brazos.", "3 s de bajada controlada: ahí está la sobrecarga sin añadir peso.", "Si fallas la última rep, termina con una negativa de 5 s."] },
      { id: "d1a2", block: "A2", name: "Fondos en espaldera", eq: ["ladder"], sets: 4, reps: "6–8", rir: 2, tempo: "3-1-1-0", rest: 90,
        tips: ["Pausa de 1 s abajo con el hombro a la altura del codo, sin rebotar.", "Torso ligeramente inclinado hacia delante para cargar pecho.", "Bloquea arriba apretando tríceps 1 s."] },
      { id: "d1b1", block: "B1", name: "Remo inclinado con barra", eq: ["bar"], sets: 3, reps: "8–10", rir: 2, tempo: "2-0-1-2", rest: 30,
        tips: ["Pausa de 2 s con la barra en el ombligo: convierte 40 kg en un estímulo serio.", "Bisagra de cadera a ~45°, columna neutra y core firme.", "Codos a 45° del torso, no abiertos."] },
      { id: "d1b2", block: "B2", name: "Press de hombro unilateral con mancuerna", eq: ["db"], sets: 3, reps: "8–10 / lado", rir: 2, tempo: "3-0-1-0", rest: 75,
        tips: ["Hazlo en media rodilla: el antirotación suma trabajo de core.", "Bajada de 3 s hasta la oreja.", "No arquees la zona lumbar; glúteo de la pierna de atrás apretado."] },
      { id: "d1c1", block: "C1", name: "Flexiones con déficit (manos sobre discos)", eq: ["bw", "bar"], sets: 2, reps: "10–15", rir: 1, tempo: "3-1-1-0", rest: 20,
        tips: ["Los discos te dan 5–8 cm extra de recorrido: baja el pecho por debajo de las manos.", "Cuerpo en bloque, glúteos apretados.", "Pausa de 1 s abajo."] },
      { id: "d1c2", block: "C2", name: "Elevaciones de piernas colgado", eq: ["ladder"], sets: 2, reps: "8–12", rir: 2, tempo: "2-1-2-0", rest: 60,
        tips: ["Retroversión pélvica al subir: la pelvis sube, no solo las piernas.", "Evita el balanceo; 2 s de bajada.", "Si cuesta, rodillas al pecho."] },
    ],
  },
  {
    id: "d2", short: "Día 2", name: "Pierna & Core", minutes: 45, weekday: 1,
    focus: "Sentadilla, estabilidad de rodilla y tobillo, potencia con balón y bisagra de cadera. Cierra con abdomen colgado.",
    exercises: [
      { id: "d2a", block: "A", name: "Sentadilla (barra o kettlebell)", eq: ["bar", "kb"], sets: 4, reps: "6–10", rir: 2, tempo: "3-1-1-0", rest: 90,
        tips: ["Barra de 40 kg en la espalda o goblet con KB de 8 kg. Si la rodilla está sensible, ese día elige la KB.", "Rodillas en la línea de la punta del pie: no dejes que se vayan hacia dentro.", "3 s de bajada y 1 s de pausa abajo: control antes que profundidad."] },
      { id: "d2b", block: "B", name: "Pistol squat con pausa isométrica", eq: ["ladder", "bw"], sets: 3, reps: "Máx. / pierna", rir: 2, tempo: "3-3-1-0", rest: 60,
        tips: ["Agárrate a la espaldera y baja solo hasta donde la rodilla siga alineada.", "Quédate 3 s quieto en el punto más bajo que controles: ahí trabajan la estabilidad y el tobillo.", "Progresión: sentarte en una caja → bajar más con apoyo → pistol completa."] },
      { id: "d2c1", block: "C1", name: "Zancadas con balón medicinal", eq: ["mb"], sets: 3, reps: "8 / pierna", rir: 2, tempo: "2-1-1-0", rest: 30,
        tips: ["Balón al pecho; opcional: gira el torso hacia la pierna de delante.", "La rodilla trasera roza el piso sin golpearlo.", "Paso largo para cargar glúteo y descargar la rodilla."] },
      { id: "d2c2", block: "C2", name: "Zancadas con salto", eq: ["bw"], sets: 3, reps: "6 / pierna", rir: 2, tempo: "Explosivo", rest: 75,
        tips: ["Aterriza suave en la planta y amortigua: si el aterrizaje hace ruido, baja la altura.", "Rodilla y tobillo alineados al caer.", "Si un día tienes el tobillo débil, cámbialas por zancadas alternas sin salto."] },
      { id: "d2d", block: "D", name: "Peso muerto rumano (RDL)", eq: ["bar"], sets: 3, reps: "8–10", rir: 2, tempo: "3-1-1-0", rest: 75,
        tips: ["Barra de 40 kg pegada a las piernas; las rodillas apenas flexionadas.", "Empuja la cadera hacia atrás hasta sentir el isquio y pausa 1 s.", "Espalda neutra todo el recorrido."] },
      { id: "d2e", block: "E", name: "Farmer's walk (2 KB de 8 kg)", eq: ["kb"], sets: 3, reps: "30 s", rir: 2, tempo: "Marcha", rest: 45,
        tips: ["Hombros atrás y abajo, pasos cortos y firmes.", "Para el tobillo: una de las vueltas, camínala de puntillas.", "Sin dejar que las KB se balanceen."] },
      { id: "d2f1", block: "F1", name: "Toes to bar en espaldera", eq: ["ladder"], sets: 3, reps: "6–10", rir: 2, tempo: "Controlado", rest: 15,
        tips: ["Pelvis hacia arriba, no solo las piernas.", "Sin balanceo: baja en 2 s.", "Si se rompe la técnica, rodillas al pecho."] },
      { id: "d2f2", block: "F2", name: "Elevaciones de piernas", eq: ["ladder"], sets: 3, reps: "10–12", rir: 1, tempo: "2-1-3-0", rest: 60,
        tips: ["Colgado en la espaldera o acostado con las manos en un peldaño.", "3 s de bajada.", "Lumbar pegada si las haces acostado."] },
    ],
  },
  {
    id: "d3", short: "Día 3", name: "Running & Tobillos", minutes: 38, weekday: 3,
    focus: "Trote por intervalos a ritmo conversacional, con preparación y fuerza de tobillo para proteger rodillas y tobillos.",
    exercises: day3Exercises(1),
  },
  {
    id: "d4", short: "Día 4", name: "Full Body & Kettlebell Flow", minutes: 45, weekday: 5,
    focus: "Potencia y trabajo de cadena completa; ideal para el sábado con más margen.",
    exercises: [
      { id: "d4a", block: "A", name: "Thruster con barra", eq: ["bar"], sets: 4, reps: "6–8", rir: 2, tempo: "2-0-X-0", rest: 90,
        tips: ["Sentadilla frontal profunda y empuje explosivo (X) en un solo movimiento.", "Codos altos en la recepción.", "Respira arriba, no abajo."] },
      { id: "d4b", block: "B", name: "Complejo KB doble: 5 swing + 5 clean + 5 sentadilla frontal + 5 press", eq: ["kb"], sets: 4, reps: "1 ronda (20 reps)", rir: 2, tempo: "Fluido", rest: 60,
        tips: ["No sueltes las KB durante la ronda.", "El swing es bisagra de cadera, no sentadilla.", "En el clean la KB rueda sobre la muñeca, no golpea."] },
      { id: "d4c1", block: "C1", name: "Dominadas negativas lentas", eq: ["ladder"], sets: 3, reps: "4–5", rir: 2, tempo: "5-0-X-0", rest: 30,
        tips: ["Sube con salto o con los pies en un peldaño.", "5 s de bajada.", "Si ya dominas las 5, sujeta una KB de 8 kg entre los pies."] },
      { id: "d4c2", block: "C2", name: "Turkish get-up", eq: ["kb"], sets: 3, reps: "1 / lado", rir: 3, tempo: "Lento", rest: 60,
        tips: ["Mirada siempre en la KB.", "Cada fase con pausa de 1 s.", "Calidad sobre velocidad."] },
      { id: "d4d1", block: "D1", name: "L-sit en espaldera (o tuck)", eq: ["ladder"], sets: 4, reps: "10–20 s", rir: 2, tempo: "Isométrico", rest: 20,
        tips: ["Hombros deprimidos, brazos bloqueados.", "Progresión: tuck → una pierna → L completa.", "Puntas de los pies activas."] },
      { id: "d4d2", block: "D2", name: "Suitcase march (KB 8 kg + mancuerna 10 kg)", eq: ["kb", "db"], sets: 4, reps: "40 s", rir: 2, tempo: "Marcha", rest: 45,
        tips: ["Una carga distinta en cada mano: el core resiste la inclinación.", "Rodilla a la altura de la cadera.", "Hombros nivelados."] },
    ],
  },
  {
    id: "low", short: "Rescate", name: "Modo Baja Energía (20 min)", minutes: 20, weekday: -1, low: true,
    focus: "Para mañanas críticas: 4 rondas, todo con RIR 3–4. Mantienes la racha sin cavar más fatiga.",
    exercises: [
      { id: "lowa", block: "R1", name: "Colgado activo", eq: ["ladder"], sets: 4, reps: "30 s", rir: 4, tempo: "Isométrico", rest: 0,
        tips: ["Despierta hombros y descomprime la columna.", "Escápulas activas, no pasivo."] },
      { id: "lowb", block: "R2", name: "Dominadas", eq: ["ladder"], sets: 4, reps: "3–4", rir: 4, tempo: "2-0-1-0", rest: 0,
        tips: ["Lejos del fallo a propósito.", "Calidad total en cada rep."] },
      { id: "lowc", block: "R3", name: "Flexiones", eq: ["bw"], sets: 4, reps: "8–10", rir: 3, tempo: "2-0-1-0", rest: 0,
        tips: ["Ritmo cómodo, respiración nasal."] },
      { id: "lowd", block: "R4", name: "Sentadilla goblet", eq: ["db"], sets: 4, reps: "10", rir: 3, tempo: "3-1-1-0", rest: 0,
        tips: ["Una mancuerna de 10 kg al pecho.", "Pausa abajo empujando rodillas hacia fuera."] },
      { id: "lowe", block: "R5", name: "Swing con KB", eq: ["kb"], sets: 4, reps: "15", rir: 3, tempo: "Explosivo", rest: 60,
        tips: ["Cadera potente, brazos sueltos.", "Descansa 60 s y empieza la siguiente ronda."] },
    ],
  },
];

export const WARMUP = [
  { name: "Colgado + retracciones escapulares", detail: "30 s colgado activo, luego 8 retracciones lentas en la espaldera.", eq: "Swedish ladder" },
  { name: "Halos con KB + círculos de cadera", detail: "5 halos por lado con KB de 8 kg y 10 círculos de cadera.", eq: "KB 8 kg" },
  { name: "Sentadilla goblet con pausa", detail: "Mantén la posición baja con la KB y empuja las rodillas con los codos. Sube y repite 5 veces.", eq: "KB 8 kg" },
  { name: "World's greatest stretch", detail: "3 por lado: zancada, codo al empeine, rotación torácica hacia arriba.", eq: "Peso corporal" },
  { name: "Swings ligeros + flexiones inclinadas", detail: "2 × 10 swings y 5 flexiones con las manos en un peldaño alto.", eq: "KB 8 kg + espaldera" },
];

export const BLOCK_WEEKS = [
  { n: 1, label: "Reactivación", note: "RIR +1 sobre lo indicado. Cuida el SNC: técnica y tempo, nada al fallo.", rir: 1, sets: 0 },
  { n: 2, label: "Base", note: "RIR tal como está escrito. Sube 1 rep por serie donde puedas.", rir: 0, sets: 0 },
  { n: 3, label: "Sobrecarga", note: "RIR −1. Alarga las pausas 1 s o añade 1 s a la excéntrica.", rir: -1, sets: 0 },
  { n: 4, label: "Descarga", note: "Una serie menos y RIR +2. Recupera antes del siguiente bloque.", rir: 2, sets: -1 },
];

export const effSets = (ex, week) => (ex.fixedSets ? ex.sets : Math.max(1, ex.sets + (BLOCK_WEEKS[week - 1]?.sets || 0)));

export const effRir = (ex, week) => Math.max(0, ex.rir + (BLOCK_WEEKS[week - 1]?.rir || 0));

export const routineById = (id, runLevel) => {
  const base = ROUTINES.find((r) => r.id === id) || ROUTINES[0];
  if (base.id === "d3") {
    const lvl = getRunLevel(runLevel ?? 1);
    return { ...base, runPlan: lvl, exercises: day3Exercises(lvl.level) };
  }
  return base;
};
