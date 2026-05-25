import { Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import Nav from "./Nav";
import LeftsSite from "./LeftsSite";
import SettingsSidePanel from "./SettingsSidePanel";
import style from "../style/MainLayout.module.css";

function MainLayout({
  onLogout,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 1000 : false
  );

  // 1. Obtenemos el token localmente para decidir si mostrar el sidebar
  const currentToken = localStorage.getItem("token") || sessionStorage.getItem("token");

  useEffect(() => {
    if ((isMobileMenuOpen || isMobilePanelOpen) && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => (document.body.style.overflow = "");
  }, [isMobile, isMobileMenuOpen, isMobilePanelOpen]);

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
    "/ajustes": <SettingsSidePanel />,
  };
  const routesWithDefaultSidebar = new Set(["/", "/filtros"]);

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
    ? CurrentSidebar || (routesWithDefaultSidebar.has(location.pathname) ? DefaultSidebar : null)
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

  const mobilePanelLabel =
    location.pathname === "/notas"
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
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
