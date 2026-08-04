import express from "express";

const router = express.Router();

// Info de versión para el aviso de "actualizá la app".
// 👉 En cada release nuevo: subí `latest` a la versión que publicás en la store
//    y actualizá `changes`. La app compara su versión contra `latest`: si es
//    menor, muestra el popup.
const APP_INFO = {
  latest: "1.1.0", // ← subir en cada release (debe coincidir con app.json)
  ios: "https://apps.apple.com/app/id6781464707",
  android: "",
  title: "¡Nueva versión disponible! 🚀",
  message:
    "Actualizá Growth para ver las últimas mejoras. La app no se actualiza sola: tocá “Actualizar” y bajá la nueva versión de la store.",
  changes: [
    "Nueva sección Salud 🌱: pasos, caminatas por GPS, peso y ánimo",
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
