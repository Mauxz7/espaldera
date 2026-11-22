import { getRunLevel } from "./runPlan.js";

export const EQ = {
  ladder: "Swedish ladder",
  dips: "Paralelas",
  trx: "Correas de suspensión",
  wheel: "Rueda abdominal",
  board: "Tabla inclinada",
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
    { id: "d3a", block: "A", pattern: "run", muscles: { calves: 0.4, glutes: 0.4 }, name: "Activación de tobillo y cadera", eq: ["ladder", "bw"], sets: 2, reps: "8 / lado", rir: 4, tempo: "Controlado", rest: 0,
      tips: ["Círculos de tobillo, 8 elevaciones de talón lentas y 8 balanceos de pierna agarrado a la espaldera.", "Termina con 8 puentes de glúteo: despiertan la cadera para que la rodilla no cargue de más.", "Nada de estiramientos largos antes de correr."] },
    { id: "d3b", block: "B", pattern: "run", muscles: { calves: 0.3, quads: 0.3, glutes: 0.2 }, name: "Caminata rápida de entrada", eq: ["run"], sets: 1, fixedSets: true, reps: `${lvl.warmupMin} min`, rir: 4, tempo: "Ritmo ágil", rest: 0,
      tips: ["Paso largo y brazos activos: sube pulsaciones sin impacto.", "Si algo molesta aquí, hoy cambia el trote por la alternativa sin impacto."] },
    { id: "d3c", block: "C", pattern: "run", muscles: { calves: 0.8, quads: 0.6, hamstrings: 0.4, glutes: 0.4 }, name: `Intervalos: trote ${lvl.runMin} min + caminata ${lvl.walkMin} min`, eq: ["run"], sets: lvl.reps, fixedSets: true, reps: `${lvl.runMin} min de trote`, rir: 3, tempo: "Conversacional", rest: lvl.walkMin * 60,
      tips: [
        lvl.note,
        "Ritmo al que puedas hablar en frases completas: si jadeas, vas muy rápido.",
        "Pasos cortos y silenciosos, cayendo debajo de la cadera: menos golpe en la rodilla.",
        `Al marcar cada bloque arranca ${walkLabel} de caminata.`,
        "Superficie pareja; dolor punzante en rodilla o tobillo = se termina el trote y sigues caminando.",
      ] },
    { id: "d3d", block: "D", pattern: "run", muscles: { calves: 0.2, quads: 0.2 }, name: "Caminata de vuelta a la calma", eq: ["run"], sets: 1, fixedSets: true, reps: `${lvl.cooldownMin} min`, rir: 4, tempo: "Suave", rest: 0,
      tips: ["Baja el ritmo poco a poco y respira por la nariz.", "No te sientes de golpe al terminar."] },
    { id: "d3e", block: "E", pattern: "run", muscles: { calves: 1 }, name: "Elevaciones de talón excéntricas en peldaño", eq: ["ladder"], sets: 3, reps: "10–12", rir: 2, tempo: "1-0-3-1", rest: 45,
      tips: ["Sube con las dos piernas y baja en 3 s: es lo que más fortalece el tobillo y el tendón.", "Talones por debajo del peldaño al final de la bajada.", "Agárrate a la espaldera solo para el equilibrio."] },
    { id: "d3f", block: "F", pattern: "run", muscles: { calves: 0.6 }, name: "Tibial contra la pared + equilibrio a una pierna", eq: ["bw"], sets: 2, reps: "12 + 30 s / pierna", rir: 3, tempo: "Controlado", rest: 30,
      tips: ["Espalda en la pared, pies adelante: sube las puntas 12 veces (tibial anterior, protege la espinilla).", "Luego 30 s en una pierna con la rodilla apenas flexionada.", "Progresión del equilibrio: ojos cerrados."] },
  ];
}

