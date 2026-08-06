import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  AppState,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Polyline, Marker } from "react-native-maps";
import { iniciarCaminataLA, actualizarCaminataLA, terminarCaminataLA } from "../services/liveActivity";
import * as TaskManager from "expo-task-manager";
import { useTheme } from "../theme";

const R_TIERRA = 6371000; // metros
const toRad = (x) => (x * Math.PI) / 180;
const TASK = "growth-caminata-track";
// Región inicial del mapa (se recentra en tu ubicación al fijar el GPS).
const REGION_DEFAULT = {
  latitude: -31.6333,
  longitude: -60.7,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

// Tipos de actividad (como en Strava): cambia la métrica principal (ritmo vs
// velocidad) y el gasto calórico (MET). No cambia el GPS ni el trazado.
const ACTIVIDADES = [
  { key: "caminata", label: "Caminata", icon: "walk", met: 3.5, metrica: "ritmo" },
  { key: "carrera", label: "Carrera", icon: "run", met: 9.0, metrica: "ritmo" },
  { key: "bici", label: "Bici", icon: "bike", met: 6.0, metrica: "velocidad" },
];

function haversine(a, b) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(h));
}

// Acumulador de la caminata en curso. Vive a nivel de módulo para que el task
// de segundo plano pueda seguir sumando aunque la UI no esté visible.
const track = { last: null, metros: 0, activo: false, puntos: [] };

const sumarPunto = (coords) => {
  if (!track.activo) return;
  const punto = { latitude: coords.latitude, longitude: coords.longitude };
  if (track.last) {
    const d = haversine(track.last, coords);
    // Filtramos micro-ruido (<1m) y saltos irreales (>100m entre lecturas).
    if (d > 1 && d < 100) {
      track.metros += d;
      track.puntos.push(punto); // el trazado del recorrido (para el mapa)
    }
  } else {
    track.puntos.push(punto); // primer punto
  }
  track.last = coords;
};

// Task de ubicación en segundo plano: recibe puntos aunque la app esté
// bloqueada o minimizada y los suma al acumulador.
TaskManager.defineTask(TASK, ({ data, error }) => {
  if (error) return;
  (data?.locations || []).forEach((loc) => sumarPunto(loc.coords));
});

const detenerFuentes = async (subRef) => {
  if (subRef.current) {
    subRef.current.remove();
    subRef.current = null;
  }
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
      await Location.stopLocationUpdatesAsync(TASK);
    }
  } catch {}
};

