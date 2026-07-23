import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheck,
  FiCheckCircle,
  FiEdit2,
  FiFlag,
  FiPause,
  FiPlay,
  FiPlus,
  FiTarget,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { metaService } from "../api";
import style from "../style/Metas.module.css";

const HORIZONTES = [
  { value: "corto", label: "Corto plazo", hint: "próximas semanas / meses" },
  { value: "mediano", label: "Mediano plazo", hint: "dentro de este año" },
  { value: "largo", label: "Largo plazo", hint: "a uno o más años" },
];

const AREAS = ["Finanzas", "Salud", "Carrera", "Personal", "Aprendizaje"];

const MEDICIONES = [
  { value: "hitos", label: "Por hitos", hint: "una checklist de pasos" },
  { value: "numero", label: "Por número", hint: "ej: ahorrar $500.000" },
  { value: "manual", label: "Manual", hint: "ajustás el % vos" },
];

const FORM_VACIO = {
  id: null,
  titulo: "",
  descripcion: "",
  horizonte: "corto",
  area: "",
  fechaObjetivo: "",
  medicion: "hitos",
  hitos: [],
  objetivoNumero: "",
  actualNumero: "",
  unidad: "",
  progresoManual: 0,
};

const hoyLocal = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

// Progreso 0-100 según cómo se mide la meta.
const progressOf = (m) => {
  if (m.estado === "completada") return 100;
  if (m.medicion === "hitos") {
    const total = m.hitos?.length || 0;
    if (!total) return 0;
    return Math.round((100 * m.hitos.filter((h) => h.hecho).length) / total);
  }
  if (m.medicion === "numero") {
    const objetivo = Number(m.objetivoNumero) || 0;
    if (objetivo <= 0) return 0;
    return Math.min(100, Math.round((100 * (Number(m.actualNumero) || 0)) / objetivo));
  }
  return Math.min(100, Math.max(0, Math.round(Number(m.progresoManual) || 0)));
};

// Días que faltan para la fecha objetivo (negativo = vencida).
const daysUntil = (fecha) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) return null;
  const [y, m, d] = fecha.split("-").map(Number);
  const [hy, hm, hd] = hoyLocal().split("-").map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86400000
  );
};

const dueLabel = (m) => {
  if (m.estado === "completada") {
    return m.completadaEn ? `Completada el ${m.completadaEn.split("-").reverse().join("/")}` : "Completada";
  }
  const dias = daysUntil(m.fechaObjetivo);
  if (dias === null) return "Sin fecha límite";
  if (dias === 0) return "Vence hoy";
  if (dias > 0) return `${dias === 1 ? "Falta 1 día" : `Faltan ${dias} días`}`;
  return `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`;
};

const fmtNum = (n) => Number(n || 0).toLocaleString("es-AR");

// Colores por plazo (los mismos de las pills).
const PLAZO_COLORS = { corto: "#5b8ad6", mediano: "#c9a23a", largo: "#b06ad6" };

// Gradiente cónico para el donut (mismo recurso que la página de Métricas).
const buildConicGradient = (items) => {
  const total = items.reduce((acc, item) => acc + item.value, 0);
  if (!total) return "conic-gradient(rgba(127,137,129,0.25) 0 100%)";
  let acumulado = 0;
  const stops = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const desde = (acumulado / total) * 100;
      acumulado += item.value;
      const hasta = (acumulado / total) * 100;
      return `${item.color} ${desde}% ${hasta}%`;
    });
  return `conic-gradient(${stops.join(", ")})`;
};

