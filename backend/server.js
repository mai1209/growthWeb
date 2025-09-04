import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./src/config/db.js";
import ingresoEgresoRoutes from "./src/routes/ingresoEgresoRoutes.js";
import authRoutes from './src/routes/authRoutes.js'
import taskRoutes from './src/routes/taskRoutes.js'
//import path from "path";

dotenv.config();

const app = express();

connectDB();

const corsOptions = {
  origin: "http://localhost:3001",   // tu frontend
  credentials: true,                 // permite cookies/sesiones
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};


app.use(cors(corsOptions));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());



//rutas
app.use("/api/add", ingresoEgresoRoutes);
app.use("/api/ingreso-egreso", ingresoEgresoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/task',taskRoutes )

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});