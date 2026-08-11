import { useState } from "react";
import { FiChevronDown, FiFileText, FiHeart, FiInfo, FiLink, FiLock, FiMoon, FiSettings } from "react-icons/fi";
import { NavLink } from "react-router-dom";
import style from "../style/SettingsSidePanel.module.css";

const OPTIONS = [
  {
    to: "/ajustes?tab=password",
    label: "Cambiar contraseña",
    description: "Actualiza tu clave desde la sesión.",
    icon: FiLock,
  },
  {
    to: "/ajustes?tab=integraciones",
    label: "Integraciones",
    description: "Conectá Google Calendar.",
    icon: FiLink,
  },
  {
    to: "/ajustes?tab=facturacion",
    label: "Facturación (ARCA)",
    description: "Facturá los ingresos de este perfil.",
    icon: FiFileText,
  },
  {
    to: "/ajustes?tab=tema",
    label: "Tema",
    description: "Modo claro u oscuro de la app.",
    icon: FiMoon,
  },
  {
    to: "/ajustes?tab=apoyar",
    label: "Apoyar Growth",
    description: "Colaborá para mantener la app.",
    icon: FiHeart,
  },
];

function SettingsSidePanel() {
  // Arranca abierto: los usuarios no entendían que el menú se podía desplegar.
  const [open, setOpen] = useState(true);

  return (
    <aside className={`${style.container} ${open ? style.containerOpen : ""}`}>
      <div className={style.panel}>
        <button
          type="button"
          className={`${style.header} ${open ? style.headerOpen : ""}`}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <span className={style.iconWrap}>
            <FiSettings />
          </span>
          <div className={style.headerText}>
            <p className={style.kicker}>Ajustes</p>
            <h2>Opciones de cuenta</h2>
          </div>
          <FiChevronDown className={style.headerChevron} />
        </button>

        <nav className={`${style.optionList} ${open ? style.optionListOpen : ""}`}>
          {OPTIONS.map((option) => {
            const Icon = option.icon;

            return (
              <NavLink
                key={option.to}
                to={option.to}
                className={({ isActive }) =>
                  `${style.optionLink} ${isActive ? style.optionLinkActive : ""}`
                }
              >
                <Icon className={style.optionIcon} />
                <strong className={style.optionLabel}>{option.label}</strong>
                <span
                  className={style.optionInfo}
                  data-tip={option.description}
                  aria-label={option.description}
                >
                  <FiInfo />
                </span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export default SettingsSidePanel;
