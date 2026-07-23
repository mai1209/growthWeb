import Journal from "../models/journalModel.js";

const MAX_CAMPO = 2000;
const MAX_LISTADO = 60;

const esFecha = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

// Suma/resta días sobre "YYYY-MM-DD" sin que la zona del servidor mueva nada.
const sumarDias = (fecha, delta) => {
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
};

// Una entrada "cuenta" para la racha si tiene algo escrito o ánimo marcado.
const tieneContenido = (e) =>
  Number(e.animo) > 0 ||
  [e.gratitud, e.mejor, e.distinto, e.libre].some((c) => String(c || "").trim());

// Días consecutivos hacia atrás. Si hoy todavía no escribió, arranca desde
// ayer: la racha no se "pierde" a la mañana antes de escribir.
const calcularRacha = (fechas, hoy) => {
  const marcadas = new Set(fechas);
  let cursor = marcadas.has(hoy) ? hoy : sumarDias(hoy, -1);
  if (!marcadas.has(cursor)) return 0;
  let racha = 0;
  while (marcadas.has(cursor)) {
    racha += 1;
    cursor = sumarDias(cursor, -1);
  }
  return racha;
};

const serialize = (e) => ({
  fecha: e.fecha,
  animo: Number(e.animo) || 0,
  gratitud: e.gratitud || "",
  mejor: e.mejor || "",
  distinto: e.distinto || "",
  libre: e.libre || "",
});

const armarRespuesta = (entradas, hoy) => {
  const conContenido = entradas.filter(tieneContenido);
  return {
    hoy: entradas.find((e) => e.fecha === hoy) ? serialize(entradas.find((e) => e.fecha === hoy)) : null,
    // Historial: sólo entradas con algo escrito, sin la de hoy.
    entradas: conContenido.filter((e) => e.fecha !== hoy).map(serialize),
    racha: esFecha(hoy) ? calcularRacha(conContenido.map((e) => e.fecha), hoy) : 0,
  };
};

// GET /api/journal?fecha=YYYY-MM-DD  (fecha local del cliente)
export const getJournal = async (req, res) => {
  try {
    const fecha = String(req.query.fecha || "");
    const entradas = await Journal.find({ usuario: req.user.id })
      .sort({ fecha: -1 })
      .limit(MAX_LISTADO);
    return res.status(200).json(armarRespuesta(entradas, fecha));
  } catch (error) {
    return res.status(500).json({ error: "No se pudo obtener el journal" });
  }
};

// PUT /api/journal  { fecha, animo, gratitud, mejor, distinto, libre }
// Crea o actualiza la entrada de ese día.
export const saveJournal = async (req, res) => {
  try {
    const fecha = String(req.body.fecha || "");
    if (!esFecha(fecha)) return res.status(400).json({ error: "Fecha inválida" });

    const cambios = {};
    const animo = Number(req.body.animo);
    if (Number.isFinite(animo) && animo >= 0 && animo <= 5) cambios.animo = animo;
    for (const campo of ["gratitud", "mejor", "distinto", "libre"]) {
      if (typeof req.body[campo] === "string") {
        cambios[campo] = req.body[campo].slice(0, MAX_CAMPO);
      }
    }

    await Journal.findOneAndUpdate(
      { usuario: req.user.id, fecha },
      { $set: cambios, $setOnInsert: { usuario: req.user.id, fecha } },
      { upsert: true, new: true }
    );

    const entradas = await Journal.find({ usuario: req.user.id })
      .sort({ fecha: -1 })
      .limit(MAX_LISTADO);
    return res.status(200).json(armarRespuesta(entradas, fecha));
  } catch (error) {
    return res.status(500).json({ error: "No se pudo guardar la entrada" });
  }
};
