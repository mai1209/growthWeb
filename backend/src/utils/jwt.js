// /utils/jwt.js (CORREGIDO Y COMPLETO)

import jwt from 'jsonwebtoken';

// 1. La función ahora recibe el objeto 'user' completo, no solo el ID.
export const generateToken = (user) => {

  // 2. Creamos el "payload" con toda la información que queremos guardar en el token.
  const payload = {
    userId: user._id,
    username: user.username, // <-- ¡LA LÍNEA CLAVE!
    email: user.email        // Opcional: también puedes incluir el email si lo necesitas
  };

  // 3. Usamos el nuevo payload para firmar el token.
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
};

// La función de verificar se queda igual, no necesita cambios.
export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};