const D1_BASE_EXERCISES = [
  { id: "d1a1", block: "A1", pattern: "pull_v", muscles: { lats: 1, biceps: 0.6, upperBack: 0.5 }, name: "Dominadas pronas", eq: ["ladder"], sets: 4, reps: "4–6", rir: 2, tempo: "3-1-1-0", rest: 45,
    tips: ["Deprime escápulas antes de tirar; el primer centímetro sale de la espalda, no de los brazos.", "3 s de bajada controlada: ahí está la sobrecarga sin añadir peso.", "Si fallas la última rep, termina con una negativa de 5 s."] },
  { id: "d1a2", block: "A2", pattern: "push_h", muscles: { chest: 1, triceps: 0.7, shoulders: 0.5 }, name: "Fondos en paralelas", eq: ["dips"], sets: 4, reps: "6–8", rir: 2, tempo: "3-1-1-0", rest: 90,
    tips: ["Pausa de 1 s abajo con el hombro a la altura del codo, sin rebotar.", "Torso ligeramente inclinado hacia delante para cargar pecho.", "Bloquea arriba apretando tríceps 1 s."] },
  { id: "d1b1", block: "B1", pattern: "pull_h", muscles: { upperBack: 1, lats: 0.7, biceps: 0.5, core: 0.3 }, name: "Remo inclinado con barra", eq: ["bar"], sets: 3, reps: "8–10", rir: 2, tempo: "2-0-1-2", rest: 30,
    tips: ["Pausa de 2 s con la barra en el ombligo: convierte 40 kg en un estímulo serio.", "Bisagra de cadera a ~45°, columna neutra y core firme.", "Codos a 45° del torso, no abiertos."] },
  { id: "d1b2", block: "B2", pattern: "push_v", muscles: { shoulders: 1, triceps: 0.5, core: 0.4 }, name: "Press de hombro unilateral con mancuerna", eq: ["db"], sets: 3, reps: "8–10 / lado", rir: 2, tempo: "3-0-1-0", rest: 75,
    tips: ["Hazlo en media rodilla: el antirotación suma trabajo de core.", "Bajada de 3 s hasta la oreja.", "No arquees la zona lumbar; glúteo de la pierna de atrás apretado."] },
  { id: "d1c1", block: "C1", pattern: "push_h", muscles: { chest: 1, triceps: 0.5, shoulders: 0.5, core: 0.3 }, name: "Flexiones con déficit (manos sobre discos)", eq: ["bw", "bar"], sets: 2, reps: "10–15", rir: 1, tempo: "3-1-1-0", rest: 20,
    tips: ["Los discos te dan 5–8 cm extra de recorrido: baja el pecho por debajo de las manos.", "Cuerpo en bloque, glúteos apretados.", "Pausa de 1 s abajo."] },
  { id: "d1c2", block: "C2", pattern: "core", muscles: { core: 1, lats: 0.2 }, name: "Elevaciones de piernas colgado", eq: ["ladder"], sets: 2, reps: "8–12", rir: 2, tempo: "2-1-2-0", rest: 60,
    tips: ["Retroversión pélvica al subir: la pelvis sube, no solo las piernas.", "Evita el balanceo; 2 s de bajada.", "Si cuesta, rodillas al pecho."] },
];

const D1_TRX_EXERCISES = [
  { id: "d1t1", block: "A1", pattern: "pull_v", muscles: { lats: 1, biceps: 0.8, upperBack: 0.5 }, name: "Dominadas supinas (o pronas)", eq: ["ladder"], sets: 3, reps: "5–8", rir: 2, tempo: "3-1-1-0", rest: 30,
    tips: ["Agarre firme en la barra de la espaldera y escápulas abajo antes de subir.", "Controla 3 s en la bajada para exprimir el dorsal.", "Si te falta 1 rep al final, haz una negativa lenta."] },
  { id: "d1t2", block: "A2", pattern: "push_h", muscles: { chest: 1, triceps: 0.5, shoulders: 0.5, core: 0.3 }, name: "Press de pecho en correas", eq: ["trx"], sets: 3, reps: "10–12", rir: 2, tempo: "3-1-1-0", rest: 75,
    tips: ["Cuerpo rígido como plancha; da un paso atrás si quieres más ángulo e intensidad.", "Baja el pecho entre las manos sin que las correas rocen los brazos.", "Aprieta abdomen y glúteos todo el recorrido."] },
  { id: "d1t3", block: "B1", pattern: "pull_h", muscles: { upperBack: 1, lats: 0.6, biceps: 0.5, core: 0.3 }, name: "Remo invertido en correas", eq: ["trx"], sets: 3, reps: "10–14", rir: 2, tempo: "2-0-1-2", rest: 30,
    tips: ["Camina hacia delante debajo del anclaje para hacerlo más duro; hacia atrás para aliviar.", "Pausa de 2 s arriba llevando el pecho a los puños.", "Mantén las caderas arriba sin quebrarte."] },
  { id: "d1t4", block: "B2", pattern: "push_v", muscles: { shoulders: 1, triceps: 0.5, core: 0.4 }, name: "Press de hombro unilateral con mancuerna", eq: ["db"], sets: 3, reps: "8–10 / lado", rir: 2, tempo: "3-0-1-0", rest: 75,
    tips: ["En media rodilla para sumar estabilidad de core.", "Baja en 3 s hasta la altura de la oreja.", "Empuja vertical sin encoger el trapecio."] },
  { id: "d1t5", block: "C1", pattern: "pull_h", muscles: { upperBack: 1, shoulders: 0.7 }, name: "Aperturas en Y / Face pull en correas", eq: ["trx"], sets: 3, reps: "10–12", rir: 2, tempo: "2-1-1-1", rest: 20,
    tips: ["Brazos estirados formando una Y o codos altos hacia la frente para deltoide posterior.", "No tires con impulso de cadera: ajusta los pies para controlar.", "Pausa de 1 s en la apertura máxima."] },
  { id: "d1t6", block: "C2", pattern: "arms", muscles: { triceps: 1, core: 0.3 }, name: "Extensión de tríceps en correas", eq: ["trx"], sets: 3, reps: "10–12", rir: 1, tempo: "3-0-1-0", rest: 60,
    tips: ["Codos fijos apuntando al frente; solo se doblan las bisagras del codo.", "Lleva las manos hacia la frente manteniendo la plancha.", "Extiende fuerte sin abrir los codos."] },
  { id: "d1t7", block: "D1", pattern: "arms", muscles: { biceps: 1, upperBack: 0.2 }, name: "Curl de bíceps en correas", eq: ["trx"], sets: 2, reps: "10–14", rir: 1, tempo: "2-0-1-1", rest: 20,
    tips: ["Codos altos al nivel de los hombros todo el tiempo.", "Lleva los puños hacia las sienes apretando 1 s.", "Baja lento sin perder tensión en las correas."] },
  { id: "d1t8", block: "D2", pattern: "core", muscles: { core: 1, lats: 0.3, shoulders: 0.3 }, name: "Fallout abdominal en correas (o rueda abdominal)", eq: ["trx", "wheel"], sets: 2, reps: "8–12", rir: 2, tempo: "3-1-1-0", rest: 60,
    tips: ["Retroversión pélvica y glúteos apretados: nunca arquees la espalda baja.", "Extiende los brazos hacia delante hasta donde mantengas la lumbar neutra.", "Si prefieres la rueda en el piso, misma consigna de control."] },
];

