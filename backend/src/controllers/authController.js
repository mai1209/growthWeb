import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/jwt.js';


export const signup = async (req, res) => {
  try {
    // 1. AHORA TAMBIÉN EXTRAEMOS 'username' DEL BODY
    const { username, email, password } = req.body;

    // 2. AÑADIMOS VALIDACIONES PARA 'username'
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Contraseña mínima 6 caracteres" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "El email ya está en uso" });
    }

    // Opcional: Verificar si el nombre de usuario ya existe
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: "El nombre de usuario ya está en uso" });
    }

    // 3. PASAMOS 'username' AL CREAR EL NUEVO USUARIO
    const user = await User.create({ username, email, password });

      // ANTES: const token = generateToken(user._id);
    // AHORA:
    const token = generateToken(user); // <-- Le pasamos el objeto 'user' completo

    res.status(201).json({
      message: "Usuario creado",
      userId: user._id,
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email y contraseña requeridos" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Credenciales inválidas" });

    // ANTES: const token = generateToken(user._id);
    // AHORA:
    const token = generateToken(user); // <-- Le pasamos el objeto 'user' complet

    res.json({ message: "Login exitoso", userId: user._id, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
