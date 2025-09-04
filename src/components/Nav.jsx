// Nav.jsx (Versión Final con Nombre de Usuario Dinámico)

import { useMemo } from 'react'; // <-- 1. Importamos useMemo
import { jwtDecode } from 'jwt-decode'; // <-- 2. Importamos la librería que instalaste
import style from '../style/Nav.module.css';
import { Link } from 'react-router-dom';

function Nav({ token, onLogout }) {

  // 3. Usamos useMemo para decodificar el token de forma eficiente
  const userData = useMemo(() => {
    // Si no hay token, no hay datos de usuario
    if (!token) {
      return null;
    }
    try {
      // Decodificamos el token y devolvemos el payload (los datos del usuario)
      return jwtDecode(token);
    } catch (error) {
      console.error("Error al decodificar el token:", error);
      // Si el token es inválido, tampoco hay datos de usuario
      return null;
    }
  }, [token]); // Esto se ejecutará de nuevo solo si el 'token' cambia

  return (
    <div className={style.container}>
      <nav className={style.nav}>
        <div className={style.containerLogo}>
          <img className={style.logo} src="./logo.png" alt="logo" />
          <p className={style.nameLogo}>growth</p>
        </div>

        <div className={style.navItems}>
     
          <Link to="/" className={style.navItemHome}>
            <img className={style.imgItem} src="./home.png" alt="home" />
            <p className={style.textItem}>Home</p>
          </Link>
          <div className={style.containerImg}>

            <Link to="/notas" className={style.link}>
             <img src="./tasklist.png" alt="tasklist" />
              <p>Tareas</p>
            </Link>
            <div className={style.link}>
               <img src="./notes.png" alt="notes" />
              
              <p>Notas</p>
            </div>
            <div className={style.link}>
              <img src="./help.png" alt="help" />
              <p>Ayuda</p>
            </div>
            <div className={style.link}>
              <img src="./settings.png" alt="settings" />
              <p>Ajustes</p>
            </div>
          </div>
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