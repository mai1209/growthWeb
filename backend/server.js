import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./src/config/db.js";

import ingresoEgresoRoutes from "./src/routes/ingresoEgresoRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import taskRoutes from "./src/routes/taskRoutes.js";
import sharedExpenseRoutes from "./src/routes/sharedExpenseRoutes.js";

dotenv.config();

const app = express();

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
app.use("/api/add", ingresoEgresoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/shared-groups", sharedExpenseRoutes);

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