import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Nav from "./Nav";
import LeftsSite from "./LeftsSite";
import LeftSideNotas from "./LeftSideNotas";

function MainLayout({ token, onLogout, taskToEdit, onTaskUpdate, refreshKey, onUpdate }) {
  const location = useLocation();

  // ✅ 1) Estado ARRIBA (antes de usarlo)
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  // ✅ 2) Bloquear scroll cuando el panel está abierto (solo mobile, opcional)
  useEffect(() => {
    if (isNotesOpen && window.innerWidth <= 1000) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => (document.body.style.overflow = "");
  }, [isNotesOpen]);

  // ✅ 3) Sidebar map ya puede usar setIsNotesOpen
  const sidebarMap = {
    "/notas": (
      <LeftSideNotas
        onTaskUpdate={onTaskUpdate}
        onUpdate={onUpdate}
        taskToEdit={taskToEdit}
        setIsNotesOpen={setIsNotesOpen} // ✅ ahora sí
      />
    ),
  };

  const DefaultSidebar = <LeftsSite token={token} refreshKey={refreshKey} />;
  const CurrentSidebar = sidebarMap[location.pathname];

  return (
    <div>
      <Nav token={token} onLogout={onLogout} />

      <main style={{ display: "flex" }}>
        {token ? (CurrentSidebar || DefaultSidebar) : null}

        <div style={{ flex: 1 }}>
          {/* ✅ solo pasamos isNotesOpen para que Tareas lo lea */}
          <Outlet context={{ isNotesOpen }} />
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
