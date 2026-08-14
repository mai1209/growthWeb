// Modal para compartir una tarea (tarea colaborativa entre usuarios).
// Buscás por @usuario, invitás, y ves quién ya colabora (pendiente/aceptado).
import { useEffect, useState } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import { taskService } from "../api";
import Modal from "./comunidad/Modal";

function Avatar({ user, size = 38 }) {
  const inicial = (user?.fullName || user?.username || "?").trim().charAt(0).toUpperCase();
  const base = {
    width: size,
    height: size,
    borderRadius: "50%",
    flex: `0 0 ${size}px`,
    objectFit: "cover",
  };
  if (user?.foto) return <img src={user.foto} alt="" style={base} />;
  return (
    <span
      style={{
        ...base,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(93,199,45,0.18)",
        color: "var(--color-verde, #5dc72d)",
        fontWeight: 800,
        fontSize: size * 0.42,
      }}
    >
      {inicial}
    </span>
  );
}

const fila = {
  display: "flex",
  alignItems: "center",
  gap: "0.7rem",
  padding: "0.4rem 0",
};

export default function CompartirTareaModal({ task, onClose, onCambio }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [colaboradores, setColaboradores] = useState(task.colaboradores || []);
  const [invitando, setInvitando] = useState(null);
  const soyOwner = task.soyOwner !== false;
  const taskId = task.id || task._id;

  useEffect(() => {
    const texto = q.trim().replace(/^@/, "");
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const t = setTimeout(() => {
      taskService
        .buscarUsuario(texto)
        .then(({ data }) => setResultados(data?.usuarios || []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const yaEsta = (id) =>
    String(task.owner?.id) === String(id) || colaboradores.some((c) => String(c.id) === String(id));

  const invitar = async (u) => {
    if (invitando) return;
    setInvitando(u.id);
    try {
      await taskService.compartir(taskId, { userId: u.id });
      setColaboradores((prev) => [...prev, { ...u, estado: "pendiente" }]);
      setQ("");
      setResultados([]);
      onCambio && onCambio();
    } catch {
      /* no-op */
    } finally {
      setInvitando(null);
    }
  };

  const quitar = async (u) => {
    setColaboradores((prev) => prev.filter((c) => String(c.id) !== String(u.id)));
    try {
      await taskService.quitarColaborador(taskId, u.id);
      onCambio && onCambio();
    } catch {
      /* no-op */
    }
  };

  const chip = (estado) => ({
    fontSize: "0.72rem",
    fontWeight: 800,
    padding: "0.2rem 0.6rem",
    borderRadius: 999,
    background: estado === "aceptado" ? "rgba(93,199,45,0.16)" : "var(--surface-hover, rgba(255,255,255,0.06))",
    color: estado === "aceptado" ? "var(--color-verde, #5dc72d)" : "var(--color-muted)",
  });

  return (
    <Modal titulo="Compartir tarea" onClose={onClose}>
      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <div style={{ color: "var(--color-text)", fontSize: "1.05rem", fontWeight: 800 }}>{task.meta}</div>
        <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", lineHeight: 1.45, margin: 0 }}>
          Buscá a la persona por su @usuario. Cuando acepte, van a ver y completar esta tarea los dos.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            border: "1px solid var(--border-color)",
            background: "var(--surface-input, transparent)",
            borderRadius: 10,
            padding: "0.55rem 0.8rem",
          }}
        >
          <FiSearch style={{ color: "var(--color-muted)", flex: "0 0 auto" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="@usuario"
            autoCapitalize="none"
            autoCorrect="off"
            style={{
              flex: "1 1 0",
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--color-text)",
              fontSize: "0.95rem",
            }}
          />
          {buscando ? <span style={{ color: "var(--color-muted)", fontSize: "0.8rem" }}>…</span> : null}
        </div>

        {resultados.length > 0 ? (
          <div
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: 10,
              padding: "0.2rem 0.7rem",
            }}
          >
            {resultados.map((u) => {
              const esta = yaEsta(u.id);
              return (
                <div key={u.id} style={fila}>
                  <Avatar user={u} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "var(--color-text)", fontWeight: 700, fontSize: "0.92rem" }}>
                      {u.fullName || u.username}
                    </div>
                    <div style={{ color: "var(--color-muted)", fontSize: "0.78rem" }}>@{u.username}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => !esta && invitar(u)}
                    disabled={esta || invitando === u.id}
                    style={{
                      cursor: esta ? "default" : "pointer",
                      border: esta ? "1px solid var(--border-color)" : "none",
                      background: esta ? "transparent" : "var(--color-verde, #5dc72d)",
                      color: esta ? "var(--color-muted)" : "var(--accent-contrast, #06210a)",
                      fontWeight: 800,
                      fontSize: "0.8rem",
                      borderRadius: 999,
                      padding: "0.35rem 0.9rem",
                    }}
                  >
                    {invitando === u.id ? "…" : esta ? "Ya está" : "Invitar"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <div
          style={{
            color: "var(--color-muted)",
            fontSize: "0.72rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginTop: "0.2rem",
          }}
        >
          {colaboradores.length > 0 ? "Colaboradores" : "Todavía no compartiste esta tarea"}
        </div>
        {colaboradores.map((c) => (
          <div key={c.id} style={fila}>
            <Avatar user={c} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "var(--color-text)", fontWeight: 700, fontSize: "0.92rem" }}>
                {c.fullName || c.username}
              </div>
              <div style={{ color: "var(--color-muted)", fontSize: "0.78rem" }}>@{c.username}</div>
            </div>
            <span style={chip(c.estado)}>{c.estado === "aceptado" ? "Se unió" : "Pendiente"}</span>
            {soyOwner ? (
              <button
                type="button"
                onClick={() => quitar(c)}
                aria-label="Quitar"
                style={{
                  cursor: "pointer",
                  border: "none",
                  background: "transparent",
                  color: "var(--color-muted)",
                  display: "inline-flex",
                  padding: 4,
                }}
              >
                <FiX />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </Modal>
  );
}
