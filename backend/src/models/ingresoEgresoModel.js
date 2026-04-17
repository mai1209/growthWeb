import mongoose from 'mongoose';

const ingresoEgresoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['ingreso', 'egreso', 'ahorro'],
    required: true
  },
  monto: {
    type: Number,
    required: true
  },
  moneda: {
    type: String,
    enum: ['ARS', 'USD'],
    default: 'ARS'
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
  esRecurrente: {
    type: Boolean,
    default: false
  },
  frecuencia: {
    type: String,
    enum: ['mensual', 'quincenal', 'semanal', null],
    default: null
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
// al final del schema (antes del export)
ingresoEgresoSchema.index({ usuario: 1, fecha: -1 });

export default mongoose.model('IngresoEgreso', ingresoEgresoSchema);
