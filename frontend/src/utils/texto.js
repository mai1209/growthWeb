// Primera letra en mayúscula al escribir (el resto queda como lo tipea la
// persona). Sirve para categoría, detalle, acreedor, títulos, etc.
export const capitalizarPrimera = (valor) => {
  const t = String(valor ?? "");
  if (!t) return t;
  // Saltea espacios iniciales: " hola" → " Hola"
  const i = t.search(/\S/);
  if (i < 0) return t;
  return t.slice(0, i) + t[i].toLocaleUpperCase("es-AR") + t.slice(i + 1);
};
