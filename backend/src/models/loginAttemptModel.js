import mongoose from 'mongoose';

// Intentos de login FALLIDOS (los exitosos actualizan user.lastLoginAt).
// Sirven para la página de monitoreo: ver si alguien está probando contraseñas.
const loginAttemptSchema = new mongoose.Schema(
  {
    email: { type: String, default: '', trim: true, lowercase: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    // "no-user" = el email no existe; "bad-password" = existe pero clave incorrecta
    motivo: { type: String, enum: ['no-user', 'bad-password'], default: 'bad-password' },
  },
  { timestamps: true }
);

// TTL: los intentos se borran solos a los 30 días (no acumular datos al pedo)
loginAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
loginAttemptSchema.index({ ip: 1, createdAt: -1 });

const LoginAttempt = mongoose.model('LoginAttempt', loginAttemptSchema);

export default LoginAttempt;
