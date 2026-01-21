import { useMemo } from "react";
import { jwtDecode } from "jwt-decode";
import style from "../style/Nav.module.css";
import { NavLink, useNavigate } from "react-router-dom";

function Nav({ token, onLogout }) {
  const navigate = useNavigate();

  const userData = useMemo(() => {
    if (!token) return null;
    try {
      const decoded = jwtDecode(token);
      
      // ✅ Opcional: Verificar si el token ya expiró en el cliente
      const currentTime = Date.now() / 1000;
      if (decoded.exp < currentTime) {
        console.warn("El token ha expirado.");
        // Podríamos forzar logout aquí, pero el Interceptor de Axios 
        // lo hará apenas intentes hacer un fetch, lo cual es más seguro.
      }
      
      return decoded;
    } catch (error) {
      console.error("Token inválido:", error);
      return null;
    }
  }, [token]);

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

        {/* ✅ Links solo si hay token */}
        {token && (
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

        {/* ✅ User actions: Cambié la condición para que si hay token pero userData falla, no rompa */}
        {token && (
          <div className={style.userActions}>
            <div className={style.user}>
              <p>Hola, {userData?.username || "Usuario"}!</p>
            </div>
            <button onClick={handleLogout} className={style.logoutButton}>
              Cerrar Sesión
            </button>
          </div>
        )}

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