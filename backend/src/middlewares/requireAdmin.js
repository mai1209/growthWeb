// Solo deja pasar a los emails listados en ADMIN_EMAILS (separados por coma).
// Se usa DESPUÉS de requireAuth (necesita req.user). Sin la env var configurada
// nadie es admin: la ruta queda cerrada por defecto.
export const requireAdmin = (req, res, next) => {
  const admins = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const email = String(req.user?.email || '').toLowerCase();

  if (!email || !admins.includes(email)) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  next();
};
