import { FiKey, FiLock, FiRefreshCcw, FiUser } from "react-icons/fi";
import { NavLink } from "react-router-dom";
import style from "../style/SettingsSidePanel.module.css";

const OPTIONS = [
  {
    to: "/ajustes?tab=perfil",
    label: "Perfil",
    description: "Nombre, foto, email y teléfono.",
    icon: FiUser,
  },
  {
    to: "/ajustes?tab=password",
    label: "Cambiar contraseña",
    description: "Actualiza tu clave desde la sesión.",
    icon: FiLock,
  },
  {
    to: "/ajustes?tab=recuperar",
    label: "Recuperar contraseña",
    description: "Genera un enlace de recuperación.",
    icon: FiRefreshCcw,
  },
];

function SettingsSidePanel() {
  return (
    <aside className={style.container}>
      <div className={style.panel}>
        <section className={style.header}>
          <span className={style.iconWrap}>
            <FiKey />
          </span>
          <div>
            <p className={style.kicker}>Ajustes</p>
            <h2>Opciones de cuenta</h2>
          </div>
        </section>

        <nav className={style.optionList}>
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
