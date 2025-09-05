import { useMemo } from 'react';
import { jwtDecode } from 'jwt-decode';
import style from '../style/Nav.module.css';
import { NavLink } from 'react-router-dom';

function Nav({ token, onLogout }) {
  const userData = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch (error) {
      console.error("Error al decodificar el token:", error);
      return null;
    }
  }, [token]);

  // Esta función decide qué clase aplicar basado en si el enlace está activo
  const getNavLinkClass = ({ isActive }) => {
    return isActive ? `${style.navLink} ${style.activeLink}` : style.navLink;
  };

  return (
    <div className={style.container}>
      <nav className={style.nav}>
        <div className={style.containerLogo}>
          <img className={style.logo} src="/logo.png" alt="logo" />
          <p className={style.nameLogo}>growth</p>
        </div>

        <div className={style.navItems}>
          {/* 👇 CORRECCIÓN: Usamos la FUNCIÓN, no la clase de CSS 👇 */}
          <NavLink to="/" className={getNavLinkClass}>
            <img src="/homedos.png" alt="home2" />
            <p>Home</p>
          </NavLink>
          <NavLink to="/notas" className={getNavLinkClass}>
            <img src="/tarea.png" alt="tasklist" />
            <p>Tareas</p>
          </NavLink>
          <NavLink to="/notes" className={getNavLinkClass}>
            <img src="/notas.png" alt="notes" />
            <p>Notas</p>
          </NavLink>
          <NavLink to="/help" className={getNavLinkClass}>
            <img src="/help.png" alt="help" />
            <p>Ayuda</p>
          </NavLink>
          <NavLink to="/settings" className={getNavLinkClass}>
            <img src="/settings.png" alt="settings" />
            <p>Ajustes</p>
          </NavLink>
        </div>

        {token && userData ? (
          <div className={style.userActions}>
            <div className={style.user}>
              <p>Hola, {userData.username || 'Usuario'}!</p>
              <img className={style.imgUser} src="" alt="user" />
            </div>
            <button onClick={onLogout} className={style.logoutButton}>
              Cerrar Sesión
            </button>
          </div>
        ) : (
          <div></div>
        )}
      </nav>
    </div>
  );
}

export default Nav;