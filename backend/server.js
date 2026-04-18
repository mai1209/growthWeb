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

// Conexión a DB (lazy para serverless)
let dbReady = false;

app.use(async (req, res, next) => {
  // No conectar para health/debug
  if (req.path === "/api/health" || req.path === "/api/debug") {
    return next();
  }

  try {
    if (!dbReady) {
      await connectDB();
      dbReady = true;
    }
    next();
  } catch (error) {
    console.error("DB connection error:", error);
    return res.status(500).json({ error: "Database connection failed" });
  }
});

// Rutas API
app.use("/api/add", ingresoEgresoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/shared-groups", sharedExpenseRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Solo para desarrollo local
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
