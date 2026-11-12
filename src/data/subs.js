// kind "eq": equivalente biomecánico (mismos músculos). kind "imp": mismo patrón con otro implemento.
// reps, tempo y RIR reemplazan a los del ejercicio original; las series se mantienen.
export const SUB_KIND = { eq: "Equivalente biomecánico", imp: "Mismo patrón, otro implemento" };

export const SUBS = {
  d1a1: [
    { id: "chin", kind: "eq", name: "Dominadas supinas", eq: ["ladder"], reps: "5–7", tempo: "3-1-1-0", rir: 2, why: "Mismo dorsal con más bíceps; suelen salir 1–2 reps más." },
    { id: "neg", kind: "eq", name: "Dominadas negativas lentas", eq: ["ladder"], reps: "4–5", tempo: "5-0-X-0", rir: 2, why: "Si hoy no salen completas: solo la bajada de 5 s." },
    { id: "dbrow", kind: "imp", name: "Remo unilateral con mancuerna", eq: ["db"], reps: "10–12 / lado", tempo: "3-1-1-1", rir: 1, why: "Tracción con carga externa; más reps porque 10 kg pesan menos que tu cuerpo." },
  ],
  d1a2: [
    { id: "deficit", kind: "eq", name: "Flexiones con déficit", eq: ["bw", "bar"], reps: "10–15", tempo: "3-1-1-0", rir: 2, why: "Pecho y tríceps con más recorrido, sin cargar el hombro arriba." },
    { id: "diamond", kind: "eq", name: "Flexiones diamante", eq: ["bw"], reps: "8–12", tempo: "2-1-1-0", rir: 2, why: "Más tríceps, como el fondo." },
    { id: "floorpress", kind: "imp", name: "Press de suelo con barra", eq: ["bar"], reps: "8–10", tempo: "3-1-1-0", rir: 2, why: "Mismo empuje con barra; el suelo limita el rango si el hombro molesta." },
  ],
  d1b1: [
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
    { id: "pausepu", kind: "eq", name: "Flexiones con pausa de 2 s", eq: ["bw"], reps: "12–20", tempo: "3-2-1-0", rir: 1, why: "Sin discos: la pausa compensa el menor recorrido." },
    { id: "dbfloor", kind: "imp", name: "Press de suelo con mancuernas", eq: ["db"], reps: "12–15", tempo: "3-1-1-0", rir: 1, why: "Mismo pecho y tríceps con carga externa." },
    { id: "mbpu", kind: "imp", name: "Flexiones con una mano sobre el balón", eq: ["mb"], reps: "6–8 / lado", tempo: "2-1-1-0", rir: 2, why: "Recorrido extra en un lado y más estabilidad." },
  ],
  d1c2: [
    { id: "knees", kind: "eq", name: "Rodillas al pecho colgado", eq: ["ladder"], reps: "10–15", tempo: "2-1-2-0", rir: 2, why: "Mismo abdomen con palanca corta." },
    { id: "lyinglr", kind: "eq", name: "Elevaciones de piernas acostado", eq: ["ladder", "bw"], reps: "12–15", tempo: "2-1-3-0", rir: 1, why: "Manos en un peldaño; sin fatiga de agarre." },
    { id: "deadbugmb", kind: "imp", name: "Dead bug con balón medicinal", eq: ["mb"], reps: "8 / lado", tempo: "Lento", rir: 2, why: "Antiextensión del core sostenido el balón con brazos y rodillas." },
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
    { id: "swing", kind: "imp", name: "Swing con KB", eq: ["kb"], reps: "15", tempo: "Explosivo", rir: 2, why: "Potencia de cadera sin aterrizajes." },
    { id: "mbthrow", kind: "imp", name: "Lanzamiento de balón desde sentadilla", eq: ["mb"], reps: "8", tempo: "Explosivo", rir: 2, why: "Extensión explosiva de cadera y rodilla; no saltas, lanzas." },
  ],
  d2d: [
    { id: "slrdl", kind: "eq", name: "RDL a una pierna con KB", eq: ["kb"], reps: "8 / pierna", tempo: "3-1-1-0", rir: 2, why: "Isquio y glúteo con trabajo extra de tobillo." },
    { id: "goodmorning", kind: "eq", name: "Good morning con barra", eq: ["bar"], reps: "10–12", tempo: "3-1-1-0", rir: 3, why: "Misma bisagra con la barra en la espalda; carga moderada." },
    { id: "dbrdl", kind: "imp", name: "RDL con mancuernas", eq: ["db"], reps: "12–15", tempo: "3-1-1-0", rir: 1, why: "Mismo patrón con 2 × 10 kg y más reps." },
  ],
  d2e: [
    { id: "suitcase", kind: "eq", name: "Suitcase carry (1 KB)", eq: ["kb"], reps: "30 s / lado", tempo: "Marcha", rir: 2, why: "Carga en una mano: el core resiste la inclinación." },
    { id: "rackcarry", kind: "eq", name: "Front rack carry (2 KB)", eq: ["kb"], reps: "30 s", tempo: "Marcha", rir: 2, why: "Mismo paseo con las KB en el pecho: más core, menos agarre." },
    { id: "dbfarmer", kind: "imp", name: "Farmer's walk con 2 mancuernas", eq: ["db"], reps: "30 s", tempo: "Marcha", rir: 2, why: "10 kg por mano: un poco más de carga." },
  ],
  d2f1: [
    { id: "kneeschest", kind: "eq", name: "Rodillas al pecho colgado", eq: ["ladder"], reps: "10–12", tempo: "Controlado", rir: 2, why: "Mismo abdomen colgado con palanca corta." },
    { id: "vupmb", kind: "imp", name: "V-ups con balón medicinal", eq: ["mb"], reps: "10–12", tempo: "2-0-1-0", rir: 2, why: "Flexión de cadera y tronco en el piso, pasando el balón de manos a pies." },
  ],
  d2f2: [
    { id: "revcrunch", kind: "eq", name: "Crunch invertido en el piso", eq: ["bw"], reps: "12–15", tempo: "2-1-2-0", rir: 1, why: "Retroversión pélvica sin colgar." },
    { id: "lrmb", kind: "imp", name: "Elevaciones de piernas con balón entre los pies", eq: ["mb"], reps: "10–12", tempo: "2-1-3-0", rir: 1, why: "Más palanca con el mismo gesto." },
    { id: "deadbugkb", kind: "imp", name: "Dead bug con KB (brazos estirados)", eq: ["kb"], reps: "8 / lado", tempo: "Lento", rir: 2, why: "Antiextensión con carga arriba." },
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
    { id: "dbrowslow", kind: "imp", name: "Remo unilateral con mancuerna, bajada de 4 s", eq: ["db"], reps: "10 / lado", tempo: "4-0-1-1", rir: 2, why: "Mismo énfasis excéntrico en horizontal." },
  ],
  d4c2: [
    { id: "halftgu", kind: "eq", name: "Medio get-up (hasta la mano)", eq: ["kb"], reps: "3 / lado", tempo: "Lento", rir: 3, why: "La parte más técnica, repetida." },
    { id: "windmill", kind: "eq", name: "Windmill con KB", eq: ["kb"], reps: "5 / lado", tempo: "Lento", rir: 3, why: "Hombro estable arriba y bisagra lateral." },
    { id: "dbtgu", kind: "imp", name: "Turkish get-up con mancuerna", eq: ["db"], reps: "1 / lado", tempo: "Lento", rir: 3, why: "Mismo movimiento con otra carga." },
  ],
  d4d1: [
    { id: "tuck", kind: "eq", name: "Tuck hold en espaldera", eq: ["ladder"], reps: "15–25 s", tempo: "Isométrico", rir: 2, why: "La versión con rodillas recogidas del L-sit." },
    { id: "hollow", kind: "eq", name: "Hollow hold en el piso", eq: ["bw"], reps: "20–30 s", tempo: "Isométrico", rir: 2, why: "Misma tensión abdominal sin cargar las muñecas." },
    { id: "mbplank", kind: "imp", name: "Plancha con antebrazos sobre el balón", eq: ["mb"], reps: "20–30 s", tempo: "Isométrico", rir: 2, why: "Base inestable: el core trabaja más." },
  ],
  d4d2: [
    { id: "suitcase4", kind: "eq", name: "Suitcase carry (1 KB)", eq: ["kb"], reps: "40 s / lado", tempo: "Marcha", rir: 2, why: "Carga a un solo lado: misma antiinclinación." },
    { id: "rackmarch", kind: "eq", name: "Marcha con KB en rack unilateral", eq: ["kb"], reps: "40 s / lado", tempo: "Marcha", rir: 2, why: "La carga en el pecho exige más estabilidad." },
    { id: "ohcarry", kind: "imp", name: "Marcha con mancuerna sobre la cabeza", eq: ["db"], reps: "30 s / lado", tempo: "Marcha", rir: 2, why: "Core y hombro estables con el brazo arriba." },
  ],
  lowa: [
    { id: "scap", kind: "eq", name: "Retracciones escapulares colgado", eq: ["ladder"], reps: "8–10", tempo: "Lento", rir: 4, why: "Mismo despertar de hombros, con movimiento." },
    { id: "farmerhold", kind: "imp", name: "Farmer hold estático (2 KB)", eq: ["kb"], reps: "30 s", tempo: "Isométrico", rir: 4, why: "Agarre y postura sin colgarte." },
  ],
  lowb: [
    { id: "neglow", kind: "eq", name: "Dominadas negativas", eq: ["ladder"], reps: "2–3", tempo: "4-0-X-0", rir: 4, why: "Tracción vertical aún más suave." },
    { id: "dbrowlow", kind: "imp", name: "Remo unilateral con mancuerna", eq: ["db"], reps: "8 / lado", tempo: "2-0-1-0", rir: 4, why: "Tracción con carga ligera." },
  ],
  lowc: [
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
};

export const altFor = (exId, altId) => (altId ? (SUBS[exId] || []).find((a) => a.id === altId) || null : null);
