import React from "react";

// Red de seguridad: si algún componente crashea al renderizar (ej. el clásico
// "Objects are not valid as a React child" / error #31), en vez de quedar la
// pantalla en blanco mostramos un mensaje con un botón para recargar.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary capturó un crash de render:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
            background: "#0d1117",
            color: "#e6edf3",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Algo salió mal</h1>
          <p style={{ margin: 0, color: "#9aa4b2", maxWidth: 420 }}>
            Tuvimos un problema al cargar la app. Probá recargar; si sigue,
            esperá unos minutos e intentá de nuevo.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: "0.5rem",
              padding: "0.7rem 1.4rem",
              borderRadius: 12,
              border: "none",
              background: "#2f6f35",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
