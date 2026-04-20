import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { jwtDecode } from "jwt-decode";
import { FiMoon, FiSettings, FiSun, FiX } from "react-icons/fi";
import style from "../style/Nav.module.css";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

function Nav({
  onLogout,
  isMobileMenuOpen,
  isMobilePanelOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
  onToggleMobilePanel,
  onCloseMobilePanel,
  panelContent,
  panelLabel = "Dashboard",
  theme = "dark",
  onThemeToggle,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  //Buscamos el token directamente aquí para que sea instantáneo
  const currentToken =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  const userData = useMemo(() => {
    if (!currentToken) return null; // Usamos la variable local
    try {
      const decoded = jwtDecode(currentToken);

      return decoded;
    } catch (error) {
      return null;
    }
  }, [currentToken]);

  useEffect(() => {
    onCloseMobileMenu?.();
  }, [location.pathname, onCloseMobileMenu]);

  const getNavLinkClass = ({ isActive }) => {
    return isActive ? `${style.navLink} ${style.activeLink}` : style.navLink;
  };

  const handleLogout = () => {
    onLogout(); // Esto limpia localStorage/sessionStorage en App.js
    navigate("/"); // Mejor ir a la raíz, AppRoutes se encargará de mostrar Login
  };

  const mobileMenu =
    currentToken && isMobileMenuOpen && typeof document !== "undefined"
      ? createPortal(
          <div className={style.mobileMenuShell}>
            <button
              type="button"
              className={style.mobileBackdrop}
              onClick={onCloseMobileMenu}
              aria-label="Cerrar menu"
            />

            <div className={style.mobileDrawer}>
              <div className={style.mobileDrawerHeader}>
                <div>
                  <p className={style.drawerEyebrow}>Menu</p>
                  <h2>{userData?.username || "Usuario"}</h2>
                </div>

                <button
                  type="button"
                  className={style.mobileCloseButton}
                  onClick={onCloseMobileMenu}
                  aria-label="Cerrar menu"
                >
                  <FiX />
                </button>
              </div>

              <div className={style.mobileNavItems}>
                <NavLink to="/" className={getNavLinkClass} onClick={onCloseMobileMenu}>
                  <img src="/homedos.png" alt="home" />
                  <p>Home</p>
                </NavLink>
                <NavLink
                  to="/filtros"
                  className={getNavLinkClass}
                  onClick={onCloseMobileMenu}
                >
                  <img src="/historial.png" alt="filtros" />
                  <p>Filtros</p>
                </NavLink>
                <NavLink
                  to="/compartidos"
                  className={getNavLinkClass}
                  onClick={onCloseMobileMenu}
                >
                  <img src="/lista.png" alt="compartidos" />
                  <p>Compartidos</p>
                </NavLink>
                <NavLink
                  to="/notas"
                  className={getNavLinkClass}
                  onClick={onCloseMobileMenu}
                >
                  <img src="/tarea.png" alt="tasklist" />
                  <p>Tareas</p>
                </NavLink>
                <NavLink
                  to="/ajustes"
                  className={getNavLinkClass}
                  onClick={onCloseMobileMenu}
                >
                  <FiSettings className={style.navIcon} />
                  <p>Ajustes</p>
                </NavLink>
              </div>

              <div className={style.mobileUserBlock}>
                <p className={style.mobileGreeting}>
                  Hola, {userData?.username || "Usuario"}.
                </p>
                <button type="button" onClick={onThemeToggle} className={style.themeButton}>
                  <FiSun className={style.themeIcon} />
                  <span className={style.themeSwitchTrack}>
                    <span className={style.themeSwitchThumb} />
                  </span>
                  <FiMoon className={style.themeIcon} />
                </button>
                <button onClick={handleLogout} className={style.logoutButton}>
                  Cerrar Sesion
                </button>
              </div>

            </div>
          </div>,
          document.body
        )
      : null;

  const mobilePanel =
    currentToken && isMobilePanelOpen && typeof document !== "undefined"
      ? createPortal(
          <div className={style.mobileMenuShell}>
            <button
              type="button"
              className={style.mobileBackdrop}
              onClick={onCloseMobilePanel}
              aria-label={`Cerrar ${panelLabel.toLowerCase()}`}
            />

            <div className={`${style.mobileDrawer} ${style.mobilePanelDrawer}`}>
              <div className={style.mobileDrawerHeader}>
                <div>
                  <p className={style.drawerEyebrow}>{panelLabel}</p>
                  <h2>{panelLabel === "Dashboard" ? "Resumen lateral" : "Panel de notas"}</h2>
                </div>

                <button
                  type="button"
                  className={style.mobileCloseButton}
                  onClick={onCloseMobilePanel}
                  aria-label={`Cerrar ${panelLabel.toLowerCase()}`}
                >
                  <FiX />
                </button>
              </div>

              {panelContent ? <div className={style.mobileSidebar}>{panelContent}</div> : null}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className={style.container}>
      <nav className={style.nav}>
        <div className={style.containerLogo}>
          <img className={style.logo} src="/logo.png" alt="logo" />
          <p className={style.nameLogo}>growth</p>
        </div>

        {currentToken && (
          <div className={style.navItems}>
            <NavLink to="/" className={getNavLinkClass} onClick={onCloseMobileMenu}>
              <img src="/homedos.png" alt="home" />
              <p>Home</p>
            </NavLink>
            <NavLink to="/filtros" className={getNavLinkClass} onClick={onCloseMobileMenu}>
              <img src="/historial.png" alt="filtros" />
              <p>Filtros</p>
            </NavLink>
            <NavLink to="/compartidos" className={getNavLinkClass} onClick={onCloseMobileMenu}>
              <img src="/lista.png" alt="compartidos" />
              <p>Compartidos</p>
            </NavLink>
            <NavLink to="/notas" className={getNavLinkClass} onClick={onCloseMobileMenu}>
              <img src="/tarea.png" alt="tasklist" />
              <p>Tareas</p>
            </NavLink>
            <NavLink to="/ajustes" className={getNavLinkClass} onClick={onCloseMobileMenu}>
              <FiSettings className={style.navIcon} />
              <p>Ajustes</p>
            </NavLink>
          </div>
        )}

        {currentToken && (
          <div className={style.userActions}>
            <div className={style.user}>
              <p>Hola, {userData?.username || "Usuario"}!</p>
            </div>
            <button type="button" onClick={onThemeToggle} className={style.themeButton}>
              <FiSun className={style.themeIcon} />
              <span className={style.themeSwitchTrack}>
                <span className={style.themeSwitchThumb} />
              </span>
              <FiMoon className={style.themeIcon} />
            </button>
            <button onClick={handleLogout} className={style.logoutButton}>
              Cerrar Sesión
            </button>
          </div>
        )}

        {currentToken && (
          <div className={style.mobileActions}>
            <button
              className={style.panelButton}
              type="button"
              onClick={onToggleMobilePanel}
            >
              {panelLabel}
            </button>

            <button
              className={style.menuButton}
              type="button"
              onClick={onToggleMobileMenu}
              aria-label="Abrir menu"
            >
              <span className={style.menuBar} />
              <span className={style.menuBar} />
              <span className={style.menuBar} />
            </button>
          </div>
        )}
      </nav>
      </div>
      {mobileMenu}
      {mobilePanel}
    </>
  );
}

export default Nav;
