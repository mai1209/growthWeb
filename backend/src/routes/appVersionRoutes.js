import express from "express";

const router = express.Router();

// Info de versión para el aviso de "actualizá la app".
// 👉 `latest` = la versión que YA está PUBLICADA en la App Store (que el usuario
//    puede descargar). Debe usar el MISMO número que la store (1.0.x) y coincidir
//    con app.json / config.js APP_VERSION. Subilo recién cuando la nueva versión
//    esté aprobada y live en la store. La app avisa si su versión es menor a esta.
const APP_INFO = {
  latest: "1.0.10", // ← versión LIVE en la store hoy (subir a 1.0.11 cuando se apruebe)
  ios: "https://apps.apple.com/app/id6781464707",
  android: "",
  title: "¡Nueva versión disponible!",
  message:
    "Actualizá Growth para ver las últimas mejoras. La app no se actualiza sola: tocá “Actualizar” y bajá la nueva versión de la store.",
  changes: [
    "Nueva sección Salud: pasos, caminatas por GPS, peso y ánimo",
    "Calorías diarias: plan + registro de comidas con autocompletar",
    "Gráficos de tendencia (día/semana/mes/año) y “Todos los datos”",
    "El diario arranca cada oración en mayúscula",
    "Varios arreglos y mejoras de estabilidad",
  ],
};

// GET /api/app-version  (público)
router.get("/", (req, res) => {
  res.status(200).json(APP_INFO);
});

export default router;
