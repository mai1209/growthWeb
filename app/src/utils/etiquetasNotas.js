// Color de las etiquetas de notas. El usuario elige uno al crear la etiqueta
// (se guarda en el backend); si no hay color guardado se usa uno fijo por nombre,
// igual que en la web.
export const TAG_DOT_COLORS = ["#75f94c", "#69a7ff", "#a78bfa", "#f070b8", "#ffd55c", "#ff9d5c", "#3ed9a4"];
export const TAG_COLOR_CHOICES = TAG_DOT_COLORS.slice(0, 5);

export const hashTagColor = (name) => {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_DOT_COLORS[h % TAG_DOT_COLORS.length];
};

// tagColors: { nombreEnMinusculas: "#hex" }
export const colorDeEtiqueta = (tagColors, name) =>
  (tagColors && tagColors[String(name || "").toLowerCase()]) || hashTagColor(name);
