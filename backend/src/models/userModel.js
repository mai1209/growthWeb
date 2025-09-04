import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    // =======================================================
  username: {
    type: String,
    required: [true, "El nombre de usuario es obligatorio"],
    trim: true, // Quita espacios en blanco al principio y al final
    unique: true, // Opcional: asegura que cada nombre de usuario sea único
  },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

// 🔥 ESTE ES EL CÓDIGO CRÍTICO 🔥
// Se ejecuta automáticamente ANTES de que un usuario se guarde en la BD
userSchema.pre('save', async function (next) {
  // Si la contraseña no se ha modificado, no hacer nada
  if (!this.isModified('password')) {
    return next();
  }
  
  // Hashear la contraseña
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

export default mongoose.model('User', userSchema);