const D2_BASE_EXERCISES = [
  { id: "d2a", block: "A", pattern: "squat", muscles: { quads: 1, glutes: 0.7, core: 0.4, hamstrings: 0.3 }, name: "Sentadilla (barra o kettlebell)", eq: ["bar", "kb"], sets: 4, reps: "6–10", rir: 2, tempo: "3-1-1-0", rest: 90,
    tips: ["Barra de 40 kg en la espalda o goblet con KB de 8 kg. Si la rodilla está sensible, ese día elige la KB.", "Rodillas en la línea de la punta del pie: no dejes que se vayan hacia dentro.", "3 s de bajada y 1 s de pausa abajo: control antes que profundidad."] },
  { id: "d2b", block: "B", pattern: "squat", muscles: { quads: 1, glutes: 0.8, calves: 0.3, core: 0.3 }, name: "Pistol squat con pausa isométrica", eq: ["ladder", "bw"], sets: 3, reps: "Máx. / pierna", rir: 2, tempo: "3-3-1-0", rest: 60,
    tips: ["Agárrate a la espaldera y baja solo hasta donde la rodilla siga alineada.", "Quédate 3 s quieto en el punto más bajo que controles: ahí trabajan la estabilidad y el tobillo.", "Progresión: sentarte en una caja → bajar más con apoyo → pistol completa."] },
  { id: "d2c1", block: "C1", pattern: "squat", muscles: { quads: 1, glutes: 0.7, hamstrings: 0.3, core: 0.3 }, name: "Zancadas con balón medicinal", eq: ["mb"], sets: 3, reps: "8 / pierna", rir: 2, tempo: "2-1-1-0", rest: 30,
    tips: ["Balón al pecho; opcional: gira el torso hacia la pierna de delante.", "La rodilla trasera roza el piso sin golpearlo.", "Paso largo para cargar glúteo y descargar la rodilla."] },
  { id: "d2c2", block: "C2", pattern: "squat", muscles: { quads: 1, glutes: 0.7, calves: 0.5 }, name: "Zancadas con salto", eq: ["bw"], sets: 3, reps: "6 / pierna", rir: 2, tempo: "Explosivo", rest: 75,
    tips: ["Aterriza suave en la planta y amortigua: si el aterrizaje hace ruido, baja la altura.", "Rodilla y tobillo alineados al caer.", "Si un día tienes el tobillo débil, cámbialas por zancadas alternas sin salto."] },
  { id: "d2d", block: "D", pattern: "hinge", muscles: { hamstrings: 1, glutes: 0.9, upperBack: 0.3, core: 0.3 }, name: "Peso muerto rumano (RDL)", eq: ["bar"], sets: 3, reps: "8–10", rir: 2, tempo: "3-1-1-0", rest: 75,
    tips: ["Barra de 40 kg pegada a las piernas; las rodillas apenas flexionadas.", "Empuja la cadera hacia atrás hasta sentir el isquio y pausa 1 s.", "Espalda neutra todo el recorrido."] },
  { id: "d2e", block: "E", pattern: "hinge", muscles: { upperBack: 0.6, core: 0.6, calves: 0.4, glutes: 0.3 }, name: "Farmer's walk (2 KB de 8 kg)", eq: ["kb"], sets: 3, reps: "30 s", rir: 2, tempo: "Marcha", rest: 45,
    tips: ["Hombros atrás y abajo, pasos cortos y firmes.", "Para el tobillo: una de las vueltas, camínala de puntillas.", "Sin dejar que las KB se balanceen."] },
  { id: "d2f1", block: "F1", pattern: "core", muscles: { core: 1, lats: 0.3 }, name: "Toes to bar en espaldera", eq: ["ladder"], sets: 3, reps: "6–10", rir: 2, tempo: "Controlado", rest: 15,
    tips: ["Pelvis hacia arriba, no solo las piernas.", "Sin balanceo: baja en 2 s.", "Si se rompe la técnica, rodillas al pecho."] },
  { id: "d2f2", block: "F2", pattern: "core", muscles: { core: 1 }, name: "Elevaciones de piernas", eq: ["ladder"], sets: 3, reps: "10–12", rir: 1, tempo: "2-1-3-0", rest: 60,
    tips: ["Colgado en la espaldera o acostado con las manos en un peldaño.", "3 s de bajada.", "Lumbar pegada si las haces acostado."] },
];

