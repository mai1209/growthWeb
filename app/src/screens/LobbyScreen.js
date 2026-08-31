// Lobby — pantalla de entrada: elegís qué app usar. Grilla de 2 columnas
// (Finanzas, Desarrollo, Salud, Co-Working) + GROWTH PRO a lo ancho.
// Tocás la card → entrás. Tocás la ⓘ → popup con la descripción.
// Estética del Figma original: fondo #10150f, verde #75f94c, Menda, radio 22.
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";

const BG = "#10150f";
const VERDE = "#75f94c";
const GRIS_LINEA = "#4f4f4f";

// `grupo` es el id en NAV_GROUPS: define qué secciones muestra la barra inferior.
// `glyph`/`icon`: mismos iconos que usaba el menú de navegación (RadialTabBar).
const CARDS = [
  {
    titulo: "Finanzas",
    glyph: "$",
    grupo: "finanzas",
    desc: "Pon orden a tus finanzas con esta herramienta. Administra caja en pesos, caja en dolares, deudas y ahorros. Divide automaticamente los gastos con un grupo de personas, filtra, ve tus metricas, arma tu lista de compras.",
  },
  {
    titulo: "Desarrollo personal",
    icon: "trending-up-outline",
    grupo: "desarrollo",
    desc: "Ordena tu vida. Utiliza funciones como trazo de metas, agenda de tareas diarias//programadas, block de notas, escribe tu journaling, escribe y lee tus afirmaciones diarias y aprovecha al maximo tu tiempo con la herramienta de pomodoro timer!",
  },
  {
    titulo: "Salud",
    icon: "heart-outline",
    grupo: "salud",
    desc: "Lleva un trackeo de tus pasos diarios, inicia recorridos y compartelos en tus redes sociales, cuenta tus calorías, ordena tu rutina de gimnasio y lleva un control del progreso de tus rutinas.",
  },
  {
    titulo: "Co-Working",
    icon: "people-outline",
    grupo: "coworking",
    desc: "Registra tus horas, arma y una grilla de “To-Do”, “En progreso”, “En revisión”, “Realizados”",
  },
];

const PRO_DESC =
  "Disfruta la app en su forma tradicional con todas las herramientas en un solo lugar.";

