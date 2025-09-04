import mongoose from 'mongoose';

const ingresoEgresoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['ingreso', 'egreso'],
    required: true
  },
  monto: {
    type: Number,
    required: true
  },
  categoria: {
    type: String,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  },
  detalle: {
    type: String,
    default: ''
  },
  // 🔥 NUEVO: Referencia al usuario
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('IngresoEgreso', ingresoEgresoSchema);