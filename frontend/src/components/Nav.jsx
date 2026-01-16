import { useMemo } from "react";
import { jwtDecode } from "jwt-decode";
import style from "../style/Nav.module.css";
import { NavLink } from "react-router-dom";

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

  const getNavLinkClass = ({ isActive }) => {
    return isActive ? `${style.navLink} ${style.activeLink}` : style.navLink;
  };



  ///LOS LINKS QUE FALTAN EN EL MENU
  //   <NavLink to="/notes" className={getNavLinkClass}>
  //           <img src="/notas.png" alt="notes" />
  //         <p>Notas</p>
  //     </NavLink>
  //   <NavLink to="/help" className={getNavLinkClass}>
  //   <img src="/help.png" alt="help" />
  // <p>Ayuda</p>
  //</NavLink>
  //<NavLink to="/settings" className={getNavLinkClass}>
  // <img src="/settings.png" alt="settings" />
  //<p>Ajustes</p>
  //</NavLink>

  return (
    <div className={style.container}>
      <nav className={style.nav}>
        <div className={style.containerLogo}>
          <img className={style.logo} src="/logo.png" alt="logo" />
          <p className={style.nameLogo}>growth</p>
        </div>

        <div className={style.navItems}>
          <NavLink to="/" className={getNavLinkClass}>
            <img src="/homedos.png" alt="home2" />
            <p>Home</p>
          </NavLink>
          <NavLink to="/notas" className={getNavLinkClass}>
            <img src="/tarea.png" alt="tasklist" />
            <p>Tareas</p>
          </NavLink>
        </div>

        {token && userData ? (
          <div className={style.userActions}>
            <div className={style.user}>
              <p>Hola, {userData.username || "Usuario"}!</p>
            </div>
            <button onClick={onLogout} className={style.logoutButton}>
              Cerrar Sesión
            </button>
          </div>
        ) : (
          <div></div>
        )}
        <button className={style.menuButton}>
          <img src="./menu.png" alt="menuHamburguesass" />
        </button>
      </nav>
    </div>
  );
}

export default Nav;
