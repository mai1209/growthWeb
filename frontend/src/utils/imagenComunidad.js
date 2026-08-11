// Redimensiona una imagen elegida por el usuario a un data URI JPEG liviano.
// El backend recibe este data URI y lo sube a Vercel Blob (guarda solo la URL).
// Achicamos del lado del cliente para no mandar 5MB por la red al pedo.
export function redimensionarImagen(file, maxLado = 1080, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Sin archivo"));
    if (!/^image\//.test(file.type)) return reject(new Error("No es una imagen"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}
