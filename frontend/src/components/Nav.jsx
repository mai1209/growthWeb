import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { jwtDecode } from "jwt-decode";
import { FiBriefcase, FiChevronDown, FiChevronsLeft, FiChevronsRight, FiClock, FiWatch, FiPieChart, FiSettings, FiSun, FiTarget, FiX, FiLogOut, FiHome, FiFilter, FiShare2, FiCheckSquare, FiEdit3, FiFlag, FiDollarSign, FiTrendingUp, FiShoppingCart, FiFeather, FiUsers, FiArrowRight } from "react-icons/fi";
import style from "../style/Nav.module.css";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { authService } from "../api";

// Nav agrupado por secciones (estilo consola: se despliegan/contraen).
const NAV_GROUPS = [
  {
    id: "finanzas",
    title: "Finanzas",
    icon: <FiDollarSign className={style.navGroupIcon} />,
    items: [
      { to: "/", label: "Home", icon: <FiHome className={style.navIcon} /> },
      { to: "/filtros", label: "Filtros", icon: <FiFilter className={style.navIcon} /> },
      { to: "/metricas", label: "Métricas", icon: <FiPieChart className={style.navIcon} /> },
      { to: "/compartidos", label: "Compartidos", icon: <FiShare2 className={style.navIcon} /> },
      { to: "/notas?view=shopping", label: "Lista de compras", icon: <FiShoppingCart className={style.navIcon} /> },
    ],
  },
  {
    id: "desarrollo",
    title: "Desarrollo personal",
    icon: <FiTrendingUp className={style.navGroupIcon} />,
    items: [
      { to: "/metas", label: "Metas", icon: <FiFlag className={style.navIcon} /> },
      { to: "/tareas", label: "Tareas", icon: <FiCheckSquare className={style.navIcon} /> },
      { to: "/notas", label: "Notas", icon: <FiEdit3 className={style.navIcon} /> },
      { to: "/notas?view=journal", label: "Journaling", icon: <FiFeather className={style.navIcon} /> },
      { to: "/notas?view=afirmaciones", label: "Afirmaciones", icon: <FiSun className={style.navIcon} /> },
      { to: "/pomodoro", label: "Pomodoro", icon: <FiClock className={style.navIcon} /> },
    ],
  },
  {
    id: "coworking",
    title: "Co-working",
    icon: <FiUsers className={style.navGroupIcon} />,
    items: [
      { to: "/pomodoro?panel=tracker", label: "Registro de horas", icon: <FiWatch className={style.navIcon} /> },
    ],
  },
];

// Ya no hay items sueltos en la lista: Ajustes vive abajo (junto a cerrar sesión),
// y Apoyar + tema están dentro de Ajustes.
const NAV_STANDALONE = [];

