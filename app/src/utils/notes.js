// Las notas comparten backend con la web (tipo "note"). La web guarda HTML;
// en mobile editamos texto plano, así que convertimos en ambas direcciones.

const decodeEntities = (text = "") =>
  text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

// HTML que viene del backend -> texto legible en mobile
export const htmlToPlain = (html = "") => {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(p|div|section|li|h[1-6]|tr)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
};

const escapeHtml = (text = "") =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Texto plano de mobile -> HTML que la web puede leer y renderizar
export const plainToHtml = (text = "") => {
  if (!text.trim()) return "";
  return escapeHtml(text).replace(/\n/g, "<br>");
};

// Vista previa corta para las cards
export const notePreview = (html = "", max = 120) => {
  const plain = htmlToPlain(html).replace(/\n+/g, " ").trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
};

// ===== Colores de nota (mismos que la web: color1..color11) =====
// Aproximación sólida del gradiente pastel de cada color.
export const NOTE_COLORS = {
  color1: { bg: "#d6f0bd", text: "#121814" }, // verde
  color2: { bg: "#ffd2af", text: "#121814" }, // naranja
  color3: { bg: "#ffec9c", text: "#121814" }, // amarillo
  color4: { bg: "#c3efd6", text: "#121814" }, // turquesa
  color5: { bg: "#c9e4ff", text: "#121814" }, // azul
  color6: { bg: "#ffcde2", text: "#121814" }, // rosa
  color7: { bg: "#e0d2ff", text: "#121814" }, // lila
  color8: { bg: "#ffccc5", text: "#121814" }, // rojo
  color9: { bg: "#e4eae4", text: "#121814" }, // gris
  color10: { bg: "#f2f6f1", text: "#121814" }, // blanco
  color11: { bg: "#1b211d", text: "#f7fff9" }, // negro
};

export const NOTE_COLOR_KEYS = Object.keys(NOTE_COLORS);

export const getNoteColor = (key) => NOTE_COLORS[key] || NOTE_COLORS.color1;

// ===== Fechas =====
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const parseNoteDate = (value) => {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const noteSortValue = (n) => {
  const d = parseNoteDate(n.fecha) || (n.updatedAt ? new Date(n.updatedAt) : null);
  return d ? d.getTime() : 0;
};

export const formatShortDate = (value) => {
  const d = parseNoteDate(value);
  if (!d) return "";
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

// Igual que la web: "Últimos 30 días" + buckets por mes, más nuevo primero
export const groupNotesForBoard = (notes = []) => {
  const now = Date.now();
  const sorted = [...notes].sort((a, b) => noteSortValue(b) - noteSortValue(a));
  const recent = [];
  const byMonth = new Map();

  sorted.forEach((note) => {
    const d = parseNoteDate(note.fecha) || new Date();
    const diffDays = (now - d.getTime()) / 86400000;
    if (diffDays <= 30) {
      recent.push(note);
    } else {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!byMonth.has(key)) {
        byMonth.set(key, { label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, notes: [] });
      }
      byMonth.get(key).notes.push(note);
    }
  });

  const groups = [];
  if (recent.length) groups.push({ key: "recent", label: "Últimos 30 días", notes: recent });
  byMonth.forEach((value, key) => groups.push({ key, label: value.label, notes: value.notes }));
  return groups;
};
