import { useMemo } from "react";
import { jwtDecode } from "jwt-decode";
import style from "../style/Nav.module.css";
import { NavLink, useNavigate } from "react-router-dom";

function Nav({ onLogout }) {
  const navigate = useNavigate();
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

  const getNavLinkClass = ({ isActive }) => {
    return isActive ? `${style.navLink} ${style.activeLink}` : style.navLink;
  };

  const handleLogout = () => {
    onLogout(); // Esto limpia localStorage/sessionStorage en App.js
    navigate("/"); // Mejor ir a la raíz, AppRoutes se encargará de mostrar Login
  };

  return (
    <div className={style.container}>
      <nav className={style.nav}>
        <div className={style.containerLogo}>
          <img className={style.logo} src="/logo.png" alt="logo" />
          <p className={style.nameLogo}>growth</p>
        </div>

        {/* Cambiamos las condiciones para usar 'currentToken' */}
        {currentToken && (
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
          <button className={style.menuButton} type="button">
            <img src="/menu.png" alt="menu" />
          </button>
        )}
      </nav>
    </div>
  );
}

export default Nav;
