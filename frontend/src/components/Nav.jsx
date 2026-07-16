import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { jwtDecode } from "jwt-decode";
import { FiBriefcase, FiChevronDown, FiClock, FiMoon, FiPieChart, FiSettings, FiSun, FiX, FiLogOut, FiHome, FiFilter, FiShare2, FiCheckSquare, FiEdit3 } from "react-icons/fi";
import style from "../style/Nav.module.css";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { authService } from "../api";

// Definición centralizada de rutas para evitar repetición
const NAV_LINKS = [
  { to: "/", label: "Home", icon: <FiHome className={style.navIcon} /> },
  { to: "/filtros", label: "Filtros", icon: <FiFilter className={style.navIcon} /> },
  { to: "/compartidos", label: "Compartidos", icon: <FiShare2 className={style.navIcon} /> },
  { to: "/metricas", label: "Métricas", icon: <FiPieChart className={style.navIcon} /> },
  { to: "/tareas", label: "Tareas", icon: <FiCheckSquare className={style.navIcon} /> },
  { to: "/notas", label: "Notas", icon: <FiEdit3 className={style.navIcon} /> },
  { to: "/pomodoro", label: "Pomodoro", icon: <FiClock className={style.navIcon} /> },
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
  activeWorkspace = "personal",
  onWorkspaceChange,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

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
    setProfileMenuOpen(false);
  }, [location.pathname, onCloseMobileMenu]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const businesses = useMemo(() => {
    const source = Array.isArray(profile?.businessProfiles) && profile.businessProfiles.length
      ? profile.businessProfiles
      : profile?.businessProfile?.name
        ? [{ ...profile.businessProfile, _id: "legacy" }]
        : [];

    return source
      .filter((business) => business?.name)
      .map((business, index) => ({
        id: index === 0 || business._id === "legacy" ? "business" : `business:${business._id}`,
        name: business.name,
        photo: business.logoUrl || "",
        type: "business",
      }));
  }, [profile]);

  const profileOptions = useMemo(() => [
    {
      id: "personal",
      name: profile?.fullName || userData?.username || "Personal",
      photo: profile?.profilePhotoUrl || "",
      type: "personal",
    },
    ...businesses,
  ], [businesses, profile, userData?.username]);

  const activeProfile = profileOptions.find((option) => option.id === activeWorkspace) || profileOptions[0];
  const displayName = activeProfile.name;
  const availableProfiles = profileOptions.filter((option) => option.id !== activeProfile.id);

  const handleLogout = () => {
    onLogout();
    navigate("/");
  };

  const getNavLinkClass = ({ isActive }) =>
    isActive ? `${style.navLink} ${style.activeLink}` : style.navLink;

  const getRailLinkClass = ({ isActive }) =>
    `${style.railLink} ${isActive ? style.railLinkActive : ""}`;

  // --- COMPONENTES INTERNOS PARA EVITAR REPETICIÓN ---
  const NavItems = ({ rail = false } = {}) => (
    <>
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={rail ? getRailLinkClass : getNavLinkClass}
          onClick={onCloseMobileMenu}
          end={link.to === "/"}
        >
          {link.icon}
          <span className={rail ? style.tip : undefined}>{link.label}</span>
        </NavLink>
      ))}
    </>
  );

  const ProfileAvatar = ({ option = activeProfile }) => (
    <div className={style.avatar}>
      {option.photo ? (
        <img src={option.photo} alt="" />
      ) : option.type === "business" ? (
        <FiBriefcase />
      ) : (
        (option.name[0] || "P").toUpperCase()
      )}
    </div>
  );

  const ProfileDropdown = ({ mobile = false }) => (
    <div
      className={`${style.profileMenu} ${mobile ? style.profileMenuMobile : ""}`}
      ref={mobile ? null : profileMenuRef}
    >
      <button
        type="button"
        className={style.userProfile}
        onClick={() => setProfileMenuOpen((prev) => !prev)}
        aria-expanded={profileMenuOpen}
      >
        <ProfileAvatar />
        <span className={style.userName}>{displayName}</span>
        <FiChevronDown className={`${style.chevron} ${profileMenuOpen ? style.chevronOpen : ""}`} />
      </button>

      {profileMenuOpen ? (
        <div className={style.profileDropdown}>
          {availableProfiles.length ? (
            availableProfiles.map((option) => (
              <button
                key={option.id}
                type="button"
                className={style.profileOption}
                onClick={() => {
                  onWorkspaceChange?.(option.id);
                  setProfileMenuOpen(false);
                  if (mobile) onCloseMobileMenu?.();
                }}
              >
                <ProfileAvatar option={option} />
                <span>{option.name}</span>
              </button>
            ))
          ) : (
            <button
              type="button"
              className={style.profileOption}
              onClick={() => {
                navigate("/ajustes?tab=perfil");
                setProfileMenuOpen(false);
                if (mobile) onCloseMobileMenu?.();
              }}
            >
              <FiBriefcase />
              <span>Agregar negocio</span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Rail vertical — desktop */}
      <aside className={style.rail}>
        <div className={style.railTop}>
          <button
            className={style.railLogo}
            onClick={() => navigate("/")}
            type="button"
            aria-label="Inicio"
          >
            <img src="/logo.png" alt="Growth" />
          </button>

          {currentToken && (
            <nav className={style.railNav}>
              <NavItems rail />
            </nav>
          )}
        </div>

        {currentToken && (
          <div className={style.railBottom}>
            <div className={style.railProfile}>
              <ProfileDropdown />
            </div>

            <button onClick={onThemeToggle} className={style.railAction} type="button">
              <FiSun className={style.sun} />
              <FiMoon className={style.moon} />
              <span className={style.tip}>Cambiar tema</span>
            </button>

            <button onClick={handleLogout} className={style.railAction} type="button">
              <FiLogOut />
              <span className={style.tip}>Cerrar sesión</span>
            </button>
          </div>
        )}
      </aside>

      {/* Barra superior — mobile */}
      <header className={style.mobileHeader}>
        <div className={style.logoSection} onClick={() => navigate("/")}>
          <img className={style.logo} src="/logo.png" alt="Growth" />
          <span className={style.brandName}>growth</span>
        </div>

        {currentToken && (
          <div className={style.mobileButtons}>
            {panelContent ? (
              <button className={style.panelTrigger} onClick={onToggleMobilePanel}>
                {panelLabel}
              </button>
            ) : null}
            <button className={style.burger} onClick={onToggleMobileMenu} aria-label="Menú">
              <span />
              <span />
            </button>
          </div>
        )}
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
              <ProfileDropdown mobile />
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
