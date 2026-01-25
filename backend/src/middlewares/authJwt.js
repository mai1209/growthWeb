import { verifyToken } from "../utils/jwt.js";
import User from "../models/userModel.js";

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "No autorizado - Token no proporcionado" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token); // 🔹 usamos la función de utils

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return res.status(401).json({ error: "Usuario no encontrado" });

    req.user = user;
    req.userId = user._id;

    //req.user = user;
    //req.id = user._id; // Crea esta propiedad limpia
   // next();

    next();
  } catch (error) {
    console.error("Error en autenticación:", error);
    res.status(401).json({ error: "Token inválido" });
  }
};