export default function LobbyScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const u = (width / 738) * 1.15; // escala del diseño +15% para llenar mejor la pantalla
  const [info, setInfo] = useState(null); // { titulo, desc } | null
  const [fontsLoaded] = useFonts({
    "Menda-Bold": require("../../assets/fonts/Menda-Bold.ttf"),
    "Menda-Medium": require("../../assets/fonts/Menda-Medium.ttf"),
  });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: BG }} />;

  // Con grupo: barra plana con las secciones de esa app. Sin grupo (GROWTH PRO):
  // la app tradicional con el menú radial.
  const irA = (grupo) => navigation.navigate("Main", grupo ? { group: grupo } : undefined);

  const GAP = 20 * u;
  const ANCHO_GRILLA = 528 * u;
  const ANCHO_CARD = (ANCHO_GRILLA - GAP) / 2;

  const InfoBtn = ({ titulo, desc }) => (
    <TouchableOpacity
      hitSlop={10}
      onPress={() => setInfo({ titulo, desc })}
      style={{ position: "absolute", top: 10 * u, right: 10 * u }}
    >
      <Ionicons name="information-circle-outline" size={26 * u} color={VERDE} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 30 * u, paddingBottom: insets.bottom + 30 * u }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo GROWTH */}
        <Image
          source={require("../../assets/lobby-logo-header.png")}
          style={{ width: 299 * u, height: 54 * u, alignSelf: "center" }}
          resizeMode="contain"
        />

        {/* Línea separadora */}
        <View
          style={{
            width: 447 * u,
            height: StyleSheet.hairlineWidth,
            backgroundColor: GRIS_LINEA,
            alignSelf: "center",
            marginTop: 25 * u,
          }}
        />

        {/* ¡BIENVENIDO! */}
        <Text
          style={{
            fontFamily: "Menda-Bold",
            fontSize: 35 * u,
            letterSpacing: -1.8 * u,
            color: "#fff",
            textAlign: "center",
            marginTop: 70 * u,
          }}
        >
          ¡BIENVENIDO!
        </Text>

        {/* Subtítulo */}
        <Text
          style={{
            fontFamily: "Menda-Medium",
            fontSize: 25 * u,
            lineHeight: 28 * u,
            letterSpacing: -1.2 * u,
            color: "#fff",
            textAlign: "center",
            width: 488 * u,
            alignSelf: "center",
            marginTop: 40 * u,
            marginBottom: 48 * u,
          }}
        >
          Elija la app que desea utilizar en este momento
        </Text>

        {/* Grilla 2 columnas */}
        <View
          style={{
            width: ANCHO_GRILLA,
            alignSelf: "center",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: GAP,
          }}
        >
          {CARDS.map((c) => (
            <TouchableOpacity
              key={c.titulo}
              activeOpacity={0.85}
              onPress={() => irA(c.grupo)}
              style={{
                width: ANCHO_CARD,
                height: 150 * u,
                borderWidth: 1,
                borderColor: VERDE,
                borderRadius: 22 * u,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 14 * u,
              }}
            >
              {c.glyph ? (
                // "$" fino, igual que en la barra de navegación
                <Text style={{ fontSize: 34 * u, lineHeight: 36 * u, fontWeight: "300", color: VERDE }}>
                  {c.glyph}
                </Text>
              ) : (
                <Ionicons name={c.icon} size={34 * u} color={VERDE} />
              )}
              <Text
                style={{
                  fontFamily: "Menda-Bold",
                  fontSize: 20 * u,
                  letterSpacing: -1 * u,
                  color: "#fff",
                  textAlign: "center",
                  marginTop: 10 * u,
                }}
              >
                {c.titulo}
              </Text>
              <InfoBtn titulo={c.titulo} desc={c.desc} />
            </TouchableOpacity>
          ))}

          {/* GROWTH PRO: ocupa las dos columnas */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => irA(null)}
            style={{
              width: ANCHO_GRILLA,
              height: 120 * u,
              borderWidth: 1,
              borderColor: VERDE,
              borderRadius: 22 * u,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8 * u,
            }}
          >
            <Text
              style={{
                fontFamily: "Menda-Bold",
                fontSize: 25 * u,
                letterSpacing: -1.2 * u,
                color: "#fff",
              }}
            >
              GROWTH PRO
            </Text>
            <Image
              source={require("../../assets/lobby-logo-pro.png")}
              style={{ width: 33 * u, height: 24 * u }}
              resizeMode="contain"
            />
            <InfoBtn titulo="GROWTH PRO" desc={PRO_DESC} />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Versión web — fijo abajo, tipo footer */}
      <Text
        style={{
          fontFamily: "Menda-Medium",
          fontSize: 25 * u,
          lineHeight: 28 * u,
          letterSpacing: -1.2 * u,
          color: "#fff",
          textAlign: "center",
          marginBottom: insets.bottom + 18 * u,
        }}
      >
        Utiliza la version web{"\n"}
        <Text
          style={{ color: VERDE }}
          onPress={() => Linking.openURL("https://www.growthmanager.app").catch(() => {})}
        >
          www.growthmanager.app
        </Text>
      </Text>

      {/* Popup con la descripción (ⓘ) */}
      <Modal visible={Boolean(info)} transparent animationType="fade" onRequestClose={() => setInfo(null)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setInfo(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            alignItems: "center",
            justifyContent: "center",
            padding: 30 * u,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              width: 528 * u,
              backgroundColor: BG,
              borderWidth: 1,
              borderColor: VERDE,
              borderRadius: 22 * u,
              padding: 28 * u,
            }}
          >
            <Text
              style={{
                fontFamily: "Menda-Bold",
                fontSize: 25 * u,
                letterSpacing: -1.2 * u,
                color: "#fff",
                marginBottom: 14 * u,
              }}
            >
              {info?.titulo}
            </Text>
            <Text
              style={{
                fontFamily: "Menda-Medium",
                fontSize: 16 * u,
                lineHeight: 22 * u,
                letterSpacing: -0.5 * u,
                color: "#fff",
              }}
            >
              {info?.desc}
            </Text>
            <TouchableOpacity
              onPress={() => setInfo(null)}
              hitSlop={10}
              style={{ position: "absolute", top: 12 * u, right: 12 * u }}
            >
              <Ionicons name="close" size={26 * u} color={VERDE} />
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
