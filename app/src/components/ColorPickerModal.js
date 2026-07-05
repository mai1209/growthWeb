import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
} from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTheme } from "../theme";

// ===== Conversión HSV <-> HEX =====
const hsvToRgb = (h, s, v) => {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  };
  return [f(5), f(3), f(1)].map((x) => Math.round(x * 255));
};

const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;

const hexToHsv = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return { h: 120, s: 0.7, v: 0.85 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max ? d / max : 0, v: max };
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const SQ = 264; // lado del cuadrado
const BAR_H = 22;

// Cuadrado de saturación/brillo + barra de matiz, como los editores de texto.
export default function ColorPickerModal({ visible, initialColor, onClose, onSelect }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [hsv, setHsv] = useState({ h: 120, s: 0.7, v: 0.85 });

  useEffect(() => {
    if (visible) setHsv(hexToHsv(initialColor));
  }, [visible, initialColor]);

  const hex = useMemo(() => rgbToHex(...hsvToRgb(hsv.h, hsv.s, hsv.v)), [hsv]);
  const hueHex = useMemo(() => rgbToHex(...hsvToRgb(hsv.h, 1, 1)), [hsv.h]);

  // Gestos: el cuadrado setea s (x) y v (y); la barra setea h (x)
  const squarePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleSquare(e),
      onPanResponderMove: (e) => handleSquare(e),
    })
  ).current;
  const barPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleBar(e),
      onPanResponderMove: (e) => handleBar(e),
    })
  ).current;

  const handleSquare = (e) => {
    const { locationX, locationY } = e.nativeEvent;
    const s = clamp(locationX / SQ, 0, 1);
    const v = clamp(1 - locationY / SQ, 0, 1);
    setHsv((p) => ({ ...p, s, v }));
  };
  const handleBar = (e) => {
    const { locationX } = e.nativeEvent;
    const h = clamp(locationX / SQ, 0, 1) * 360;
    setHsv((p) => ({ ...p, h }));
  };

  const thumbX = hsv.s * SQ;
  const thumbY = (1 - hsv.v) * SQ;
  const hueX = (hsv.h / 360) * SQ;
  const HUE_STOPS = ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000"];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Elegí un color</Text>

          {/* Cuadrado saturación / brillo */}
          <View style={styles.squareWrap} {...squarePan.panHandlers}>
            <Svg width={SQ} height={SQ} pointerEvents="none">
              <Defs>
                <LinearGradient id="sat" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#ffffff" />
                  <Stop offset="1" stopColor={hueHex} />
                </LinearGradient>
                <LinearGradient id="val" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                  <Stop offset="1" stopColor="#000000" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={SQ} height={SQ} fill="url(#sat)" rx="14" />
              <Rect x="0" y="0" width={SQ} height={SQ} fill="url(#val)" rx="14" />
            </Svg>
            <View
              pointerEvents="none"
              style={[styles.thumb, { left: thumbX - 11, top: thumbY - 11, backgroundColor: hex }]}
            />
          </View>

          {/* Barra de matiz */}
          <View style={styles.barWrap} {...barPan.panHandlers}>
            <Svg width={SQ} height={BAR_H} pointerEvents="none">
              <Defs>
                <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
                  {HUE_STOPS.map((c, i) => (
                    <Stop key={i} offset={`${i / (HUE_STOPS.length - 1)}`} stopColor={c} />
                  ))}
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={SQ} height={BAR_H} fill="url(#hue)" rx={BAR_H / 2} />
            </Svg>
            <View
              pointerEvents="none"
              style={[styles.barThumb, { left: hueX - 11, backgroundColor: hueHex }]}
            />
          </View>

          {/* Vista previa + HEX */}
          <View style={styles.previewRow}>
            <View style={[styles.preview, { backgroundColor: hex }]} />
            <Text style={styles.hexText}>{hex.toUpperCase()}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.okBtn}
              onPress={() => {
                onSelect?.(hex);
                onClose?.();
              }}
            >
              <Text style={styles.okText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    card: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 22,
      padding: 18,
      alignItems: "center",
      gap: 14,
    },
    title: { color: colors.text, fontSize: 17, fontWeight: "800", alignSelf: "flex-start" },
    squareWrap: { width: SQ, height: SQ },
    thumb: {
      position: "absolute",
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 3,
      borderColor: "#fff",
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 3,
    },
    barWrap: { width: SQ, height: BAR_H, justifyContent: "center" },
    barThumb: {
      position: "absolute",
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 3,
      borderColor: "#fff",
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 3,
    },
    previewRow: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "flex-start" },
    preview: {
      width: 34,
      height: 34,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    hexText: { color: colors.text, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
    actions: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
    cancelBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    cancelText: { color: colors.text, fontWeight: "700" },
    okBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.segActive,
    },
    okText: { color: colors.segActiveText, fontWeight: "800" },
  });
