import express from "express";

const router = express.Router();

// Info de versión para el aviso de "actualizá la app".
// 👉 En cada release nuevo: subí `latest` a la versión que publicás en la store
//    y actualizá `changes`. La app compara su versión contra `latest`: si es
//    menor, muestra el popup.
const APP_INFO = {
  latest: "1.0.11", // ← subir en cada release (debe coincidir con app.json)
  ios: "https://apps.apple.com/app/id6781464707",
  android: "",
  title: "¡Nueva versión disponible! 🚀",
  message:
    "Actualizá Growth para ver las últimas mejoras. La app no se actualiza sola: tocá “Actualizar” y bajá la nueva versión de la store.",
  changes: [
    "Perfil rediseñado: portada, foto ajustable, bio y @usuario",
    "Gráficos de velas en Métricas y Metas",
    "Historial con las mismas tarjetas que Filtros (editar, borrar, pagar deuda)",
    "Varios arreglos y mejoras de estabilidad",
  ],
};

// GET /api/app-version  (público)
router.get("/", (req, res) => {
  res.status(200).json(APP_INFO);
});

export default router;
