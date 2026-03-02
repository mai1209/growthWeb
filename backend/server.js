import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./src/config/db.js";

import ingresoEgresoRoutes from "./src/routes/ingresoEgresoRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import taskRoutes from "./src/routes/taskRoutes.js";

dotenv.config();

const app = express();

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