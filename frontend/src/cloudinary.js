// Configuración de Cloudinary para subir imágenes de las notas.
// Subida "unsigned": el cloud name y el preset son públicos (no son secretos).
//
// Cómo obtener estos valores:
//   1. Creá una cuenta gratis en https://cloudinary.com
//   2. CLOUD_NAME está en el Dashboard, arriba (ej: "dxxxx123").
//   3. UPLOAD_PRESET: Settings → Upload → Add upload preset →
//      Signing Mode: Unsigned → guardá y copiá el nombre del preset.
//
// Pegá los dos valores acá abajo y las fotos empiezan a subirse solas.
export const CLOUDINARY = {
  cloudName: "", // <-- pegá tu Cloud name
  uploadPreset: "", // <-- pegá el nombre del upload preset (unsigned)
};

export const isCloudinaryConfigured = () =>
  Boolean(CLOUDINARY.cloudName && CLOUDINARY.uploadPreset);

// Comprime/achica una imagen en el navegador antes de subirla (máx ~1600px de
// lado y calidad 0.82) para que cargue rápido y no ocupe de más.
const compressImage = (file, maxSize = 1600, quality = 0.82) =>
  new Promise((resolve) => {
    if (!file.type?.startsWith("image/")) {
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
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob || file),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

// Sube un archivo/blob a Cloudinary y devuelve la URL segura (https).
export const uploadImageToCloudinary = async (file) => {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary no está configurado");
  }
  const compressed = await compressImage(file);
  const form = new FormData();
  form.append("file", compressed);
  form.append("upload_preset", CLOUDINARY.uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  if (!res.ok) {
    throw new Error("No se pudo subir la imagen");
  }
  const data = await res.json();
  if (!data.secure_url) {
    throw new Error("Respuesta inválida de Cloudinary");
  }
  return data.secure_url;
};