// Acento del avatar según el color de tarjeta elegido (solo decorativo; el resto sigue verde)
const CARD_ACCENTS = {
  holo: { ring: "#c8b8ff", glow: "rgba(200, 184, 255, 0.25)" },
  platino: { ring: "#dbe3ec", glow: "rgba(219, 227, 236, 0.25)" },
  titanio: { ring: "#9aa4b0", glow: "rgba(154, 164, 176, 0.25)" },
  chrome: { ring: "#7a828d", glow: "rgba(122, 130, 141, 0.28)" },
  esmeralda: { ring: "#16d97a", glow: "rgba(22, 217, 122, 0.22)" },
  champagne: { ring: "#d9b877", glow: "rgba(217, 184, 119, 0.25)" },
};
const readCardAccent = () => {
  try {
    return CARD_ACCENTS[localStorage.getItem("gw-card-style")] || CARD_ACCENTS.holo;
  } catch {
    return CARD_ACCENTS.holo;
  }
};

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
  const [railExpanded, setRailExpanded] = useState(
    () => localStorage.getItem("gw-rail-expanded") === "1"
  );
  const [cardAccent, setCardAccent] = useState(readCardAccent);
  // Acordeón: un solo grupo abierto a la vez (tanto colapsado como expandido).
  // undefined = auto (abre el grupo de la sección activa); id | null.
  const [openGroup, setOpenGroup] = useState(undefined);
  useEffect(() => {
    const update = () => setCardAccent(readCardAccent());
    window.addEventListener("gw-card-style", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("gw-card-style", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const toggleRail = () => {
    setRailExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("gw-rail-expanded", next ? "1" : "0");
      } catch {
        /* nada */
      }
      return next;
    });
  };
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

  // Active manual: hay items que comparten pathname y se diferencian por query
  // (Notas / Lista de compras / Journaling → /notas; Pomodoro / Co-working → /pomodoro).
  const isItemActive = (to) => {
    const [path, queryString] = to.split("?");
    if (path === "/") {
      if (location.pathname !== "/") return false;
    } else if (location.pathname !== path) {
      return false;
    }
    const current = new URLSearchParams(location.search);
    const itemParams = new URLSearchParams(queryString || "");
    const itemView = itemParams.get("view");
    const itemPanel = itemParams.get("panel");
    if (itemView) return current.get("view") === itemView;
    if (itemPanel) return current.get("panel") === itemPanel;
    // Item base (sin query): activo sólo cuando no hay un hermano con query.
    if (path === "/notas") {
      const v = current.get("view");
      return !v || v === "notes" || v === "calendar";
    }
    if (path === "/pomodoro") return current.get("panel") !== "tracker";
    return true;
  };

  const renderLink = (item, rail) => {
    const active = isItemActive(item.to);
    const cls = rail
      ? `${style.railLink} ${active ? style.railLinkActive : ""}`
      : active
      ? `${style.navLink} ${style.activeLink}`
      : style.navLink;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cls}
        onClick={onCloseMobileMenu}
        end={item.to === "/"}
      >
        {item.icon}
        <span className={rail ? style.tip : undefined}>{item.label}</span>
      </NavLink>
    );
  };

  // Grupo abierto (acordeón). Por defecto se auto-abre el de la sección activa.
  const activeGroupId = NAV_GROUPS.find((g) => g.items.some((it) => isItemActive(it.to)))?.id;
  const openGroupId = openGroup === undefined ? activeGroupId : openGroup;
  const toggleGroup = (id) => setOpenGroup(openGroupId === id ? null : id);

  // --- COMPONENTES INTERNOS PARA EVITAR REPETICIÓN ---
  const NavItems = ({ rail = false } = {}) => {
    const grouped = !rail || railExpanded;
    // Rail colapsado: sólo el ícono de cada grupo; al hacer click se despliegan
    // los íconos de sus items (sin texto, con tooltip al pasar el mouse).
    if (!grouped) {
      return (
        <>
          {NAV_GROUPS.map((group) => {
            const open = openGroupId === group.id;
            const groupActive = group.items.some((it) => isItemActive(it.to));
            return (
              <div key={group.id} className={style.railGroup}>
                <button
                  type="button"
                  className={`${style.railLink} ${style.railGroupBtn} ${
                    open ? style.railGroupBtnOpen : ""
                  } ${groupActive ? style.railGroupBtnActive : ""}`}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                >
                  {group.icon}
                  <FiChevronDown
                    className={`${style.railGroupChevron} ${open ? style.railGroupChevronOpen : ""}`}
                  />
                  <span className={style.tip}>{group.title}</span>
                </button>
                {open && group.items.map((item) => renderLink(item, true))}
              </div>
            );
          })}
          {NAV_STANDALONE.map((item) => renderLink(item, true))}
        </>
      );
    }
    return (
      <>
        {NAV_GROUPS.map((group) => {
          const open = openGroupId === group.id;
          return (
            <div key={group.id} className={style.navGroup}>
              <button
                type="button"
                className={style.navGroupTitle}
                onClick={() => toggleGroup(group.id)}
                aria-expanded={open}
              >
                {group.icon}
                <span className={style.navGroupLabel}>{group.title}</span>
                <FiChevronDown
                  className={`${style.navGroupChevron} ${open ? style.navGroupChevronOpen : ""}`}
                />
              </button>
              {open && (
                <div className={style.navGroupItems}>
                  {group.items.map((item) => renderLink(item, rail))}
                </div>
              )}
            </div>
          );
        })}
        {NAV_STANDALONE.length > 0 && (
          <div className={style.navStandalone}>
            {NAV_STANDALONE.map((item) => renderLink(item, rail))}
          </div>
        )}
      </>
    );
  };

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
          <p className={style.profileDropdownHint}>Entrar al perfil</p>
          {/* Cada perfil se entra desde acá: al tocarlo pasa a ser el principal
              (activo) y te lleva a /perfil. Adentro podés volver a cambiar. */}
          {profileOptions.map((option) => {
            const isActive = option.id === activeProfile.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`${style.profileOption} ${isActive ? style.profileOptionCurrent : ""}`}
                onClick={() => {
                  onWorkspaceChange?.(option.id);
                  navigate("/perfil");
                  setProfileMenuOpen(false);
                  if (mobile) onCloseMobileMenu?.();
                }}
              >
                <ProfileAvatar option={option} />
                <span className={style.profileOptionName}>{option.name}</span>
                {isActive ? <span className={style.profileOptionBadge}>actual</span> : null}
                <FiArrowRight className={style.profileEnterArrow} />
              </button>
            );
          })}

          <button
            type="button"
            className={style.profileOption}
            onClick={() => {
              navigate("/perfil");
              setProfileMenuOpen(false);
              if (mobile) onCloseMobileMenu?.();
            }}
          >
            <FiBriefcase />
            <span className={style.profileOptionName}>Agregar negocio</span>
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Rail vertical — desktop */}
      <aside
        className={`${style.rail} ${railExpanded ? style.railExpanded : ""}`}
        style={{ "--avatarAccent": cardAccent.ring, "--avatarAccentGlow": cardAccent.glow }}
      >
        <div className={style.railTop}>
          <div className={style.railHead}>
            {railExpanded ? (
              <>
                <button
                  className={style.railLogo}
                  onClick={() => navigate("/")}
                  type="button"
                  aria-label="Inicio"
                >
                  <img src="/logo.png" alt="Growth" />
                </button>
                <span className={style.railBrand}>growth</span>
                {currentToken && (
                  <button
                    className={`${style.railToggle} ${style.railToggleBig}`}
                    onClick={toggleRail}
                    type="button"
                    aria-label="Contraer menú"
                    title="Contraer"
                  >
                    <FiChevronsLeft />
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  className={style.railLogo}
                  onClick={() => navigate("/")}
                  type="button"
                  aria-label="Inicio"
                >
                  <img src="/logo.png" alt="Growth" />
                </button>
                {currentToken && (
                  <button
                    className={`${style.railToggle} ${style.railToggleBig}`}
                    onClick={toggleRail}
                    type="button"
                    aria-label="Expandir menú"
                    title="Expandir"
                  >
                    <FiChevronsRight />
                  </button>
                )}
              </>
            )}
          </div>

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

            <div className={style.railFooterActions}>
              <button
                onClick={handleLogout}
                className={`${style.railAction} ${style.railLogout}`}
                type="button"
              >
                <FiLogOut />
                <span className={style.tip}>Cerrar sesión</span>
              </button>

              <NavLink
                to="/ajustes"
                className={({ isActive }) =>
                  `${style.railAction} ${style.railGear} ${isActive ? style.railActionActive : ""}`
                }
                aria-label="Ajustes"
                title="Ajustes"
              >
                <FiSettings />
              </NavLink>
            </div>
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
