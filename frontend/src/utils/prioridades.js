// Prioridades de tareas (nombre + color). La lista real la guarda cada usuario
// en el backend (GET/PUT /api/task/prioridades); esto son los valores por
// defecto y helpers compartidos por el formulario y las tarjetas.

export const DEFAULT_PRIORIDADES = [
  { nombre: "importante", color: "#f0c419" },
  { nombre: "urgente", color: "#e05252" },
  { nombre: "no importante", color: "#8e9baa" },
  { nombre: "obligaciones", color: "#3f9fe7" },
];

// Colores para elegir al crear/editar una prioridad (los mismos de las tareas).
export const PRIORIDAD_COLORES = [
  "#5dc72d",
  "#ff7a35",
  "#f0c419",
  "#35c981",
  "#3f9fe7",
  "#ea5e9a",
  "#8b6ee8",
  "#e05252",
  "#8e9baa",
  "#dfe6d4",
];

export const colorDePrioridad = (prioridades, nombre) => {
  if (!nombre) return null;
  const clave = String(nombre).trim().toLowerCase();
  const p = (prioridades || []).find((x) => x.nombre.toLowerCase() === clave);
  return p ? p.color : null;
};

// Texto oscuro sobre colores claros, blanco sobre oscuros.
export const textoSobre = (hex) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return "#16241d";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#16241d" : "#ffffff";
};