const D2_UNI_EXERCISES = [
  { id: "d2u1", block: "A", pattern: "squat", muscles: { quads: 1, glutes: 0.6, core: 0.5, upperBack: 0.3 }, name: "Sentadilla frontal con barra (o goblet KB)", eq: ["bar", "kb"], sets: 4, reps: "6–8", rir: 2, tempo: "3-1-1-0", rest: 90,
    tips: ["Torso erguido y codos altos; baja en 3 s con pausa de 1 s abajo.", "Si la rodilla está cargada, usa la KB de 8 kg en goblet.", "Rodillas siguiendo la línea de los dedos del pie."] },
  { id: "d2u2", block: "B", pattern: "squat", muscles: { quads: 1, glutes: 0.8, hamstrings: 0.3 }, name: "Sentadilla búlgara con pie en peldaño", eq: ["ladder", "db"], sets: 3, reps: "8–10 / pierna", rir: 2, tempo: "3-1-1-0", rest: 60,
    tips: ["Empeine trasero apoyado en un peldaño bajo o la tabla; peso en el pie delantero.", "Baja vertical en 3 s manteniendo la rodilla estable.", "Puedes empezar solo con peso corporal y subir a mancuernas."] },
  { id: "d2u3", block: "C", pattern: "hinge", muscles: { hamstrings: 1, glutes: 0.9, calves: 0.3, core: 0.3 }, name: "RDL a una pierna (o kickstand) con KB", eq: ["kb"], sets: 3, reps: "8–10 / pierna", rir: 2, tempo: "3-1-1-0", rest: 60,
    tips: ["Microflexión de rodilla y cadera hacia atrás: trabaja glúteo e isquio junto al tobillo.", "Si el equilibrio molesta, apoya la punta del pie trasero (kickstand).", "Caderas cuadradas al piso sin rotar."] },
  { id: "d2u4", block: "D1", pattern: "squat", muscles: { quads: 1, glutes: 0.7, hamstrings: 0.4 }, name: "Sentadilla cosaca con KB", eq: ["kb"], sets: 3, reps: "6–8 / lado", rir: 2, tempo: "3-1-1-0", rest: 30,
    tips: ["Postura amplia; desplaza el peso hacia una pierna bajando controlado.", "Talón de apoyo firme y rodilla alineada; la otra pierna queda extendida.", "Fortalece aductores, cadera y movilidad de tobillo sin impacto."] },
  { id: "d2u5", block: "D2", pattern: "squat", muscles: { quads: 1, glutes: 0.4 }, name: "Isométrico contra la pared (wall sit)", eq: ["bw"], sets: 3, reps: "35–45 s", rir: 2, tempo: "Isométrico", rest: 60,
    tips: ["Espalda pegada a la pared, muslos cerca de la horizontal y tobillos bajo las rodillas.", "Excelente para proteger el tendón rotuliano sin impacto.", "Empuja los talones contra el piso todo el tiempo."] },
  { id: "d2u6", block: "E", pattern: "core", muscles: { core: 1, lats: 0.3, shoulders: 0.3 }, name: "Rueda abdominal (o pike en correas)", eq: ["wheel", "trx"], sets: 3, reps: "8–12", rir: 2, tempo: "3-1-1-0", rest: 60,
    tips: ["Mantén el abdomen duro y la pelvis metida hacia dentro antes de rodar.", "Llega solo hasta donde controles sin hundir la lumbar.", "Alternativa rápida: pies en las correas para pike o rodillas al pecho."] },
];

