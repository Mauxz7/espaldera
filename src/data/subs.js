// kind "eq": equivalente biomecánico (mismos músculos). kind "imp": mismo patrón con otro implemento.
// reps, tempo y RIR reemplazan a los del ejercicio original; las series se mantienen.
export const SUB_KIND = { eq: "Equivalente biomecánico", imp: "Mismo patrón, otro implemento" };

export const PATTERNS = {
  pull_v: "Tracción vertical",
  pull_h: "Remo y espalda alta",
  push_h: "Empuje horizontal",
  push_v: "Empuje vertical",
  arms: "Brazos",
  squat: "Sentadilla y rodilla",
  hinge: "Bisagra y cadera",
  full: "Potencia y complejos",
  core: "Core y abdomen",
  run: "Cardio y tobillos",
};

export const SUBS = {
  d1a1: [
    { id: "chin", kind: "eq", name: "Dominadas supinas", eq: ["ladder"], reps: "5–7", tempo: "3-1-1-0", rir: 2, why: "Mismo dorsal con más bíceps; suelen salir 1–2 reps más." },
    { id: "neg", kind: "eq", name: "Dominadas negativas lentas", eq: ["ladder"], reps: "4–5", tempo: "5-0-X-0", rir: 2, why: "Si hoy no salen completas: solo la bajada de 5 s." },
    { id: "dbrow", kind: "imp", muscles: { lats: 1, upperBack: 0.8, biceps: 0.5, core: 0.3 }, name: "Remo unilateral con mancuerna", eq: ["db"], reps: "10–12 / lado", tempo: "3-1-1-1", rir: 1, why: "Tracción con carga externa; más reps porque 10 kg pesan menos que tu cuerpo." },
  ],
  d1a2: [
    { id: "trxpress", kind: "imp", name: "Press de pecho en correas", eq: ["trx"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Mismo empuje de pecho y tríceps sin cargar tanto el hombro arriba." },
    { id: "deficit", kind: "eq", name: "Flexiones con déficit", eq: ["bw", "bar"], reps: "10–15", tempo: "3-1-1-0", rir: 2, why: "Pecho y tríceps con más recorrido, sin cargar el hombro arriba." },
    { id: "diamond", kind: "eq", name: "Flexiones diamante", eq: ["bw"], reps: "8–12", tempo: "2-1-1-0", rir: 2, why: "Más tríceps, como el fondo." },
    { id: "floorpress", kind: "imp", name: "Press de suelo con barra", eq: ["bar"], reps: "8–10", tempo: "3-1-1-0", rir: 2, why: "Mismo empuje con barra; el suelo limita el rango si el hombro molesta." },
  ],
  d1b1: [
    { id: "trxrow", kind: "imp", name: "Remo invertido en correas", eq: ["trx"], reps: "10–14", tempo: "2-0-1-2", rir: 2, why: "Espalda media y dorsal sin cargar la zona lumbar." },
    { id: "pendlay", kind: "eq", name: "Remo Pendlay con barra", eq: ["bar"], reps: "6–8", tempo: "1-0-X-1", rir: 2, why: "Desde el piso cada rep: más potencia y espalda media." },
    { id: "dbrow2", kind: "imp", name: "Remo inclinado con 2 mancuernas", eq: ["db"], reps: "12–15", tempo: "2-0-1-2", rir: 1, why: "Mismo ángulo; compensa los 10 kg con más reps y la pausa." },
    { id: "kbrow", kind: "imp", name: "Remo inclinado con 2 KB", eq: ["kb"], reps: "12–15", tempo: "2-0-1-2", rir: 1, why: "Agarre neutro, más amable para codos." },
  ],
  d1b2: [
    { id: "pike", kind: "eq", name: "Flexiones pike (pies en peldaño)", eq: ["ladder", "bw"], reps: "6–10", tempo: "3-1-1-0", rir: 2, why: "Empuje vertical con tu peso; deltoide anterior y tríceps." },
    { id: "kbpress", kind: "imp", name: "Press de hombro unilateral con KB", eq: ["kb"], reps: "10–12 / lado", tempo: "3-0-1-0", rir: 2, why: "La KB cuelga detrás del antebrazo: más estabilidad de hombro." },
    { id: "ohp", kind: "imp", name: "Press militar con barra (carga parcial)", eq: ["bar"], reps: "6–8", tempo: "3-0-1-0", rir: 2, why: "Ambos brazos a la vez; usa solo los discos que controles." },
  ],
  d1c1: [
    { id: "incline_db", kind: "imp", name: "Press inclinado en tabla con mancuernas", eq: ["board", "db"], reps: "10–12", tempo: "3-1-1-0", rir: 1, why: "Apoya la tabla en un peldaño bajo y trabaja pecho superior." },
    { id: "trxpress_c1", kind: "imp", name: "Press de pecho en correas", eq: ["trx"], reps: "10–15", tempo: "3-1-1-0", rir: 1, why: "Más recorrido e inestabilidad sin apoyar las manos en el piso." },
    { id: "pausepu", kind: "eq", name: "Flexiones con pausa de 2 s", eq: ["bw"], reps: "12–20", tempo: "3-2-1-0", rir: 1, why: "Sin discos: la pausa compensa el menor recorrido." },
    { id: "dbfloor", kind: "imp", name: "Press de suelo con mancuernas", eq: ["db"], reps: "12–15", tempo: "3-1-1-0", rir: 1, why: "Mismo pecho y tríceps con carga externa." },
    { id: "mbpu", kind: "imp", name: "Flexiones con una mano sobre el balón", eq: ["mb"], reps: "6–8 / lado", tempo: "2-1-1-0", rir: 2, why: "Recorrido extra en un lado y más estabilidad." },
  ],
  d1c2: [
    { id: "trxfallout_c2", kind: "imp", name: "Fallout abdominal en correas", eq: ["trx"], reps: "8–12", tempo: "3-1-1-0", rir: 2, why: "Core intenso sin fatigar el agarre tras las dominadas." },
    { id: "wheel_c2", kind: "imp", name: "Rueda abdominal", eq: ["wheel"], reps: "8–12", tempo: "3-1-1-0", rir: 2, why: "Antiextensión pura en el sitio, rápida de hacer." },
    { id: "knees", kind: "eq", name: "Rodillas al pecho colgado", eq: ["ladder"], reps: "10–15", tempo: "2-1-2-0", rir: 2, why: "Mismo abdomen con palanca corta." },
    { id: "lyinglr", kind: "eq", name: "Elevaciones de piernas acostado", eq: ["ladder", "bw"], reps: "12–15", tempo: "2-1-3-0", rir: 1, why: "Manos en un peldaño; sin fatiga de agarre." },
    { id: "deadbugmb", kind: "imp", name: "Dead bug con balón medicinal", eq: ["mb"], reps: "8 / lado", tempo: "Lento", rir: 2, why: "Antiextensión del core sosteniendo el balón con brazos y rodillas." },
  ],
  d1t1: [
    { id: "d1t1_prona", kind: "eq", name: "Dominadas pronas", eq: ["ladder"], reps: "4–6", tempo: "3-1-1-0", rir: 2, why: "Mayor énfasis en dorsal ancho y agarre prono." },
    { id: "d1t1_neg", kind: "eq", name: "Dominadas negativas lentas", eq: ["ladder"], reps: "4–5", tempo: "5-0-X-0", rir: 2, why: "Solo la bajada controlada de 5 s." },
    { id: "d1t1_assist", kind: "eq", name: "Dominadas asistidas con pies en peldaño", eq: ["ladder"], reps: "6–8", tempo: "3-0-1-0", rir: 2, why: "Rango completo descargando parte del peso con los pies." },
  ],
  d1t2: [
    { id: "d1t2_dips", kind: "eq", name: "Fondos en paralelas", eq: ["dips"], reps: "6–8", tempo: "3-1-1-0", rir: 2, why: "Alternativa más pesada en las paralelas." },
    { id: "d1t2_incline", kind: "imp", name: "Press inclinado en tabla con mancuernas", eq: ["board", "db"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Más carga en pecho alto con las mancuernas." },
    { id: "d1t2_fly", kind: "eq", name: "Aperturas de pecho en correas", eq: ["trx"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Mayor aislamiento de pectoral." },
  ],
  d1t3: [
    { id: "d1t3_bar", kind: "imp", name: "Remo inclinado con barra", eq: ["bar"], reps: "8–10", tempo: "2-0-1-2", rir: 2, why: "Carga externa constante con los 40 kg." },
    { id: "d1t3_db", kind: "imp", name: "Remo unilateral con mancuerna", eq: ["db"], reps: "10–12 / lado", tempo: "3-1-1-1", rir: 1, why: "Corrige asimetrías entre lados." },
  ],
  d1t4: [
    { id: "d1t4_kb", kind: "imp", name: "Press de hombro unilateral con KB", eq: ["kb"], reps: "10–12 / lado", tempo: "3-0-1-0", rir: 2, why: "Más demanda de estabilidad de hombro." },
    { id: "d1t4_pike", kind: "eq", name: "Flexiones pike (pies en peldaño)", eq: ["ladder", "bw"], reps: "6–10", tempo: "3-1-1-0", rir: 2, why: "Solo con peso corporal y la espaldera." },
  ],
  d1t5: [
    { id: "d1t5_tfly", kind: "eq", name: "Aperturas en T en correas (deltoide posterior)", eq: ["trx"], reps: "12–15", tempo: "2-1-1-1", rir: 2, why: "Aísla espalda alta y parte trasera del hombro." },
    { id: "d1t5_band", kind: "imp", name: "Remo al mentón / elevaciones con mancuernas", eq: ["db"], reps: "12–15", tempo: "2-1-1-0", rir: 2, why: "Hombro lateral y postura sin correas." },
  ],
  d1t6: [
    { id: "d1t6_dips", kind: "eq", muscles: { triceps: 1, chest: 0.7, shoulders: 0.4 }, name: "Fondos en paralelas (torso recto)", eq: ["dips"], reps: "6–10", tempo: "3-1-1-0", rir: 1, why: "Más carga para tríceps manteniendo el cuerpo vertical." },
    { id: "d1t6_skull", kind: "imp", name: "Press francés con mancuernas en tabla", eq: ["db", "board"], reps: "10–12", tempo: "3-1-1-0", rir: 1, why: "Trabajo directo de cabeza larga del tríceps." },
  ],
  d1t7: [
    { id: "d1t7_hammer", kind: "imp", name: "Curl martillo con mancuernas", eq: ["db"], reps: "10–12", tempo: "3-0-1-1", rir: 1, why: "Bíceps y braquiorradial, amable con las muñecas." },
    { id: "d1t7_chin", kind: "imp", muscles: { biceps: 1, lats: 0.9, upperBack: 0.5 }, name: "Dominadas supinas (enfoque bíceps)", eq: ["ladder"], reps: "4–6", tempo: "3-1-1-0", rir: 2, why: "Palanca más pesada usando tu peso." },
  ],
  d1t8: [
    { id: "d1t8_wheel", kind: "eq", name: "Rueda abdominal", eq: ["wheel"], reps: "8–12", tempo: "3-1-1-0", rir: 2, why: "Mismo patrón en el suelo con la rueda." },
    { id: "d1t8_board", kind: "imp", name: "Abdominales en tabla inclinada", eq: ["board"], reps: "10–15", tempo: "2-1-2-0", rir: 2, why: "Flexión de tronco controlada sin cargar hombros." },
  ],
  d2a: [
    { id: "front", kind: "eq", name: "Sentadilla frontal con barra", eq: ["bar"], reps: "5–8", tempo: "3-1-1-0", rir: 2, why: "Más cuádriceps y torso erguido; menos carga en la espalda baja." },
    { id: "boxmb", kind: "eq", name: "Sentadilla a caja con balón al pecho", eq: ["mb"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Profundidad fija: la mejor opción si la rodilla está sensible." },
    { id: "gobletdb", kind: "imp", name: "Sentadilla goblet con mancuerna", eq: ["db"], reps: "12–15", tempo: "3-2-1-0", rir: 2, why: "Mismo patrón con 10 kg; la pausa de 2 s compensa la carga." },
  ],
  d2b: [
    { id: "bulgariso", kind: "eq", name: "Sentadilla búlgara con pausa isométrica", eq: ["ladder", "bw"], reps: "6–8 / pierna", tempo: "3-3-1-0", rir: 2, why: "Pie de atrás en un peldaño bajo; misma estabilidad de rodilla con más apoyo." },
    { id: "boxpistol", kind: "eq", name: "Pistol a caja (sentarse y subir)", eq: ["bw"], reps: "5–8 / pierna", tempo: "3-2-1-0", rir: 2, why: "Unilateral con tope de profundidad." },
    { id: "stepup", kind: "imp", name: "Step-up lento al peldaño con KB", eq: ["kb", "ladder"], reps: "8 / pierna", tempo: "3-1-1-0", rir: 2, why: "Control de rodilla y tobillo con carga en la mano." },
  ],
  d2c1: [
    { id: "splitmb", kind: "eq", name: "Split squat estático con balón", eq: ["mb"], reps: "10 / pierna", tempo: "2-1-1-0", rir: 2, why: "Mismo patrón sin pasos: menos fuerza de cizalla en la rodilla." },
    { id: "revdb", kind: "imp", name: "Zancadas inversas con mancuernas", eq: ["db"], reps: "8 / pierna", tempo: "2-1-1-0", rir: 2, why: "Pasar hacia atrás descarga la rodilla delantera." },
    { id: "rackkb", kind: "imp", name: "Zancadas con 2 KB en rack", eq: ["kb"], reps: "8 / pierna", tempo: "2-1-1-0", rir: 2, why: "Carga frontal: más core y torso erguido." },
  ],
  d2c2: [
    { id: "altfast", kind: "eq", name: "Zancadas alternas rápidas sin salto", eq: ["bw"], reps: "10 / pierna", tempo: "Rápido controlado", rir: 2, why: "Mismo patrón sin impacto: para días de tobillo débil." },
    { id: "swing", kind: "imp", muscles: { glutes: 1, hamstrings: 0.8, core: 0.3, upperBack: 0.2 }, name: "Swing con KB", eq: ["kb"], reps: "15", tempo: "Explosivo", rir: 2, why: "Potencia de cadera sin aterrizajes." },
    { id: "mbthrow", kind: "imp", name: "Lanzamiento de balón desde sentadilla", eq: ["mb"], reps: "8", tempo: "Explosivo", rir: 2, why: "Extensión explosiva de cadera y rodilla; no saltas, lanzas." },
  ],
  d2d: [
    { id: "slrdl", kind: "eq", name: "RDL a una pierna con KB", eq: ["kb"], reps: "8 / pierna", tempo: "3-1-1-0", rir: 2, why: "Isquio y glúteo con trabajo extra de tobillo." },
    { id: "goodmorning", kind: "eq", name: "Good morning con barra", eq: ["bar"], reps: "10–12", tempo: "3-1-1-0", rir: 3, why: "Misma bisagra con la barra en la espalda; carga moderada." },
    { id: "dbrdl", kind: "imp", name: "RDL con mancuernas", eq: ["db"], reps: "12–15", tempo: "3-1-1-0", rir: 1, why: "Mismo patrón con 2 × 10 kg y más reps." },
  ],
  d2e: [
    { id: "hipthrust", kind: "imp", muscles: { glutes: 1, hamstrings: 0.5, core: 0.2 }, name: "Hip thrust con barra (en el sitio)", eq: ["bar"], reps: "10–12", tempo: "2-2-1-0", rir: 2, why: "Sin caminar ni espacio extra: carga fuerte de glúteo en el sitio." },
    { id: "wallsit_e", kind: "imp", muscles: { quads: 1, glutes: 0.4 }, name: "Isométrico contra la pared (wall sit)", eq: ["bw"], reps: "40 s", tempo: "Isométrico", rir: 2, why: "En el sitio y sin equipo: protege rodilla y cuádriceps." },
    { id: "slbridge_e", kind: "imp", muscles: { glutes: 1, hamstrings: 0.5, core: 0.2 }, name: "Puente de glúteo a una pierna", eq: ["bw"], reps: "10 / pierna", tempo: "2-1-1-0", rir: 2, why: "Estabilidad de cadera y glúteo sin desplazarte." },
    { id: "suitcase", kind: "eq", name: "Suitcase carry (1 KB)", eq: ["kb"], reps: "30 s / lado", tempo: "Marcha", rir: 2, why: "Carga en una mano: el core resiste la inclinación." },
    { id: "dbfarmer", kind: "imp", name: "Farmer's walk con 2 mancuernas", eq: ["db"], reps: "30 s", tempo: "Marcha", rir: 2, why: "10 kg por mano: un poco más de carga." },
  ],
  d2f1: [
    { id: "trxpike", kind: "imp", name: "Pike o rodillas al pecho en correas", eq: ["trx"], reps: "10–12", tempo: "2-1-2-0", rir: 2, why: "Abdomen intenso sin fatigar manos ni antebrazos." },
    { id: "boardabs", kind: "imp", name: "Abdominales en tabla inclinada", eq: ["board"], reps: "10–15", tempo: "2-1-2-0", rir: 2, why: "Usa la tabla en peldaño bajo sin colgarte." },
    { id: "kneeschest", kind: "eq", name: "Rodillas al pecho colgado", eq: ["ladder"], reps: "10–12", tempo: "Controlado", rir: 2, why: "Mismo abdomen colgado con palanca corta." },
    { id: "vupmb", kind: "imp", name: "V-ups con balón medicinal", eq: ["mb"], reps: "10–12", tempo: "2-0-1-0", rir: 2, why: "Flexión de cadera y tronco en el piso, pasando el balón de manos a pies." },
  ],
  d2f2: [
    { id: "wheel_d2", kind: "imp", name: "Rueda abdominal", eq: ["wheel"], reps: "8–12", tempo: "3-1-1-0", rir: 2, why: "Antiextensión intensa sin colgar de la espaldera." },
    { id: "boardleg", kind: "eq", name: "Elevaciones de piernas en tabla inclinada", eq: ["board"], reps: "10–12", tempo: "2-1-3-0", rir: 1, why: "Espalda apoyada en la tabla, sin balanceo." },
    { id: "revcrunch", kind: "eq", name: "Crunch invertido en el piso", eq: ["bw"], reps: "12–15", tempo: "2-1-2-0", rir: 1, why: "Retroversión pélvica sin colgar." },
    { id: "lrmb", kind: "imp", name: "Elevaciones de piernas con balón entre los pies", eq: ["mb"], reps: "10–12", tempo: "2-1-3-0", rir: 1, why: "Más palanca con el mismo gesto." },
    { id: "deadbugkb", kind: "imp", name: "Dead bug con KB (brazos estirados)", eq: ["kb"], reps: "8 / lado", tempo: "Lento", rir: 2, why: "Antiextensión con carga arriba." },
  ],
  d2u1: [
    { id: "d2u1_back", kind: "eq", name: "Sentadilla trasera con barra", eq: ["bar"], reps: "6–10", tempo: "3-1-1-0", rir: 2, why: "Si las muñecas prefieren barra atrás." },
    { id: "d2u1_box", kind: "eq", name: "Sentadilla a caja con balón o KB", eq: ["mb", "kb"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Tope de profundidad si la rodilla está sensible." },
  ],
  d2u2: [
    { id: "d2u2_split", kind: "eq", name: "Split squat estático con mancuernas", eq: ["db"], reps: "10 / pierna", tempo: "3-1-1-0", rir: 2, why: "Ambos pies en el suelo para mayor estabilidad." },
    { id: "d2u2_step", kind: "imp", name: "Step-up lento al peldaño con KB", eq: ["kb", "ladder"], reps: "8–10 / pierna", tempo: "3-1-1-0", rir: 2, why: "Control de tobillo y rodilla subiendo." },
  ],
  d2u3: [
    { id: "d2u3_bar", kind: "eq", name: "Peso muerto rumano con barra", eq: ["bar"], reps: "8–10", tempo: "3-1-1-0", rir: 2, why: "Trabajo bilateral con los 40 kg." },
    { id: "d2u3_bridge", kind: "imp", name: "Puente de glúteo a una pierna", eq: ["bw"], reps: "12 / pierna", tempo: "2-1-1-0", rir: 2, why: "Cero carga lumbar, foco en glúteo." },
  ],
  d2u4: [
    { id: "d2u4_lat", kind: "eq", name: "Zancada lateral con balón medicinal", eq: ["mb"], reps: "8 / lado", tempo: "2-1-1-0", rir: 2, why: "Menor profundidad, mismo plano lateral." },
    { id: "d2u4_goblet", kind: "eq", name: "Sentadilla goblet con pausa de 2 s", eq: ["kb"], reps: "10–12", tempo: "3-2-1-0", rir: 2, why: "Si los aductores están muy tirantes." },
  ],
  d2u5: [
    { id: "d2u5_rev", kind: "imp", name: "Zancadas inversas sin salto", eq: ["db"], reps: "8 / pierna", tempo: "3-1-1-0", rir: 2, why: "Trabajo dinámico controlado para cuádriceps." },
    { id: "d2u5_calf", kind: "imp", muscles: { calves: 1 }, name: "Elevaciones de talón con 2 KB", eq: ["kb"], reps: "12–15", tempo: "1-1-3-0", rir: 2, why: "Enfoque directo en gemelo y estabilidad de tobillo." },
  ],
  d2u6: [
    { id: "d2u6_fallout", kind: "eq", name: "Fallout abdominal en correas", eq: ["trx"], reps: "8–12", tempo: "3-1-1-0", rir: 2, why: "Mismo trabajo de antiextensión de pie." },
    { id: "d2u6_board", kind: "imp", name: "Abdominales en tabla inclinada", eq: ["board"], reps: "10–15", tempo: "2-1-2-0", rir: 2, why: "Sin apoyar muñecas ni hombros." },
  ],
  d3a: [
    { id: "gobletank", kind: "imp", name: "Sentadilla goblet con pausa + círculos de tobillo", eq: ["kb"], reps: "6 + 8 / lado", tempo: "Lento", rir: 4, why: "La pausa abajo con la KB abre tobillo y cadera a la vez." },
    { id: "slbridge", kind: "eq", name: "Puente de glúteo a una pierna", eq: ["bw"], reps: "10 / lado", tempo: "2-1-1-0", rir: 4, why: "Activa el glúteo, que es el que estabiliza la rodilla al correr." },
  ],
  d3b: [
    { id: "march", kind: "eq", name: "Marcha en el sitio con rodillas altas", eq: ["bw"], reps: "3 min", tempo: "Ritmo ágil", rir: 4, why: "Mismo calentamiento sin salir de casa." },
    { id: "bikein", kind: "imp", name: "Bici estática suave", eq: ["bike"], reps: "5 min", tempo: "Cadencia cómoda", rir: 4, why: "Sube pulsaciones sin ningún impacto." },
  ],
  d3c: [
    { id: "powerwalk", kind: "eq", name: "Caminata rápida continua", eq: ["run"], reps: "4 min", tempo: "Ritmo fuerte", rir: 3, why: "Mismo trabajo aeróbico con mucho menos golpe: para días de rodilla o tobillo sensibles." },
    { id: "bikeint", kind: "imp", name: "Bici estática: 3 min fuerte + 1 min suave", eq: ["bike"], reps: "3 min fuertes", tempo: "Cadencia alta", rir: 3, why: "Mismos intervalos sin impacto." },
    { id: "kbcardio", kind: "imp", name: "Circuito sin impacto: swing 30 s + marcha 30 s", eq: ["kb"], reps: "3 min", tempo: "Continuo", rir: 3, why: "Cardio en casa si llueve: la cadera trabaja y los pies no despegan." },
  ],
  d3d: [
    { id: "marchcool", kind: "eq", name: "Marcha suave en el sitio + respiración nasal", eq: ["bw"], reps: "4 min", tempo: "Suave", rir: 4, why: "Misma vuelta a la calma en casa." },
    { id: "bikecool", kind: "imp", name: "Bici estática muy suave", eq: ["bike"], reps: "4 min", tempo: "Sin resistencia", rir: 4, why: "Baja pulsaciones sin cargar las piernas." },
  ],
  d3e: [
    { id: "slcalf", kind: "eq", name: "Elevaciones de talón a una pierna", eq: ["ladder"], reps: "8 / pierna", tempo: "1-0-3-1", rir: 2, why: "Más carga por tobillo cuando las de dos piernas ya son fáciles." },
    { id: "kbcalf", kind: "imp", name: "Elevaciones de talón con 2 KB", eq: ["kb"], reps: "12–15", tempo: "1-1-3-0", rir: 2, why: "En el piso y con carga en las manos: más estable." },
    { id: "isocalf", kind: "eq", name: "Isométrico de gemelo en peldaño", eq: ["ladder"], reps: "30 s", tempo: "Isométrico", rir: 2, why: "Sin movimiento: la opción si el tendón está cargado." },
  ],
  d3f: [
    { id: "heelwalk", kind: "eq", name: "Caminar de talones + equilibrio a una pierna", eq: ["bw"], reps: "30 s + 30 s / pierna", tempo: "Controlado", rir: 3, why: "El mismo tibial, caminando con las puntas arriba." },
    { id: "mbbalance", kind: "imp", name: "Equilibrio a una pierna pasando el balón", eq: ["mb"], reps: "30 s / pierna", tempo: "Controlado", rir: 3, why: "El balón alrededor de la cintura obliga al tobillo a corregir." },
  ],
  d4a: [
    { id: "kbthr", kind: "imp", name: "Thruster con 2 KB", eq: ["kb"], reps: "8–10", tempo: "2-0-X-0", rir: 2, why: "Mismo patrón con KB en rack." },
    { id: "dbthr", kind: "imp", name: "Thruster con mancuernas", eq: ["db"], reps: "8–10", tempo: "2-0-X-0", rir: 2, why: "Cada brazo libre; más fácil para la muñeca." },
    { id: "wallball", kind: "imp", name: "Wall ball con balón medicinal", eq: ["mb"], reps: "12–15", tempo: "2-0-X-0", rir: 2, why: "Sentadilla y empuje lanzando el balón a la pared; recíbelo sin saltar." },
  ],
  d4b: [
    { id: "dbcomplex", kind: "imp", name: "Complejo con mancuernas: 5 swing + 5 clean + 5 sentadilla + 5 press", eq: ["db"], reps: "1 ronda (20 reps)", tempo: "Fluido", rir: 2, why: "Misma secuencia con mancuernas." },
    { id: "barcomplex", kind: "imp", name: "Complejo con barra: 5 RDL + 5 remo + 5 sentadilla frontal + 5 press", eq: ["bar"], reps: "1 ronda (20 reps)", tempo: "Fluido", rir: 2, why: "Cadena completa sin soltar la barra; carga parcial." },
    { id: "kbsingle", kind: "eq", name: "Complejo con una KB, alternando lados", eq: ["kb"], reps: "1 ronda / lado", tempo: "Fluido", rir: 2, why: "Mismo flujo con la mitad de carga y más core." },
  ],
  d4c1: [
    { id: "assisted", kind: "eq", name: "Dominadas asistidas con pies en peldaño", eq: ["ladder"], reps: "6–8", tempo: "3-0-1-0", rir: 2, why: "Recorrido completo con ayuda de las piernas." },
    { id: "trxrow_d4", kind: "imp", muscles: { upperBack: 1, lats: 0.6, biceps: 0.5, core: 0.3 }, name: "Remo invertido en correas", eq: ["trx"], reps: "10–12", tempo: "2-0-1-2", rir: 2, why: "Tracción rápida en la misma espaldera." },
    { id: "dbrowslow", kind: "imp", muscles: { lats: 1, upperBack: 0.8, biceps: 0.5, core: 0.3 }, name: "Remo unilateral con mancuerna, bajada de 4 s", eq: ["db"], reps: "10 / lado", tempo: "4-0-1-1", rir: 2, why: "Mismo énfasis excéntrico en horizontal." },
  ],
  d4c2p: [
    { id: "dips_d4", kind: "eq", name: "Fondos en paralelas", eq: ["dips"], reps: "6–8", tempo: "3-1-1-0", rir: 2, why: "Empuje más pesado usando las paralelas de la espaldera." },
    { id: "trxfly_d4", kind: "imp", muscles: { upperBack: 1, shoulders: 0.7 }, name: "Face pull / Y-fly en correas", eq: ["trx"], reps: "10–12", tempo: "2-1-1-1", rir: 2, why: "Para dar prioridad a hombros posteriores y postura." },
    { id: "incline_db_d4", kind: "imp", name: "Press inclinado en tabla con mancuernas", eq: ["board", "db"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Pecho superior con carga libre." },
  ],
  d4d1: [
    { id: "trxfallout_d4", kind: "imp", name: "Fallout abdominal en correas", eq: ["trx"], reps: "8–12", tempo: "3-1-1-0", rir: 2, why: "Mismo trabajo abdominal sin colgar en las paralelas." },
    { id: "tuck", kind: "eq", name: "Tuck hold en paralelas", eq: ["dips"], reps: "15–25 s", tempo: "Isométrico", rir: 2, why: "La versión con rodillas recogidas del L-sit." },
    { id: "hollow", kind: "eq", name: "Hollow hold en el piso", eq: ["bw"], reps: "20–30 s", tempo: "Isométrico", rir: 2, why: "Misma tensión abdominal sin cargar las muñecas." },
    { id: "mbplank", kind: "imp", name: "Plancha con antebrazos sobre el balón", eq: ["mb"], reps: "20–30 s", tempo: "Isométrico", rir: 2, why: "Base inestable: el core trabaja más." },
  ],
  d4d2s: [
    { id: "dbswing_d4", kind: "imp", name: "Swing con mancuerna", eq: ["db"], reps: "15", tempo: "Explosivo", rir: 2, why: "Misma bisagra sujetando una mancuerna de 10 kg a dos manos." },
    { id: "hipthrust_d4", kind: "imp", name: "Hip thrust con barra", eq: ["bar"], reps: "10–12", tempo: "2-2-1-0", rir: 2, why: "Extensión de cadera controlada en el sitio." },
    { id: "suitcase_d4", kind: "imp", name: "Suitcase carry (1 KB)", eq: ["kb"], reps: "30 s / lado", tempo: "Marcha", rir: 2, why: "Si quieres variar con paseo de granjero unilateral." },
  ],
  d4b1: [
    { id: "d4b1_kb", kind: "imp", name: "Complejo KB doble: 5 swing + 5 clean + 5 sentadilla + 5 press", eq: ["kb"], reps: "1 ronda (20 reps)", tempo: "Fluido", rir: 2, why: "Versión ágil con las dos KB." },
    { id: "d4b1_thr", kind: "eq", name: "Thruster con barra", eq: ["bar"], reps: "6–8", tempo: "2-0-X-0", rir: 2, why: "Más corto si buscas menos fatiga de agarre." },
  ],
  d4b2: [
    { id: "d4b2_bar", kind: "imp", name: "Remo inclinado con barra", eq: ["bar"], reps: "8–10", tempo: "2-0-1-2", rir: 2, why: "Carga externa con los 40 kg." },
    { id: "d4b2_neg", kind: "imp", muscles: { lats: 1, biceps: 0.6, upperBack: 0.5 }, name: "Dominadas negativas lentas", eq: ["ladder"], reps: "4–5", tempo: "5-0-X-0", rir: 2, why: "Cambia el ángulo a tracción vertical." },
  ],
  d4b3: [
    { id: "d4b3_bulg", kind: "eq", name: "Sentadilla búlgara con pie en peldaño", eq: ["ladder", "bw"], reps: "8 / pierna", tempo: "3-1-1-0", rir: 2, why: "Más estable aún apoyando el pie trasero." },
    { id: "d4b3_gob", kind: "eq", name: "Sentadilla goblet con KB", eq: ["kb"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Bilateral si la rodilla prefiere menos balanceo." },
  ],
  d4b4: [
    { id: "d4b4_trx", kind: "eq", name: "Press de pecho en correas", eq: ["trx"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Menor carga articular en hombros que los fondos." },
    { id: "d4b4_pu", kind: "eq", name: "Flexiones con déficit", eq: ["bw", "bar"], reps: "10–15", tempo: "3-1-1-0", rir: 2, why: "Alternativa directa en el piso." },
  ],
  d4b5: [
    { id: "d4b5_rdl", kind: "imp", name: "Peso muerto rumano con barra", eq: ["bar"], reps: "8–10", tempo: "3-1-1-0", rir: 2, why: "Bisagra lenta en lugar de explosiva." },
    { id: "d4b5_hip", kind: "imp", name: "Hip thrust con barra", eq: ["bar"], reps: "10–12", tempo: "2-2-1-0", rir: 2, why: "Foco extra en glúteos." },
  ],
  d4b6: [
    { id: "d4b6_trx", kind: "eq", name: "Fallout abdominal en correas", eq: ["trx"], reps: "8–12", tempo: "3-1-1-0", rir: 2, why: "De pie en las correas sin arrodillarte." },
    { id: "d4b6_board", kind: "imp", name: "Abdominales en tabla inclinada", eq: ["board"], reps: "10–12", tempo: "2-1-2-0", rir: 2, why: "Flexión controlada en la tabla." },
  ],
  d4m1: [
    { id: "d4m1_bar", kind: "imp", name: "Thruster con barra", eq: ["bar"], reps: "6–8", tempo: "2-0-X-0", rir: 2, why: "Si quieres algo más pesado en pierna." },
    { id: "d4m1_wall", kind: "imp", name: "Wall ball con balón medicinal", eq: ["mb"], reps: "12–15", tempo: "2-0-X-0", rir: 2, why: "Más ligero y metabólico sin saltar." },
  ],
  d4m2: [
    { id: "d4m2_db", kind: "imp", name: "Remo inclinado con 2 mancuernas", eq: ["db"], reps: "12", tempo: "2-0-1-1", rir: 2, why: "Mismo tirón horizontal con mancuernas." },
    { id: "d4m2_yfly", kind: "eq", name: "Face pull / Y-fly en correas", eq: ["trx"], reps: "10–12", tempo: "2-0-1-1", rir: 2, why: "Más enfoque en hombros posteriores." },
  ],
  d4m3: [
    { id: "d4m3_db", kind: "imp", name: "Swing con mancuerna", eq: ["db"], reps: "15", tempo: "Explosivo", rir: 2, why: "Con mancuerna a dos manos." },
    { id: "d4m3_bridge", kind: "imp", name: "Puente de glúteo con balón entre rodillas", eq: ["mb"], reps: "15", tempo: "2-1-1-0", rir: 2, why: "Extensión de cadera controlada." },
  ],
  d4m4: [
    { id: "d4m4_pu", kind: "eq", name: "Flexiones con pausa de 2 s", eq: ["bw"], reps: "10–15", tempo: "2-2-1-0", rir: 2, why: "Mismo empuje en el piso." },
    { id: "d4m4_dips", kind: "eq", name: "Fondos en paralelas", eq: ["dips"], reps: "6–8", tempo: "2-1-1-0", rir: 2, why: "Empuje más demandante." },
  ],
  d4m5: [
    { id: "d4m5_wheel", kind: "eq", name: "Rueda abdominal", eq: ["wheel"], reps: "8–12", tempo: "3-1-1-0", rir: 2, why: "Antiextensión rápida en el piso." },
    { id: "d4m5_pike", kind: "imp", name: "Pike o rodillas al pecho en correas", eq: ["trx"], reps: "10–12", tempo: "2-1-1-0", rir: 2, why: "Aprovecha las correas que ya estás usando." },
  ],
  lowa: [
    { id: "scap", kind: "eq", name: "Retracciones escapulares colgado", eq: ["ladder"], reps: "8–10", tempo: "Lento", rir: 4, why: "Mismo despertar de hombros, con movimiento." },
    { id: "farmerhold", kind: "imp", name: "Farmer hold estático (2 KB)", eq: ["kb"], reps: "30 s", tempo: "Isométrico", rir: 4, why: "Agarre y postura sin colgarte." },
  ],
  lowb: [
    { id: "neglow", kind: "eq", name: "Dominadas negativas", eq: ["ladder"], reps: "2–3", tempo: "4-0-X-0", rir: 4, why: "Tracción vertical aún más suave." },
    { id: "trxrowlow", kind: "imp", name: "Remo invertido suave en correas", eq: ["trx"], reps: "10", tempo: "2-0-1-1", rir: 4, why: "Tracción amable regulando el ángulo." },
    { id: "dbrowlow", kind: "imp", name: "Remo unilateral con mancuerna", eq: ["db"], reps: "8 / lado", tempo: "2-0-1-0", rir: 4, why: "Tracción con carga ligera." },
  ],
  lowc: [
    { id: "trxpresslow", kind: "imp", name: "Press de pecho suave en correas", eq: ["trx"], reps: "10–12", tempo: "2-1-1-0", rir: 3, why: "Empuje fácil de graduar dando un paso atrás." },
    { id: "inclow", kind: "eq", name: "Flexiones inclinadas en peldaño", eq: ["ladder", "bw"], reps: "10–12", tempo: "2-0-1-0", rir: 3, why: "Mismo empuje, más fácil." },
    { id: "dbfloorlow", kind: "imp", name: "Press de suelo con mancuernas", eq: ["db"], reps: "10–12", tempo: "2-0-1-0", rir: 3, why: "Empuje acostado, sin cargar muñecas." },
  ],
  lowd: [
    { id: "kbgoblet", kind: "imp", name: "Sentadilla goblet con KB", eq: ["kb"], reps: "10", tempo: "3-1-1-0", rir: 3, why: "Mismo ejercicio con la KB." },
    { id: "boxlow", kind: "eq", name: "Sentadilla a caja con balón", eq: ["mb"], reps: "10", tempo: "3-1-1-0", rir: 3, why: "Profundidad controlada para días de rodilla sensible." },
  ],
  lowe: [
    { id: "dbrdllow", kind: "imp", name: "RDL con mancuernas", eq: ["db"], reps: "12", tempo: "2-0-1-0", rir: 3, why: "Misma bisagra de cadera sin el impulso." },
    { id: "dbswing", kind: "imp", name: "Swing con mancuerna", eq: ["db"], reps: "15", tempo: "Explosivo", rir: 3, why: "Mismo swing con la mancuerna a dos manos." },
    { id: "bridgemb", kind: "eq", name: "Puente de glúteo con balón entre las rodillas", eq: ["mb"], reps: "15", tempo: "2-1-1-0", rir: 3, why: "Extensión de cadera sin carga en la espalda." },
  ],
  lowt1: [
    { id: "lowt1_scap", kind: "eq", name: "Retracciones escapulares colgado", eq: ["ladder"], reps: "8–10", tempo: "Lento", rir: 4, why: "Aún más suave para días muy cargados." },
    { id: "lowt1_neg", kind: "eq", name: "Dominadas negativas suaves", eq: ["ladder"], reps: "2–3", tempo: "4-0-X-0", rir: 3, why: "Solo bajada controlada." },
  ],
  lowt2: [
    { id: "lowt2_inc", kind: "eq", name: "Flexiones inclinadas en peldaño", eq: ["ladder", "bw"], reps: "10–12", tempo: "2-0-1-0", rir: 3, why: "Empuje ligero sin correas." },
    { id: "lowt2_floor", kind: "imp", name: "Press de suelo con mancuernas", eq: ["db"], reps: "10–12", tempo: "2-0-1-0", rir: 3, why: "Alternativa acostado." },
  ],
  lowt3: [
    { id: "lowt3_db", kind: "imp", name: "Remo unilateral con mancuerna", eq: ["db"], reps: "10 / lado", tempo: "2-0-1-1", rir: 3, why: "Tracción horizontal con mancuerna." },
    { id: "lowt3_kb", kind: "imp", name: "Remo inclinado con 2 KB", eq: ["kb"], reps: "10–12", tempo: "2-0-1-1", rir: 3, why: "Agarre neutro suave." },
  ],
  lowt4: [
    { id: "lowt4_halo", kind: "imp", name: "Halos lentos con KB", eq: ["kb"], reps: "6 / lado", tempo: "Lento", rir: 4, why: "Movilidad y salud de hombro sin fatiga." },
    { id: "lowt4_tfly", kind: "eq", name: "Aperturas en T en correas", eq: ["trx"], reps: "10–12", tempo: "2-0-1-1", rir: 3, why: "Postura de espalda alta." },
  ],
  lowt5: [
    { id: "lowt5_deadbug", kind: "imp", name: "Dead bug con balón medicinal", eq: ["mb"], reps: "8 / lado", tempo: "Lento", rir: 3, why: "Core suave boca arriba." },
    { id: "lowt5_wheel", kind: "eq", name: "Rueda abdominal (rango corto)", eq: ["wheel"], reps: "8", tempo: "2-1-1-0", rir: 3, why: "Activación corta en el piso." },
  ],
};

export const EXERCISE_LIBRARY = [
  // Tracción vertical (pull_v)
  { id: "lib_pullup_prona", pattern: "pull_v", muscles: { lats: 1, biceps: 0.6, upperBack: 0.5 }, kind: "eq", name: "Dominadas pronas", eq: ["ladder"], reps: "4–6", tempo: "3-1-1-0", rir: 2, why: "Tracción vertical clásica para dorsal ancho." },
  { id: "lib_chinup", pattern: "pull_v", muscles: { lats: 1, biceps: 0.8, upperBack: 0.5 }, kind: "eq", name: "Dominadas supinas", eq: ["ladder"], reps: "5–7", tempo: "3-1-1-0", rir: 2, why: "Mismo dorsal con mayor aporte de bíceps." },
  { id: "lib_pullup_neg", pattern: "pull_v", muscles: { lats: 1, biceps: 0.6, upperBack: 0.5 }, kind: "eq", name: "Dominadas negativas lentas", eq: ["ladder"], reps: "4–5", tempo: "5-0-X-0", rir: 2, why: "Sobrecarga excéntrica de 5 s sin añadir peso." },
  { id: "lib_pullup_assist", pattern: "pull_v", muscles: { lats: 1, biceps: 0.6, upperBack: 0.5 }, kind: "eq", name: "Dominadas asistidas con pies en peldaño", eq: ["ladder"], reps: "6–8", tempo: "3-0-1-0", rir: 2, why: "Rango completo descargando peso con los pies." },

  // Remo y espalda alta (pull_h)
  { id: "lib_trx_row", pattern: "pull_h", muscles: { upperBack: 1, lats: 0.6, biceps: 0.5, core: 0.3 }, kind: "imp", name: "Remo invertido en correas", eq: ["trx"], reps: "10–14", tempo: "2-0-1-2", rir: 2, why: "Espalda media y dorsal regulando el ángulo con los pies." },
  { id: "lib_trx_yfly", pattern: "pull_h", muscles: { upperBack: 1, shoulders: 0.7 }, kind: "imp", name: "Aperturas en Y en correas", eq: ["trx"], reps: "10–12", tempo: "2-1-1-1", rir: 2, why: "Trapecio inferior, deltoide posterior y salud de hombro." },
  { id: "lib_trx_facepull", pattern: "pull_h", muscles: { upperBack: 1, shoulders: 0.7, biceps: 0.2 }, kind: "imp", name: "Face pull en correas", eq: ["trx"], reps: "10–15", tempo: "2-1-1-1", rir: 2, why: "Rotación externa de hombro y postura de espalda alta." },
  { id: "lib_bar_row", pattern: "pull_h", muscles: { upperBack: 1, lats: 0.7, biceps: 0.5, core: 0.3 }, kind: "eq", name: "Remo inclinado con barra", eq: ["bar"], reps: "8–10", tempo: "2-0-1-2", rir: 2, why: "Remo pesado con pausa de 2 s arriba." },
  { id: "lib_pendlay_row", pattern: "pull_h", muscles: { upperBack: 1, lats: 0.7, biceps: 0.5, hamstrings: 0.3, core: 0.3 }, kind: "eq", name: "Remo Pendlay con barra", eq: ["bar"], reps: "6–8", tempo: "1-0-X-1", rir: 2, why: "Desde el piso en cada rep: potencia de espalda media." },
  { id: "lib_db_row_1", pattern: "pull_h", muscles: { lats: 1, upperBack: 0.8, biceps: 0.5, core: 0.3 }, kind: "imp", name: "Remo unilateral con mancuerna", eq: ["db"], reps: "10–12 / lado", tempo: "3-1-1-1", rir: 1, why: "Trabajo unilateral que evita compensaciones." },

  // Empuje horizontal (push_h)
  { id: "lib_dips", pattern: "push_h", muscles: { chest: 1, triceps: 0.7, shoulders: 0.5 }, kind: "eq", name: "Fondos en paralelas", eq: ["dips"], reps: "6–8", tempo: "3-1-1-0", rir: 2, why: "Empuje profundo para pecho bajo y tríceps." },
  { id: "lib_trx_press", pattern: "push_h", muscles: { chest: 1, triceps: 0.5, shoulders: 0.5, core: 0.3 }, kind: "imp", name: "Press de pecho en correas", eq: ["trx"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Pecho y core en plancha sin cambiar de estación." },
  { id: "lib_trx_fly", pattern: "push_h", muscles: { chest: 1, shoulders: 0.4, core: 0.3 }, kind: "imp", name: "Aperturas de pecho en correas", eq: ["trx"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Aislamiento de pectoral con control escapular." },
  { id: "lib_board_incline", pattern: "push_h", muscles: { chest: 1, shoulders: 0.6, triceps: 0.5 }, kind: "imp", name: "Press inclinado en tabla con mancuernas", eq: ["board", "db"], reps: "10–12", tempo: "3-1-1-0", rir: 2, why: "Pecho superior apoyando la tabla en un peldaño bajo." },
  { id: "lib_bar_floor", pattern: "push_h", muscles: { chest: 1, triceps: 0.7, shoulders: 0.4 }, kind: "imp", name: "Press de suelo con barra", eq: ["bar"], reps: "8–10", tempo: "3-1-1-0", rir: 2, why: "Empuje con barra de 40 kg protegiendo el hombro." },
  { id: "lib_pu_deficit", pattern: "push_h", muscles: { chest: 1, triceps: 0.5, shoulders: 0.5, core: 0.3 }, kind: "eq", name: "Flexiones con déficit (manos sobre discos)", eq: ["bw", "bar"], reps: "10–15", tempo: "3-1-1-0", rir: 1, why: "Recorrido extra en pecho y hombros." },

  // Empuje vertical (push_v)
  { id: "lib_db_ohp_1", pattern: "push_v", muscles: { shoulders: 1, triceps: 0.5, core: 0.4 }, kind: "eq", name: "Press de hombro unilateral con mancuerna", eq: ["db"], reps: "8–10 / lado", tempo: "3-0-1-0", rir: 2, why: "Empuje vertical con antirotación de core." },
  { id: "lib_kb_ohp_1", pattern: "push_v", muscles: { shoulders: 1, triceps: 0.5, core: 0.4 }, kind: "imp", name: "Press de hombro unilateral con KB", eq: ["kb"], reps: "10–12 / lado", tempo: "3-0-1-0", rir: 2, why: "La KB exige más control y estabilidad de muñeca y hombro." },
  { id: "lib_bar_ohp", pattern: "push_v", muscles: { shoulders: 1, triceps: 0.6, core: 0.4, upperBack: 0.2 }, kind: "imp", name: "Press militar con barra", eq: ["bar"], reps: "6–8", tempo: "3-0-1-0", rir: 2, why: "Empuje vertical bilateral con carga ajustable." },
  { id: "lib_pike_pu", pattern: "push_v", muscles: { shoulders: 1, triceps: 0.6, chest: 0.3, core: 0.3 }, kind: "eq", name: "Flexiones pike (pies en peldaño)", eq: ["ladder", "bw"], reps: "6–10", tempo: "3-1-1-0", rir: 2, why: "Hombro y tríceps usando tu propio peso." },

  // Brazos (arms)
  { id: "lib_trx_triceps", pattern: "arms", muscles: { triceps: 1, core: 0.3 }, kind: "eq", name: "Extensión de tríceps en correas", eq: ["trx"], reps: "10–12", tempo: "3-0-1-0", rir: 1, why: "Tríceps con fuerte activación de core." },
  { id: "lib_trx_curl", pattern: "arms", muscles: { biceps: 1, upperBack: 0.2 }, kind: "eq", name: "Curl de bíceps en correas", eq: ["trx"], reps: "10–14", tempo: "2-0-1-1", rir: 1, why: "Bíceps sin soltar la espalda neutra." },
  { id: "lib_db_hammer", pattern: "arms", muscles: { biceps: 1 }, kind: "imp", name: "Curl martillo con mancuernas", eq: ["db"], reps: "10–12", tempo: "3-0-1-1", rir: 1, why: "Agarre neutro para bíceps y antebrazos." },
  { id: "lib_db_skull", pattern: "arms", muscles: { triceps: 1 }, kind: "imp", name: "Press francés con mancuernas en tabla", eq: ["db", "board"], reps: "10–12", tempo: "3-1-1-0", rir: 1, why: "Aislamiento de tríceps aprovechando la tabla." },

  // Sentadilla y rodilla (squat)
  { id: "lib_bar_front_sq", pattern: "squat", muscles: { quads: 1, glutes: 0.6, core: 0.5, upperBack: 0.3 }, kind: "eq", name: "Sentadilla frontal con barra", eq: ["bar"], reps: "5–8", tempo: "3-1-1-0", rir: 2, why: "Más cuádriceps y torso vertical que la trasera." },
  { id: "lib_kb_goblet", pattern: "squat", muscles: { quads: 1, glutes: 0.6, core: 0.3 }, kind: "imp", name: "Sentadilla goblet con KB", eq: ["kb"], reps: "10–12", tempo: "3-2-1-0", rir: 2, why: "Excelente para abrir caderas y cuidar la rodilla." },
  { id: "lib_bulgarian", pattern: "squat", muscles: { quads: 1, glutes: 0.8, hamstrings: 0.3 }, kind: "eq", name: "Sentadilla búlgara en peldaño", eq: ["ladder", "db"], reps: "8–10 / pierna", tempo: "3-1-1-0", rir: 2, why: "Unilateral muy estable para rodilla y glúteo." },
  { id: "lib_rev_lunge_db", pattern: "squat", muscles: { quads: 1, glutes: 0.8, hamstrings: 0.3 }, kind: "imp", name: "Zancadas inversas con mancuernas", eq: ["db"], reps: "8–10 / pierna", tempo: "2-1-1-0", rir: 2, why: "Ir hacia atrás reduce la presión rotuliana." },
  { id: "lib_cossack", pattern: "squat", muscles: { quads: 1, glutes: 0.7, hamstrings: 0.4 }, kind: "eq", name: "Sentadilla cosaca con KB", eq: ["kb"], reps: "6–8 / lado", tempo: "3-1-1-0", rir: 2, why: "Movilidad de cadera y tobillo en plano lateral." },
  { id: "lib_wallsit", pattern: "squat", muscles: { quads: 1, glutes: 0.4 }, kind: "imp", name: "Isométrico contra la pared (wall sit)", eq: ["bw"], reps: "35–45 s", tempo: "Isométrico", rir: 2, why: "Fortalece tendón rotuliano con cero impacto." },
  { id: "lib_stepup", pattern: "squat", muscles: { quads: 1, glutes: 0.8, calves: 0.3 }, kind: "imp", name: "Step-up lento al peldaño con KB", eq: ["ladder", "kb"], reps: "8 / pierna", tempo: "3-1-1-0", rir: 2, why: "Control fino de rodilla y tobillo al subir." },

  // Bisagra y cadera (hinge)
  { id: "lib_bar_rdl", pattern: "hinge", muscles: { hamstrings: 1, glutes: 0.9, upperBack: 0.3, core: 0.3 }, kind: "eq", name: "Peso muerto rumano con barra", eq: ["bar"], reps: "8–10", tempo: "3-1-1-0", rir: 2, why: "Cadena posterior pesada y controlada." },
  { id: "lib_sl_rdl", pattern: "hinge", muscles: { hamstrings: 1, glutes: 0.9, calves: 0.3, core: 0.3 }, kind: "eq", name: "RDL a una pierna con KB", eq: ["kb"], reps: "8–10 / pierna", tempo: "3-1-1-0", rir: 2, why: "Isquio, glúteo y propiocepción de tobillo." },
  { id: "lib_kb_swing", pattern: "hinge", muscles: { glutes: 1, hamstrings: 0.8, core: 0.3, upperBack: 0.2 }, kind: "imp", name: "Swings con KB", eq: ["kb"], reps: "15", tempo: "Explosivo", rir: 2, why: "Potencia de cadera y pulso sin saltar." },
  { id: "lib_hip_thrust", pattern: "hinge", muscles: { glutes: 1, hamstrings: 0.5, core: 0.2 }, kind: "imp", name: "Hip thrust con barra", eq: ["bar"], reps: "10–12", tempo: "2-2-1-0", rir: 2, why: "Máxima activación de glúteo en el sitio." },
  { id: "lib_glute_bridge_1", pattern: "hinge", muscles: { glutes: 1, hamstrings: 0.5, core: 0.2 }, kind: "imp", name: "Puente de glúteo a una pierna", eq: ["bw"], reps: "10–12 / pierna", tempo: "2-1-1-0", rir: 2, why: "Estabilidad de cadera sin cargar la espalda." },

  // Potencia y complejos (full)
  { id: "lib_bar_thruster", pattern: "full", muscles: { quads: 1, shoulders: 1, glutes: 0.6, triceps: 0.5, core: 0.4 }, kind: "eq", name: "Thruster con barra", eq: ["bar"], reps: "6–8", tempo: "2-0-X-0", rir: 2, why: "Sentadilla frontal + empuje vertical explosivo." },
  { id: "lib_kb_thruster", pattern: "full", muscles: { quads: 1, shoulders: 1, glutes: 0.6, triceps: 0.5, core: 0.4 }, kind: "imp", name: "Thruster con 2 KB", eq: ["kb"], reps: "8–10", tempo: "2-0-X-0", rir: 2, why: "Más libre para hombros y muñecas." },
  { id: "lib_kb_complex", pattern: "full", muscles: { glutes: 0.8, quads: 0.7, shoulders: 0.7, hamstrings: 0.5, upperBack: 0.5, core: 0.5, triceps: 0.3 }, kind: "eq", name: "Complejo KB doble: 5 swing + 5 clean + 5 sentadilla + 5 press", eq: ["kb"], reps: "1 ronda (20 reps)", tempo: "Fluido", rir: 2, why: "Flujo completo de cuerpo entero." },
  { id: "lib_bar_complex", pattern: "full", muscles: { quads: 0.8, glutes: 0.8, hamstrings: 0.7, upperBack: 0.7, shoulders: 0.7, lats: 0.4, core: 0.5, triceps: 0.3 }, kind: "imp", name: "Complejo con barra: 6 RDL + 6 remo + 6 sentadilla + 6 push press", eq: ["bar"], reps: "1 ronda (24 reps)", tempo: "Fluido", rir: 2, why: "Cadena posterior, tracción y pierna sin soltar la barra." },

  // Core y abdomen (core)
  { id: "lib_trx_fallout", pattern: "core", muscles: { core: 1, lats: 0.3, shoulders: 0.3 }, kind: "eq", name: "Fallout abdominal en correas", eq: ["trx"], reps: "8–12", tempo: "3-1-1-0", rir: 2, why: "Antiextensión intensa graduando la posición de los pies." },
  { id: "lib_ab_wheel", pattern: "core", muscles: { core: 1, lats: 0.3, shoulders: 0.3 }, kind: "eq", name: "Rueda abdominal", eq: ["wheel"], reps: "8–12", tempo: "3-1-1-0", rir: 2, why: "Control total de abdomen y dorsal en el suelo." },
  { id: "lib_trx_pike", pattern: "core", muscles: { core: 1, shoulders: 0.4, quads: 0.2 }, kind: "imp", name: "Pike o rodillas al pecho en correas", eq: ["trx"], reps: "10–12", tempo: "2-1-2-0", rir: 2, why: "Flexión de cadera con estabilidad de hombros." },
  { id: "lib_board_crunch", pattern: "core", muscles: { core: 1 }, kind: "imp", name: "Abdominales en tabla inclinada", eq: ["board"], reps: "10–15", tempo: "2-1-2-0", rir: 2, why: "Flexión de tronco con bajada excéntrica lenta." },
  { id: "lib_dips_lsit", pattern: "core", muscles: { core: 1, quads: 0.3, triceps: 0.3 }, kind: "eq", name: "L-sit en paralelas (o tuck)", eq: ["dips"], reps: "10–20 s", tempo: "Isométrico", rir: 2, why: "Isométrico de abdomen y flexores de cadera." },
  { id: "lib_hanging_leg", pattern: "core", muscles: { core: 1, lats: 0.2 }, kind: "eq", name: "Elevaciones de piernas colgado", eq: ["ladder"], reps: "8–12", tempo: "2-1-2-0", rir: 2, why: "Abdomen colgado con retroversión pélvica." },
  { id: "lib_hollow", pattern: "core", muscles: { core: 1 }, kind: "eq", name: "Hollow hold en el piso", eq: ["bw"], reps: "20–30 s", tempo: "Isométrico", rir: 2, why: "Tensión lumbar-abdominal sin ningún equipo." },

  // Cardio y tobillos (run)
  { id: "lib_bike_int", pattern: "run", muscles: { quads: 0.8, calves: 0.4, glutes: 0.4 }, kind: "imp", name: "Bici estática: 3 min fuerte + 1 min suave", eq: ["bike"], reps: "3 min fuertes", tempo: "Cadencia alta", rir: 3, why: "Intervalos aeróbicos con cero impacto en rodilla y tobillo." },
  { id: "lib_power_walk", pattern: "run", muscles: { calves: 0.5, glutes: 0.4, quads: 0.3 }, kind: "eq", name: "Caminata rápida continua", eq: ["run"], reps: "4 min", tempo: "Ritmo fuerte", rir: 3, why: "Trabajo aeróbico suave para días sensibles." },
  { id: "lib_kb_cardio", pattern: "run", muscles: { glutes: 0.7, hamstrings: 0.5, calves: 0.4, core: 0.3 }, kind: "imp", name: "Circuito sin impacto: swing 30 s + marcha 30 s", eq: ["kb"], reps: "3 min", tempo: "Continuo", rir: 3, why: "Cardio en casa sin despegar los pies." },
];

export const altFor = (exId, altId) => {
  if (!altId) return null;
  const fromSubs = (SUBS[exId] || []).find((a) => a.id === altId);
  if (fromSubs) return fromSubs;
  return EXERCISE_LIBRARY.find((a) => a.id === altId) || null;
};
