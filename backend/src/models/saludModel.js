import mongoose from "mongoose";

// Datos de Salud. Personales (no separan por workspace): un documento por usuario.
// La app es la fuente principal (sensores del teléfono); la web puede leer todo
// y cargar lo manual (agua, ánimo, peso, comidas).
//
// Las secciones "por día" son objetos { "YYYY-MM-DD": valor } y se mergean por
// clave en el PUT, así el teléfono y la web pueden empujar días distintos sin
// pisarse el histórico.
const saludSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    // día → pasos (número). Solo lo escribe el teléfono (podómetro).
    pasos: { type: mongoose.Schema.Types.Mixed, default: {} },
    // día → pasos cargados a mano (se SUMAN a los del sensor). Ej: caminaste sin el teléfono.
    pasosManual: { type: mongoose.Schema.Types.Mixed, default: {} },
    // día → ml de agua.
    agua: { type: mongoose.Schema.Types.Mixed, default: {} },
    // día → ánimo (1 a 5).
    animo: { type: mongoose.Schema.Types.Mixed, default: {} },
    // día → peso (kg).
    peso: { type: mongoose.Schema.Types.Mixed, default: {} },
    // día → [{ id, franja, nombre, kcal, carbG, protG, fatG }]
    comidas: { type: mongoose.Schema.Types.Mixed, default: {} },
    // [{ fecha, metros, secs }] — solo del teléfono (GPS).
    caminatas: { type: [{ _id: false, fecha: String, metros: Number, secs: Number }], default: [] },
    // Plan nutricional: { peso, altura, edad, sexo, actividad, objetivo }
    nutri: { type: mongoose.Schema.Types.Mixed, default: null },
    // Metas: { pasos, agua }
    metas: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, minimize: false }
);

const Salud = mongoose.model("Salud", saludSchema);

export default Salud;
