import { useState } from "react";
import { FiChevronDown, FiCopy, FiCheck, FiHelpCircle, FiX } from "react-icons/fi";
import style from "../style/JournalAyuda.module.css";

// Centro de ayuda del journal. Pensado para ir sumando secciones: hoy están
// las "Preguntas por tema"; más adelante se agregan otras (guías, ejemplos…).

// ==== Sección 1: preguntas para inspirarte, agrupadas por tema ====
const TEMAS = [
  {
    id: "autoconocimiento",
    emoji: "🧭",
    titulo: "Autoconocimiento",
    preguntas: [
      "¿Quién soy cuando nadie me está mirando?",
      "¿Qué tres palabras me describen hoy y por qué?",
      "¿Qué parte de mí escondo y por qué?",
      "¿Qué me hace sentir más vivo/a?",
      "¿Qué creencia sobre mí mismo/a estoy listo/a para soltar?",
      "¿En qué momentos me siento más yo?",
      "¿Qué necesito hoy que no me estoy dando?",
      "¿Qué me está pidiendo mi cuerpo que no escucho?",
      "¿Qué haría distinto si nadie me juzgara?",
      "¿Cuál es mi mayor fortaleza y cómo la uso?",
      "¿Qué patrón se repite en mi vida?",
      "¿Qué me da vergüenza admitir, aunque sea acá?",
      "¿Qué versión de mí quiero ser dentro de un año?",
      "¿Qué aprendí de mí esta semana?",
      "¿Qué me estoy contando que ya no es verdad?",
    ],
  },
  {
    id: "gratitud",
    emoji: "🙏",
    titulo: "Gratitud",
    preguntas: [
      "¿Por qué tres cosas estoy agradecido/a hoy?",
      "¿Qué persona hizo mi día mejor y no se lo dije?",
      "¿Qué tengo hoy que hace un año deseaba?",
      "¿Qué pequeño placer disfruté hoy?",
      "¿Qué parte de mi cuerpo quiero agradecer?",
      "¿Qué dificultad, mirándola bien, me enseñó algo?",
      "¿Qué de lo cotidiano suelo dar por sentado?",
      "¿Quién me apoya siempre y por qué lo valoro?",
      "¿Qué lugar me da paz y por qué?",
      "¿Qué me hizo reír últimamente?",
      "¿Qué oportunidad tengo hoy que no todos tienen?",
      "¿Qué error del pasado hoy agradezco haber cometido?",
      "¿Qué comodidad de mi vida a veces olvido valorar?",
      "¿Qué me regaló hoy la naturaleza?",
      "¿Por qué estoy agradecido/a conmigo mismo/a hoy?",
    ],
  },
  {
    id: "emociones",
    emoji: "🌊",
    titulo: "Emociones",
    preguntas: [
      "¿Cómo me siento ahora mismo, sin filtrarlo?",
      "¿Dónde siento esta emoción en el cuerpo?",
      "¿Qué está tratando de decirme lo que siento?",
      "¿Qué emoción vengo evitando últimamente?",
      "¿Qué me dio miedo hoy y por qué?",
      "¿Cuándo fue la última vez que lloré y qué lo provocó?",
      "¿Qué me pone ansioso/a y qué necesito para calmarme?",
      "¿Qué me enojó hoy y qué había debajo de ese enojo?",
      "¿Qué me dio alegría genuina hoy?",
      "¿Qué emoción quiero sentir más seguido?",
      "¿Cómo trato a mis emociones difíciles?",
      "Si mi tristeza pudiera hablar, ¿qué me diría?",
      "¿Qué necesito soltar antes de dormir?",
      "¿Qué me alivia cuando estoy mal?",
      "¿Reaccioné o respondí hoy? ¿Cuál fue la diferencia?",
    ],
  },
  {
    id: "vinculos",
    emoji: "❤️",
    titulo: "Relaciones y vínculos",
    preguntas: [
      "¿Quién suma a mi vida y quién me resta energía?",
      "¿A quién necesito perdonar, aunque sea a mí?",
      "¿Qué le quiero decir a alguien y no me animo?",
      "¿Cómo me muestro en mis relaciones?",
      "¿Qué límite necesito poner y con quién?",
      "¿Qué relación quiero cuidar más?",
      "¿Qué aprendí de una relación que terminó?",
      "¿Estoy dando más de lo que recibo? ¿Con quién?",
      "¿Qué tipo de amor quiero construir?",
      "¿A quién extraño y por qué?",
      "¿Qué modelo de vínculo repito de mi familia?",
      "¿Cómo me hace sentir la persona en la que más pienso?",
      "¿Qué necesito de los demás que no pido?",
      "¿A quién puedo agradecerle hoy?",
      "¿Con quién puedo ser 100% yo?",
    ],
  },
  {
    id: "estoicismo",
    emoji: "🏛️",
    titulo: "Estoicismo y sentido",
    preguntas: [
      "¿Qué estuvo bajo mi control hoy y qué no?",
      "¿Actué según mis valores o me dejé llevar?",
      "¿Qué obstáculo de hoy puedo convertir en camino?",
      "Si hoy fuera mi último día, ¿lo viví bien?",
      "¿Qué cosas me preocupan que no dependen de mí?",
      "¿Qué haría hoy la mejor versión de mí?",
      "¿A qué le doy demasiada importancia?",
      "¿Qué virtud quiero practicar mañana?",
      "¿Qué me enseñó hoy una dificultad?",
      "¿Qué es 'suficiente' para mí?",
      "¿Qué haría si no tuviera miedo al fracaso?",
      "¿Qué legado quiero dejar?",
      "¿Qué puedo aceptar hoy que no puedo cambiar?",
      "¿Estoy viviendo mi vida o la que otros esperan?",
      "¿Qué me daría paz si lo soltara?",
    ],
  },
  {
    id: "metas",
    emoji: "🎯",
    titulo: "Metas y productividad",
    preguntas: [
      "¿Cuál fue mi tarea más importante hoy y la completé?",
      "¿En qué perdí tiempo o me distraje?",
      "¿Cuál es la única cosa que haría que mañana valga la pena?",
      "¿Qué me acerca a mis metas y qué me aleja?",
      "¿Qué hábito quiero construir y cuál soltar?",
      "¿Qué estoy postergando y por qué?",
      "¿Qué pequeño paso puedo dar hoy hacia lo que quiero?",
      "¿Qué me frena de verdad: falta de tiempo o de decisión?",
      "¿Cómo se vería mi día ideal?",
      "¿Qué logro, por chico que sea, quiero celebrar?",
      "¿Qué aprendí de un error reciente?",
      "¿Qué haría si supiera que no puedo fallar?",
      "¿Qué me distrae de lo que de verdad importa?",
      "¿Qué quiero haber logrado en tres meses?",
      "¿Estoy ocupado/a o soy productivo/a?",
    ],
  },
  {
    id: "amor-propio",
    emoji: "🌱",
    titulo: "Amor propio",
    preguntas: [
      "¿Qué me diría hoy si fuera mi mejor amigo/a?",
      "¿En qué fui demasiado duro/a conmigo?",
      "¿Qué logro mío merece que me felicite?",
      "¿Qué me hace sentir orgulloso/a de mí?",
      "¿Cómo cuido de mí cuando estoy mal?",
      "¿Qué necesito perdonarme?",
      "¿Qué me repito que no le diría a nadie que quiero?",
      "¿Qué cualidad mía suelo minimizar?",
      "¿Qué me haría bien hoy y me lo estoy negando?",
      "¿Cuándo me sentí valiente últimamente?",
      "¿Qué aprendí a aceptar de mí?",
      "¿Qué me merezco y todavía no me permito?",
      "¿Cómo puedo tratarme con más ternura mañana?",
      "¿De qué me arrepiento y cómo puedo soltarlo?",
      "¿Qué me hace único/a?",
    ],
  },
  {
    id: "dificiles",
    emoji: "🌧️",
    titulo: "Momentos difíciles",
    preguntas: [
      "¿Qué es lo más difícil que estoy atravesando?",
      "¿Qué necesito hoy para sostenerme?",
      "¿Qué me ayudó otras veces que estuve así?",
      "¿Qué me estoy exigiendo de más en este momento?",
      "¿Qué puedo agradecer incluso en medio de esto?",
      "¿Qué me diría dentro de un año sobre hoy?",
      "¿Qué parte de esto depende de mí?",
      "¿A quién puedo pedirle ayuda?",
      "¿Qué me está enseñando este momento?",
      "¿Qué es lo mínimo que puedo hacer hoy por mí?",
      "¿Qué me da esperanza?",
      "¿Qué necesito soltar para seguir?",
      "¿Cómo me hablaría alguien que me ama?",
      "¿Qué fortaleza descubrí en mí gracias a esto?",
      "¿Qué me recordaría que esto también va a pasar?",
    ],
  },
];

