// Emisión de factura electrónica vía AfipSDK (ARCA).
// La API key del proveedor es a nivel app (env AFIPSDK_API_KEY). El CUIT es
// el del perfil emisor. Arrancamos en homologación (AFIP_PRODUCTION !== "true").
//
// Requisitos en el servidor:
//   - npm install @afipsdk/afip.js
//   - env AFIPSDK_API_KEY (access token de tu cuenta AfipSDK)
//   - env AFIP_PRODUCTION = "true" para producción (por defecto: homologación)

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const formatCbteFch = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

// Tipo de comprobante según la condición del emisor.
// Monotributo / exento -> Factura C (11). Responsable Inscripto -> Factura B (6)
// a consumidor final. (Factura A, con receptor RI + CUIT, queda como paso siguiente.)
const tipoComprobante = (condicionIVA) => {
  if (condicionIVA === "responsable_inscripto") return { cbteTipo: 6, nombre: "Factura B" };
  return { cbteTipo: 11, nombre: "Factura C" };
};

const CONDICION_IVA_RECEPTOR_CF = 5; // Consumidor Final

export const emitirFactura = async (fiscalConfig, movimiento) => {
  if (!process.env.AFIPSDK_API_KEY) {
    throw new Error("Falta configurar AFIPSDK_API_KEY en el servidor.");
  }
  const cuit = String(fiscalConfig.cuit || "").replace(/\D/g, "");
  if (cuit.length !== 11) throw new Error("El CUIT del perfil no es válido.");

  const mod = await import("@afipsdk/afip.js");
  const Afip = mod.default || mod;
  const production = process.env.AFIP_PRODUCTION === "true";

  const afip = new Afip({
    CUIT: Number(cuit),
    access_token: process.env.AFIPSDK_API_KEY,
    production,
  });

  const ptoVta = Number(fiscalConfig.puntoVenta) || 1;
  const { cbteTipo, nombre } = tipoComprobante(fiscalConfig.condicionIVA);

  const impTotal = round2(movimiento.monto);
  let impNeto = impTotal;
  let impIVA = 0;
  let iva;
  if (cbteTipo === 6) {
    // Factura B: el precio incluye IVA (21%) -> lo desagregamos.
    impNeto = round2(impTotal / 1.21);
    impIVA = round2(impTotal - impNeto);
    iva = [{ Id: 5, BaseImp: impNeto, Importe: impIVA }]; // 5 = 21%
  }

  const last = await afip.ElectronicBilling.getLastVoucher(ptoVta, cbteTipo);
  const numero = (Number(last) || 0) + 1;
  const cbteFch = formatCbteFch();

  const data = {
    CantReg: 1,
    PtoVta: ptoVta,
    CbteTipo: cbteTipo,
    Concepto: 1, // 1 = Productos
    DocTipo: 99, // 99 = Consumidor Final
    DocNro: 0,
    CbteDesde: numero,
    CbteHasta: numero,
    CbteFch: cbteFch,
    ImpTotal: impTotal,
    ImpTotConc: 0,
    ImpNeto: impNeto,
    ImpOpEx: 0,
    ImpIVA: impIVA,
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
    CondicionIVAReceptorId: CONDICION_IVA_RECEPTOR_CF,
    ...(iva ? { Iva: iva } : {}),
  };

  const resVoucher = await afip.ElectronicBilling.createVoucher(data);

  return {
    cae: resVoucher.CAE,
    caeVto: resVoucher.CAEFchVto,
    tipo: cbteTipo,
    tipoNombre: nombre,
    numero,
    ptoVenta: ptoVta,
    fecha: cbteFch,
    homologacion: !production,
    emitidaAt: new Date(),
  };
};
