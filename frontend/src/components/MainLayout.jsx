import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Nav from "./Nav";
import LeftsSite from "./LeftsSite";
import LeftSideNotas from "./LeftSideNotas";

function MainLayout({ onLogout, taskToEdit, onTaskUpdate, refreshKey, onUpdate }) {
  const location = useLocation();
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  // 1. Obtenemos el token localmente para decidir si mostrar el sidebar
  const currentToken = localStorage.getItem("token") || sessionStorage.getItem("token");

  useEffect(() => {
    if (isNotesOpen && window.innerWidth <= 1000) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => (document.body.style.overflow = "");
  }, [isNotesOpen]);

  // 2. Mapeo de Sidebars: YA NO pasamos 'token={token}'
  const sidebarMap = {
    "/notas": (
      <LeftSideNotas
        onTaskUpdate={onTaskUpdate}
        onUpdate={onUpdate}
        taskToEdit={taskToEdit}
        // El token ya lo saca de api.js internamente
      />
    ),
  };

  // 3. Sidebar por defecto: YA NO pasamos 'token={token}'
  const DefaultSidebar = <LeftsSite refreshKey={refreshKey} />;
  const CurrentSidebar = sidebarMap[location.pathname];

  return (
    <div>
      {/* El Nav ahora es independiente */}
      <Nav onLogout={onLogout} />
      
      <main style={{ display: "flex" }}>
        {/* Usamos el token del storage para la condición visual */}
        {currentToken ? (CurrentSidebar || DefaultSidebar) : null}

        <div style={{ flex: 1 }}>
          <Outlet context={{ isNotesOpen, setIsNotesOpen }} />
        </div>
      </main>
    </div>
  );
}

export default MainLayout;