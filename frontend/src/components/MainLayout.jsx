import { Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import Nav from "./Nav";
import LeftsSite from "./LeftsSite";
import LeftSideNotas from "./LeftSideNotas";
import SettingsSidePanel from "./SettingsSidePanel";
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
  theme,
  onThemeToggle,
  activeWorkspace,
  onWorkspaceChange,
}) {
  const location = useLocation();
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 1000 : false
  );

  // 1. Obtenemos el token localmente para decidir si mostrar el sidebar
  const currentToken = localStorage.getItem("token") || sessionStorage.getItem("token");

  useEffect(() => {
    if ((isNotesOpen || isMobileMenuOpen || isMobilePanelOpen) && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => (document.body.style.overflow = "");
  }, [isMobile, isMobileMenuOpen, isMobilePanelOpen, isNotesOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1000px)");

    const handleResize = (event) => {
      setIsMobile(event.matches);

      if (!event.matches) {
        setIsMobileMenuOpen(false);
        setIsMobilePanelOpen(false);
      }
    };

    handleResize(mediaQuery);
    mediaQuery.addEventListener("change", handleResize);

    return () => mediaQuery.removeEventListener("change", handleResize);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsMobilePanelOpen(false);
  }, [location.pathname]);

  // 2. Mapeo de Sidebars: YA NO pasamos 'token={token}'
  const sidebarMap = {
    "/tareas": (
      <LeftSideNotas
        onTaskUpdate={onTaskUpdate}
        onUpdate={onUpdate}
        taskToEdit={taskToEdit}
        refreshKey={refreshKey}
        activeWorkspace={activeWorkspace}
        setIsNotesOpen={setIsNotesOpen}
        embeddedMobile={isMobile}
      />
    ),
    "/ajustes": <SettingsSidePanel />,
  };
  const routesWithoutSidebar = new Set(["/notas"]);

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
  const sidebarContent = currentToken
    ? routesWithoutSidebar.has(location.pathname)
      ? null
      : CurrentSidebar || DefaultSidebar
    : null;
  const handleCloseMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const handleCloseMobilePanel = useCallback(() => {
    setIsMobilePanelOpen(false);
  }, []);

  const handleToggleMobileMenu = useCallback(() => {
    setIsMobilePanelOpen(false);
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const handleToggleMobilePanel = useCallback(() => {
    setIsMobileMenuOpen(false);
    setIsMobilePanelOpen((prev) => !prev);
  }, []);

  const handleOpenNotesPanel = useCallback(() => {
    if (!isMobile) return;
    setIsMobileMenuOpen(false);
    setIsMobilePanelOpen(true);
  }, [isMobile]);

  const mobilePanelLabel =
    location.pathname === "/tareas"
      ? "Panel"
      : location.pathname === "/notas"
        ? "Notas"
      : location.pathname === "/ajustes"
        ? "Ajustes"
        : "Dashboard";

  return (
    <div className={style.shell}>
      <Nav
        onLogout={onLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        isMobilePanelOpen={isMobilePanelOpen}
        onToggleMobileMenu={handleToggleMobileMenu}
        onCloseMobileMenu={handleCloseMobileMenu}
        onToggleMobilePanel={handleToggleMobilePanel}
        onCloseMobilePanel={handleCloseMobilePanel}
        panelContent={sidebarContent}
        panelLabel={mobilePanelLabel}
        theme={theme}
        onThemeToggle={onThemeToggle}
        activeWorkspace={activeWorkspace}
        onWorkspaceChange={onWorkspaceChange}
      />

      <main className={style.main}>
        {!isMobile && sidebarContent ? (
          <div className={style.sidebar}>{sidebarContent}</div>
        ) : null}

        <div className={style.content}>
          <Outlet
            context={{
              isNotesOpen,
              setIsNotesOpen,
              openNotesPanel: handleOpenNotesPanel,
            }}
          />
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
