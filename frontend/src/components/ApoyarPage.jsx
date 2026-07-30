import { useState } from "react";
import {
  FiHeart,
  FiCopy,
  FiCheck,
  FiDollarSign,
  FiCreditCard,
  FiTrendingUp,
  FiPieChart,
  FiBarChart2,
  FiTarget,
  FiCheckSquare,
  FiCalendar,
  FiClock,
  FiFlag,
} from "react-icons/fi";
import { FaBitcoin, FaEthereum } from "react-icons/fa";
import style from "../style/Apoyar.module.css";
import { DONACIONES } from "../utils/donaciones";

// Ícono por método (al lado del título).
const ICONOS = {
  mp: <FiDollarSign />,
  eth: <FaEthereum />,
  btc: <FaBitcoin />,
  astropay: <FiCreditCard />,
};

// Íconos de gestión decorativos del fondo (verdes, delineados, con glow).
// Cada uno late (crece/achica) con su propio ritmo para un efecto aleatorio.
const FONDO = [
  { Icon: FiTrendingUp, style: { top: "6%", left: "5%", width: 34, height: 34, animationDelay: "0s", animationDuration: "3.2s" } },
  { Icon: FiPieChart, style: { top: "13%", right: "8%", width: 28, height: 28, animationDelay: "1.1s", animationDuration: "2.8s" } },
  { Icon: FiTarget, style: { top: "40%", left: "4%", width: 38, height: 38, animationDelay: "0.6s", animationDuration: "3.9s" } },
  { Icon: FiBarChart2, style: { top: "56%", right: "6%", width: 34, height: 34, animationDelay: "2.2s", animationDuration: "3.4s" } },
  { Icon: FiCheckSquare, style: { bottom: "9%", left: "9%", width: 30, height: 30, animationDelay: "1.6s", animationDuration: "2.6s" } },
  { Icon: FiCalendar, style: { bottom: "14%", right: "11%", width: 28, height: 28, animationDelay: "0.3s", animationDuration: "4.3s" } },
  { Icon: FiClock, style: { top: "28%", right: "17%", width: 24, height: 24, animationDelay: "2.6s", animationDuration: "3s" } },
  { Icon: FiFlag, style: { bottom: "32%", left: "15%", width: 26, height: 26, animationDelay: "1.9s", animationDuration: "3.6s" } },
  { Icon: FiDollarSign, style: { top: "70%", left: "10%", width: 26, height: 26, animationDelay: "0.9s", animationDuration: "3.1s" } },
  { Icon: FiTrendingUp, style: { top: "80%", right: "16%", width: 30, height: 30, animationDelay: "2.9s", animationDuration: "3.7s" } },
  { Icon: FiTarget, style: { top: "18%", left: "22%", width: 22, height: 22, animationDelay: "1.4s", animationDuration: "2.9s" } },
  { Icon: FiPieChart, style: { bottom: "44%", right: "22%", width: 24, height: 24, animationDelay: "3.3s", animationDuration: "3.5s" } },
];

function ApoyarPage({ embedded = false }) {
  const [copiadoId, setCopiadoId] = useState(null);

  const copiar = async (item) => {
    try {
      await navigator.clipboard.writeText(item.valor);
      setCopiadoId(item.id);
      setTimeout(
        () => setCopiadoId((prev) => (prev === item.id ? null : prev)),
        1800
      );
    } catch {
      /* si el navegador bloquea el clipboard, no rompemos nada */
    }
  };

  return (
    <div className={`${style.page} ${embedded ? style.embedded : ""}`}>
      <div className={style.bg} aria-hidden="true">
        {FONDO.map(({ Icon, style: pos }, i) => (
          <Icon key={i} className={style.bgIcon} style={pos} />
        ))}
      </div>
      <div className={style.card}>
        <div className={style.hero}>
          <span className={style.heroIcon}>
            <FiHeart />
          </span>
          <h1 className={style.titulo}>Apoyá Growth 💚</h1>
          <p className={style.sub}>
            Growth es y va a seguir siendo gratis. Si te suma, un aporte ayuda a
            mantenerla y a seguir mejorándola.
          </p>
        </div>

        <div className={style.cols}>
        <section className={style.bloque}>
          <h2 className={style.bloqueTit}>¿Qué es Growth?</h2>
          <p className={style.parrafo}>
            Growth Manager es una app para ordenar tu vida en un solo lugar: tus
            finanzas (ingresos, gastos, ahorros y deudas), tus tareas, tus metas,
            notas, journaling, afirmaciones y listas de compras.
          </p>
          <h2 className={style.bloqueTit}>¿Para qué sirve?</h2>
          <p className={style.parrafo}>
            Para tener claridad de tu plata y de tu día a día, construir hábitos y
            avanzar hacia tus objetivos, sin saltar entre mil apps.
          </p>
          <h2 className={style.bloqueTit}>¿A quién ayuda?</h2>
          <p className={style.parrafo}>
            A cualquiera que quiera crecer un poco cada día: freelancers,
            emprendedores, estudiantes y a vos que querés tomar las riendas de tus
            finanzas y tus metas.
          </p>
        </section>

        <section className={style.bloque}>
          <h2 className={style.bloqueTit}>Formas de donar</h2>
          <p className={style.parrafo}>
            Copiá el dato y transferí por donde te quede cómodo. ¡Gracias de
            corazón! 🙌
          </p>

          <div className={style.metodos}>
            {DONACIONES.map((item) => (
              <div key={item.id} className={style.metodo}>
                <div className={style.metodoInfo}>
                  <p className={style.metodoTit}>
                    <span className={style.metodoIcono}>
                      {ICONOS[item.icono] || <FiDollarSign />}
                    </span>
                    {item.titulo}
                  </p>
                  <p className={style.metodoDesc}>{item.desc}</p>
                  <code className={style.metodoValor}>{item.valor}</code>
                </div>
                <button
                  type="button"
                  className={`${style.copiarBtn} ${
                    copiadoId === item.id ? style.copiarBtnOk : ""
                  }`}
                  onClick={() => copiar(item)}
                >
                  {copiadoId === item.id ? (
                    <>
                      <FiCheck /> Copiado
                    </>
                  ) : (
                    <>
                      <FiCopy /> Copiar
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}

export default ApoyarPage;
