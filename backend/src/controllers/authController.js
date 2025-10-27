import User from '../models/userModel.js';
import { generateToken } from '../utils/jwt.js';

export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: 'Todos los campos son requeridos' });

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing)
      return res.status(400).json({ error: 'El usuario o email ya existe' });

    const user = await User.create({ username, email, password });
    const token = generateToken(user);

    res.status(201).json({
      message: 'Usuario creado correctamente',
      userId: user._id,
      token,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const login = async (req, res) => {
  try {
    console.time('login');
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const user = await User.findOne({ email }).select('+password');
    console.timeLog('login', 'User found');

    if (!user)
      return res.status(401).json({ error: 'Credenciales inválidas' });

    const isMatch = await user.matchPassword(password);
    console.timeLog('login', 'Password checked');

    if (!isMatch)
      return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = generateToken(user);
    console.timeEnd('login');

    res.json({
      message: 'Login exitoso',
      userId: user._id,
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
