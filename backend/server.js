import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./src/config/db.js";
import ingresoEgresoRoutes from "./src/routes/ingresoEgresoRoutes.js";
import authRoutes from './src/routes/authRoutes.js'
import taskRoutes from './src/routes/taskRoutes.js'

dotenv.config();

const app = express();

connectDB();

// --- 👇 ESTA ES LA SECCIÓN CORREGIDA 👇 ---

// 1. Define tu "lista blanca" de orígenes permitidos
const whitelist = [process.env.FRONTEND_URL, 'http://localhost:3001'];

const corsOptions = {
  // 2. La opción 'origin' ahora es una función que revisa la lista blanca
  origin: function (origin, callback) {
    // Permite peticiones si el origen está en la lista (o si no hay origen, como en Postman)
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true, // permite cookies/sesiones
};

// 3. Usa la nueva configuración de CORS
app.use(cors(corsOptions));

// -------------------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

//rutas
app.use("/api/add", ingresoEgresoRoutes);
app.use("/api/ingreso-egreso", ingresoEgresoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/task', taskRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});