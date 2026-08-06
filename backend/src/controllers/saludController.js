import Salud from "../models/saludModel.js";

const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// Firma estable de una caminata para poder marcarla como borrada (tombstone).
const firmaCaminata = (c) => `${c?.fecha}|${Math.round(num(c?.metros))}|${num(c?.secs)}`;
const MAX_CAMINATAS_BORRADAS = 300;

// Cuántos días guardamos por sección (con orden cronológico de clave alcanza).
const MAX_DIAS = { pasos: 400, pasosManual: 400, agua: 60, animo: 120, peso: 400, comidas: 60 };
const MAX_CAMINATAS = 100;
const MAX_COMIDAS_DIA = 40;

// Mergea una sección por-día: toma el objeto guardado y le pisa las claves que
// vienen en el body (el que escribe un día gana ese día), recortando al máximo.
// `combinar(anterior, entrante)` permite decidir cómo se resuelve un día que ya
// existía; por defecto gana el entrante (last-write-wins).
const mergeDias = (actual, entrante, limpiarValor, max, combinar) => {
  const base = actual && typeof actual === "object" ? { ...actual } : {};
  Object.keys(entrante || {}).forEach((k) => {
    if (!esFecha(k)) return;
    const limpio = limpiarValor(entrante[k]);
    base[k] = combinar && k in base ? combinar(base[k], limpio) : limpio;
  });
  const recortado = {};
  Object.keys(base)
    .sort()
    .slice(-max)
    .forEach((k) => {
      recortado[k] = base[k];
    });
  return recortado;
};

const limpiarComidasDia = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_COMIDAS_DIA).map((c) => ({
    id: String(c?.id || "").slice(0, 40),
    franja: String(c?.franja || "").slice(0, 20),
    nombre: String(c?.nombre || "").slice(0, 120),
    kcal: num(c?.kcal),
    carbG: num(c?.carbG),
    protG: num(c?.protG),
    fatG: num(c?.fatG),
  }));
};

const obtenerDoc = async (userId) => {
  const existente = await Salud.findOne({ usuario: userId });
  if (existente) return existente;
  return Salud.create({ usuario: userId });
};

const serializar = (doc) => ({
  pasos: doc.pasos || {},
  pasosManual: doc.pasosManual || {},
  agua: doc.agua || {},
  animo: doc.animo || {},
  peso: doc.peso || {},
  comidas: doc.comidas || {},
  // La `ruta` (recorrido GPS) NO se manda en la carga general: puede ser grande
  // y solo la usa el visor de recorridos en el teléfono (que la guarda local).
  caminatas: (doc.caminatas || []).map((c) => ({
    fecha: c.fecha,
    metros: c.metros,
    secs: c.secs,
  })),
  nutri: doc.nutri || null,
  metas: doc.metas || null,
  updatedAt: doc.updatedAt,
});

// GET /api/salud
export const getSalud = async (req, res) => {
  try {
    const doc = await obtenerDoc(req.userId);
    return res.json(serializar(doc));
  } catch (err) {
    console.error("[salud] get:", err.message);
    return res.status(500).json({ error: "No se pudo cargar salud." });
  }
};

// GET /api/salud/recorridos — caminatas CON su trazado GPS (aparte del GET general,
// que no lo manda para ser liviano). Lo usa el visor de recorridos.
export const getRecorridos = async (req, res) => {
  try {
    const doc = await obtenerDoc(req.userId);
    const recorridos = (doc.caminatas || [])
      .filter((c) => Array.isArray(c.ruta) && c.ruta.length > 1)
      .map((c) => ({
        fecha: c.fecha,
        metros: c.metros,
        secs: c.secs,
        ruta: c.ruta.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      }));
    return res.json({ recorridos });
  } catch (err) {
    console.error("[salud] recorridos:", err.message);
    return res.status(500).json({ error: "No se pudieron cargar los recorridos." });
  }
};

