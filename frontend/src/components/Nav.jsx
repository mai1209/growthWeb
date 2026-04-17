import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { jwtDecode } from "jwt-decode";
import style from "../style/Nav.module.css";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

function Nav({
  onLogout,
  isMobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
  drawerContent,
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
                >
                  Cerrar
                </button>
              </div>

              <div className={style.mobileNavItems}>
                <NavLink to="/" className={getNavLinkClass} onClick={onCloseMobileMenu}>
                  <img src="/homedos.png" alt="home" />
                  <p>Home</p>
                </NavLink>
                <NavLink
                  to="/notas"
                  className={getNavLinkClass}
                  onClick={onCloseMobileMenu}
                >
                  <img src="/tarea.png" alt="tasklist" />
                  <p>Tareas</p>
                </NavLink>
              </div>

              <div className={style.mobileUserBlock}>
                <p className={style.mobileGreeting}>
                  Hola, {userData?.username || "Usuario"}.
                </p>
                <button onClick={handleLogout} className={style.logoutButton}>
                  Cerrar Sesion
                </button>
              </div>

              {drawerContent ? <div className={style.mobileSidebar}>{drawerContent}</div> : null}
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
            <NavLink to="/notas" className={getNavLinkClass} onClick={onCloseMobileMenu}>
              <img src="/tarea.png" alt="tasklist" />
              <p>Tareas</p>
            </NavLink>
          </div>
        )}

        {currentToken && (
          <div className={style.userActions}>
            <div className={style.user}>
              <p>Hola, {userData?.username || "Usuario"}!</p>
            </div>
            <button onClick={handleLogout} className={style.logoutButton}>
              Cerrar Sesión
            </button>
          </div>
        )}

        {currentToken && (
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
        )}
      </nav>
      </div>
      {mobileMenu}
    </>
  );
}

export default Nav;
