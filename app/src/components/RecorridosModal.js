import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Polyline, Marker } from "react-native-maps";
import CalendarioFechas from "./CalendarioFechas";
import { useTheme } from "../theme";

const REGION_DEFAULT = { latitude: -31.6333, longitude: -60.7, latitudeDelta: 0.02, longitudeDelta: 0.02 };
const fmtFecha = (k) =>
  new Date(`${k}T00:00:00`).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

// Visor de recorridos de caminata guardados (mapa con el trazado + selector).
export default function RecorridosModal({ visible, onClose, caminatas }) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);

  const conRuta = useMemo(
    () => (caminatas || []).filter((c) => Array.isArray(c.ruta) && c.ruta.length > 1),
    [caminatas]
  );
  const [idx, setIdx] = useState(0);
  const [calAbierto, setCalAbierto] = useState(false);
  useEffect(() => {
    if (visible) {
      setIdx(0);
      setCalAbierto(false);
    }
  }, [visible]);
  const sel = conRuta[idx];
  const kmSel = sel ? sel.metros / 1000 : 0;
  const minSel = sel ? Math.floor((sel.secs || 0) / 60) : 0;
  const ritmoSel = sel && kmSel > 0.02 && sel.secs > 0 ? sel.secs / 60 / kmSel : 0;

  const ajustar = () => {
    if (mapRef.current && sel?.ruta?.length > 1) {
      mapRef.current.fitToCoordinates(sel.ruta, {
        edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
        animated: true,
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Recorridos GPS</Text>
          {conRuta.length ? (
            <TouchableOpacity onPress={() => setCalAbierto((v) => !v)} hitSlop={10}>
              <Ionicons name={calAbierto ? "close" : "calendar-outline"} size={22} color={colors.muted} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 26 }} />
          )}
        </View>

        {!conRuta.length ? (
          <View style={styles.center}>
            <Ionicons name="map-outline" size={40} color={colors.muted} />
            <Text style={styles.hint}>
              Todavía no tenés caminatas con recorrido guardado. Iniciá una caminata con GPS y el
              trazado va a aparecer acá.
            </Text>
          </View>
        ) : calAbierto ? (
          <View style={{ padding: 12 }}>
            <CalendarioFechas
              fechaSel={sel?.fecha}
              tieneDatos={(k) => conRuta.some((c) => c.fecha === k)}
              onSelect={(k) => {
                const i = conRuta.findIndex((c) => c.fecha === k);
                if (i >= 0) {
                  setIdx(i);
                  setTimeout(ajustar, 350);
                }
                setCalAbierto(false);
              }}
            />
          </View>
        ) : (
          <>
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
                initialRegion={
                  sel?.ruta?.[0]
                    ? { ...sel.ruta[0], latitudeDelta: 0.01, longitudeDelta: 0.01 }
                    : REGION_DEFAULT
                }
                onMapReady={ajustar}
                userInterfaceStyle={isDark ? "dark" : "light"}
                pitchEnabled={false}
                rotateEnabled={false}
                toolbarEnabled={false}
              >
                {sel?.ruta?.length > 1 ? (
                  <>
                    <Polyline
                      coordinates={sel.ruta}
                      strokeColor={colors.greenBright}
                      strokeWidth={5}
                      lineCap="round"
                      lineJoin="round"
                    />
                    <Marker coordinate={sel.ruta[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                      <View style={styles.dotStart} />
                    </Marker>
                    <Marker
                      coordinate={sel.ruta[sel.ruta.length - 1]}
                      anchor={{ x: 0.5, y: 0.5 }}
                      tracksViewChanges={false}
                    >
                      <View style={styles.dotEnd}>
                        <View style={styles.dotEndInner} />
                      </View>
                    </Marker>
                  </>
                ) : null}
              </MapView>
              {isDark ? <View pointerEvents="none" style={styles.mapDim} /> : null}
                </>
              )}
            </View>

            <View style={styles.fechaSel}>
              <Ionicons name="calendar-outline" size={13} color={colors.muted} />
              <Text style={styles.fechaSelTxt}>{fmtFecha(sel.fecha)}</Text>
            </View>

            <View style={styles.statCards}>
              <View style={styles.statCard}>
                <Ionicons name="walk-outline" size={17} color={colors.greenBright} />
                <Text style={[styles.statCardNum, { color: colors.greenBright }]}>{kmSel.toFixed(2)}</Text>
                <Text style={styles.statCardLbl}>km</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="time-outline" size={17} color={colors.greenBright} />
                <Text style={styles.statCardNum}>{minSel}</Text>
                <Text style={styles.statCardLbl}>min</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="speedometer-outline" size={17} color={colors.greenBright} />
                <Text style={styles.statCardNum}>{ritmoSel > 0 ? ritmoSel.toFixed(1) : "—"}</Text>
                <Text style={styles.statCardLbl}>min/km</Text>
              </View>
            </View>

            <Text style={styles.listaTitulo}>Tus caminatas</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsWrap}
              contentContainerStyle={styles.chips}
            >
              {conRuta.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.chip, i === idx && styles.chipOn]}
                  onPress={() => {
                    setIdx(i);
                    setTimeout(ajustar, 350);
                  }}
                >
                  <Ionicons
                    name="navigate"
                    size={16}
                    color={i === idx ? colors.greenBright : colors.muted}
                  />
                  <View style={styles.chipTxt}>
                    <Text style={[styles.chipFecha, i === idx && styles.chipTxtOn]}>{fmtFecha(c.fecha)}</Text>
                    <Text style={[styles.chipKm, i === idx && styles.chipTxtOn]}>
                      {(c.metros / 1000).toFixed(1)} km
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
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

    mapWrap: {
      height: 280,
      marginHorizontal: 10,
      marginTop: 4,
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

    fechaSel: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "center",
      paddingTop: 12,
      paddingBottom: 8,
    },
    fechaSelTxt: { color: colors.muted, fontSize: 13, fontWeight: "800", textTransform: "capitalize" },

    statCards: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
    statCard: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 6 },
    statCardNum: { color: colors.text, fontSize: 22, fontWeight: "900" },
    statCardLbl: { color: colors.muted, fontSize: 11, fontWeight: "700" },

    listaTitulo: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    chipsWrap: { flexGrow: 0 },
    chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 18 },
    chip: {
      height: 64,
      minWidth: 96,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      gap: 8,
    },
    chipTxt: { gap: 2 },
    chipOn: { borderColor: colors.greenBright, backgroundColor: "rgba(93,199,45,0.12)" },
    chipFecha: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
    chipKm: { color: colors.text, fontSize: 15, fontWeight: "800" },
    chipTxtOn: { color: colors.greenBright },

    dotStart: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: "#fff",
      borderWidth: 3,
      borderColor: colors.greenBright,
    },
    dotEnd: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(93,199,45,0.30)",
      alignItems: "center",
      justifyContent: "center",
    },
    dotEndInner: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.greenBright,
      borderWidth: 2,
      borderColor: "#fff",
    },
  });
