import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../theme";

export default function ProgressRing({ percent = 0, size = 96, stroke = 11 }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - pct / 100);

  return (
    // El texto va en flujo normal centrado y el Svg de fondo en absoluto:
    // al revés (label absoluto) quedaba corrido con RN 0.86 / new arch.
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.cardBorder}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.greenBright}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.value}>{pct}%</Text>
      <Text style={styles.label}>hecho</Text>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  value: { color: colors.text, fontSize: 22, fontWeight: "900", lineHeight: 24 },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
