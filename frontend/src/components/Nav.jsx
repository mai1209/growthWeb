import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { jwtDecode } from "jwt-decode";
import { FiMoon, FiPieChart, FiSettings, FiSun, FiX, FiLogOut, FiHome, FiFilter, FiShare2, FiCheckSquare } from "react-icons/fi";
import style from "../style/Nav.module.css";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { authService } from "../api";

// Definición centralizada de rutas para evitar repetición
const NAV_LINKS = [
  { to: "/", label: "Home", icon: <FiHome className={style.navIcon} /> },
  { to: "/filtros", label: "Filtros", icon: <FiFilter className={style.navIcon} /> },
  { to: "/compartidos", label: "Compartidos", icon: <FiShare2 className={style.navIcon} /> },
  { to: "/metricas", label: "Métricas", icon: <FiPieChart className={style.navIcon} /> },
  { to: "/notas", label: "Tareas", icon: <FiCheckSquare className={style.navIcon} /> },
  { to: "/ajustes", label: "Ajustes", icon: <FiSettings className={style.navIcon} /> },
];

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
  onThemeToggle,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);

  const currentToken = localStorage.getItem("token") || sessionStorage.getItem("token");

  const userData = useMemo(() => {
    if (!currentToken) return null;
    try {
      return jwtDecode(currentToken);
    } catch {
      return null;
    }
  }, [currentToken]);

  useEffect(() => {
    if (!currentToken) {
      setProfile(null);
      return;
    }

    let isMounted = true;
    const loadProfile = async () => {
      try {
        const response = await authService.getProfile();
        if (isMounted) setProfile(response.data);
      } catch (error) {
        if (isMounted) setProfile(null);
      }
    };

    const handleProfileUpdate = (event) => setProfile(event.detail || null);
    
    loadProfile();
    window.addEventListener("growth-profile-updated", handleProfileUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("growth-profile-updated", handleProfileUpdate);
    };
  }, [currentToken]);

  useEffect(() => {
    onCloseMobileMenu?.();
  }, [location.pathname, onCloseMobileMenu]);

  const displayName = profile?.fullName || userData?.username || "Usuario";
  const initials = (displayName[0] || "U").toUpperCase();

  const handleLogout = () => {
    onLogout();
    navigate("/");
  };

  const getNavLinkClass = ({ isActive }) => 
    isActive ? `${style.navLink} ${style.activeLink}` : style.navLink;

  // --- COMPONENTES INTERNOS PARA EVITAR REPETICIÓN ---
  const NavItems = () => (
    <>
      {NAV_LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} className={getNavLinkClass} onClick={onCloseMobileMenu}>
          {link.icon}
          <span>{link.label}</span>
        </NavLink>
      ))}
    </>
  );

  return (
    <>
      <header className={style.header}>
        <nav className={style.nav}>
          <div className={style.logoSection} onClick={() => navigate("/")}>
            <img className={style.logo} src="/logo.png" alt="Growth" />
            <span className={style.brandName}>growth</span>
          </div>

          {currentToken && (
            <div className={style.desktopNav}>
              <NavItems />
            </div>
          )}

          {currentToken && (
            <div className={style.actionsSection}>
              <button onClick={onThemeToggle} className={style.iconAction} title="Cambiar tema">
                <FiSun className={style.sun} />
                <FiMoon className={style.moon} />
              </button>

              <div className={style.userProfile}>
                <div className={style.avatar}>
                  {profile?.profilePhotoUrl ? <img src={profile.profilePhotoUrl} alt="" /> : initials}
                </div>
                <span className={style.userName}>{displayName}</span>
              </div>

              <button onClick={handleLogout} className={style.logoutBtn} title="Cerrar sesión">
                <FiLogOut />
              </button>

              {/* Botones Móviles */}
              <div className={style.mobileButtons}>
                <button className={style.panelTrigger} onClick={onToggleMobilePanel}>
                  {panelLabel}
                </button>
                <button className={style.burger} onClick={onToggleMobileMenu} aria-label="Menú">
                  <span />
                  <span />
                </button>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Portals: Solo se renderizan si están abiertos */}
      {isMobileMenuOpen && createPortal(
        <div className={style.drawerWrapper}>
          <div className={style.backdrop} onClick={onCloseMobileMenu} />
          <div className={style.drawer}>
            <div className={style.drawerHeader}>
              <h3>Menú Principal</h3>
              <button onClick={onCloseMobileMenu}><FiX /></button>
            </div>
            <div className={style.drawerContent}>
              <NavItems />
              <div className={style.drawerFooter}>
                <button onClick={handleLogout} className={style.logoutBtnFull}>
                  <FiLogOut /> Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isMobilePanelOpen && createPortal(
        <div className={style.drawerWrapper}>
          <div className={style.backdrop} onClick={onCloseMobilePanel} />
          <div className={`${style.drawer} ${style.panelDrawer}`}>
            <div className={style.drawerHeader}>
              <h3>{panelLabel}</h3>
              <button onClick={onCloseMobilePanel}><FiX /></button>
            </div>
            <div className={style.panelContent}>{panelContent}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default Nav;