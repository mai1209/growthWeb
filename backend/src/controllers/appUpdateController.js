import AppUpdate from "../models/appUpdateModel.js";

const STORE_URLS = {
  ios: "https://apps.apple.com/app/id6781464707",
  android: "https://play.google.com/store/apps/details?id=app.growthmanager.mobile",
};

// Lo que había fijo en el código antes de que el aviso se editara desde
// /monitoreo: se usa solo la primera vez, para crear el documento.
const DEFAULTS = {
  activo: true,
  latest: "1.0.10",
  obligatorio: false,
  title: "¡Nueva versión disponible!",
  message:
    "Actualizá Growth para ver las últimas mejoras. La app no se actualiza sola: tocá “Actualizar” y bajá la nueva versión de la store.",
  changes: [
    "Compartí tus recorridos con foto de fondo y mapa real",
    "Salud: pasos, caminatas por GPS, peso, ánimo e hidratación",
    "Mejoras en el diario y en el rendimiento",
    "Varios arreglos y mejoras de estabilidad",
  ],
};

const getOrCreate = () =>
  AppUpdate.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default", ...DEFAULTS } },
    { upsert: true, new: true }
  );

const serialize = (doc) => ({
  activo: Boolean(doc.activo),
  latest: doc.latest || "",
  obligatorio: Boolean(doc.obligatorio),
  title: doc.title || "",
  message: doc.message || "",
  changes: Array.isArray(doc.changes) ? doc.changes : [],
  updatedAt: doc.updatedAt || null,
});

// GET /api/app-version (público) — lo consulta la app al abrir. Mantiene la
// forma que ya esperaban las versiones viejas de la app (latest, ios, android,
// title, message, changes) y suma `required`. Con el aviso apagado, `latest`
// va vacío y la app no muestra nada.
export const getPublicAppVersion = async (req, res) => {
  try {
    const cfg = serialize(await getOrCreate());
    res.status(200).json({
      latest: cfg.activo ? cfg.latest : "",
      required: cfg.activo && cfg.obligatorio,
      ...STORE_URLS,
      title: cfg.title,
      message: cfg.message,
      changes: cfg.changes,
    });
  } catch (err) {
    // Si falla la base, la app no tiene que romperse ni bloquear a nadie
    res.status(200).json({ latest: "", required: false, ...STORE_URLS });
  }
};

// GET /api/admin/app-update
export const getAppUpdate = async (req, res) => {
  try {
    res.status(200).json(serialize(await getOrCreate()));
  } catch (err) {
    res.status(500).json({ message: "No se pudo leer el aviso de actualización." });
  }
};

// PUT /api/admin/app-update
export const updateAppUpdate = async (req, res) => {
  try {
    const body = req.body || {};
    const latest = String(body.latest ?? "").trim();
    if (latest && !/^\d+(\.\d+){0,3}$/.test(latest)) {
      return res
        .status(400)
        .json({ message: "La versión tiene que ser tipo 1.0.17 (solo números y puntos)." });
    }
    const changes = (Array.isArray(body.changes) ? body.changes : [])
      .map((c) => String(c || "").trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 12);

    await getOrCreate();
    const doc = await AppUpdate.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          activo: Boolean(body.activo),
          latest,
          obligatorio: Boolean(body.obligatorio),
          title: String(body.title ?? "").trim().slice(0, 120),
          message: String(body.message ?? "").trim().slice(0, 600),
          changes,
        },
      },
      { new: true }
    );
    res.status(200).json(serialize(doc));
  } catch (err) {
    res.status(500).json({ message: "No se pudo guardar el aviso de actualización." });
  }
};
