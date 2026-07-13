import mongoose from "mongoose";

// Configuración de facturación electrónica (ARCA) por usuario y por perfil
// (workspace). Cada perfil tiene su propia identidad fiscal y su propio
// on/off. La API key del proveedor (AfipSDK) NO vive acá: es a nivel app
// (variable de entorno del backend). Acá solo guardamos los datos del emisor.
const fiscalConfigSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspace: {
      type: String,
      default: "personal",
      trim: true,
    },
    // Facturación activada para este perfil
    activo: {
      type: Boolean,
      default: false,
    },
    cuit: {
      type: String,
      default: "",
      trim: true,
    },
    razonSocial: {
      type: String,
      default: "",
      trim: true,
    },
    condicionIVA: {
      type: String,
      enum: ["monotributo", "responsable_inscripto", "exento"],
      default: "monotributo",
    },
    puntoVenta: {
      type: Number,
      default: 1,
      min: 1,
    },
    // Cómo se emiten las facturas de este perfil
    modo: {
      type: String,
      enum: ["manual", "automatico"],
      default: "manual",
    },
    // Estado de la delegación del web service en ARCA (el paso único que
    // hace el usuario con su Clave Fiscal). Se marca cuando quedó autorizado.
    arcaAutorizado: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Una sola config por usuario + perfil
fiscalConfigSchema.index({ usuario: 1, workspace: 1 }, { unique: true });

export default mongoose.model("FiscalConfig", fiscalConfigSchema);
