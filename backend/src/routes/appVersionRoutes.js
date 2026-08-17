import express from "express";

const router = express.Router();

// Info de versión para el aviso de "actualizá la app".
// 👉 `latest` = la versión que YA está PUBLICADA en la App Store (que el usuario
//    puede descargar). Debe usar el MISMO número que la store (1.0.x) y coincidir
//    con app.json / config.js APP_VERSION. Subilo recién cuando la nueva versión
//    esté aprobada y live en la store. La app avisa si su versión es menor a esta.
// 🔔 CÓMO USAR EL AVISO DE ACTUALIZACIÓN:
//   1. Cuando la versión nueva esté APROBADA y LIVE en las tiendas, cambiá
//      `latest` al número nuevo (ej: "1.0.15") y hacé `git push` (Vercel deploya).
//   2. La app avisa a quien tenga una versión MENOR a `latest`. (Vos, ya en la
//      última, no lo ves.) Como es un solo `latest` para las dos tiendas, subilo
//      recién cuando esté live en AMBAS (en la práctica: cuando Apple aprueba,
//      porque Android tuyo ya suele estar antes).
const APP_INFO = {
  latest: "1.0.10", // ← versión LIVE en la store. SUBIR a "1.0.15" cuando esté aprobada en ambas.
  ios: "https://apps.apple.com/app/id6781464707",
  android: "https://play.google.com/store/apps/details?id=app.growthmanager.mobile",
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

// GET /api/app-version  (público)
router.get("/", (req, res) => {
  res.status(200).json(APP_INFO);
});

export default router;
