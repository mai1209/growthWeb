import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

export default function UpdateModal({ visible, info, onClose }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  if (!info) return null;

  const openStore = () => {
    const url = info.ios || info.android;
    if (url) Linking.openURL(url).catch(() => {});
    onClose?.(); // marca la versión como avisada: no vuelve a aparecer
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Image
              source={require("../../assets/growth-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>{info.title || "Nueva versión disponible"}</Text>
          {info.message ? <Text style={styles.message}>{info.message}</Text> : null}

          {Array.isArray(info.changes) && info.changes.length ? (
            <ScrollView
              style={styles.changes}
              contentContainerStyle={{ gap: 9 }}
              showsVerticalScrollIndicator={false}
            >
              {info.changes.map((c, i) => (
                <View key={i} style={styles.changeRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.greenBright} />
                  <Text style={styles.changeText}>{c}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <TouchableOpacity style={styles.primary} onPress={openStore}>
            <Ionicons name="cloud-download-outline" size={18} color="#06210a" />
            <Text style={styles.primaryText}>Actualizar ahora</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.ghost} hitSlop={8}>
            <Text style={styles.ghostText}>Ahora no</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: 24,
    },
    card: {
      backgroundColor: colors.bg,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 22,
      gap: 12,
      alignItems: "center",
    },
    iconWrap: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    logo: { width: 32, height: 32 },
    title: { color: colors.text, fontSize: 19, fontWeight: "900", textAlign: "center" },
    message: {
      color: colors.muted,
      fontSize: 14.5,
      lineHeight: 20,
      textAlign: "center",
    },
    changes: {
      alignSelf: "stretch",
      maxHeight: 190,
      marginTop: 2,
    },
    changeRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    changeText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 19 },
    primary: {
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 6,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.greenBright,
    },
    primaryText: { color: "#06210a", fontWeight: "900", fontSize: 15.5 },
    ghost: { paddingVertical: 8 },
    ghostText: { color: colors.muted, fontWeight: "700", fontSize: 14 },
  });
