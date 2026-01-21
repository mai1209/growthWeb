import { useMemo } from "react";
import { jwtDecode } from "jwt-decode";
import style from "../style/Nav.module.css";
import { NavLink, useNavigate } from "react-router-dom";

function Nav({ token, onLogout }) {
  const navigate = useNavigate();

  const userData = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch (error) {
      console.error("Error al decodificar el token:", error);
      return null;
    }
  }, [token]);

  const getNavLinkClass = ({ isActive }) => {
    return isActive ? `${style.navLink} ${style.activeLink}` : style.navLink;
  };

  const handleLogout = () => {
    onLogout();
    navigate("/login"); // ✅ al cerrar sesión, volvés a login
  };

  return (
    <div className={style.container}>
      <nav className={style.nav}>
        <div className={style.containerLogo}>
          <img className={style.logo} src="/logo.png" alt="logo" />
          <p className={style.nameLogo}>growth</p>
        </div>

        {/* ✅ Links SOLO si está logueado */}
        {token ? (
          <div className={style.navItems}>
            <NavLink to="/" className={getNavLinkClass}>
              <img src="/homedos.png" alt="home" />
              <p>Home</p>
            </NavLink>

            <NavLink to="/notas" className={getNavLinkClass}>
              <img src="/tarea.png" alt="tasklist" />
              <p>Tareas</p>
            </NavLink>
          </div>
        ) : (
          <div />
        )}

        {/* ✅ User actions solo si hay sesión válida */}
        {token && userData ? (
          <div className={style.userActions}>
            <div className={style.user}>
              <p>Hola, {userData.username || "Usuario"}!</p>
            </div>
            <button onClick={handleLogout} className={style.logoutButton}>
              Cerrar Sesión
            </button>
          </div>
        ) : (
          <div />
        )}

        {/* ✅ Hamburguesa solo si hay token (si no, confunde) */}
        {token && (
          <button className={style.menuButton} type="button">
            <img src="/menu.png" alt="menu" />
          </button>
        )}
      </nav>
    </div>
  );
}

export default Nav;