function JournalAyuda({ onClose }) {
  const [temaAbierto, setTemaAbierto] = useState(TEMAS[0].id);
  const [copiada, setCopiada] = useState(null);

  const copiar = async (pregunta, key) => {
    try {
      await navigator.clipboard.writeText(pregunta);
      setCopiada(key);
      setTimeout(() => setCopiada((prev) => (prev === key ? null : prev)), 1400);
    } catch {
      /* si el navegador no deja copiar, no rompemos */
    }
  };

  return (
    <div className={style.overlay} onClick={onClose} role="presentation">
      <div className={style.panel} onClick={(e) => e.stopPropagation()}>
        <header className={style.head}>
          <div className={style.headTitulo}>
            <FiHelpCircle className={style.headIcono} />
            <div>
              <p className={style.kicker}>Ayuda para tu journal</p>
              <h2 className={style.titulo}>¿No sabés qué escribir?</h2>
            </div>
          </div>
          <button type="button" className={style.cerrar} onClick={onClose} aria-label="Cerrar">
            <FiX />
          </button>
        </header>

        <div className={style.cuerpo}>
          <section className={style.seccion}>
            <p className={style.seccionTitulo}>Preguntas para inspirarte</p>
            <p className={style.seccionSub}>
              Elegí un tema y copiá la pregunta que te resuene para pegarla en tu journal.
            </p>

            <div className={style.temas}>
              {TEMAS.map((tema) => {
                const abierto = temaAbierto === tema.id;
                return (
                  <div key={tema.id} className={style.tema}>
                    <button
                      type="button"
                      className={style.temaHead}
                      onClick={() => setTemaAbierto(abierto ? null : tema.id)}
                      aria-expanded={abierto}
                    >
                      <span className={style.temaEmoji}>{tema.emoji}</span>
                      <span className={style.temaTitulo}>{tema.titulo}</span>
                      <span className={style.temaCount}>{tema.preguntas.length}</span>
                      <FiChevronDown
                        className={`${style.temaChevron} ${abierto ? style.temaChevronOpen : ""}`}
                      />
                    </button>

                    {abierto ? (
                      <ul className={style.preguntas}>
                        {tema.preguntas.map((pregunta, i) => {
                          const key = `${tema.id}-${i}`;
                          return (
                            <li key={key} className={style.preguntaItem}>
                              <span className={style.preguntaTexto}>{pregunta}</span>
                              <button
                                type="button"
                                className={`${style.copiarBtn} ${copiada === key ? style.copiarOk : ""}`}
                                onClick={() => copiar(pregunta, key)}
                              >
                                {copiada === key ? (
                                  <>
                                    <FiCheck /> Copiada
                                  </>
                                ) : (
                                  <>
                                    <FiCopy /> Copiar
                                  </>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Acá vamos sumando más secciones de ayuda (guías, ejemplos, etc.) */}
        </div>
      </div>
    </div>
  );
}

export default JournalAyuda;
