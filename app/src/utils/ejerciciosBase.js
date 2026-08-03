// Biblioteca de ejercicios comunes para autocompletar al armar rutinas o registrar.
// grupo se usa para agrupar/colorear. El usuario también puede agregar los suyos.
export const GRUPOS = [
  "Pecho",
  "Espalda",
  "Piernas",
  "Hombros",
  "Bíceps",
  "Tríceps",
  "Core",
  "Cardio",
  "Full body",
];

export const EJERCICIOS_BASE = [
  // Pecho
  { nombre: "Press de banca", grupo: "Pecho" },
  { nombre: "Press inclinado con mancuernas", grupo: "Pecho" },
  { nombre: "Press plano con mancuernas", grupo: "Pecho" },
  { nombre: "Aperturas", grupo: "Pecho" },
  { nombre: "Fondos", grupo: "Pecho" },
  { nombre: "Peck deck", grupo: "Pecho" },
  { nombre: "Flexiones", grupo: "Pecho" },
  // Espalda
  { nombre: "Dominadas", grupo: "Espalda" },
  { nombre: "Remo con barra", grupo: "Espalda" },
  { nombre: "Remo con mancuerna", grupo: "Espalda" },
  { nombre: "Jalón al pecho", grupo: "Espalda" },
  { nombre: "Remo en polea", grupo: "Espalda" },
  { nombre: "Peso muerto", grupo: "Espalda" },
  { nombre: "Pull over", grupo: "Espalda" },
  // Piernas
  { nombre: "Sentadilla", grupo: "Piernas" },
  { nombre: "Prensa", grupo: "Piernas" },
  { nombre: "Extensión de cuádriceps", grupo: "Piernas" },
  { nombre: "Curl femoral", grupo: "Piernas" },
  { nombre: "Zancadas", grupo: "Piernas" },
  { nombre: "Peso muerto rumano", grupo: "Piernas" },
  { nombre: "Elevación de talones", grupo: "Piernas" },
  { nombre: "Hip thrust", grupo: "Piernas" },
  { nombre: "Sentadilla búlgara", grupo: "Piernas" },
  // Hombros
  { nombre: "Press militar", grupo: "Hombros" },
  { nombre: "Press Arnold", grupo: "Hombros" },
  { nombre: "Elevaciones laterales", grupo: "Hombros" },
  { nombre: "Elevaciones frontales", grupo: "Hombros" },
  { nombre: "Pájaros", grupo: "Hombros" },
  { nombre: "Remo al mentón", grupo: "Hombros" },
  // Bíceps
  { nombre: "Curl con barra", grupo: "Bíceps" },
  { nombre: "Curl con mancuernas", grupo: "Bíceps" },
  { nombre: "Curl martillo", grupo: "Bíceps" },
  { nombre: "Curl predicador", grupo: "Bíceps" },
  { nombre: "Curl en polea", grupo: "Bíceps" },
  // Tríceps
  { nombre: "Extensión en polea", grupo: "Tríceps" },
  { nombre: "Press francés", grupo: "Tríceps" },
  { nombre: "Patada de tríceps", grupo: "Tríceps" },
  { nombre: "Fondos en banco", grupo: "Tríceps" },
  // Core
  { nombre: "Abdominales", grupo: "Core" },
  { nombre: "Plancha", grupo: "Core" },
  { nombre: "Elevación de piernas", grupo: "Core" },
  { nombre: "Rueda abdominal", grupo: "Core" },
  { nombre: "Crunch en polea", grupo: "Core" },
  // Cardio
  { nombre: "Cinta", grupo: "Cardio" },
  { nombre: "Bicicleta", grupo: "Cardio" },
  { nombre: "Elíptico", grupo: "Cardio" },
  { nombre: "Escaladora", grupo: "Cardio" },
  { nombre: "Remo (máquina)", grupo: "Cardio" },
];
