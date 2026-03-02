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
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin;

    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );

    return res.sendStatus(204);
  }
  next();
});
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
app.get("/api/debug", (req, res) => {
  res.json({
    ok: true,
    origin: req.headers.origin || null,
    host: req.headers.host || null,
    referer: req.headers.referer || null,
  });
});

if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