const fmtTiempo = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function CaminataModal({ visible, onClose, onGuardar, pesoKg = 70 }) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const [fase, setFase] = useState("permiso"); // permiso | activo | pausado | resumen | denegado
  const [metros, setMetros] = useState(0);
  const [secs, setSecs] = useState(0);
  const [ruta, setRuta] = useState([]); // trazado del recorrido para el mapa
  const [enFondo, setEnFondo] = useState(false); // true si el tracking sigue en segundo plano
  const [tipo, setTipo] = useState("caminata"); // tipo de actividad (recuerda la última)

  const subRef = useRef(null); // watchPosition (modo foreground / Expo Go)
  const mapRef = useRef(null);
  const timerRef = useRef(null);
  const elapsedBaseRef = useRef(0); // ms acumulados de tramos anteriores (pausas)
  const segStartRef = useRef(null); // inicio del tramo actual

  const sincronizar = () => {
    setMetros(track.metros);
    setRuta(track.puntos.slice()); // refresca la línea del mapa
    const segs =
      segStartRef.current != null
        ? Math.floor((elapsedBaseRef.current + (Date.now() - segStartRef.current)) / 1000)
        : Math.floor(elapsedBaseRef.current / 1000);
    setSecs(segs);
    // Refresca la tarjeta (Live Activity) con los km y el tiempo actuales.
    if (track.activo) actualizarCaminataLA(track.metros, segs);
  };

  const arrancarTracking = async () => {
    track.last = null; // tras una pausa no contamos el hueco como distancia
    track.activo = true;
    segStartRef.current = Date.now();

    // Intento seguir en segundo plano (requiere build nativo + permiso "Siempre").
    let backgroundOk = false;
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status === "granted") {
        await Location.startLocationUpdatesAsync(TASK, {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 3000,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "Caminata en curso 🚶",
            notificationBody: "Growth sigue midiendo tu caminata. Abrí la app para pausar o finalizar.",
            notificationColor: "#5dc72d",
          },
        });
        backgroundOk = true;
      }
    } catch {}

    if (!backgroundOk) {
      // Expo Go o sin permiso "Siempre": medimos con la app abierta, como antes.
      subRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
        (loc) => sumarPunto(loc.coords)
      );
    }
    setEnFondo(backgroundOk);

    // Enciende la Live Activity (si el equipo la soporta; si no, no hace nada).
    iniciarCaminataLA(track.metros, Math.floor(elapsedBaseRef.current / 1000));

    timerRef.current = setInterval(sincronizar, 1000);
    setFase("activo");
  };

  const cortarTramo = async () => {
    track.activo = false;
    if (segStartRef.current != null) {
      elapsedBaseRef.current += Date.now() - segStartRef.current;
      segStartRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await detenerFuentes(subRef);
    sincronizar();
  };

  // Al abrir: reset + permisos + arrancar.
  useEffect(() => {
    let vivo = true;
    if (visible) {
      setFase("permiso");
      setMetros(0);
      setSecs(0);
      setRuta([]);
      track.metros = 0;
      track.last = null;
      track.puntos = [];
      elapsedBaseRef.current = 0;
      segStartRef.current = null;
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!vivo) return;
        if (status !== "granted") {
          setFase("denegado");
          return;
        }
        // No arrancamos solos: quedamos "listos" para que elija el tipo y toque Iniciar.
        setFase("listo");
      })();
    }
    return () => {
      vivo = false;
      track.activo = false;
      if (timerRef.current) clearInterval(timerRef.current);
      detenerFuentes(subRef);
      terminarCaminataLA(); // al cerrar la caminata, cerramos la tarjeta
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Al volver del fondo, sincronizamos al toque (el interval no corre suspendido).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") sincronizar();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pausar = async () => {
    await cortarTramo();
    setFase("pausado");
  };
  const reanudar = () => {
    arrancarTracking();
  };
  const finalizar = async () => {
    await cortarTramo();
    terminarCaminataLA(); // termina la Live Activity
    setFase("resumen");
  };
  const act = ACTIVIDADES.find((a) => a.key === tipo) || ACTIVIDADES[0];
  const km = metros / 1000;
  const ritmo = km > 0.02 && secs > 0 ? secs / 60 / km : 0; // min/km
  const vel = secs > 0 ? km / (secs / 3600) : 0; // km/h
  const kcal = Math.round(act.met * (pesoKg || 70) * (secs / 3600)); // MET × peso × horas
  const ultimoPunto = ruta.length ? ruta[ruta.length - 1] : null;

  const guardar = () => {
    onGuardar?.({ metros: Math.round(track.metros), secs, ruta: track.puntos.slice(), tipo, kcal });
    onClose?.();
  };

  const infoActividad = () => {
    Alert.alert(
      "¿Qué actividad elegir?",
      "Elegí según lo que hacés:\n\n🚶  Caminata — paso tranquilo.\n🏃  Carrera — si corrés (con o sin pausas de caminata, va como Carrera).\n🚴  Bici.\n\nLa distancia y el tiempo se miden igual en las 3 (por GPS). Lo que cambia son las CALORÍAS: correr quema más del doble que caminar. Si corrés y elegís Caminata, te cuenta de menos.\n\n¿Mitad y mitad? Elegí Carrera (como en Strava).",
      [{ text: "Entendido" }]
    );
  };

  // El mapa sigue tu posición (punto verde) mientras caminás.
  useEffect(() => {
    if (!ultimoPunto || !mapRef.current) return;
    if (fase === "activo" || fase === "pausado") {
      mapRef.current.animateCamera({ center: ultimoPunto }, { duration: 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ultimoPunto?.latitude, ultimoPunto?.longitude, fase]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{act.label}</Text>
          <View style={{ width: 26 }} />
        </View>

        {fase === "permiso" ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.hint}>Preparando el GPS…</Text>
          </View>
        ) : fase === "denegado" ? (
          <View style={styles.center}>
            <Ionicons name="location-outline" size={40} color={colors.muted} />
            <Text style={styles.hint}>
              Necesitamos permiso de ubicación para medir tu caminata. Podés activarlo en los
              ajustes del teléfono.
            </Text>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.mapWrap}>
              {Platform.OS === "android" ? (
                <View style={styles.mapSoon}>
                  <Ionicons name="map-outline" size={34} color={colors.muted} />
                  <Text style={styles.mapSoonText}>Mapa próximamente en Android</Text>
                  <Text style={styles.mapSoonSub}>Por ahora disponible solo en iOS</Text>
                </View>
              ) : (
                <>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={REGION_DEFAULT}
                userInterfaceStyle={isDark ? "dark" : "light"}
                showsUserLocation={false}
                showsMyLocationButton={false}
                toolbarEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                {ruta.length > 1 ? (
                  <Polyline
                    coordinates={ruta}
                    strokeColor={colors.greenBright}
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                  />
                ) : null}
                {ultimoPunto ? (
                  <Marker coordinate={ultimoPunto} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={styles.dotOuter}>
                      <View style={styles.dotInner} />
                    </View>
                  </Marker>
                ) : null}
              </MapView>
              {isDark ? <View pointerEvents="none" style={styles.mapDim} /> : null}
                </>
              )}
            </View>

            <View style={styles.panel}>
              <View style={styles.actSelector}>
                {ACTIVIDADES.map((a) => (
                  <TouchableOpacity
                    key={a.key}
                    style={[styles.actChip, tipo === a.key && styles.actChipOn]}
                    onPress={() => setTipo(a.key)}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons
                      name={a.icon}
                      size={18}
                      color={tipo === a.key ? colors.greenBright : colors.text}
                    />
                    <Text style={[styles.actLabel, tipo === a.key && styles.actLabelOn]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.infoLink} onPress={infoActividad} hitSlop={8}>
                <Ionicons name="information-circle-outline" size={14} color={colors.muted} />
                <Text style={styles.infoLinkText}>¿Cuál elegir? Influye en las calorías</Text>
              </TouchableOpacity>
              {fase === "listo" ? (
                <View style={styles.estado}>
                  <Ionicons name="location" size={14} color={colors.greenBright} />
                  <Text style={styles.estadoTxt}>GPS LISTO</Text>
                </View>
              ) : fase !== "resumen" ? (
                <View style={[styles.estado, fase === "pausado" && styles.estadoPausa]}>
                  <View style={[styles.estadoDot, fase === "pausado" && styles.estadoDotPausa]} />
                  <Text style={[styles.estadoTxt, fase === "pausado" && styles.estadoTxtPausa]}>
                    {fase === "activo" ? "EN CURSO" : "EN PAUSA"}
                  </Text>
                </View>
              ) : (
                <View style={styles.estado}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.greenBright} />
                  <Text style={styles.estadoTxt}>{act.label.toUpperCase()} LISTA</Text>
                </View>
              )}

              <View style={styles.kmRow}>
                <Text style={styles.kmBig}>{km.toFixed(2)}</Text>
                <Text style={styles.kmUnit}>km</Text>
              </View>

              <View style={styles.statCards}>
                <View style={styles.statCard}>
                  <Ionicons name="time-outline" size={17} color={colors.greenBright} />
                  <Text style={styles.statCardNum}>{fmtTiempo(secs)}</Text>
                  <Text style={styles.statCardLbl}>tiempo</Text>
                </View>
                {act.metrica === "velocidad" ? (
                  <View style={styles.statCard}>
                    <Ionicons name="speedometer-outline" size={17} color={colors.greenBright} />
                    <Text style={styles.statCardNum}>{vel > 0 ? vel.toFixed(1) : "—"}</Text>
                    <Text style={styles.statCardLbl}>km/h</Text>
                  </View>
                ) : (
                  <View style={styles.statCard}>
                    <Ionicons name="speedometer-outline" size={17} color={colors.greenBright} />
                    <Text style={styles.statCardNum}>{ritmo > 0 ? ritmo.toFixed(1) : "—"}</Text>
                    <Text style={styles.statCardLbl}>min/km</Text>
                  </View>
                )}
                <View style={styles.statCard}>
                  <Ionicons name="flame-outline" size={17} color={colors.greenBright} />
                  <Text style={styles.statCardNum}>{kcal > 0 ? kcal : "—"}</Text>
                  <Text style={styles.statCardLbl}>kcal</Text>
                </View>
              </View>

            {fase === "listo" ? (
              <View style={styles.acciones}>
                <TouchableOpacity style={styles.btnPrim} onPress={arrancarTracking}>
                  <Ionicons name="play" size={20} color="#06210a" />
                  <Text style={styles.btnPrimText}>Iniciar {act.label.toLowerCase()}</Text>
                </TouchableOpacity>
              </View>
            ) : fase === "activo" ? (
              <View style={styles.acciones}>
                <TouchableOpacity style={styles.btnSec} onPress={pausar}>
                  <Ionicons name="pause" size={20} color={colors.text} />
                  <Text style={styles.btnSecText}>Pausar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnStop} onPress={finalizar}>
                  <Ionicons name="stop" size={20} color="#fff" />
                  <Text style={styles.btnStopText}>Finalizar</Text>
                </TouchableOpacity>
              </View>
            ) : fase === "pausado" ? (
              <View style={styles.acciones}>
                <TouchableOpacity style={styles.btnPrim} onPress={reanudar}>
                  <Ionicons name="play" size={20} color="#06210a" />
                  <Text style={styles.btnPrimText}>Reanudar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnStop} onPress={finalizar}>
                  <Ionicons name="stop" size={20} color="#fff" />
                  <Text style={styles.btnStopText}>Finalizar</Text>
                </TouchableOpacity>
              </View>
            ) : fase === "resumen" ? (
              <View style={styles.acciones}>
                <TouchableOpacity style={styles.btnSec} onPress={onClose}>
                  <Text style={styles.btnSecText}>Descartar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrim} onPress={guardar}>
                  <Text style={styles.btnPrimText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {fase === "listo" ? (
              <Text style={styles.resumenTxt}>
                Elegí la actividad arriba y tocá Iniciar cuando estés listo/a.
              </Text>
            ) : fase === "resumen" ? (
              <Text style={styles.resumenTxt}>¡Buena {act.label.toLowerCase()}! Guardala en tu historial.</Text>
            ) : enFondo ? (
              <Text style={styles.resumenTxt}>
                Podés bloquear el teléfono o usar otras apps: la actividad sigue midiéndose. Volvé
                acá para pausar o finalizar.
              </Text>
            ) : (
              <Text style={styles.resumenTxt}>
                Para que siga midiéndose con la pantalla bloqueada, permití “Ubicación: Siempre” en
                los ajustes del teléfono. Por ahora, mantené la app abierta.
              </Text>
            )}
            </View>
          </View>
        )}
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
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
    hint: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },

    body: { flex: 1 },
    mapWrap: {
      flex: 1,
      minHeight: 200,
      marginHorizontal: 10,
      marginTop: 8,
      borderRadius: 22,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    map: { flex: 1 },
    mapDim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
    mapSoon: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: 20, backgroundColor: colors.card },
    mapSoonText: { color: colors.text, fontSize: 15, fontWeight: "800" },
    mapSoonSub: { color: colors.muted, fontSize: 12.5, fontWeight: "600" },
    dotOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(93,199,45,0.30)",
      alignItems: "center",
      justifyContent: "center",
    },
    dotInner: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.greenBright,
      borderWidth: 2,
      borderColor: "#fff",
    },
    panel: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, alignItems: "center", gap: 10 },

    actSelector: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
    actChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    actChipOn: { borderColor: colors.greenBright, backgroundColor: "rgba(93,199,45,0.14)" },
    actLabel: { color: colors.muted, fontSize: 13, fontWeight: "800" },
    actLabelOn: { color: colors.greenBright },
    infoLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    infoLinkText: { color: colors.muted, fontSize: 12, fontWeight: "600" },

    estado: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: "rgba(93,199,45,0.14)",
      borderWidth: 1,
      borderColor: "rgba(93,199,45,0.4)",
    },
    estadoPausa: { backgroundColor: "rgba(214,169,46,0.14)", borderColor: "rgba(214,169,46,0.45)" },
    estadoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.greenBright },
    estadoDotPausa: { backgroundColor: "#d6a92e" },
    estadoTxt: { color: colors.greenBright, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
    estadoTxtPausa: { color: "#d6a92e" },

    kmRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 2 },
    kmBig: { color: colors.greenBright, fontSize: 52, fontWeight: "900", letterSpacing: -1.5 },
    kmUnit: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 9 },
    kmLabel: { color: colors.muted, fontSize: 15, fontWeight: "700", marginBottom: 24 },

    statCards: { flexDirection: "row", gap: 8, alignSelf: "stretch", marginTop: 4 },
    statCard: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 6 },
    statCardNum: { color: colors.text, fontSize: 22, fontWeight: "900" },
    statCardLbl: { color: colors.muted, fontSize: 11, fontWeight: "700" },

    stats: { flexDirection: "row", gap: 40, marginBottom: 4 },
    stat: { alignItems: "center", gap: 4 },
    statNum: { color: colors.text, fontSize: 28, fontWeight: "800" },
    statLbl: { color: colors.muted, fontSize: 12, fontWeight: "700" },

    acciones: { flexDirection: "row", gap: 12 },
    btnSec: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    btnSecText: { color: colors.text, fontSize: 15, fontWeight: "800" },
    btnPrim: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 26,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: colors.greenBright,
    },
    btnPrimText: { color: "#06210a", fontSize: 15, fontWeight: "800" },
    btnStop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 26,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: colors.red,
    },
    btnStopText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    resumenTxt: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 20,
      textAlign: "center",
      paddingHorizontal: 10,
    },
  });
