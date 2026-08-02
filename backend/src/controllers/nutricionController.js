import Anthropic from "@anthropic-ai/sdk";

// Modelo para estimar comida por foto. Se puede cambiar a "claude-haiku-4-5"
// (mucho más barato) o "claude-sonnet-5" según el balance costo/calidad.
const MODEL = "claude-opus-5";

// Cliente lazy: NO se construye al importar el módulo (si no hay ANTHROPIC_API_KEY,
// el SDK tira error y se caería todo el backend). Se crea recién al usarse.
let client = null;
const getClient = () => {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    nombre: { type: "string" },
    kcal: { type: "number" },
    carbG: { type: "number" },
    protG: { type: "number" },
    fatG: { type: "number" },
  },
  required: ["nombre", "kcal", "carbG", "protG", "fatG"],
};

// POST /api/nutricion/analizar-foto  { imagenBase64, mediaType }
export const analizarFoto = async (req, res) => {
  const { imagenBase64, mediaType } = req.body || {};
  if (!imagenBase64) return res.status(400).json({ error: "Falta la imagen." });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "El análisis por IA no está configurado." });
  }

  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system:
        "Sos nutricionista. Estimás qué plato aparece en una foto de comida y sus calorías y macros " +
        "para una porción como la que se ve. Sé realista con el tamaño de la porción. " +
        "Si la imagen no es comida, devolvé nombre vacío y 0 en todo.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imagenBase64,
              },
            },
            {
              type: "text",
              text:
                "Analizá esta foto de comida. Devolvé el nombre del plato en español y sus valores " +
                "estimados: kcal (calorías totales del plato), carbG, protG y fatG (gramos).",
            },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    let data = null;
    if (textBlock?.text) {
      try {
        data = JSON.parse(textBlock.text);
      } catch {
        const m = textBlock.text.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            data = JSON.parse(m[0]);
          } catch {}
        }
      }
    }
    if (!data) return res.status(502).json({ error: "No se pudo interpretar la respuesta de la IA." });

    return res.json({
      nombre: String(data.nombre || "").trim(),
      kcal: Math.max(0, Math.round(Number(data.kcal) || 0)),
      carbG: Math.max(0, Math.round(Number(data.carbG) || 0)),
      protG: Math.max(0, Math.round(Number(data.protG) || 0)),
      fatG: Math.max(0, Math.round(Number(data.fatG) || 0)),
    });
  } catch (err) {
    console.error("[nutricion] analizarFoto:", err?.status, err?.message);
    return res.status(500).json({ error: "No se pudo analizar la foto." });
  }
};
