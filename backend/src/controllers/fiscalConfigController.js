import FiscalConfigModel from "../models/fiscalConfigModel.js";

// Mismo criterio de workspace que el resto de la API.
const normalizeWorkspaceValue = (value) => {
  const workspace = String(value || "").trim();
  return /^business(?::[a-f\d]{24})?$/i.test(workspace) ? workspace : "personal";
};

const normalizeWorkspace = (req) =>
  normalizeWorkspaceValue(
    req.query.workspace || req.body.workspace || req.headers["x-workspace"]
  );

const CONDICIONES = ["monotributo", "responsable_inscripto", "exento"];
const MODOS = ["manual", "automatico"];

// Forma por defecto para que el front siempre reciba un objeto completo.
const defaultConfig = (workspace) => ({
  workspace,
  activo: false,
  cuit: "",
  razonSocial: "",
  condicionIVA: "monotributo",
  puntoVenta: 1,
  modo: "manual",
  arcaAutorizado: false,
});

const serialize = (doc, workspace) => {
  if (!doc) return defaultConfig(workspace);
  const raw = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    workspace: raw.workspace,
    activo: Boolean(raw.activo),
    cuit: raw.cuit || "",
    razonSocial: raw.razonSocial || "",
    condicionIVA: raw.condicionIVA || "monotributo",
    puntoVenta: raw.puntoVenta || 1,
    modo: raw.modo || "manual",
    arcaAutorizado: Boolean(raw.arcaAutorizado),
  };
};

// GET /api/fiscal-config — config del perfil activo (o defaults si no existe)
export const getFiscalConfig = async (req, res) => {
  try {
    const workspace = normalizeWorkspace(req);
    const doc = await FiscalConfigModel.findOne({ usuario: req.userId, workspace });
    res.status(200).json(serialize(doc, workspace));
  } catch (error) {
    console.error("Error al obtener la config fiscal:", error);
    res.status(500).json({ error: "Error al obtener la configuración de facturación" });
  }
};

// PUT /api/fiscal-config — crea o actualiza la config del perfil activo
export const updateFiscalConfig = async (req, res) => {
  try {
    const workspace = normalizeWorkspace(req);
    const { activo, cuit, razonSocial, condicionIVA, puntoVenta, modo, arcaAutorizado } =
      req.body;

    const update = {};

    if (activo !== undefined) update.activo = Boolean(activo);

    if (cuit !== undefined) {
      const soloDigitos = String(cuit || "").replace(/\D/g, "");
      if (soloDigitos && soloDigitos.length !== 11) {
        return res.status(400).json({ error: "El CUIT debe tener 11 dígitos" });
      }
      update.cuit = soloDigitos;
    }

    if (razonSocial !== undefined) {
      update.razonSocial = String(razonSocial || "").trim().slice(0, 120);
    }

    if (condicionIVA !== undefined) {
      if (!CONDICIONES.includes(condicionIVA)) {
        return res.status(400).json({ error: "Condición de IVA inválida" });
      }
      update.condicionIVA = condicionIVA;
    }

    if (puntoVenta !== undefined) {
      const pv = Number(puntoVenta);
      if (!Number.isInteger(pv) || pv < 1) {
        return res.status(400).json({ error: "El punto de venta debe ser un número válido" });
      }
      update.puntoVenta = pv;
    }

    if (modo !== undefined) {
      if (!MODOS.includes(modo)) {
        return res.status(400).json({ error: "El modo debe ser manual o automático" });
      }
      update.modo = modo;
    }

    if (arcaAutorizado !== undefined) update.arcaAutorizado = Boolean(arcaAutorizado);

    const doc = await FiscalConfigModel.findOneAndUpdate(
      { usuario: req.userId, workspace },
      { $set: update, $setOnInsert: { usuario: req.userId, workspace } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json(serialize(doc, workspace));
  } catch (error) {
    console.error("Error al guardar la config fiscal:", error);
    res.status(500).json({ error: "Error al guardar la configuración de facturación" });
  }
};
