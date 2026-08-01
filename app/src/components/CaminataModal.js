import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useTheme } from "../theme";

const R_TIERRA = 6371000; // metros
const toRad = (x) => (x * Math.PI) / 180;

function haversine(a, b) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(h));
}

const fmtTiempo = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function CaminataModal({ visible, onClose, onGuardar }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [fase, setFase] = useState("permiso"); // permiso | activo | pausado | resumen | denegado
  const [metros, setMetros] = useState(0);
  const [secs, setSecs] = useState(0);

  const subRef = useRef(null);
  const lastCoordRef = useRef(null);
  const timerRef = useRef(null);

  const detenerTracking = () => {
    if (subRef.current) {
      subRef.current.remove();
      subRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const arrancarTracking = async () => {
    lastCoordRef.current = null;
    subRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
      (loc) => {
        const c = loc.coords;
        if (lastCoordRef.current) {
          const d = haversine(lastCoordRef.current, c);
          // Filtramos micro-ruido (<1m) y saltos irreales (>100m entre lecturas).
          if (d > 1 && d < 100) setMetros((m) => m + d);
        }
        lastCoordRef.current = c;
      }
    );
    timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
    setFase("activo");
  };

  // Al abrir: pedimos permiso y arrancamos el tracking.
  useEffect(() => {
    let vivo = true;
    if (visible) {
      setFase("permiso");
      setMetros(0);
      setSecs(0);
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!vivo) return;
        if (status !== "granted") {
          setFase("denegado");
          return;
        }
        await arrancarTracking();
      })();
    }
    return () => {
      vivo = false;
      detenerTracking();
    };
  }, [visible]);

  const pausar = () => {
    detenerTracking();
    setFase("pausado");
  };
  const reanudar = () => {
    arrancarTracking();
  };
  const finalizar = () => {
    detenerTracking();
    setFase("resumen");
  };
  const guardar = () => {
    onGuardar?.({ metros: Math.round(metros), secs });
    onClose?.();
  };

  const km = metros / 1000;
  const ritmo = km > 0.02 ? secs / 60 / km : 0; // min/km

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Caminata</Text>
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
            <Text style={styles.kmBig}>{km.toFixed(2)}</Text>
            <Text style={styles.kmLabel}>kilómetros</Text>

            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{fmtTiempo(secs)}</Text>
                <Text style={styles.statLbl}>tiempo</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{ritmo > 0 ? ritmo.toFixed(1) : "—"}</Text>
                <Text style={styles.statLbl}>min/km</Text>
              </View>
            </View>

            {fase === "activo" ? (
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

            {fase === "resumen" ? (
              <Text style={styles.resumenTxt}>¡Buena caminata! Guardala en tu historial.</Text>
            ) : (
              <Text style={styles.resumenTxt}>Mantené la pantalla abierta mientras caminás.</Text>
            )}
          </View>
        )}
      </SafeAreaView>
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

    body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: 24 },
    kmBig: { color: colors.text, fontSize: 72, fontWeight: "900", letterSpacing: -1 },
    kmLabel: { color: colors.muted, fontSize: 15, fontWeight: "700", marginBottom: 24 },

    stats: { flexDirection: "row", gap: 40, marginBottom: 36 },
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
    resumenTxt: { color: colors.muted, fontSize: 13, marginTop: 20, textAlign: "center" },
  });
