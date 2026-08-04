// URL del backend que ya tenés en producción (misma API que la web → mismas cuentas).
// Para pegarle al backend de tu compu en desarrollo (mismo WiFi), cambiá por algo
// como: export const API_BASE_URL = "http://192.168.0.10:3000";
export const API_BASE_URL = "https://www.growthmanager.app";

// Versión de ESTE build (debe coincidir con la de app.json). Se compara contra
// la "latest" del backend para avisar cuando hay que actualizar. Subila en cada
// release, junto con app.json y el `latest` del backend.
export const APP_VERSION = "1.2.0";
