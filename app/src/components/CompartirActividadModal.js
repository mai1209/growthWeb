import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useTheme } from "../theme";
import { elegirFotoComida } from "../utils/foto";
import { communityService } from "../api";

const ACT = {
  caminata: { label: "Caminata", icon: "walk", metrica: "ritmo" },
  carrera: { label: "Carrera", icon: "run", metrica: "ritmo" },
  bici: { label: "Bici", icon: "bike", metrica: "velocidad" },
};

const fmtTiempoLargo = (secs) => {
  const t = secs || 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min ${String(s).padStart(2, "0")}s`;
};

// Trazado del recorrido (verde por defecto) para superponer sobre la foto.
function Trazado({ ruta, W, H, color = "#5dc72d" }) {
  if (!Array.isArray(ruta) || ruta.length < 2) return null;
  const pad = 10;
  const lats = ruta.map((p) => p.latitude);
  const lngs = ruta.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180) || 1;
  const spanLng = (maxLng - minLng) * kx || 1e-6;
  const spanLat = maxLat - minLat || 1e-6;
  const scale = Math.min((W - 2 * pad) / spanLng, (H - 2 * pad) / spanLat);
  const offX = (W - spanLng * scale) / 2;
  const offY = (H - spanLat * scale) / 2;
  const pts = ruta.map((p) => [
    offX + (p.longitude - minLng) * kx * scale,
    H - offY - (p.latitude - minLat) * scale,
  ]);
  const d = "M " + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ");
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Sombra/contorno oscuro: hace que el recorrido resalte sobre la foto */}
      <Path d={d} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={pts[0][0]} cy={pts[0][1]} r={5.5} fill="rgba(0,0,0,0.45)" />
      <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={6} fill="rgba(0,0,0,0.45)" />
      {/* Recorrido */}
      <Path d={d} fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={pts[0][0]} cy={pts[0][1]} r={4} fill={color} />
      <Circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4.5} fill={color} />
    </Svg>
  );
}

export default function CompartirActividadModal({ visible, actividad, onClose }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const shotRef = useRef(null);
  const [foto, setFoto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  // Como Strava: tocar el bloque rota el formato; escala achica/agranda todo.
  const [layout, setLayout] = useState("vertical"); // vertical | horizontal | mini
  const [escala, setEscala] = useState(1);

  // Arrastre del bloque de datos: se puede poner en cualquier parte de la foto.
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        setArrastrando(true);
        pan.setOffset({ x: pan.x.__getValue(), y: pan.y.__getValue() });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, g) => {
        pan.flattenOffset();
        setArrastrando(false);
        // Toque (sin arrastre) = rotar entre los formatos, como Strava.
        if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
          setLayout((l) => (l === "vertical" ? "horizontal" : l === "horizontal" ? "mini" : "vertical"));
        }
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        setArrastrando(false);
      },
    })
  ).current;

  const act = ACT[actividad?.tipo] || ACT.caminata;
  const km = (actividad?.metros || 0) / 1000;
  const secs = actividad?.secs || 0;
  const ritmo = km > 0.02 && secs > 0 ? secs / 60 / km : 0;
  const vel = secs > 0 ? km / (secs / 3600) : 0;

  const lienzoW = Math.min(Dimensions.get("window").width - 32, 360);
  const lienzoH = Math.round(lienzoW * 1.5);

  const elegirFoto = async () => {
    const r = await elegirFotoComida();
    if (r?.base64) setFoto(`data:${r.mediaType};base64,${r.base64}`);
  };

  const capturar = (opts) => shotRef.current?.capture(opts);

  const guardar = async () => {
    setOcupado(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true); // true = solo "agregar" (write-only)
      if (!perm.granted) {
        Alert.alert("Permiso", "Necesitamos permiso para guardar en tu galería.");
        return;
      }
      const uri = await capturar({ format: "jpg", quality: 0.92 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Guardada", "La imagen quedó en tu galería. 📸");
    } catch {
      Alert.alert("Error", "No se pudo guardar la imagen.");
    } finally {
      setOcupado(false);
    }
  };

  const compartirAfuera = async () => {
    setOcupado(true);
    try {
      const uri = await capturar({ format: "jpg", quality: 0.92 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {
      Alert.alert("Error", "No se pudo compartir.");
    } finally {
      setOcupado(false);
    }
  };

  const publicar = async () => {
    setOcupado(true);
    try {
      // OJO: el .capture() del componente ignora estos opts y usa los del <ViewShot>
      // (devuelve file://). Para obtener el data-uri base64 hay que usar captureRef.
      const dataUri = await captureRef(shotRef, { format: "jpg", quality: 0.82, result: "data-uri" });
      await communityService.crearPost({
        tipo: "actividad",
        texto: "",
        foto: dataUri,
        actividad: {
          tipo: actividad?.tipo || "caminata",
          metros: actividad?.metros || 0,
          secs,
          kcal: actividad?.kcal || 0,
          ruta: actividad?.ruta || undefined,
        },
      });
      Alert.alert("¡Listo!", "Esta foto fue cargada al perfil con éxito.", [
        {
          text: "Ver perfil",
          onPress: () => {
            onClose?.();
            navigation.navigate("Perfil");
          },
        },
      ]);
    } catch {
      Alert.alert("Error", "No se pudo publicar.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Compartir imagen</Text>
          <TouchableOpacity onPress={elegirFoto} hitSlop={10}>
            <Ionicons name="image-outline" size={22} color={colors.greenBright} />
          </TouchableOpacity>
        </View>

        <ScrollView
          scrollEnabled={!arrastrando}
          contentContainerStyle={{ alignItems: "center", padding: 16, paddingBottom: 30 }}
        >
          <ViewShot
            ref={shotRef}
            options={{ format: "jpg", quality: 0.92 }}
            style={[styles.lienzo, { width: lienzoW, height: lienzoH }]}
          >
            {foto ? (
              <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.lienzoBg]} />
            )}

            {/* Datos apilados, arrastrables: ponelos donde quieras sobre la foto */}
            <Animated.View
              style={[
                styles.overlayInfo,
                { transform: [...pan.getTranslateTransform(), { scale: escala }] },
              ]}
              {...panResponder.panHandlers}
            >
              {layout !== "mini" ? (
                <View style={layout === "horizontal" ? styles.statsFila : styles.statsCol}>
                  <View style={styles.dato}>
                    <Text style={styles.datoLbl}>DISTANCIA</Text>
                    <Text style={styles.datoVal}>{km.toFixed(2)} km</Text>
                  </View>
                  <View style={styles.dato}>
                    <Text style={styles.datoLbl}>{act.metrica === "velocidad" ? "VELOCIDAD" : "RITMO"}</Text>
                    <Text style={styles.datoVal}>
                      {act.metrica === "velocidad"
                        ? `${vel > 0 ? vel.toFixed(1) : "—"} km/h`
                        : `${ritmo > 0 ? ritmo.toFixed(1) : "—"} /km`}
                    </Text>
                  </View>
                  <View style={styles.dato}>
                    <Text style={styles.datoLbl}>TIEMPO</Text>
                    <Text style={styles.datoVal}>{fmtTiempoLargo(secs)}</Text>
                  </View>
                  {actividad?.kcal && layout === "vertical" ? (
                    <View style={styles.dato}>
                      <Text style={styles.datoLbl}>CALORÍAS</Text>
                      <Text style={styles.datoVal}>{actividad.kcal} kcal</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {Array.isArray(actividad?.ruta) && actividad.ruta.length > 1 ? (
                <View style={styles.miniRuta}>
                  <Trazado ruta={actividad.ruta} W={110} H={80} color="#3bcb23" />
                </View>
              ) : null}
              {/* GROWTH con el logo al lado, abajo del recorrido */}
              <View style={styles.marcaRow}>
                <Image source={require("../../assets/logoDist.png")} style={styles.marcaLogo} />
                <Text style={styles.marca}>GROWTH</Text>
              </View>
            </Animated.View>
          </ViewShot>

          {!foto ? (
            <TouchableOpacity style={styles.elegirBtn} onPress={elegirFoto}>
              <Ionicons name="image-outline" size={18} color={colors.greenBright} />
              <Text style={styles.elegirTxt}>Elegí una foto de fondo</Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.arrastraHint}>
            <Ionicons name="move-outline" size={15} color={colors.greenBright} />
            <Text style={styles.arrastraHintTxt}>
              Arrastrá para mover · tocá el bloque para cambiar el formato
            </Text>
          </View>

          <View style={styles.tamRow}>
            <Text style={styles.arrastraHintTxt}>Tamaño</Text>
            <TouchableOpacity
              style={styles.tamBtn}
              onPress={() => setEscala((v) => Math.max(0.55, Math.round((v - 0.15) * 100) / 100))}
            >
              <Text style={styles.tamBtnTxt}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tamBtn}
              onPress={() => setEscala((v) => Math.min(1.5, Math.round((v + 0.15) * 100) / 100))}
            >
              <Text style={styles.tamBtnTxt}>＋</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[styles.acciones, { paddingBottom: insets.bottom + 10 }]}>
          {ocupado ? (
            <ActivityIndicator color={colors.green} style={{ paddingVertical: 12 }} />
          ) : (
            <>
              <TouchableOpacity style={styles.accBtn} onPress={guardar}>
                <Ionicons name="download-outline" size={20} color={colors.text} />
                <Text style={styles.accTxt}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.accBtn} onPress={compartirAfuera}>
                <Ionicons name="share-outline" size={20} color={colors.text} />
                <Text style={styles.accTxt}>Compartir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.accBtnPrim} onPress={publicar}>
                <Ionicons name="globe-outline" size={20} color="#06210a" />
                <Text style={styles.accTxtPrim}>Publicar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    title: { color: colors.text, fontSize: 18, fontWeight: "800" },

    // Sin borderRadius: la captura queda rectangular (si se redondea, el JPG
    // rellena las esquinas transparentes de BLANCO). El redondeo lo pone quien
    // la muestra (la tarjeta del posteo).
    lienzo: { overflow: "hidden", backgroundColor: "#0d1f27" },
    lienzoBg: { backgroundColor: "#0d1f27" },
    overlayInfo: { position: "absolute", left: 24, top: "34%", gap: 14, alignItems: "center" },
    statsCol: { alignItems: "center", gap: 14 },
    statsFila: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
    dato: { alignItems: "center" },
    datoLbl: {
      color: "rgba(255,255,255,0.85)",
      fontSize: 10.5,
      fontWeight: "600",
      letterSpacing: 1.3,
      textAlign: "center",
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowRadius: 5,
      textShadowOffset: { width: 0, height: 1 },
    },
    datoVal: {
      color: "#fff",
      fontSize: 25,
      fontWeight: "400",
      letterSpacing: -0.3,
      marginTop: 1,
      textAlign: "center",
      textShadowColor: "rgba(0,0,0,0.55)",
      textShadowRadius: 6,
      textShadowOffset: { width: 0, height: 1 },
    },
    miniRuta: { marginTop: 6 },
    marcaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
    marcaLogo: { width: 20, height: 14, resizeMode: "contain" },
    marca: {
      color: "#00ed64",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
      textShadowColor: "rgba(0,0,0,0.55)",
      textShadowRadius: 6,
      textShadowOffset: { width: 0, height: 1 },
    },

    elegirBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
    elegirTxt: { color: colors.greenBright, fontSize: 14, fontWeight: "800" },
    arrastraHint: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12 },
    arrastraHintTxt: { color: colors.muted, fontSize: 12, fontWeight: "600" },
    tamRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
    tamBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
    },
    tamBtnTxt: { color: colors.greenBright, fontSize: 17, fontWeight: "800" },

    acciones: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    accBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    accTxt: { color: colors.text, fontSize: 14, fontWeight: "800" },
    accBtnPrim: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: colors.greenBright,
    },
    accTxtPrim: { color: "#06210a", fontSize: 14, fontWeight: "800" },
  });
