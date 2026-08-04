import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoyKey = () => dayKey(new Date());

// Calendario de mes para elegir una fecha. Los días con datos llevan un puntito.
// Props: fechaSel (YYYY-MM-DD), onSelect(fecha), tieneDatos(fecha)=>bool.
export default function CalendarioFechas({ fechaSel, onSelect, tieneDatos }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [mes, setMes] = useState(() => {
    const d = new Date(`${fechaSel || hoyKey()}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const hoy = hoyKey();
  const y = mes.getFullYear();
  const m = mes.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const primerDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const celdas = [...Array(primerDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => setMes(new Date(y, m - 1, 1))} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.mes}>{mes.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</Text>
        <TouchableOpacity onPress={() => setMes(new Date(y, m + 1, 1))} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <View key={`d${i}`} style={styles.cell}>
            <Text style={styles.dow}>{d}</Text>
          </View>
        ))}
        {celdas.map((d, i) => {
          if (d == null) return <View key={i} style={styles.cell} />;
          const k = `${y}-${pad(m + 1)}-${pad(d)}`;
          const futuro = k > hoy;
          const tiene = !futuro && tieneDatos && tieneDatos(k);
          const sel = k === fechaSel;
          const esHoy = k === hoy;
          return (
            <View key={i} style={styles.cell}>
              <TouchableOpacity
                disabled={futuro}
                style={[styles.dia, sel && styles.diaSel, esHoy && !sel && styles.diaHoy]}
                onPress={() => onSelect(k)}
              >
                <Text style={[styles.diaTxt, sel && styles.diaTxtSel, futuro && styles.diaTxtOff]}>{d}</Text>
                {tiene ? <View style={[styles.dot, sel && styles.dotSel]} /> : null}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 12,
      gap: 6,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    mes: { color: colors.text, fontSize: 14, fontWeight: "800", textTransform: "capitalize" },
    grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
    cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 2 },
    dow: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    dia: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    diaSel: { backgroundColor: colors.greenBright },
    diaHoy: { borderWidth: 1.5, borderColor: colors.greenBright },
    diaTxt: { color: colors.text, fontSize: 13, fontWeight: "700" },
    diaTxtSel: { color: "#06210a" },
    diaTxtOff: { color: colors.cardBorder },
    dot: { position: "absolute", bottom: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.greenBright },
    dotSel: { backgroundColor: "#06210a" },
  });
