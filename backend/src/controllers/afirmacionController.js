import Afirmacion from "../models/afirmacionModel.js";

const MAX_LINEAS = 30;
const MAX_LARGO = 400;
// Guardamos poco más de un año de marcas: alcanza de sobra para la racha.
const MAX_LECTURAS = 400;

const esFecha = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

// Suma/resta días sobre una fecha "YYYY-MM-DD" sin que la zona horaria del
// servidor mueva el resultado (todo en UTC, que acá es sólo aritmética).
const sumarDias = (fecha, delta) => {
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
};

// Cuenta días consecutivos hacia atrás. Si todavía no leyó hoy arrancamos desde
// ayer, así la racha no se "pierde" a la mañana antes de leer.
const calcularRacha = (lecturas, hoy) => {
  const marcadas = new Set(lecturas);
  let cursor = marcadas.has(hoy) ? hoy : sumarDias(hoy, -1);
  if (!marcadas.has(cursor)) return 0;

  let racha = 0;
  while (marcadas.has(cursor)) {
    racha += 1;
    cursor = sumarDias(cursor, -1);
  }
  return racha;
};

const limpiarLineas = (valor) => {
  if (!Array.isArray(valor)) return null;
  return valor
    .slice(0, MAX_LINEAS)
    .map((linea) => String(linea ?? "").slice(0, MAX_LARGO));
};

// Devuelve el documento del usuario, creándolo la primera vez.
const obtenerDoc = async (userId) => {
  const existente = await Afirmacion.findOne({ usuario: userId });
  if (existente) return existente;
  return Afirmacion.create({ usuario: userId });
};

const serializar = (doc, fecha) => {
  const lecturas = Array.isArray(doc.lecturas) ? doc.lecturas : [];
  return {
    lineas: Array.isArray(doc.lineas) ? doc.lineas : [],
    repetirDiario: doc.repetirDiario !== false,
    recordatorio: doc.recordatorio || { activo: false, hora: "08:00" },
    leidoHoy: esFecha(fecha) ? lecturas.includes(fecha) : false,
    racha: esFecha(fecha) ? calcularRacha(lecturas, fecha) : 0,
  };
};

// GET /api/afirmaciones?fecha=YYYY-MM-DD  (fecha local del cliente)
export const getAfirmaciones = async (req, res) => {
  try {
    const fecha = String(req.query.fecha || "");
    const doc = await obtenerDoc(req.user.id);
    return res.status(200).json(serializar(doc, fecha));
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron obtener las afirmaciones" });
  }
};

// PUT /api/afirmaciones  { lineas, repetirDiario }
export const updateAfirmaciones = async (req, res) => {
  try {
    const fecha = String(req.body.fecha || req.query.fecha || "");
    const doc = await obtenerDoc(req.user.id);

    const lineas = limpiarLineas(req.body.lineas);
    if (lineas) doc.lineas = lineas;
    if (typeof req.body.repetirDiario === "boolean") {
      doc.repetirDiario = req.body.repetirDiario;
    }

    await doc.save();
    return res.status(200).json(serializar(doc, fecha));
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron guardar las afirmaciones" });
  }
};

// POST /api/afirmaciones/leer  { fecha }  -> marca el día como leído
export const marcarLeido = async (req, res) => {
  try {
    const fecha = String(req.body.fecha || "");
    if (!esFecha(fecha)) return res.status(400).json({ error: "Fecha inválida" });

    const doc = await obtenerDoc(req.user.id);
    if (!doc.lecturas.includes(fecha)) {
      doc.lecturas = [...doc.lecturas, fecha].sort().slice(-MAX_LECTURAS);
      await doc.save();
    }
    return res.status(200).json(serializar(doc, fecha));
  } catch (error) {
    return res.status(500).json({ error: "No se pudo marcar la lectura" });
  }
};

// DELETE /api/afirmaciones/leer?fecha=YYYY-MM-DD  -> por si se marcó sin querer
export const desmarcarLeido = async (req, res) => {
  try {
    const fecha = String(req.query.fecha || req.body.fecha || "");
    if (!esFecha(fecha)) return res.status(400).json({ error: "Fecha inválida" });

    const doc = await obtenerDoc(req.user.id);
    doc.lecturas = doc.lecturas.filter((f) => f !== fecha);
    await doc.save();
    return res.status(200).json(serializar(doc, fecha));
  } catch (error) {
    return res.status(500).json({ error: "No se pudo desmarcar la lectura" });
  }
};
