import { useState } from "react";
import { FiChevronDown, FiFileText, FiKey, FiLink, FiLock, FiUser } from "react-icons/fi";
import { NavLink } from "react-router-dom";
import style from "../style/SettingsSidePanel.module.css";

const OPTIONS = [
  {
    to: "/ajustes?tab=perfil",
    label: "Perfil",
    description: "Usuario, bio, foto y datos de cuenta.",
    icon: FiUser,
  },
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
];

function SettingsSidePanel() {
  // Arranca colapsado para ahorrar espacio: se abre al tocar el encabezado.
  const [open, setOpen] = useState(false);

  return (
    <aside className={style.container}>
      <div className={style.panel}>
        <button
          type="button"
          className={`${style.header} ${open ? style.headerOpen : ""}`}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <span className={style.iconWrap}>
            <FiKey />
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
                <Icon />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
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
