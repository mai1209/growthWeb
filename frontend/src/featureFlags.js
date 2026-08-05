// Feature flags de la web.
//
// ARCA_HABILITADO: la facturación electrónica (ARCA) está armada de punta a punta
// (config fiscal + emitir factura), pero queda OCULTA tras "Próximamente" hasta
// tener un plan pago de AfipSDK. Cuando exista el sistema de planes, cambiar a
// true para activarla entera (config en Ajustes + botón "Emitir factura").
export const ARCA_HABILITADO = false;
