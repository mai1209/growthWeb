// /utils/jwt.js

import jwt from 'jsonwebtoken';

export const generateToken = (user, expiresIn = '1d') => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no está definido en las variables de entorno");
  }

  const payload = {
    userId: user._id,
    username: user.username,
    email: user.email,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

export const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET no está definido en las variables de entorno");
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};
