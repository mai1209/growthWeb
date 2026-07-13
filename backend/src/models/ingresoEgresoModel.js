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
  },

  // Factura electrónica emitida para este ingreso (ARCA vía AfipSDK).
  // Queda vacío hasta que se emite.
  factura: {
    cae: { type: String, default: '' },
    caeVto: { type: String, default: '' }, // vencimiento del CAE (YYYY-MM-DD)
    tipo: { type: Number },                // CbteTipo (1=A, 6=B, 11=C)
    tipoNombre: { type: String, default: '' },
    numero: { type: Number },              // número de comprobante
    ptoVenta: { type: Number },
    fecha: { type: String, default: '' },  // fecha del comprobante (YYYYMMDD)
    homologacion: { type: Boolean, default: false },
    emitidaAt: { type: Date },
  }
}, {
  timestamps: true
});
// al final del schema (antes del export)
ingresoEgresoSchema.index({ usuario: 1, workspace: 1, fecha: -1 });

export default mongoose.model('IngresoEgreso', ingresoEgresoSchema);
