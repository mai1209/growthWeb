import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import connectDB from "./src/config/db.js";

import ingresoEgresoRoutes from "./src/routes/ingresoEgresoRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import taskRoutes from "./src/routes/taskRoutes.js";
import sharedExpenseRoutes from "./src/routes/sharedExpenseRoutes.js";
import categoryRoutes from "./src/routes/categoryRoutes.js";

dotenv.config();

const app = express();

// En Vercel los pedidos pasan por un proxy: necesario para leer la IP real
app.set("trust proxy", 1);

// Límite estricto para login/registro/recuperación (anti fuerza bruta).
// Solo cuentan los intentos FALLIDOS: un login exitoso no gasta cupo,
// así un usuario normal (o varios dispositivos) nunca queda bloqueado.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 intentos fallidos por IP en esa ventana
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // los 2xx no cuentan
  message: { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
});

// Límite general de la API (anti abuso/spam)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // 300 pedidos por IP cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados pedidos. Esperá un momento e intentá otra vez." },
});

const resolveAllowedOrigins = () => {
  const rawOrigins = [
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.REACT_APP_API_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    "https://www.growthmanager.app",
    "https://growthmanager.app",
  ].filter(Boolean);

  return [...new Set(rawOrigins.map((origin) => origin.replace(/\/+$/, "")))];
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/+$/, "");
      const allowedOrigins = resolveAllowedOrigins();

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      console.error("CORS blocked origin:", {
        origin: normalizedOrigin,
        allowedOrigins,
      });

      return callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true,
  })
);

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Conexión a DB lazy para serverless
let dbReady = false;

app.use(async (req, res, next) => {
  // No conectar DB para health/debug
  if (req.path === "/api/health" || req.path === "/api/debug") {
    return next();
  }

  try {
    if (!dbReady) {
      await connectDB();
      dbReady = true;
    }

    return next();
  } catch (error) {
    console.error("DB connection error:", error);
    return res.status(500).json({
      error: "Database connection failed",
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  return res.status(200).json({
    ok: true,
    message: "Backend funcionando",
  });
});

// Debug simple
app.get("/api/debug", (req, res) => {
  return res.status(200).json({
    ok: true,
    env: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
  });
});

// Rutas API
// Límite estricto en las rutas sensibles (antes de las rutas de auth)
app.use(
  ["/api/auth/login", "/api/auth/signup", "/api/auth/forgot-password", "/api/auth/reset-password"],
  authLimiter
);

// Límite general para toda la API
app.use("/api", apiLimiter);

app.use("/api/add", ingresoEgresoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/shared-groups", sharedExpenseRoutes);
app.use("/api/categories", categoryRoutes);

// Rutas de Google montadas de forma perezosa: si el módulo (o sus paquetes)
// no carga en el entorno serverless, el resto de la API sigue funcionando.
try {
  const { default: googleRoutes } = await import("./src/routes/googleRoutes.js");
  app.use("/api/google", googleRoutes);
} catch (error) {
  console.error("Rutas de Google no disponibles:", error.message);
}

// Ruta fallback para API inexistente
app.use("/api", (req, res) => {
  return res.status(404).json({
    error: "Ruta API no encontrada",
    path: req.originalUrl,
    method: req.method,
  });
});

// Solo para desarrollo local
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;