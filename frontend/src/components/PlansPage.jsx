import { useNavigate } from "react-router-dom";
import { FiCheck, FiMoon, FiSun } from "react-icons/fi";
import style from "../style/Login.module.css";

const PLANS = [
  {
    name: "Base",
    price: "Ideal para empezar",
    description: "Controlá turnos, caja y seguimiento diario con una base simple.",
    features: ["Panel principal", "Movimientos y filtros", "Notas y tareas"],
  },
  {
    name: "Pro",
    price: "El más elegido",
    description: "Sumá métricas, control más fino y una experiencia completa para el negocio.",
    features: ["Métricas", "Gastos compartidos", "Ajustes y perfil"],
    featured: true,
  },
  {
    name: "Equipo",
    price: "Para crecer",
    description: "Pensado para negocios que necesitan más orden entre varias personas.",
    features: ["Flujos compartidos", "Más control operativo", "Escala para el equipo"],
  },
];

function PlansPage({ theme = "dark", onThemeToggle }) {
  const navigate = useNavigate();

  return (
    <div className={style.container}>
      <div className={`${style.back} ${style.plansBack}`}>
        <div className={style.authTopbar}>
          <button
            type="button"
            className={style.secondaryTopAction}
            onClick={() => navigate("/login?next=/ajustes")}
          >
            Ya tengo cuenta
          </button>
          <button
            type="button"
            className={style.themeButton}
            onClick={onThemeToggle}
            aria-label={theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
          >
            <FiSun className={style.themeIcon} />
            <span className={style.themeSwitchTrack}>
              <span className={style.themeSwitchThumb} />
            </span>
            <FiMoon className={style.themeIcon} />
          </button>
        </div>

        <section className={style.plansSection}>
          <div className={style.plansIntro}>
            <p className={style.title}>Elegí cómo volver a Growth</p>
            <p className={style.plansText}>
              Si venís desde la web, entrá por acá para revisar planes y después iniciar sesión
              para gestionar o reactivar tu cuenta.
            </p>
          </div>

          <div className={style.planGrid}>
            {PLANS.map((plan) => (
              <article
                key={plan.name}
                className={`${style.planCard} ${plan.featured ? style.planCardFeatured : ""}`}
              >
                <div className={style.planCardHeader}>
                  <span className={style.planName}>{plan.name}</span>
                  <strong className={style.planPrice}>{plan.price}</strong>
                </div>

                <p className={style.planDescription}>{plan.description}</p>

                <div className={style.planFeatureList}>
                  {plan.features.map((feature) => (
                    <span key={feature} className={style.planFeature}>
                      <FiCheck />
                      {feature}
                    </span>
                  ))}
                </div>

                <div className={style.planActions}>
                  <button
                    type="button"
                    className={style.btn}
                    onClick={() => navigate("/login?next=/ajustes")}
                  >
                    Entrar para gestionar plan
                  </button>
                  <button
                    type="button"
                    className={style.secondaryAction}
                    onClick={() => navigate("/register")}
                  >
                    Crear cuenta nueva
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default PlansPage;
