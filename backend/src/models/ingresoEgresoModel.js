import mongoose from 'mongoose';

const ingresoEgresoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['ingreso', 'egreso', 'ahorro', 'deuda'],
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
  medio: {
    type: String,
    enum: ['efectivo', 'transferencia'],
    default: 'efectivo'
  },
  workspace: {
    type: String,
    default: 'personal',
    trim: true
  },
  deudaEstado: {
    type: String,
    enum: ['pendiente', 'pagada'],
    default: 'pendiente'
  },
  deudaPagado: {
    type: Number,
    default: 0,
    min: 0
  },
  deudaAcreedor: {
    type: String,
    default: ''
  },
  deudaPagadaAt: {
    type: Date,
    default: null
  },
  deudaMovimientoPagoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IngresoEgreso',
    default: null
  },
  esRecurrente: {
    type: Boolean,
    default: false
  },
  // Egreso pagado con plata del ahorro: descuenta del ahorro, no del saldo
  desdeAhorro: {
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
ingresoEgresoSchema.index({ usuario: 1, workspace: 1, fecha: -1 });

export default mongoose.model('IngresoEgreso', ingresoEgresoSchema);
