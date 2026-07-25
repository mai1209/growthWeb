import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../theme";

// Ícono (Ionicons) por tema, monocromo como en la web.
const ICONOS = {
  autoconocimiento: "compass-outline",
  gratitud: "gift-outline",
  emociones: "water-outline",
  vinculos: "people-outline",
  estoicismo: "library-outline",
  metas: "flag-outline",
  "amor-propio": "heart-outline",
  dificiles: "umbrella-outline",
};

// Mismos temas y preguntas que el centro de ayuda de la web.
const TEMAS = [
  {
    id: "autoconocimiento",
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

// Centro de ayuda del journal en la app. Espejo del de la web: preguntas por
// tema para inspirarte. Tocás una para copiarla y pegarla donde quieras.
export default function JournalAyudaModal({ visible, onClose, onUsarPregunta }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [temaAbierto, setTemaAbierto] = useState(TEMAS[0].id);
  const [copiada, setCopiada] = useState(null);

  const copiar = async (pregunta, key) => {
    try {
      await Clipboard.setStringAsync(pregunta);
      setCopiada(key);
      setTimeout(() => setCopiada((prev) => (prev === key ? null : prev)), 1400);
    } catch {
      /* si no se puede copiar, no rompemos */
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>AYUDA PARA TU JOURNAL</Text>
            <Text style={styles.title}>¿No sabés qué escribir?</Text>
          </View>
          <View style={styles.headIcono}>
            <Ionicons name="help-circle-outline" size={22} color={colors.green} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.seccionTitulo}>Preguntas para inspirarte</Text>
          <Text style={styles.seccionSub}>
            Elegí un tema y tocá una pregunta para copiarla y usarla en tu journal.
          </Text>

          <View style={styles.temas}>
            {TEMAS.map((tema) => {
              const abierto = temaAbierto === tema.id;
              return (
                <View key={tema.id} style={styles.tema}>
                  <TouchableOpacity
                    style={styles.temaHead}
                    activeOpacity={0.7}
                    onPress={() => setTemaAbierto(abierto ? null : tema.id)}
                  >
                    <View style={styles.temaIconoWrap}>
                      <Ionicons
                        name={ICONOS[tema.id] || "compass-outline"}
                        size={16}
                        color={colors.text}
                      />
                    </View>
                    <Text style={styles.temaTitulo}>{tema.titulo}</Text>
                    <View style={styles.temaCount}>
                      <Text style={styles.temaCountText}>{tema.preguntas.length}</Text>
                    </View>
                    <Ionicons
                      name={abierto ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.muted}
                    />
                  </TouchableOpacity>

                  {abierto ? (
                    <View style={styles.preguntas}>
                      {tema.preguntas.map((pregunta, i) => {
                        const key = `${tema.id}-${i}`;
                        const ok = copiada === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            style={styles.preguntaItem}
                            activeOpacity={0.7}
                            onPress={() => copiar(pregunta, key)}
                          >
                            <Text style={styles.preguntaTexto}>{pregunta}</Text>
                            <View style={[styles.copiarBtn, ok && styles.copiarOk]}>
                              <Ionicons
                                name={ok ? "checkmark" : "copy-outline"}
                                size={13}
                                color={ok ? "#0e1a0e" : colors.muted}
                              />
                              <Text style={[styles.copiarText, ok && styles.copiarTextOk]}>
                                {ok ? "Copiada" : "Copiar"}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
    },
    backBtn: { padding: 4 },
    kicker: { color: colors.greenDark, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
    title: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
    headIcono: {
      width: 38,
      height: 38,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      backgroundColor: colors.greenSoft,
      alignItems: "center",
      justifyContent: "center",
    },

    scroll: { paddingHorizontal: 16, paddingBottom: 34, gap: 4 },
    seccionTitulo: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 6 },
    seccionSub: { color: colors.muted, fontSize: 12.5, lineHeight: 17, marginTop: 2, marginBottom: 10 },

    temas: { gap: 10 },
    tema: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    temaHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 13,
    },
    temaIconoWrap: {
      width: 30,
      height: 30,
      borderRadius: 999,
      backgroundColor: colors.cardSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    temaTitulo: { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: "800" },
    temaCount: {
      minWidth: 24,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.cardSoft,
      alignItems: "center",
    },
    temaCountText: { color: colors.muted, fontSize: 11.5, fontWeight: "800" },

    preguntas: {
      paddingHorizontal: 10,
      paddingBottom: 10,
      gap: 7,
    },
    preguntaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardSoft,
    },
    preguntaTexto: { flex: 1, color: colors.text, fontSize: 13.5, lineHeight: 18 },
    copiarBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    copiarOk: { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
    copiarText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    copiarTextOk: { color: "#0e1a0e" },
  });
