import mongoose from "mongoose";

// Aviso de "actualizá la app": un solo documento (key "default") que se edita
// desde /monitoreo. La app lo consulta al abrir (GET /api/app-version) y, si su
// versión instalada es menor a `latest`, muestra el popup. Con `obligatorio`
// el popup no se puede cerrar; sin él, tiene "Más tarde".
const appUpdateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    activo: { type: Boolean, default: true },
    // Versión que YA está publicada en las tiendas (mismo número que la store)
    latest: { type: String, default: "" },
    obligatorio: { type: Boolean, default: false },
    title: { type: String, default: "" },
    message: { type: String, default: "" },
    changes: { type: [String], default: [] },
  },
  { timestamps: true, versionKey: false }
);

const AppUpdate = mongoose.model("AppUpdate", appUpdateSchema);

export default AppUpdate;
