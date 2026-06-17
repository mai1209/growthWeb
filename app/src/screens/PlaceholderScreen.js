import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

// Pantalla provisional para las tabs que todavía no construimos.
export default function PlaceholderScreen({ title = "Próximamente", icon = "construct-outline" }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.center}>
        <Ionicons name={icon} size={42} color={colors.green} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>Esta sección está en construcción.</Text>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 8 },
  text: { color: colors.muted, fontSize: 14, textAlign: "center" },
});
