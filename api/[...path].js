export default async function handler(req, res) {
  try {
    const { default: app } = await import("../backend/server.js");
    return app(req, res);
  } catch (err) {
    // DIAGNÓSTICO TEMPORAL: si el backend no carga, devolvemos el error real
    // (en vez del genérico FUNCTION_INVOCATION_FAILED de Vercel) para poder verlo.
    res.status(500).json({
      bootError: err && err.message ? err.message : String(err),
      code: err && err.code ? err.code : null,
      stack: err && err.stack ? String(err.stack).split("\n").slice(0, 8) : null,
    });
  }
}
