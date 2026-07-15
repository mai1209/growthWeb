// Configuración de Cloudinary para subir fotos de las notas (app).
// Subida "unsigned": el cloud name y el preset son públicos (no son secretos).
//
// Pegá los mismos dos valores que en la web (frontend/src/cloudinary.js):
//   - cloudName: el Cloud name del Dashboard de Cloudinary.
//   - uploadPreset: el nombre del upload preset "unsigned".
import * as ImageManipulator from "expo-image-manipulator";

export const CLOUDINARY = {
  cloudName: "", // <-- pegá tu Cloud name
  uploadPreset: "", // <-- pegá el nombre del upload preset (unsigned)
};

export const isCloudinaryConfigured = () =>
  Boolean(CLOUDINARY.cloudName && CLOUDINARY.uploadPreset);

// Achica la imagen (máx 1600px de ancho) y la comprime antes de subir.
const compress = async (uri) => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    return uri;
  }
};

// Sube una imagen local (uri de expo-image-picker) a Cloudinary y devuelve la
// URL segura (https).
export const uploadImageToCloudinary = async (uri) => {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary no está configurado");
  }
  const finalUri = await compress(uri);
  const form = new FormData();
  form.append("file", {
    uri: finalUri,
    name: "nota.jpg",
    type: "image/jpeg",
  });
  form.append("upload_preset", CLOUDINARY.uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  if (!res.ok) throw new Error("No se pudo subir la imagen");
  const data = await res.json();
  if (!data.secure_url) throw new Error("Respuesta inválida de Cloudinary");
  return data.secure_url;
};
