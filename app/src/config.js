// URL del backend que ya tenés en producción (misma API que la web → mismas cuentas).
// Para pegarle al backend de tu compu en desarrollo (mismo WiFi), cambiá por algo
// como: export const API_BASE_URL = "http://192.168.0.10:3000";
export const API_BASE_URL = "https://www.growthmanager.app";

// Versión de ESTE build: se lee AUTOMÁTICAMENTE del build nativo (la que ponés
// en Xcode → General → Version). Ya no hay que tocarla a mano acá. Se compara
// contra la "latest" del backend para avisar cuando hay que actualizar.
// El fallback solo aplica en Expo Go / web, donde no hay versión nativa.
import * as Application from "expo-application";
export const APP_VERSION = Application.nativeApplicationVersion || "1.0.11";

// Facturación electrónica (ARCA): todo el circuito está armado (config + emitir),
// pero queda OCULTO tras "Próximamente" hasta tener un plan pago de AfipSDK.
// Cuando exista el sistema de planes, cambiar a true para activarlo entero.
export const ARCA_HABILITADO = false;

// Comunidad (perfiles, seguir, feed, clubes, retos). Para probar en dev: true.
// ⚠️ VOLVER A false ANTES DEL BUILD PÚBLICO (tiendas) hasta tener moderación +
// reportar/bloquear y actualizar la declaración de "interacción social". Ojo:
// este flag también gatea el exportador de imagen ("Compartir imagen").
export const COMUNIDAD_HABILITADA = false;
