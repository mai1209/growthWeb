import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./src/config/db.js";

import ingresoEgresoRoutes from "./src/routes/ingresoEgresoRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import taskRoutes from "./src/routes/taskRoutes.js";

dotenv.config();

const app = express();

const whitelist = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_ALT,
  "https://growthmanager.app",
  "https://www.growthmanager.app",
  "http://localhost:3001",
].filter(Boolean);

/**
 * ✅ PASO 1: preflight SIEMPRE responde rápido (antes de todo)
 * - Si el OPTIONS se clava, el browser te tira CORS + ERR_FAILED
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/**
 * ✅ Conexión a DB "lazy" (serverless friendly)
 * - NO conectar DB en top-level
 * - NO conectar DB para OPTIONS
 * - health/debug sin DB
 */
let dbReady = false;

app.use(async (req, res, next) => {
  // nunca para OPTIONS
  if (req.method === "OPTIONS") return next();

  // endpoints que no dependen de DB
  if (req.path === "/api/health" || req.path === "/api/debug") return next();

  try {
    if (!dbReady) {
      await connectDB();
      dbReady = true;
    }
    next();
  } catch (e) {
    console.error("DB connection error:", e);
    return res.status(500).json({ error: "DB connection failed" });
  }
});

/**
 * ✅ PASO 2: CORS sin tirar Error (si tirás Error a veces el browser ve "No ACAO")
 */
const corsOptions = {
  origin(origin, callback) {
    console.log("CORS origin:", origin || "direct/server-to-server");

    if (!origin) return callback(null, true);
    if (whitelist.includes(origin)) return callback(null, true);

    console.log("❌ Origin bloqueado:", origin, "Whitelist:", whitelist);
    return callback(null, false); // 👈 NO Error
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rutas
app.use("/api/add", ingresoEgresoRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/task", taskRoutes);

// health/debug
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/debug", (req, res) => {
  res.json({
    ok: true,
    origin: req.headers.origin || null,
    host: req.headers.host || null,
    referer: req.headers.referer || null,
  });
});

// local only
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;