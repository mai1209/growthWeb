// Modal para compartir una tarea con otro usuario (tarea colaborativa).
// Buscás por @usuario, invitás, y ves quién ya colabora (pendiente/aceptado).
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { taskService } from "../api";

function Avatar({ user, size = 40, colors }) {
  const inicial = (user?.fullName || user?.username || "?").trim().charAt(0).toUpperCase();
  if (user?.foto) {
    return <Image source={{ uri: user.foto }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(93,199,45,0.18)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.greenBright, fontWeight: "900", fontSize: size * 0.42 }}>{inicial}</Text>
    </View>
  );
}

export default function CompartirTareaModal({ task, onClose, onCambio }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [colaboradores, setColaboradores] = useState(task.colaboradores || []);
  const [invitando, setInvitando] = useState(null); // id que se está invitando
  const soyOwner = task.soyOwner !== false; // el backend lo marca; por defecto true

  // Búsqueda con debounce.
  useEffect(() => {
    const texto = q.trim().replace(/^@/, "");
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const t = setTimeout(() => {
      taskService
        .buscarUsuario(texto)
        .then(({ data }) => setResultados(data?.usuarios || []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const yaEsta = (id) =>
    String(task.owner?.id) === String(id) || colaboradores.some((c) => String(c.id) === String(id));

  const invitar = async (u) => {
    if (invitando) return;
    setInvitando(u.id);
    try {
      await taskService.compartir(task.id || task._id, { userId: u.id });
      setColaboradores((prev) => [...prev, { ...u, estado: "pendiente" }]);
      setQ("");
      setResultados([]);
      onCambio && onCambio();
    } catch {
      /* no-op */
    } finally {
      setInvitando(null);
    }
  };

  const quitar = async (u) => {
    setColaboradores((prev) => prev.filter((c) => String(c.id) !== String(u.id)));
    try {
      await taskService.quitarColaborador(task.id || task._id, u.id);
      onCambio && onCambio();
    } catch {
      /* no-op */
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            Compartir tarea
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.tareaNombre} numberOfLines={2}>
            {task.meta}
          </Text>
          <Text style={styles.ayuda}>
            Buscá a la persona por su @usuario. Cuando acepte, van a ver y completar esta tarea los dos.
          </Text>

          <View style={styles.buscarWrap}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              style={styles.buscarInput}
              value={q}
              onChangeText={setQ}
              placeholder="@usuario"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {buscando ? <ActivityIndicator size="small" color={colors.green} /> : null}
          </View>

          {resultados.length > 0 ? (
            <View>
              {resultados.map((u) => {
                const esta = yaEsta(u.id);
                return (
                  <View key={u.id} style={styles.fila}>
                    <Avatar user={u} size={40} colors={colors} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nombre}>{u.fullName || u.username}</Text>
                      <Text style={styles.handle}>@{u.username}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.invitarBtn}
                      onPress={() => !esta && invitar(u)}
                      disabled={esta || invitando === u.id}
                      hitSlop={8}
                    >
                      {invitando === u.id ? (
                        <ActivityIndicator size="small" color={colors.greenBright} />
                      ) : (
                        <Ionicons
                          name={esta ? "checkmark" : "add"}
                          size={26}
                          color={esta ? colors.muted : colors.greenBright}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={styles.seccion}>
            {colaboradores.length > 0 ? "Colaboradores" : "Todavía no compartiste esta tarea"}
          </Text>
          {colaboradores.map((c) => (
            <View key={c.id} style={styles.fila}>
              <Avatar user={c} size={40} colors={colors} />
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{c.fullName || c.username}</Text>
                <Text style={styles.handle}>@{c.username}</Text>
              </View>
              <View style={[styles.chip, c.estado === "aceptado" ? styles.chipOk : styles.chipPend]}>
                <Text style={[styles.chipTxt, c.estado === "aceptado" ? styles.chipTxtOk : styles.chipTxtPend]}>
                  {c.estado === "aceptado" ? "Se unió" : "Pendiente"}
                </Text>
              </View>
              {soyOwner ? (
                <TouchableOpacity onPress={() => quitar(c)} hitSlop={8} style={{ marginLeft: 4 }}>
                  <Ionicons name="close-circle" size={22} color={colors.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </ScrollView>
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
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    title: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
    tareaNombre: { color: colors.text, fontSize: 18, fontWeight: "800" },
    ayuda: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    buscarWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    buscarInput: { flex: 1, color: colors.text, fontSize: 15 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: "hidden",
    },
    fila: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 4 },
    nombre: { color: colors.text, fontSize: 15, fontWeight: "700" },
    handle: { color: colors.muted, fontSize: 12.5 },
    invitarBtn: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    seccion: { color: colors.muted, fontSize: 12.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 4 },
    chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
    chipOk: { backgroundColor: "rgba(93,199,45,0.16)" },
    chipPend: { backgroundColor: "rgba(255,255,255,0.08)" },
    chipTxt: { fontSize: 11.5, fontWeight: "800" },
    chipTxtOk: { color: colors.greenBright },
    chipTxtPend: { color: colors.muted },
  });
