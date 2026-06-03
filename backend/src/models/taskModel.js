
import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  meta: {
    type: String,
    required: [true, 'La meta es obligatoria'],
    trim: true,
  },
  tipo: {
    type: String,
    enum: ['task', 'note'],
    default: 'task',
  },
  workspace: {
    type: String,
    default: 'personal',
    trim: true,
  },
  carpeta: {
    type: String,
    default: '',
    trim: true,
  },
  contenido: {
    type: String,
    default: '',
  },
  flashcards: {
    type: [
      {
        id: { type: String },
        front: { type: String, default: '' },
        back: { type: String, default: '' },
        box: { type: Number, default: 0 },
        due: { type: String, default: '' },
        createdAt: { type: String },
        _id: false,
      },
    ],
    default: [],
  },
  fecha: {
    type: Date,
    required: true,
  },
  horario: {
    type: String,
  },
  urgencia: {
    type: String,
    enum: ['importante', 'urgente', 'no importante', 'obligaciones'],
    default: 'importante',
  },
    color: {
    type: String, 
    default: 'color1'
  },
  
diasRepeticion: {
  type: [String], // ["lun","mar","vie"]
  default: []
},

completadasEn: {
  type: [String], // ["2026-01-09"]
  default: []
}
,
  esRecurrente: {
    type: Boolean,
    default: false, // Por defecto, las tareas no son recurrentes
  },  
  
}, {
  timestamps: true,
});

const Task = mongoose.model('Task', TaskSchema);
export default Task;