const D4_BASE_EXERCISES = [
  { id: "d4a", block: "A", pattern: "full", muscles: { quads: 1, shoulders: 1, glutes: 0.6, triceps: 0.5, core: 0.4 }, name: "Thruster con barra", eq: ["bar"], sets: 4, reps: "6–8", rir: 2, tempo: "2-0-X-0", rest: 90,
    tips: ["Sentadilla frontal profunda y empuje explosivo (X) en un solo movimiento.", "Codos altos en la recepción.", "Respira arriba, no abajo."] },
  { id: "d4b", block: "B", pattern: "full", muscles: { glutes: 0.8, quads: 0.7, shoulders: 0.7, hamstrings: 0.5, upperBack: 0.5, core: 0.5, triceps: 0.3 }, name: "Complejo KB doble: 5 swing + 5 clean + 5 sentadilla frontal + 5 press", eq: ["kb"], sets: 4, reps: "1 ronda (20 reps)", rir: 2, tempo: "Fluido", rest: 60,
    tips: ["No sueltes las KB durante la ronda.", "El swing es bisagra de cadera, no sentadilla.", "En el clean la KB rueda sobre la muñeca, no golpea."] },
  { id: "d4c1", block: "C1", pattern: "pull_v", muscles: { lats: 1, biceps: 0.6, upperBack: 0.5 }, name: "Dominadas negativas lentas", eq: ["ladder"], sets: 3, reps: "4–5", rir: 2, tempo: "5-0-X-0", rest: 30,
    tips: ["Sube con salto o con los pies en un peldaño.", "5 s de bajada.", "Si ya dominas las 5, sujeta una KB de 8 kg entre los pies."] },
  { id: "d4c2p", block: "C2", pattern: "push_h", muscles: { chest: 1, triceps: 0.5, shoulders: 0.5, core: 0.3 }, name: "Press de pecho en correas", eq: ["trx"], sets: 3, reps: "10–12", rir: 2, tempo: "3-1-1-0", rest: 60,
    tips: ["Transición inmediata desde la barra de la espaldera sin armar nada extra.", "Cuerpo recto en plancha, escápulas estables y 1 s de pausa abajo.", "Da un paso atrás para hacer más duro el empuje."] },
  { id: "d4d1", block: "D1", pattern: "core", muscles: { core: 1, quads: 0.3, triceps: 0.3 }, name: "L-sit en paralelas (o tuck)", eq: ["dips", "ladder"], sets: 4, reps: "10–20 s", rir: 2, tempo: "Isométrico", rest: 20,
    tips: ["Hombros deprimidos, brazos bloqueados.", "Progresión: tuck → una pierna → L completa.", "Puntas de los pies activas."] },
  { id: "d4d2s", block: "D2", pattern: "hinge", muscles: { glutes: 1, hamstrings: 0.8, core: 0.3, upperBack: 0.2 }, name: "Swings con KB", eq: ["kb"], sets: 4, reps: "15", rir: 2, tempo: "Explosivo", rest: 45,
    tips: ["Empuje potente desde la cadera: los brazos solo acompañan como cuerdas.", "Mantén los pies pegados al piso; trabajo metabólico sin impacto en rodillas.", "Cierra glúteos y abdomen arriba en cada repetición."] },
];

