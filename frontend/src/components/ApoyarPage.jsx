import { useState } from "react";
import { FiHeart, FiCopy, FiCheck } from "react-icons/fi";
import style from "../style/Apoyar.module.css";
import { DONACIONES } from "../utils/donaciones";

function ApoyarPage() {
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
    <div className={style.page}>
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
                  <p className={style.metodoTit}>{item.titulo}</p>
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
  );
}

export default ApoyarPage;