function MetasPage({ activeWorkspace }) {
  const [metas, setMetas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [horizonteFiltro, setHorizonteFiltro] = useState("todas");
  const [estadoFiltro, setEstadoFiltro] = useState("activa");
  const [detalle, setDetalle] = useState(null); // meta abierta
  const [form, setForm] = useState(null); // formulario crear/editar
  const [hitoNuevo, setHitoNuevo] = useState("");
  const [numeroNuevo, setNumeroNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await metaService.getAll();
      setMetas(Array.isArray(data) ? data : []);
    } catch {
      /* dejamos lo que haya */
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    setCargando(true);
    cargar();
  }, [cargar, activeWorkspace]);

  // Mantiene la lista y el panel de detalle sincronizados tras un update.
  const reemplazar = (metaActualizada) => {
    setMetas((prev) => prev.map((m) => (m._id === metaActualizada._id ? metaActualizada : m)));
    setDetalle((prev) => (prev && prev._id === metaActualizada._id ? metaActualizada : prev));
  };

  const actualizar = async (meta, cambios) => {
    try {
      const { data } = await metaService.update(meta._id, cambios);
      reemplazar(data);
      return data;
    } catch {
      return null;
    }
  };

  const toggleHito = (meta, indice) => {
    const hitos = meta.hitos.map((h, i) => (i === indice ? { ...h, hecho: !h.hecho } : h));
    reemplazar({ ...meta, hitos }); // optimista
    actualizar(meta, { hitos });
  };

  const agregarHito = (meta) => {
    const texto = hitoNuevo.trim();
    if (!texto) return;
    const hitos = [...(meta.hitos || []), { texto, hecho: false }];
    setHitoNuevo("");
    reemplazar({ ...meta, hitos });
    actualizar(meta, { hitos });
  };

  const borrarHito = (meta, indice) => {
    const hitos = meta.hitos.filter((_, i) => i !== indice);
    reemplazar({ ...meta, hitos });
    actualizar(meta, { hitos });
  };

  const registrarAvance = (meta) => {
    const valor = Number(numeroNuevo);
    if (!Number.isFinite(valor)) return;
    setNumeroNuevo("");
    reemplazar({ ...meta, actualNumero: valor });
    actualizar(meta, { actualNumero: valor });
  };

  const cambiarManual = (meta, valor) => {
    reemplazar({ ...meta, progresoManual: valor });
  };

  const guardarManual = (meta, valor) => {
    actualizar(meta, { progresoManual: valor });
  };

  const cambiarEstado = (meta, estado) => {
    reemplazar({ ...meta, estado, completadaEn: estado === "completada" ? hoyLocal() : "" });
    actualizar(meta, { estado, fechaLocal: hoyLocal() });
  };

  const eliminar = async (meta) => {
    const seguro = window.confirm(`¿Eliminar la meta “${meta.titulo}”?`);
    if (!seguro) return;
    try {
      await metaService.delete(meta._id);
      setMetas((prev) => prev.filter((m) => m._id !== meta._id));
      setDetalle(null);
    } catch {
      /* nada */
    }
  };

  const abrirCrear = () => {
    setForm({ ...FORM_VACIO });
  };

  const abrirEditar = (meta) => {
    setForm({
      id: meta._id,
      titulo: meta.titulo || "",
      descripcion: meta.descripcion || "",
      horizonte: meta.horizonte || "corto",
      area: meta.area || "",
      fechaObjetivo: meta.fechaObjetivo || "",
      medicion: meta.medicion || "hitos",
      hitos: (meta.hitos || []).map((h) => ({ ...h })),
      objetivoNumero: meta.objetivoNumero || "",
      actualNumero: meta.actualNumero || "",
      unidad: meta.unidad || "",
      progresoManual: meta.progresoManual || 0,
    });
  };

  const guardarForm = async (event) => {
    event.preventDefault();
    if (!form.titulo.trim() || guardando) return;
    setGuardando(true);
    const payload = {
      titulo: form.titulo,
      descripcion: form.descripcion,
      horizonte: form.horizonte,
      area: form.area,
      fechaObjetivo: form.fechaObjetivo,
      medicion: form.medicion,
      hitos: form.hitos,
      objetivoNumero: Number(form.objetivoNumero) || 0,
      actualNumero: Number(form.actualNumero) || 0,
      unidad: form.unidad,
      progresoManual: Number(form.progresoManual) || 0,
    };
    try {
      if (form.id) {
        const { data } = await metaService.update(form.id, payload);
        reemplazar(data);
      } else {
        const { data } = await metaService.create(payload);
        setMetas((prev) => [data, ...prev]);
      }
      setForm(null);
    } catch {
      /* se reintenta guardando de nuevo */
    } finally {
      setGuardando(false);
    }
  };

  const visibles = useMemo(() => {
    return metas.filter((m) => {
      if (horizonteFiltro !== "todas" && m.horizonte !== horizonteFiltro) return false;
      if (estadoFiltro !== "todas" && m.estado !== estadoFiltro) return false;
      return true;
    });
  }, [metas, horizonteFiltro, estadoFiltro]);

  const stats = useMemo(() => {
    const activas = metas.filter((m) => m.estado === "activa");
    const completadas = metas.filter((m) => m.estado === "completada");
    const promedio = activas.length
      ? Math.round(activas.reduce((acc, m) => acc + progressOf(m), 0) / activas.length)
      : 0;
    return { activas: activas.length, completadas: completadas.length, promedio };
  }, [metas]);

  // Datos para los gráficos: distribución por plazo y avance de las activas.
  const plazoItems = useMemo(
    () =>
      HORIZONTES.map((h) => ({
        label: h.label,
        color: PLAZO_COLORS[h.value],
        value: metas.filter((m) => m.horizonte === h.value && m.estado !== "completada").length,
      })),
    [metas]
  );

  const barrasAvance = useMemo(
    () =>
      metas
        .filter((m) => m.estado === "activa")
        .map((m) => ({ id: m._id, titulo: m.titulo, progreso: progressOf(m), horizonte: m.horizonte }))
        .sort((a, b) => b.progreso - a.progreso)
        .slice(0, 6),
    [metas]
  );

  const medidaLabel = (m) => {
    if (m.medicion === "hitos") {
      const hechos = (m.hitos || []).filter((h) => h.hecho).length;
      return `${hechos} de ${(m.hitos || []).length} hitos`;
    }
    if (m.medicion === "numero") {
      return `${m.unidad}${fmtNum(m.actualNumero)} de ${m.unidad}${fmtNum(m.objetivoNumero)}`;
    }
    return "Avance manual";
  };

  const horizonteLabel = (value) => HORIZONTES.find((h) => h.value === value)?.label || value;

  /* ===== Render de una card ===== */
  const renderCard = (meta) => {
    const progreso = progressOf(meta);
    const dias = daysUntil(meta.fechaObjetivo);
    const vencida = meta.estado === "activa" && dias !== null && dias < 0;

    return (
      <button
        type="button"
        key={meta._id}
        className={`${style.card} ${meta.estado === "completada" ? style.cardCompletada : ""} ${
          meta.estado === "pausada" ? style.cardPausada : ""
        }`}
        onClick={() => setDetalle(meta)}
      >
        <div className={style.cardTop}>
          <span className={`${style.pill} ${style[`pill_${meta.horizonte}`]}`}>
            {horizonteLabel(meta.horizonte)}
          </span>
          {meta.area ? <span className={style.pillArea}>{meta.area}</span> : null}
          {meta.estado === "pausada" ? (
            <span className={style.pillPausada}>En pausa</span>
          ) : null}
        </div>

        <h3 className={style.cardTitulo}>{meta.titulo}</h3>
        {meta.descripcion ? <p className={style.cardDesc}>{meta.descripcion}</p> : null}

        <div className={style.progressRow}>
          <div className={style.progressTrack}>
            <div
              className={`${style.progressFill} ${progreso >= 100 ? style.progressDone : ""}`}
              style={{ width: `${progreso}%` }}
            />
          </div>
          <span className={style.progressPct}>{progreso}%</span>
        </div>

        <div className={style.cardFoot}>
          <span className={style.medida}>{medidaLabel(meta)}</span>
          <span className={`${style.due} ${vencida ? style.dueVencida : ""}`}>
            {dueLabel(meta)}
          </span>
        </div>
      </button>
    );
  };

  /* ===== Panel de detalle ===== */
  const renderDetalle = () => {
    const meta = detalle;
    const progreso = progressOf(meta);
    const todosHechos =
      meta.medicion === "hitos" && meta.hitos.length > 0 && meta.hitos.every((h) => h.hecho);

    return (
      <div className={style.overlay} onClick={() => setDetalle(null)}>
        <div className={style.panel} onClick={(e) => e.stopPropagation()}>
          <div className={style.panelHead}>
            <div className={style.panelPills}>
              <span className={`${style.pill} ${style[`pill_${meta.horizonte}`]}`}>
                {horizonteLabel(meta.horizonte)}
              </span>
              {meta.area ? <span className={style.pillArea}>{meta.area}</span> : null}
            </div>
            <div className={style.panelHeadActions}>
              <button
                type="button"
                className={style.iconBtn}
                onClick={() => abrirEditar(meta)}
                title="Editar meta"
                aria-label="Editar meta"
              >
                <FiEdit2 />
              </button>
              <button
                type="button"
                className={`${style.iconBtn} ${style.iconBtnRojo}`}
                onClick={() => eliminar(meta)}
                title="Eliminar meta"
                aria-label="Eliminar meta"
              >
                <FiTrash2 />
              </button>
              <button
                type="button"
                className={style.iconBtn}
                onClick={() => setDetalle(null)}
                aria-label="Cerrar"
              >
                <FiX />
              </button>
            </div>
          </div>

          <h2 className={style.panelTitulo}>{meta.titulo}</h2>
          {meta.descripcion ? <p className={style.panelDesc}>{meta.descripcion}</p> : null}
          <p className={style.panelDue}>{dueLabel(meta)}</p>

          <div className={style.progressRow}>
            <div className={style.progressTrack}>
              <div
                className={`${style.progressFill} ${progreso >= 100 ? style.progressDone : ""}`}
                style={{ width: `${progreso}%` }}
              />
            </div>
            <span className={style.progressPct}>{progreso}%</span>
          </div>

          {/* Avance según el tipo de medición */}
          {meta.medicion === "hitos" ? (
            <div className={style.hitosBox}>
              <p className={style.boxLabel}>Hitos</p>
              {meta.hitos.length === 0 ? (
                <p className={style.hitosVacio}>
                  Sumá pasos chicos: hacen que la meta grande se sienta alcanzable.
                </p>
              ) : (
                <ul className={style.hitosLista}>
                  {meta.hitos.map((hito, indice) => (
                    <li key={indice} className={style.hitoItem}>
                      <button
                        type="button"
                        className={`${style.hitoCheck} ${hito.hecho ? style.hitoCheckOn : ""}`}
                        onClick={() => toggleHito(meta, indice)}
                        aria-label={hito.hecho ? "Desmarcar hito" : "Marcar hito"}
                      >
                        {hito.hecho ? <FiCheck /> : null}
                      </button>
                      <span className={`${style.hitoTexto} ${hito.hecho ? style.hitoHecho : ""}`}>
                        {hito.texto}
                      </span>
                      <button
                        type="button"
                        className={style.hitoBorrar}
                        onClick={() => borrarHito(meta, indice)}
                        aria-label="Borrar hito"
                      >
                        <FiTrash2 />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className={style.hitoAddRow}>
                <input
                  className={style.input}
                  value={hitoNuevo}
                  onChange={(e) => setHitoNuevo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarHito(meta);
                    }
                  }}
                  placeholder="Nuevo hito…"
                />
                <button type="button" className={style.btnChico} onClick={() => agregarHito(meta)}>
                  <FiPlus /> Agregar
                </button>
              </div>
              {todosHechos && meta.estado === "activa" ? (
                <p className={style.festejo}>🎉 ¡Todos los hitos cumplidos! Marcala como completada.</p>
              ) : null}
            </div>
          ) : null}

          {meta.medicion === "numero" ? (
            <div className={style.hitosBox}>
              <p className={style.boxLabel}>Avance</p>
              <p className={style.numeroActual}>
                {meta.unidad}
                {fmtNum(meta.actualNumero)}{" "}
                <span className={style.numeroObjetivo}>
                  de {meta.unidad}
                  {fmtNum(meta.objetivoNumero)}
                </span>
              </p>
              <div className={style.hitoAddRow}>
                <input
                  className={style.input}
                  type="number"
                  value={numeroNuevo}
                  onChange={(e) => setNumeroNuevo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      registrarAvance(meta);
                    }
                  }}
                  placeholder={`Nuevo valor (${meta.unidad || "total"} acumulado)`}
                />
                <button type="button" className={style.btnChico} onClick={() => registrarAvance(meta)}>
                  <FiCheck /> Registrar
                </button>
              </div>
            </div>
          ) : null}

          {meta.medicion === "manual" ? (
            <div className={style.hitosBox}>
              <p className={style.boxLabel}>Avance manual</p>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={meta.progresoManual || 0}
                className={style.slider}
                onChange={(e) => cambiarManual(meta, Number(e.target.value))}
                onMouseUp={(e) => guardarManual(meta, Number(e.target.value))}
                onTouchEnd={(e) => guardarManual(meta, Number(e.target.value))}
              />
            </div>
          ) : null}

          {/* Acciones de estado */}
          <div className={style.panelAcciones}>
            {meta.estado === "activa" ? (
              <>
                <button
                  type="button"
                  className={style.btnCompletar}
                  onClick={() => cambiarEstado(meta, "completada")}
                >
                  <FiCheckCircle /> Marcar completada
                </button>
                <button
                  type="button"
                  className={style.btnSecundario}
                  onClick={() => cambiarEstado(meta, "pausada")}
                >
                  <FiPause /> Pausar
                </button>
              </>
            ) : (
              <button
                type="button"
                className={style.btnCompletar}
                onClick={() => cambiarEstado(meta, "activa")}
              >
                <FiPlay /> {meta.estado === "completada" ? "Reabrir meta" : "Reactivar"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ===== Formulario crear / editar ===== */
  const renderForm = () => (
    <div className={style.overlay} onClick={() => setForm(null)}>
      <form className={style.panel} onClick={(e) => e.stopPropagation()} onSubmit={guardarForm}>
        <div className={style.panelHead}>
          <h2 className={style.panelTitulo}>{form.id ? "Editar meta" : "Nueva meta"}</h2>
          <button
            type="button"
            className={style.iconBtn}
            onClick={() => setForm(null)}
            aria-label="Cerrar"
          >
            <FiX />
          </button>
        </div>

        <label className={style.campo}>
          <span>¿Qué querés lograr?</span>
          <input
            className={style.input}
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ej: Ahorrar para el viaje a Bariloche"
            autoFocus
          />
        </label>

        <label className={style.campo}>
          <span>Detalle (opcional)</span>
          <textarea
            className={`${style.input} ${style.textarea}`}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Por qué importa, cómo lo vas a encarar…"
            rows={2}
          />
        </label>

        <div className={style.campo}>
          <span>Plazo</span>
          <div className={style.chipsRow}>
            {HORIZONTES.map((h) => (
              <button
                key={h.value}
                type="button"
                className={`${style.chip} ${form.horizonte === h.value ? style.chipActivo : ""}`}
                onClick={() => setForm({ ...form, horizonte: h.value })}
                title={h.hint}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        <div className={style.dosCol}>
          <label className={style.campo}>
            <span>Área</span>
            <input
              className={style.input}
              list="areas-metas"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              placeholder="Finanzas, Salud…"
            />
            <datalist id="areas-metas">
              {AREAS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>

          <label className={style.campo}>
            <span>Fecha objetivo (opcional)</span>
            <input
              className={style.input}
              type="date"
              value={form.fechaObjetivo}
              onChange={(e) => setForm({ ...form, fechaObjetivo: e.target.value })}
            />
          </label>
        </div>

        <div className={style.campo}>
          <span>¿Cómo medís el avance?</span>
          <div className={style.chipsRow}>
            {MEDICIONES.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`${style.chip} ${form.medicion === m.value ? style.chipActivo : ""}`}
                onClick={() => setForm({ ...form, medicion: m.value })}
                title={m.hint}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {form.medicion === "numero" ? (
          <div className={style.tresCol}>
            <label className={style.campo}>
              <span>Objetivo</span>
              <input
                className={style.input}
                type="number"
                value={form.objetivoNumero}
                onChange={(e) => setForm({ ...form, objetivoNumero: e.target.value })}
                placeholder="500000"
              />
            </label>
            <label className={style.campo}>
              <span>Llevás</span>
              <input
                className={style.input}
                type="number"
                value={form.actualNumero}
                onChange={(e) => setForm({ ...form, actualNumero: e.target.value })}
                placeholder="0"
              />
            </label>
            <label className={style.campo}>
              <span>Unidad</span>
              <input
                className={style.input}
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                placeholder="$, km, libros"
              />
            </label>
          </div>
        ) : null}

        {form.medicion === "hitos" ? (
          <div className={style.campo}>
            <span>Hitos iniciales (podés sumar más después)</span>
            {form.hitos.map((hito, indice) => (
              <div key={indice} className={style.hitoAddRow}>
                <input
                  className={style.input}
                  value={hito.texto}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      hitos: form.hitos.map((h, i) =>
                        i === indice ? { ...h, texto: e.target.value } : h
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className={style.iconBtn}
                  onClick={() =>
                    setForm({ ...form, hitos: form.hitos.filter((_, i) => i !== indice) })
                  }
                  aria-label="Quitar hito"
                >
                  <FiTrash2 />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={style.btnChico}
              onClick={() =>
                setForm({ ...form, hitos: [...form.hitos, { texto: "", hecho: false }] })
              }
            >
              <FiPlus /> Agregar hito
            </button>
          </div>
        ) : null}

        <button type="submit" className={style.btnGuardar} disabled={!form.titulo.trim() || guardando}>
          {guardando ? "Guardando…" : form.id ? "Guardar cambios" : "Crear meta"}
        </button>
      </form>
    </div>
  );

  return (
    <section className={style.page}>
      <header className={style.header}>
        <div>
          <p className={style.kicker}>Metas</p>
          <h1 className={style.titulo}>Tus metas</h1>
        </div>
        <button type="button" className={style.btnNueva} onClick={abrirCrear}>
          <FiPlus /> Nueva meta
        </button>
      </header>

      {/* Resumen */}
      <div className={style.stats}>
        <div className={style.stat}>
          <FiTarget className={style.statIcono} />
          <div>
            <p className={style.statNumero}>{stats.activas}</p>
            <p className={style.statLabel}>En curso</p>
          </div>
        </div>
        <div className={style.stat}>
          <FiCheckCircle className={style.statIcono} />
          <div>
            <p className={style.statNumero}>{stats.completadas}</p>
            <p className={style.statLabel}>Completadas</p>
          </div>
        </div>
        <div className={style.stat}>
          <FiFlag className={style.statIcono} />
          <div>
            <p className={style.statNumero}>{stats.promedio}%</p>
            <p className={style.statLabel}>Avance promedio</p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      {metas.length > 0 ? (
        <div className={style.chartsGrid}>
          <article className={style.chartCard}>
            <p className={style.boxLabel}>Metas por plazo</p>
            <div className={style.donutLayout}>
              <div
                className={style.donut}
                style={{ background: buildConicGradient(plazoItems) }}
                aria-label="Distribución de metas por plazo"
              >
                <div className={style.donutHole}>
                  <strong>{plazoItems.reduce((a, i) => a + i.value, 0)}</strong>
                  <span>en curso</span>
                </div>
              </div>
              <div className={style.legend}>
                {plazoItems.map((item) => (
                  <div key={item.label} className={style.legendItem}>
                    <i style={{ background: item.color }} />
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className={style.chartCard}>
            <p className={style.boxLabel}>Avance de tus metas activas</p>
            {barrasAvance.length === 0 ? (
              <p className={style.vacio}>No hay metas activas para graficar.</p>
            ) : (
              <div className={style.barList}>
                {barrasAvance.map((b) => (
                  <div key={b.id} className={style.barRow}>
                    <span className={style.barNombre} title={b.titulo}>
                      {b.titulo}
                    </span>
                    <div className={style.barTrack}>
                      <div
                        className={style.barFill}
                        style={{
                          width: `${b.progreso}%`,
                          background: PLAZO_COLORS[b.horizonte] || "#5dc72d",
                        }}
                      />
                    </div>
                    <span className={style.barPct}>{b.progreso}%</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}

      {/* Filtros */}
      <div className={style.filtros}>
        <div className={style.chipsRow}>
          {[{ value: "todas", label: "Todas" }, ...HORIZONTES].map((h) => (
            <button
              key={h.value}
              type="button"
              className={`${style.chip} ${horizonteFiltro === h.value ? style.chipActivo : ""}`}
              onClick={() => setHorizonteFiltro(h.value)}
            >
              {h.label}
            </button>
          ))}
        </div>
        <div className={style.chipsRow}>
          {[
            { value: "activa", label: "Activas" },
            { value: "pausada", label: "Pausadas" },
            { value: "completada", label: "Completadas" },
            { value: "todas", label: "Todas" },
          ].map((e) => (
            <button
              key={e.value}
              type="button"
              className={`${style.chip} ${estadoFiltro === e.value ? style.chipActivo : ""}`}
              onClick={() => setEstadoFiltro(e.value)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {cargando ? (
        <p className={style.vacio}>Cargando tus metas…</p>
      ) : visibles.length === 0 ? (
        <div className={style.vacioBox}>
          <FiTarget className={style.vacioIcono} />
          <p className={style.vacioTitulo}>
            {metas.length === 0 ? "Todavía no tenés metas" : "Nada por acá con estos filtros"}
          </p>
          <p className={style.vacioTexto}>
            {metas.length === 0
              ? "Arrancá con una meta corta y concreta: es la forma más fácil de agarrar ritmo."
              : "Probá cambiando el plazo o el estado."}
          </p>
          {metas.length === 0 ? (
            <button type="button" className={style.btnNueva} onClick={abrirCrear}>
              <FiPlus /> Crear mi primera meta
            </button>
          ) : null}
        </div>
      ) : (
        <div className={style.grid}>{visibles.map(renderCard)}</div>
      )}

      {detalle ? renderDetalle() : null}
      {form ? renderForm() : null}
    </section>
  );
}

export default MetasPage;
