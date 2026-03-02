import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./src/config/db.js";

import ingresoEgresoRoutes from "./src/routes/ingresoEgresoRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import taskRoutes from "./src/routes/taskRoutes.js";

dotenv.config();
await connectDB();

const app = express();

const whitelist = [
  process.env.FRONTEND_URL, // principal configurada en Vercel
  process.env.FRONTEND_URL_ALT, // dominio alternativo (www, etc.)
  "https://growthmanager.app",
  "https://www.growthmanager.app",
  "http://localhost:3001",
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    console.log("CORS origin:", origin || "direct/server-to-server");
    if (!origin) return callback(null, true); // Postman / server-to-server
    if (whitelist.includes(origin)) return callback(null, true);
    return callback(new Error("No permitido por CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // asegura que OPTIONS responda siempre

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Rutas (sin duplicar)
app.use("/api/add", ingresoEgresoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/task", taskRoutes);
app.get("/api/health", (req, res) => res.json({ ok: true }));

if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
