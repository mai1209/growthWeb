import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Polyline, Marker } from "react-native-maps";
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
  useEffect(() => {
    if (visible) setIdx(0);
  }, [visible]);
  const sel = conRuta[idx];

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
          <Text style={styles.title}>Recorridos</Text>
          <View style={{ width: 26 }} />
        </View>

        {!conRuta.length ? (
          <View style={styles.center}>
            <Ionicons name="map-outline" size={40} color={colors.muted} />
            <Text style={styles.hint}>
              Todavía no tenés caminatas con recorrido guardado. Iniciá una caminata con GPS y el
              trazado va a aparecer acá.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.mapWrap}>
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
            </View>

            <View style={styles.info}>
              <Text style={styles.infoKm}>{(sel.metros / 1000).toFixed(2)} km</Text>
              <Text style={styles.infoSub}>
                {fmtFecha(sel.fecha)} · {Math.floor((sel.secs || 0) / 60)} min
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {conRuta.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.chip, i === idx && styles.chipOn]}
                  onPress={() => {
                    setIdx(i);
                    setTimeout(ajustar, 350);
                  }}
                >
                  <Text style={[styles.chipTxt, i === idx && styles.chipTxtOn]}>{fmtFecha(c.fecha)}</Text>
                  <Text style={[styles.chipKm, i === idx && styles.chipTxtOn]}>
                    {(c.metros / 1000).toFixed(1)} km
                  </Text>
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
      flex: 1,
      minHeight: 220,
      marginHorizontal: 10,
      marginTop: 4,
      borderRadius: 22,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    map: { flex: 1 },

    info: { alignItems: "center", paddingVertical: 12, gap: 2 },
    infoKm: { color: colors.text, fontSize: 30, fontWeight: "900" },
    infoSub: { color: colors.muted, fontSize: 13, fontWeight: "700", textTransform: "capitalize" },

    chips: { gap: 8, paddingHorizontal: 12, paddingBottom: 18 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      gap: 2,
    },
    chipOn: { borderColor: colors.greenBright, backgroundColor: "rgba(93,199,45,0.14)" },
    chipTxt: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
    chipKm: { color: colors.text, fontSize: 13, fontWeight: "800" },
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
