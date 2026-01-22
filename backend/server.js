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
connectDB();

const whitelist = [
  process.env.FRONTEND_URL,          // ej: https://growthmanager.app
  "https://growthmanager.app",
  "https://www.growthmanager.app",
  "http://localhost:3001",
];

const corsOptions = {
  origin: function (origin, callback) {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