const D4_BAR_TRX_EXERCISES = [
  { id: "d4b1", block: "A", pattern: "full", muscles: { quads: 0.8, glutes: 0.8, hamstrings: 0.7, upperBack: 0.7, shoulders: 0.7, lats: 0.4, core: 0.5, triceps: 0.3 }, name: "Complejo con barra: 6 RDL + 6 remo + 6 sentadilla frontal + 6 push press", eq: ["bar"], sets: 4, reps: "1 ronda (24 reps)", rir: 2, tempo: "Fluido", rest: 90,
    tips: ["Cadena completa sin soltar la barra entre ejercicios.", "Usa los 40 kg (o menos si necesitas ajustar al push press) con técnica limpia.", "Descansa 90 s completos al terminar la ronda."] },
  { id: "d4b2", block: "B1", pattern: "pull_h", muscles: { upperBack: 1, lats: 0.6, biceps: 0.5, core: 0.3 }, name: "Remo invertido en correas", eq: ["trx"], sets: 3, reps: "10–12", rir: 2, tempo: "2-0-1-2", rest: 25,
    tips: ["Cuerpo alineado como una tabla; pausa de 2 s con el pecho cerca de los puños.", "Codos pegados a 45° para cargar espalda media y dorsal.", "Regula la dificultad moviendo los pies."] },
  { id: "d4b3", block: "B2", pattern: "squat", muscles: { quads: 1, glutes: 0.8, hamstrings: 0.3 }, name: "Zancadas inversas con mancuernas (o KB)", eq: ["db", "kb"], sets: 3, reps: "8–10 / pierna", rir: 2, tempo: "2-1-1-0", rest: 60,
    tips: ["Dar el paso hacia atrás cuida más la rodilla delantera.", "Baja controlado hasta rozar el suelo y empuja con el talón delantero.", "Torso erguido y mirada al frente."] },
  { id: "d4b4", block: "C1", pattern: "push_h", muscles: { chest: 1, triceps: 0.7, shoulders: 0.5 }, name: "Fondos en paralelas (o press en correas)", eq: ["dips", "trx"], sets: 3, reps: "6–10", rir: 2, tempo: "3-1-1-0", rest: 25,
    tips: ["Si quieres más pecho, inclina un poco el torso hacia delante en las paralelas.", "Bajada controlada de 3 s sin rebotar abajo.", "También puedes pasar directo a las correas si los hombros lo piden."] },
  { id: "d4b5", block: "C2", pattern: "hinge", muscles: { glutes: 1, hamstrings: 0.8, core: 0.3, upperBack: 0.2 }, name: "Swings con KB", eq: ["kb"], sets: 3, reps: "15–20", rir: 2, tempo: "Explosivo", rest: 60,
    tips: ["Bisagra rápida atrás, extensión explosiva de cadera adelante.", "No tires con los hombros; deja que la KB flote a la altura del pecho.", "Respira corto y firme arriba."] },
  { id: "d4b6", block: "D", pattern: "core", muscles: { core: 1, lats: 0.3, shoulders: 0.3 }, name: "Rueda abdominal (o fallout en correas)", eq: ["wheel", "trx"], sets: 3, reps: "8–12", rir: 2, tempo: "3-1-1-0", rest: 45,
    tips: ["Costillas abajo y glúteos firmes antes de extender los brazos.", "Llega solo hasta donde mantengas la espalda neutra.", "Vuelve tirando desde el abdomen, no doblando la cadera."] },
];

const D4_EXPRESS_EXERCISES = [
  { id: "d4m1", block: "R1", pattern: "full", muscles: { quads: 1, shoulders: 1, glutes: 0.6, triceps: 0.5, core: 0.4 }, name: "Thruster con 2 KB (o mancuernas)", eq: ["kb", "db"], sets: 4, reps: "8–10", rir: 2, tempo: "2-0-X-0", rest: 20,
    tips: ["Baja controlado en sentadilla y aprovecha la subida para empujar arriba.", "Talones pegados al piso todo el tiempo, cero saltos.", "Transición rápida al bloque siguiente."] },
  { id: "d4m2", block: "R2", pattern: "pull_h", muscles: { upperBack: 1, lats: 0.6, biceps: 0.5, core: 0.3 }, name: "Remo invertido en correas", eq: ["trx"], sets: 4, reps: "10–12", rir: 2, tempo: "2-0-1-1", rest: 20,
    tips: ["Ángulo cómodo para sostener las 4 rondas con técnica limpia.", "Aprieta escápulas 1 s arriba en cada rep.", "Cuello relajado, hombros lejos de las orejas."] },
  { id: "d4m3", block: "R3", pattern: "hinge", muscles: { glutes: 1, hamstrings: 0.8, core: 0.3, upperBack: 0.2 }, name: "Swings con KB", eq: ["kb"], sets: 4, reps: "15", rir: 2, tempo: "Explosivo", rest: 20,
    tips: ["Pies firmes en el piso y cadera explosiva.", "Espalda recta en todo momento.", "Cambia rápido hacia las correas."] },
  { id: "d4m4", block: "R4", pattern: "push_h", muscles: { chest: 1, triceps: 0.5, shoulders: 0.5, core: 0.3 }, name: "Press de pecho en correas", eq: ["trx"], sets: 4, reps: "10–12", rir: 2, tempo: "2-0-1-0", rest: 20,
    tips: ["Cuerpo firme como plancha durante toda la serie.", "Baja controlado hasta sentir el estiramiento en el pecho.", "Empuja suave y continuo."] },
  { id: "d4m5", block: "R5", pattern: "core", muscles: { core: 1 }, name: "Abdominales en tabla inclinada (o rueda abdominal)", eq: ["board", "wheel"], sets: 4, reps: "10–12", rir: 2, tempo: "2-1-2-0", rest: 60,
    tips: ["Engancha la tabla a un peldaño bajo al inicio; baja vertebra a vertebra en 2 s.", "No tires del cuello; el movimiento sale de doblar el tronco.", "Descansa 60 s y repite la ronda."] },
];

