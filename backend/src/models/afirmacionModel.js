import mongoose from "mongoose";

// Afirmaciones diarias.
// A diferencia del resto de los modelos, este NO se separa por workspace: las
// afirmaciones son personales, valen igual en el perfil personal o de negocio.
// Un único documento por usuario.
const afirmacionSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    // Los renglones, en orden. Pueden venir vacíos (renglón en blanco).
    lineas: {
      type: [String],
      default: ["", "", "", "", ""],
    },
    // Si está en true las afirmaciones se mantienen día a día (por defecto).
    // En false cada día arranca vacío.
    repetirDiario: {
      type: Boolean,
      default: true,
    },
    // Día (local) al que pertenecen los renglones actuales. Sirve para saber,
    // cuando repetirDiario está en false, si lo que hay es de un día pasado.
    fechaLineas: {
      type: String,
      default: "",
    },
    // Cuando cada día arranca vacío, lo del día anterior no se tira: se archiva
    // acá para poder recuperarlo. Guardamos las últimas 60 tandas.
    archivo: {
      type: [
        {
          _id: false,
          fecha: String,
          lineas: [String],
        },
      ],
      default: [],
    },
    // Fechas locales "YYYY-MM-DD" en las que se marcó la lectura.
    // Es el único historial que guardamos: alcanza para la racha y no acumula texto.
    lecturas: {
      type: [String],
      default: [],
    },
    // Recordatorio push (Fase 3). Se deja el campo listo.
    recordatorio: {
      activo: { type: Boolean, default: false },
      hora: { type: String, default: "08:00" },
    },
  },
  { timestamps: true }
);

const Afirmacion = mongoose.model("Afirmacion", afirmacionSchema);

export default Afirmacion;
