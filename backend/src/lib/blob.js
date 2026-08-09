import { put } from "@vercel/blob";

// Sube una imagen (data URI base64) a Vercel Blob y devuelve su URL pública.
// - Idempotente: si `valor` ya es una URL http(s), la devuelve tal cual.
// - Degrada seguro: si no hay valor válido devuelve ""; si no está el token o
//   falla la subida, devuelve el valor original (peor caso: sigue como base64,
//   nunca rompe la request).
export async function subirImagen(valor, carpeta = "img") {
  if (!valor || typeof valor !== "string") return "";
  if (/^https?:\/\//i.test(valor)) return valor; // ya es una URL
  const m = valor.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/i);
  if (!m) return ""; // no es una imagen válida
  if (!process.env.BLOB_READ_WRITE_TOKEN) return valor; // sin token → no rompemos
  try {
    const contentType = m[1];
    const ext = contentType.split("/")[1].replace("jpeg", "jpg");
    const buffer = Buffer.from(m[2], "base64");
    const nombre = `${carpeta}/${Date.now()}-${Math.round(Math.random() * 1e9).toString(36)}.${ext}`;
    const { url } = await put(nombre, buffer, { access: "public", contentType });
    return url;
  } catch (e) {
    console.error("[blob] subirImagen:", e.message);
    return valor; // si falla, dejamos lo que había (no rompemos)
  }
}
