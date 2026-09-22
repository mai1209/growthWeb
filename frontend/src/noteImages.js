import { taskService } from "./api";

// Achica/comprime una imagen en el navegador (máx ~1600px de lado, JPEG 0.82)
// para que suba rápido y no ocupe de más.
const compressImage = (file, maxSize = 1600, quality = 0.82) =>
  new Promise((resolve) => {
    if (!file.type?.startsWith("image/") || file.type === "image/gif") {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

const toDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(blob);
  });

// Sube una imagen de nota por el API (Vercel Blob) y devuelve su URL.
export const uploadNoteImage = async (file) => {
  const compressed = await compressImage(file);
  const dataUrl = await toDataUrl(compressed);
  const { data } = await taskService.subirImagen({ imagen: dataUrl });
  if (!data?.url) throw new Error("Respuesta inválida al subir la imagen");
  return data.url;
};
