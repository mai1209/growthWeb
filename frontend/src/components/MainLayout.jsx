import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Nav from "./Nav";
import LeftsSite from "./LeftsSite";
import LeftSideNotas from "./LeftSideNotas";

function MainLayout({ token, onLogout, taskToEdit, onTaskUpdate, refreshKey, onUpdate }) {
  const location = useLocation();
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  useEffect(() => {
    if (isNotesOpen && window.innerWidth <= 1000) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => (document.body.style.overflow = "");
  }, [isNotesOpen]);

  const sidebarMap = {
    "/notas": (
      <LeftSideNotas
        onTaskUpdate={onTaskUpdate}
        onUpdate={onUpdate}
        taskToEdit={taskToEdit}
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
          {/* ✅ pasar ambos por context */}
          <Outlet context={{ isNotesOpen, setIsNotesOpen }} />
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
