import { Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import Nav from "./Nav";
import LeftsSite from "./LeftsSite";
import LeftSideNotas from "./LeftSideNotas";
import style from "../style/MainLayout.module.css";

function MainLayout({
  onLogout,
  taskToEdit,
  onTaskUpdate,
  refreshKey,
  onUpdate,
  movimientos,
  panelCurrency,
  onPanelCurrencyChange,
}) {
  const location = useLocation();
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 1000 : false
  );

  // 1. Obtenemos el token localmente para decidir si mostrar el sidebar
  const currentToken = localStorage.getItem("token") || sessionStorage.getItem("token");

  useEffect(() => {
    if ((isNotesOpen || isMobileMenuOpen) && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => (document.body.style.overflow = "");
  }, [isMobile, isMobileMenuOpen, isNotesOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1000px)");

    const handleResize = (event) => {
      setIsMobile(event.matches);

      if (!event.matches) {
        setIsMobileMenuOpen(false);
      }
    };

    handleResize(mediaQuery);
    mediaQuery.addEventListener("change", handleResize);

    return () => mediaQuery.removeEventListener("change", handleResize);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // 2. Mapeo de Sidebars: YA NO pasamos 'token={token}'
  const sidebarMap = {
    "/notas": (
      <LeftSideNotas
        onTaskUpdate={onTaskUpdate}
        onUpdate={onUpdate}
        taskToEdit={taskToEdit}
        refreshKey={refreshKey}
        setIsNotesOpen={setIsNotesOpen}
        embeddedMobile={isMobile}
      />
    ),
  };

  // 3. Sidebar por defecto: YA NO pasamos 'token={token}'
  const DefaultSidebar = (
    <LeftsSite
      refreshKey={refreshKey}
      movimientos={movimientos}
      currentCurrency={panelCurrency}
      onCurrencyChange={onPanelCurrencyChange}
    />
  );
  const CurrentSidebar = sidebarMap[location.pathname];
  const sidebarContent = currentToken ? (CurrentSidebar || DefaultSidebar) : null;
  const handleCloseMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const handleToggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  return (
    <div className={style.shell}>
      <Nav
        onLogout={onLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={handleToggleMobileMenu}
        onCloseMobileMenu={handleCloseMobileMenu}
        drawerContent={sidebarContent}
      />

      <main className={style.main}>
        {!isMobile && sidebarContent ? (
          <div className={style.sidebar}>{sidebarContent}</div>
        ) : null}

        <div className={style.content}>
          <Outlet context={{ isNotesOpen, setIsNotesOpen }} />
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