const LOW_BASE_EXERCISES = [
  { id: "lowa", block: "R1", pattern: "pull_v", muscles: { lats: 0.5, upperBack: 0.5, shoulders: 0.3 }, name: "Colgado activo", eq: ["ladder"], sets: 4, reps: "30 s", rir: 4, tempo: "Isométrico", rest: 0,
    tips: ["Despierta hombros y descomprime la columna.", "Escápulas activas, no pasivo."] },
  { id: "lowb", block: "R2", pattern: "pull_v", muscles: { lats: 1, biceps: 0.6, upperBack: 0.5 }, name: "Dominadas", eq: ["ladder"], sets: 4, reps: "3–4", rir: 4, tempo: "2-0-1-0", rest: 0,
    tips: ["Lejos del fallo a propósito.", "Calidad total en cada rep."] },
  { id: "lowc", block: "R3", pattern: "push_h", muscles: { chest: 1, triceps: 0.5, shoulders: 0.4, core: 0.3 }, name: "Flexiones", eq: ["bw"], sets: 4, reps: "8–10", rir: 3, tempo: "2-0-1-0", rest: 0,
    tips: ["Ritmo cómodo, respiración nasal."] },
  { id: "lowd", block: "R4", pattern: "squat", muscles: { quads: 1, glutes: 0.6, core: 0.3 }, name: "Sentadilla goblet", eq: ["db"], sets: 4, reps: "10", rir: 3, tempo: "3-1-1-0", rest: 0,
    tips: ["Una mancuerna de 10 kg al pecho.", "Pausa abajo empujando rodillas hacia fuera."] },
  { id: "lowe", block: "R5", pattern: "hinge", muscles: { glutes: 1, hamstrings: 0.8, core: 0.3, upperBack: 0.2 }, name: "Swing con KB", eq: ["kb"], sets: 4, reps: "15", rir: 3, tempo: "Explosivo", rest: 60,
    tips: ["Cadera potente, brazos sueltos.", "Descansa 60 s y empieza la siguiente ronda."] },
];

const LOW_TRX_UPPER_EXERCISES = [
  { id: "lowt1", block: "R1", pattern: "pull_v", muscles: { lats: 1, biceps: 0.6, upperBack: 0.5 }, name: "Dominadas cómodas (o asistidas)", eq: ["ladder"], sets: 3, reps: "4–5", rir: 3, tempo: "2-0-1-0", rest: 15,
    tips: ["Lejos del fallo: usa un peldaño para ayudarte si hace falta.", "Siente el dorsal trabajar con fluidez."] },
  { id: "lowt2", block: "R2", pattern: "push_h", muscles: { chest: 1, triceps: 0.5, shoulders: 0.5, core: 0.3 }, name: "Press de pecho en correas", eq: ["trx"], sets: 3, reps: "10–12", rir: 3, tempo: "2-1-1-0", rest: 15,
    tips: ["Ángulo amable para mantener energía.", "Pausa breve abajo manteniendo el tronco recto."] },
  { id: "lowt3", block: "R3", pattern: "pull_h", muscles: { upperBack: 1, lats: 0.6, biceps: 0.5, core: 0.3 }, name: "Remo invertido en correas", eq: ["trx"], sets: 3, reps: "10–12", rir: 3, tempo: "2-0-1-1", rest: 15,
    tips: ["Abre el pecho arriba apretando la espalda.", "Ritmo fluido sin agobiar."] },
  { id: "lowt4", block: "R4", pattern: "pull_h", muscles: { upperBack: 1, shoulders: 0.7 }, name: "Face pull / Y-fly en correas", eq: ["trx"], sets: 3, reps: "10–12", rir: 3, tempo: "2-0-1-1", rest: 15,
    tips: ["Despierta hombros posteriores y postura después de estar sentado.", "Tirón suave y controlado."] },
  { id: "lowt5", block: "R5", pattern: "core", muscles: { core: 1, lats: 0.3, shoulders: 0.3 }, name: "Fallout en correas (o rueda abdominal)", eq: ["trx", "wheel"], sets: 3, reps: "8–10", rir: 3, tempo: "2-1-1-0", rest: 60,
    tips: ["Rango corto y controlado para activar el core sin fatigarte.", "Descansa 60 s entre rondas."] },
];

