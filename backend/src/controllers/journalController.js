import Journal from "../models/journalModel.js";
import JournalConfig from "../models/journalConfigModel.js";

const MAX_CAMPO = 2000;
const MAX_LISTADO = 60;
const MAX_PREGUNTA = 90;
const MAX_EXTRAS = 15;

// Textos por defecto de las preguntas guiadas.
const PREGUNTAS_DEFAULT = {
  gratitud: "Hoy agradezco…",
  mejor: "Lo mejor de hoy fue…",
  distinto: "¿Qué harías distinto?",
};

// Devuelve las 3 preguntas base del usuario completando con los defaults.
const preguntasDe = (config) => ({
  gratitud: String(config?.preguntas?.gratitud || "").trim() || PREGUNTAS_DEFAULT.gratitud,
  mejor: String(config?.preguntas?.mejor || "").trim() || PREGUNTAS_DEFAULT.mejor,
  distinto: String(config?.preguntas?.distinto || "").trim() || PREGUNTAS_DEFAULT.distinto,
});

// Definiciones de las preguntas extra (id + texto), limpias.
const extrasDe = (config) =>
  Array.isArray(config?.extras)
    ? config.extras
        .filter((x) => x && x.id)
        .slice(0, MAX_EXTRAS)
        .map((x) => ({ id: String(x.id).slice(0, 40), texto: String(x.texto || "").slice(0, MAX_PREGUNTA) }))
    : [];

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
  [e.gratitud, e.mejor, e.distinto, e.libre].some((c) => String(c || "").trim()) ||
  (Array.isArray(e.extras) && e.extras.some((x) => String(x?.valor || "").trim()));

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
  // Snapshot de las preguntas de ese día (vacío = usar las actuales).
  preguntas: {
    gratitud: e.preguntas?.gratitud || "",
    mejor: e.preguntas?.mejor || "",
    distinto: e.preguntas?.distinto || "",
  },
  // Preguntas extra de ese día (texto snapshot + respuesta).
  extras: Array.isArray(e.extras)
    ? e.extras.map((x) => ({
        id: String(x.id || ""),
        texto: x.texto || "",
        valor: x.valor || "",
      }))
    : [],
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
    const [entradas, config] = await Promise.all([
      Journal.find({ usuario: req.user.id }).sort({ fecha: -1 }).limit(MAX_LISTADO),
      JournalConfig.findOne({ usuario: req.user.id }),
    ]);
    return res.status(200).json({
      ...armarRespuesta(entradas, fecha),
      preguntas: preguntasDe(config),
      extras: extrasDe(config),
    });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo obtener el journal" });
  }
};

// PUT /api/journal/preguntas  { gratitud, mejor, distinto }
// Textos vacíos vuelven al default.
export const savePreguntas = async (req, res) => {
  try {
    const set = {};
    for (const campo of ["gratitud", "mejor", "distinto"]) {
      if (typeof req.body[campo] === "string") {
        set[`preguntas.${campo}`] = req.body[campo].trim().slice(0, MAX_PREGUNTA);
      }
    }
    // Definiciones de las preguntas extra (id + texto), sin las vacías.
    if (Array.isArray(req.body.extras)) {
      set.extras = req.body.extras
        .filter((x) => x && x.id && String(x.texto || "").trim())
        .slice(0, MAX_EXTRAS)
        .map((x) => ({
          id: String(x.id).slice(0, 40),
          texto: String(x.texto).trim().slice(0, MAX_PREGUNTA),
        }));
    }
    const config = await JournalConfig.findOneAndUpdate(
      { usuario: req.user.id },
      { $set: set, $setOnInsert: { usuario: req.user.id } },
      { upsert: true, new: true }
    );
    const resueltas = preguntasDe(config);

    // "Se guarda ese día": estampá las preguntas nuevas en la entrada del día
    // indicado (hoy), sin tocar los días anteriores.
    const fecha = String(req.body.fecha || "");
    if (esFecha(fecha)) {
      await Journal.updateOne(
        { usuario: req.user.id, fecha },
        {
          $set: {
            "preguntas.gratitud": resueltas.gratitud,
            "preguntas.mejor": resueltas.mejor,
            "preguntas.distinto": resueltas.distinto,
          },
          $setOnInsert: { usuario: req.user.id, fecha },
        },
        { upsert: true }
      );
    }
    return res.status(200).json({ preguntas: resueltas, extras: extrasDe(config) });
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron guardar las preguntas" });
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
    // Respuestas a las preguntas extra: cada una guarda id + texto + valor.
    if (Array.isArray(req.body.extras)) {
      cambios.extras = req.body.extras
        .filter((x) => x && x.id)
        .slice(0, MAX_EXTRAS)
        .map((x) => ({
          id: String(x.id).slice(0, 40),
          texto: String(x.texto || "").slice(0, MAX_PREGUNTA),
          valor: String(x.valor || "").slice(0, MAX_CAMPO),
        }));
    }

    // Al CREAR la entrada del día, congelamos las preguntas activas ese día.
    const config = await JournalConfig.findOne({ usuario: req.user.id });
    const preguntasHoy = preguntasDe(config);

    await Journal.findOneAndUpdate(
      { usuario: req.user.id, fecha },
      {
        $set: cambios,
        $setOnInsert: {
          usuario: req.user.id,
          fecha,
          preguntas: {
            gratitud: preguntasHoy.gratitud,
            mejor: preguntasHoy.mejor,
            distinto: preguntasHoy.distinto,
          },
        },
      },
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
