// /monitoreo — panel de administración (oculto del nav, solo ADMIN_EMAILS):
// registros de usuarios, salud de la base y seguridad (logins fallidos).
// En Vercel es serverless: cada carga es una "foto" del momento, no un monitor 24/7.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiDatabase,
  FiLock,
  FiRefreshCw,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import { adminService } from "../api";
import style from "../style/Monitoreo.module.css";

const fmtFecha = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const fmtFechaHora = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Últimos 30 días completos (con 0 en los días sin registros) para el gráfico
const buildDias = (porDia = []) => {
  const map = new Map(porDia.map((d) => [d._id, d.count]));
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    out.push({ key, label: `${d.getDate()}/${d.getMonth() + 1}`, count: map.get(key) || 0 });
  }
  return out;
};

function MonitoreoPage() {
  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ov, he, se] = await Promise.all([
        adminService.overview(),
        adminService.health(),
        adminService.security(),
      ]);
      setOverview(ov.data);
      setHealth(he.data);
      setSecurity(se.data);
      setForbidden(false);
    } catch (err) {
      if (err.response?.status === 403) setForbidden(true);
      else setError("No se pudo cargar el monitoreo. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const dias = useMemo(() => buildDias(overview?.porDia), [overview]);
  const maxDia = Math.max(1, ...dias.map((d) => d.count));

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = overview?.ultimos || [];
    if (!q) return lista;
    return lista.filter(
      (u) =>
        String(u.username || "").toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q)
    );
  }, [overview, busqueda]);

  if (forbidden) {
    return (
      <div className={style.page}>
        <div className={style.forbidden}>
          <FiLock />
          <h2>Solo administradores</h2>
          <p>Tu cuenta no está habilitada para ver esta sección.</p>
        </div>
      </div>
    );
  }

  const dbOk = health?.estado === "conectada";

  return (
    <div className={style.page}>
      <header className={style.header}>
        <div>
          <h1>Monitoreo</h1>
          <p className={style.subtitle}>
            Foto al momento de cargar la página
            {health?.chequeadoEn ? ` · ${fmtFechaHora(health.chequeadoEn)}` : ""}
          </p>
        </div>
        <button className={style.refreshBtn} onClick={cargar} disabled={loading} type="button">
          <FiRefreshCw className={loading ? style.spinning : undefined} />
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </header>

      {error ? <p className={style.error}>{error}</p> : null}

      {/* ===== KPIs de usuarios ===== */}
      <section className={style.kpiGrid}>
        <div className={style.kpi}>
          <span className={style.kpiLabel}>Usuarios totales</span>
          <span className={style.kpiValue}>{overview?.total ?? "—"}</span>
        </div>
        <div className={style.kpi}>
          <span className={style.kpiLabel}>Nuevos · 24 h</span>
          <span className={`${style.kpiValue} ${style.kpiGreen}`}>{overview?.nuevos24h ?? "—"}</span>
        </div>
        <div className={style.kpi}>
          <span className={style.kpiLabel}>Nuevos · 7 días</span>
          <span className={`${style.kpiValue} ${style.kpiGreen}`}>{overview?.nuevos7d ?? "—"}</span>
        </div>
        <div className={style.kpi}>
          <span className={style.kpiLabel}>Nuevos · 30 días</span>
          <span className={`${style.kpiValue} ${style.kpiGreen}`}>{overview?.nuevos30d ?? "—"}</span>
        </div>
        <div className={style.kpi} title="Usuarios con login en los últimos 7 días (se llena a medida que la gente vuelva a entrar)">
          <span className={style.kpiLabel}>Activos · 7 días</span>
          <span className={style.kpiValue}>{overview?.activos7d ?? "—"}</span>
        </div>
      </section>

      {/* ===== Registros por día ===== */}
      <section className={style.card}>
        <h2 className={style.cardTitle}>
          <FiUsers /> Registros por día · últimos 30
        </h2>
        <div className={style.chart}>
          {dias.map((d) => (
            <div key={d.key} className={style.chartCol} title={`${d.label}: ${d.count}`}>
              <div
                className={style.chartBar}
                style={{ height: `${Math.max(4, (d.count / maxDia) * 100)}%` }}
                data-empty={d.count === 0 ? "1" : undefined}
              />
            </div>
          ))}
        </div>
        <div className={style.chartAxis}>
          <span>{dias[0]?.label}</span>
          <span>{dias[14]?.label}</span>
          <span>{dias[29]?.label}</span>
        </div>
      </section>

      <div className={style.twoCols}>
        {/* ===== Salud de la base ===== */}
        <section className={style.card}>
          <h2 className={style.cardTitle}>
            <FiDatabase /> Base de datos
          </h2>
          <div className={style.healthRow}>
            <span className={`${style.statusDot} ${dbOk ? style.dotOk : style.dotBad}`} />
            <strong>{health?.estado || "—"}</strong>
            {typeof health?.pingMs === "number" ? (
              <span className={style.muted}>· ping {health.pingMs} ms</span>
            ) : null}
          </div>
          {health?.db ? (
            <ul className={style.statList}>
              <li>
                <span>Datos</span>
                <strong>{health.db.datosMB} MB</strong>
              </li>
              <li>
                <span>Almacenamiento</span>
                <strong>{health.db.almacenamientoMB} MB</strong>
              </li>
              <li>
                <span>Índices</span>
                <strong>{health.db.indicesMB} MB</strong>
              </li>
              <li>
                <span>Colecciones</span>
                <strong>{health.db.colecciones}</strong>
              </li>
              <li>
                <span>Documentos</span>
                <strong>{health.db.documentos}</strong>
              </li>
            </ul>
          ) : null}
          {health?.conteos?.length ? (
            <>
              <h3 className={style.cardSubtitle}>Documentos por sección</h3>
              <ul className={style.statList}>
                {health.conteos.map((c) => (
                  <li key={c.label}>
                    <span>{c.label}</span>
                    <strong>{c.count}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        {/* ===== Seguridad ===== */}
        <section className={style.card}>
          <h2 className={style.cardTitle}>
            <FiActivity /> Seguridad
          </h2>
          <div className={style.securityKpis}>
            <div>
              <span className={style.kpiLabel}>Logins fallidos · 24 h</span>
              <span className={`${style.kpiValue} ${security?.fallos24h ? style.kpiWarn : ""}`}>
                {security?.fallos24h ?? "—"}
              </span>
            </div>
            <div>
              <span className={style.kpiLabel}>Fallidos · 7 días</span>
              <span className={style.kpiValue}>{security?.fallos7d ?? "—"}</span>
            </div>
          </div>
          <p className={style.mutedSmall}>
            Rate limits activos: login {security?.rateLimits?.auth || "—"} · API{" "}
            {security?.rateLimits?.api || "—"}. Los intentos se guardan 30 días.
          </p>
          {security?.topIps?.length ? (
            <>
              <h3 className={style.cardSubtitle}>IPs con más fallos (7 días)</h3>
              <ul className={style.statList}>
                {security.topIps.map((ipRow) => (
                  <li key={ipRow._id || "sin-ip"}>
                    <span className={style.mono}>{ipRow._id || "sin IP"}</span>
                    <strong>{ipRow.count}</strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={style.emptyNote}>
              <FiAlertTriangle /> Sin intentos fallidos registrados (el log arranca desde este
              deploy).
            </p>
          )}
          {security?.recientes?.length ? (
            <>
              <h3 className={style.cardSubtitle}>Últimos fallos</h3>
              <div className={style.tableWrap}>
                <table className={style.table}>
                  <thead>
                    <tr>
                      <th>Email intentado</th>
                      <th>IP</th>
                      <th>Motivo</th>
                      <th>Cuándo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {security.recientes.slice(0, 15).map((a) => (
                      <tr key={a._id}>
                        <td>{a.email || "—"}</td>
                        <td className={style.mono}>{a.ip || "—"}</td>
                        <td>{a.motivo === "no-user" ? "email inexistente" : "clave incorrecta"}</td>
                        <td>{fmtFechaHora(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {/* ===== Últimos registros ===== */}
      <section className={style.card}>
        <div className={style.tableHead}>
          <h2 className={style.cardTitle}>
            <FiUsers /> Últimos registros
          </h2>
          <label className={style.search}>
            <FiSearch />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por usuario o email"
            />
          </label>
        </div>
        <div className={style.tableWrap}>
          <table className={style.table}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Registro</th>
                <th>Último login</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u) => (
                <tr key={u._id}>
                  <td>{u.username || "—"}</td>
                  <td>{u.email || "—"}</td>
                  <td>{fmtFecha(u.createdAt)}</td>
                  <td>{u.lastLoginAt ? fmtFechaHora(u.lastLoginAt) : "—"}</td>
                </tr>
              ))}
              {!loading && usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className={style.emptyCell}>
                    Sin resultados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default MonitoreoPage;
