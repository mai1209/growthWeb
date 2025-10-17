import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import { generateToken } from '../utils/jwt.js';

export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: "Todos los campos son requeridos" });

    if (password.length < 6)
      return res.status(400).json({ error: "Contraseña mínima 6 caracteres" });

    const existingEmail = await User.findOne({ email });
    if (existingEmail)
      return res.status(400).json({ error: "El email ya está en uso" });

    const existingUsername = await User.findOne({ username });
    if (existingUsername)
      return res.status(400).json({ error: "El nombre de usuario ya está en uso" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword
    });

    const token = generateToken(user);

    res.status(201).json({
      message: "Usuario creado correctamente",
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
    if (!email || !password)
      return res.status(400).json({ error: "Email y contraseña requeridos" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ error: "Credenciales inválidas" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: "Credenciales inválidas" });

    const token = generateToken(user);

    res.json({
      message: "Login exitoso",
      userId: user._id,
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