// DELETE /api/salud/recorridos — borra UNA caminata (por fecha + metros + secs).
// Además la marca como borrada (tombstone) para que un re-sync de la app no la
// vuelva a subir. Devuelve la lista de recorridos Y de caminatas actualizadas.
export const deleteRecorrido = async (req, res) => {
  try {
    const { fecha, metros, secs } = req.body || {};
    if (!esFecha(fecha)) return res.status(400).json({ error: "Fecha inválida." });
    const doc = await obtenerDoc(req.userId);
    const arr = Array.isArray(doc.caminatas) ? doc.caminatas : [];
    const firma = firmaCaminata({ fecha, metros, secs });
    let removed = false;
    doc.caminatas = arr.filter((c) => {
      if (removed) return true;
      if (firmaCaminata(c) === firma) {
        removed = true;
        return false;
      }
      return true;
    });
    if (removed) {
      const borradas = Array.isArray(doc.caminatasBorradas) ? doc.caminatasBorradas : [];
      if (!borradas.includes(firma)) borradas.push(firma);
      doc.caminatasBorradas = borradas.slice(-MAX_CAMINATAS_BORRADAS);
      doc.markModified("caminatas");
      doc.markModified("caminatasBorradas");
      await doc.save();
    }
    const recorridos = (doc.caminatas || [])
      .filter((c) => Array.isArray(c.ruta) && c.ruta.length > 1)
      .map((c) => ({
        fecha: c.fecha,
        metros: c.metros,
        secs: c.secs,
        ruta: c.ruta.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      }));
    const caminatas = (doc.caminatas || []).map((c) => ({
      fecha: c.fecha,
      metros: c.metros,
      secs: c.secs,
    }));
    return res.json({ recorridos, caminatas, removed });
  } catch (err) {
    console.error("[salud] deleteRecorrido:", err.message);
    return res.status(500).json({ error: "No se pudo borrar el recorrido." });
  }
};

// PUT /api/salud — el body trae solo las secciones que quiere actualizar.
export const updateSalud = async (req, res) => {
  try {
    const body = req.body || {};
    const doc = await obtenerDoc(req.userId);

    if (body.pasos && typeof body.pasos === "object") {
      // Los pasos automáticos de un día son acumulativos (solo suben). Nos
      // quedamos con el MÁXIMO para que un dispositivo con lectura vieja o en 0
      // (p. ej. el otro teléfono) nunca pise los pasos reales ya guardados.
      doc.pasos = mergeDias(doc.pasos, body.pasos, num, MAX_DIAS.pasos, (prev, next) =>
        Math.max(Number(prev) || 0, next)
      );
      doc.markModified("pasos");
    }
    if (body.pasosManual && typeof body.pasosManual === "object") {
      doc.pasosManual = mergeDias(doc.pasosManual, body.pasosManual, num, MAX_DIAS.pasosManual);
      doc.markModified("pasosManual");
    }
    if (body.agua && typeof body.agua === "object") {
      doc.agua = mergeDias(doc.agua, body.agua, num, MAX_DIAS.agua);
      doc.markModified("agua");
    }
    if (body.animo && typeof body.animo === "object") {
      doc.animo = mergeDias(doc.animo, body.animo, (v) => Math.min(5, Math.max(1, num(v) || 1)), MAX_DIAS.animo);
      doc.markModified("animo");
    }
    if (body.peso && typeof body.peso === "object") {
      doc.peso = mergeDias(doc.peso, body.peso, num, MAX_DIAS.peso);
      doc.markModified("peso");
    }
    if (body.comidas && typeof body.comidas === "object") {
      doc.comidas = mergeDias(doc.comidas, body.comidas, limpiarComidasDia, MAX_DIAS.comidas);
      doc.markModified("comidas");
    }
    if (Array.isArray(body.caminatas)) {
      // Tombstones: caminatas borradas desde la web no vuelven aunque la app las re-suba.
      const borradas = new Set(Array.isArray(doc.caminatasBorradas) ? doc.caminatasBorradas : []);
      doc.caminatas = body.caminatas
        .filter((c) => c && esFecha(c.fecha))
        .filter((c) => !borradas.has(firmaCaminata({ fecha: c.fecha, metros: c.metros, secs: c.secs })))
        .slice(0, MAX_CAMINATAS)
        .map((c) => ({
          fecha: c.fecha,
          metros: num(c.metros),
          secs: num(c.secs),
          ruta: Array.isArray(c.ruta)
            ? c.ruta
                .filter((p) => p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
                .slice(0, 500)
                .map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }))
            : undefined,
        }));
    }
    if (body.nutri && typeof body.nutri === "object") {
      doc.nutri = {
        peso: num(body.nutri.peso),
        altura: num(body.nutri.altura),
        edad: num(body.nutri.edad),
        sexo: body.nutri.sexo === "M" ? "M" : "H",
        actividad: String(body.nutri.actividad || "ligero").slice(0, 20),
        objetivo: String(body.nutri.objetivo || "mantener").slice(0, 20),
      };
      doc.markModified("nutri");
    }
    if (body.metas && typeof body.metas === "object") {
      doc.metas = { pasos: num(body.metas.pasos), agua: num(body.metas.agua) };
      doc.markModified("metas");
    }

    await doc.save();
    return res.json(serializar(doc));
  } catch (err) {
    console.error("[salud] update:", err.message);
    return res.status(500).json({ error: "No se pudo guardar salud." });
  }
};
