// /utils/jwt.js

import jwt from 'jsonwebtoken';

export const generateToken = (user, expiresIn = '1d') => {
  const payload = {
    userId: user._id,
    username: user.username,
    email: user.email,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