export const ROUTINES = [
  {
    id: "d1", short: "Día 1", name: "Torso Fuerza / Calistenia", minutes: 42, weekday: 0,
    focus: "Tracción vertical pesada con excéntricas lentas, emparejada con empuje antagonista.",
    exercises: D1_BASE_EXERCISES,
    variants: [
      {
        id: "base",
        label: "Fuerza en espaldera",
        name: "Torso Fuerza / Calistenia",
        minutes: 42,
        focus: "Tracción vertical pesada con excéntricas lentas, emparejada con empuje antagonista.",
        exercises: D1_BASE_EXERCISES,
      },
      {
        id: "trx",
        label: "Correas & Hipertrofia",
        name: "Torso en Correas & Hipertrofia",
        minutes: 40,
        focus: "Superseries rápidas en la espaldera y correas de suspensión para pecho, espalda, hombros y brazos.",
        exercises: D1_TRX_EXERCISES,
      },
    ],
  },
  {
    id: "d2", short: "Día 2", name: "Pierna & Core", minutes: 45, weekday: 1,
    focus: "Sentadilla, estabilidad de rodilla y tobillo, potencia con balón y bisagra de cadera. Cierra con abdomen colgado.",
    exercises: D2_BASE_EXERCISES,
    variants: [
      {
        id: "base",
        label: "Fuerza & Estabilidad",
        name: "Pierna & Core",
        minutes: 45,
        focus: "Sentadilla, estabilidad de rodilla y tobillo, potencia con balón y bisagra de cadera. Cierra con abdomen colgado.",
        exercises: D2_BASE_EXERCISES,
      },
      {
        id: "uni",
        label: "Unilateral · 0 saltos",
        name: "Pierna Unilateral & Estabilidad",
        minutes: 40,
        focus: "Trabajo unilateral y control de rodilla y tobillo con cero saltos; cierra con core en rueda o correas.",
        exercises: D2_UNI_EXERCISES,
      },
    ],
  },
  {
    id: "d3", short: "Día 3", name: "Running & Tobillos", minutes: 38, weekday: 3,
    focus: "Trote por intervalos a ritmo conversacional, con preparación y fuerza de tobillo para proteger rodillas y tobillos.",
    exercises: day3Exercises(1),
  },
  {
    id: "d4", short: "Día 4", name: "Full Body & Kettlebell Flow", minutes: 42, weekday: 5,
    focus: "Potencia y trabajo de cadena completa sin tiempos muertos; ideal para el sábado o días con margen.",
    exercises: D4_BASE_EXERCISES,
    variants: [
      {
        id: "base",
        label: "KB Flow & Espaldera",
        name: "Full Body & Kettlebell Flow",
        minutes: 42,
        focus: "Potencia y trabajo de cadena completa sin tiempos muertos; ideal para el sábado o días con margen.",
        exercises: D4_BASE_EXERCISES,
      },
      {
        id: "bar_trx",
        label: "Barra + Correas",
        name: "Full Body · Barra & Correas",
        minutes: 40,
        focus: "Complejo fluido con barra seguido de trabajo ágil en correas, paralelas y bisagra de cadera.",
        exercises: D4_BAR_TRX_EXERCISES,
      },
      {
        id: "express",
        label: "Metabólico · 30 min",
        name: "Full Body Metabólico Express (0 saltos)",
        minutes: 30,
        focus: "Circuito fluido sin saltos de 4 rondas para días cortos: empuje, tracción, cadera y core en 30 minutos.",
        exercises: D4_EXPRESS_EXERCISES,
      },
    ],
  },
  {
    id: "low", short: "Rescate", name: "Modo Baja Energía (20 min)", minutes: 20, weekday: -1, low: true,
    focus: "Para mañanas críticas: 4 rondas, todo con RIR 3–4. Mantienes la racha sin cavar más fatiga.",
    exercises: LOW_BASE_EXERCISES,
    variants: [
      {
        id: "base",
        label: "Full Body · 20 min",
        name: "Modo Baja Energía (20 min)",
        minutes: 20,
        focus: "Para mañanas críticas: 4 rondas, todo con RIR 3–4. Mantienes la racha sin cavar más fatiga.",
        exercises: LOW_BASE_EXERCISES,
      },
      {
        id: "trx_upper",
        label: "Torso Correas · 20 min",
        name: "Torso Express en Correas (20 min)",
        minutes: 20,
        focus: "Solo espaldera y correas, sin armar discos: tracción, empuje, postura y core en 20 minutos.",
        exercises: LOW_TRX_UPPER_EXERCISES,
      },
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

export const variantsFor = (id) => {
  const base = ROUTINES.find((r) => r.id === id);
  return base && Array.isArray(base.variants) ? base.variants : [];
};

export const routineById = (id, runLevel, variantId) => {
  const base = ROUTINES.find((r) => r.id === id) || ROUTINES[0];
  if (base.id === "d3") {
    const lvl = getRunLevel(runLevel ?? 1);
    return { ...base, runPlan: lvl, exercises: day3Exercises(lvl.level), variantId: null, variantLabel: null };
  }
  if (Array.isArray(base.variants) && base.variants.length) {
    const v = (variantId && base.variants.find((x) => x.id === variantId)) || base.variants[0];
    return {
      ...base,
      name: v.name,
      minutes: v.minutes,
      focus: v.focus,
      exercises: v.exercises,
      variantId: v.id,
      variantLabel: v.label,
    };
  }
  return base;
};
