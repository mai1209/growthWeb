import mongoose from 'mongoose';
import User from '../models/userModel.js';
import IngresoEgreso from '../models/ingresoEgresoModel.js';
import Task from '../models/taskModel.js';
import Meta from '../models/metaModel.js';
import Journal from '../models/journalModel.js';
import TimeEntry from '../models/timeEntryModel.js';
import Salud from '../models/saludModel.js';
import Gym from '../models/gymModel.js';
import LoginAttempt from '../models/loginAttemptModel.js';

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

// GET /api/admin/overview — usuarios: totales, nuevos, por día y últimos registros
export const getOverview = async (req, res) => {
  try {
    const [total, nuevos24h, nuevos7d, nuevos30d, activos7d, porDia, ultimos] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: daysAgo(1) } }),
        User.countDocuments({ createdAt: { $gte: daysAgo(7) } }),
        User.countDocuments({ createdAt: { $gte: daysAgo(30) } }),
        User.countDocuments({ lastLoginAt: { $gte: daysAgo(7) } }),
        User.aggregate([
          { $match: { createdAt: { $gte: daysAgo(30) } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        User.find()
          .sort({ createdAt: -1 })
          .limit(100)
          .select('username email createdAt lastLoginAt'),
      ]);

    res.json({ total, nuevos24h, nuevos7d, nuevos30d, activos7d, porDia, ultimos });
  } catch (err) {
    console.error('admin overview error:', err);
    res.status(500).json({ error: 'No se pudo armar el resumen' });
  }
};

// GET /api/admin/health — estado de la conexión a Mongo + tamaños y conteos.
// Ojo: en Vercel es serverless, así que es una foto del momento, no un monitor 24/7.
export const getHealth = async (req, res) => {
  try {
    const conn = mongoose.connection;
    const estados = ['desconectada', 'conectada', 'conectando', 'desconectando'];

    // Latencia real de un ping a la base
    const t0 = Date.now();
    await conn.db.admin().ping();
    const pingMs = Date.now() - t0;

    const stats = await conn.db.stats();

    const modelos = [
      ['Usuarios', User],
      ['Movimientos', IngresoEgreso],
      ['Tareas', Task],
      ['Metas', Meta],
      ['Notas/Journal', Journal],
      ['Registro de horas', TimeEntry],
      ['Salud', Salud],
      ['Gym', Gym],
    ];
    const conteos = await Promise.all(
      modelos.map(async ([label, Model]) => ({
        label,
        count: await Model.estimatedDocumentCount(),
      }))
    );

    res.json({
      estado: estados[conn.readyState] || String(conn.readyState),
      pingMs,
      db: {
        nombre: stats.db,
        colecciones: stats.collections,
        documentos: stats.objects,
        datosMB: Number((stats.dataSize / 1024 / 1024).toFixed(1)),
        almacenamientoMB: Number((stats.storageSize / 1024 / 1024).toFixed(1)),
        indicesMB: Number((stats.indexSize / 1024 / 1024).toFixed(1)),
      },
      conteos,
      chequeadoEn: new Date().toISOString(),
    });
  } catch (err) {
    console.error('admin health error:', err);
    // Si el ping falla, igual devolvemos algo: eso YA es información de salud
    res.status(200).json({
      estado: 'error',
      error: 'Falló el chequeo contra la base',
      chequeadoEn: new Date().toISOString(),
    });
  }
};

// GET /api/admin/security — intentos de login fallidos (últimos 30 días por TTL)
export const getSecurity = async (req, res) => {
  try {
    const [fallos24h, fallos7d, recientes, topIps, topEmails] = await Promise.all([
      LoginAttempt.countDocuments({ createdAt: { $gte: daysAgo(1) } }),
      LoginAttempt.countDocuments({ createdAt: { $gte: daysAgo(7) } }),
      LoginAttempt.find().sort({ createdAt: -1 }).limit(50),
      LoginAttempt.aggregate([
        { $match: { createdAt: { $gte: daysAgo(7) } } },
        { $group: { _id: '$ip', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      LoginAttempt.aggregate([
        { $match: { createdAt: { $gte: daysAgo(7) } } },
        { $group: { _id: '$email', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);

    res.json({
      fallos24h,
      fallos7d,
      recientes,
      topIps,
      topEmails,
      // Espejo de la config real de server.js, para mostrarla en la página
      rateLimits: {
        auth: '20 intentos fallidos / IP / 15 min',
        api: '300 pedidos / IP / 15 min',
      },
    });
  } catch (err) {
    console.error('admin security error:', err);
    res.status(500).json({ error: 'No se pudo armar el panel de seguridad' });
  }
};
