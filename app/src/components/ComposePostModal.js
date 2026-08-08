// Composer de posteo reutilizable (feed, clubes, perfil). Muestra quién postea,
// el texto, un área de foto más amable y un contador. onPublicar({texto,foto})
// debe devolver una promesa; al resolver, limpia y cierra.
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { elegirFotoComida } from "../utils/foto";

const MAX = 600;

function Avatar({ user, size = 44, colors }) {
  const uri = user?.foto || user?.profilePhotoUrl || "";
  const inicial = (user?.fullName || user?.username || "?").trim().charAt(0).toUpperCase() || "?";
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.greenBright, fontWeight: "800", fontSize: size * 0.4 }}>{inicial}</Text>
    </View>
  );
}

export default function ComposePostModal({ visible, onClose, onPublicar, user }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const vacio = !texto.trim() && !foto;

  const cerrar = () => {
    setTexto("");
    setFoto("");
    onClose();
  };
  const agregarFoto = async () => {
    const r = await elegirFotoComida();
    if (r?.base64) setFoto(`data:${r.mediaType};base64,${r.base64}`);
  };
  const enviar = () => {
    if (vacio || enviando) return;
    setEnviando(true);
    Promise.resolve(onPublicar({ texto: texto.trim(), foto }))
      .then(() => cerrar())
      .catch(() => Alert.alert("Error", "No se pudo publicar."))
      .finally(() => setEnviando(false));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.safe, { paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.head}>
          <TouchableOpacity onPress={cerrar} hitSlop={8}>
            <Text style={styles.cancel}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.titulo}>Nuevo posteo</Text>
          <TouchableOpacity onPress={enviar} disabled={vacio || enviando} hitSlop={8}>
            <Text style={[styles.ok, (vacio || enviando) && { opacity: 0.4 }]}>Publicar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          {user ? (
            <View style={styles.userRow}>
              <Avatar user={user} size={44} colors={colors} />
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{user?.fullName || user?.username || "Vos"}</Text>
                <Text style={styles.userHandle}>@{user?.username || "usuario"}</Text>
              </View>
            </View>
          ) : null}

          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="¿Qué querés compartir?"
            placeholderTextColor={colors.muted}
            multiline
            autoFocus
            maxLength={MAX}
          />

          {foto ? (
            <View style={styles.fotoWrap}>
              <Image source={{ uri: foto }} style={styles.foto} />
              <TouchableOpacity style={styles.fotoX} onPress={() => setFoto("")} hitSlop={8}>
                <Ionicons name="close-circle" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.fotoAdd} onPress={agregarFoto} activeOpacity={0.8}>
              <View style={styles.fotoAddIcon}>
                <Ionicons name="image-outline" size={24} color={colors.greenBright} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fotoAddTit}>Agregar una foto</Text>
                <Text style={styles.fotoAddSub}>Opcional</Text>
              </View>
              <Ionicons name="add" size={22} color={colors.greenBright} />
            </TouchableOpacity>
          )}

          <Text style={styles.contador}>
            {texto.length}/{MAX}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    cancel: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    titulo: { color: colors.text, fontSize: 16, fontWeight: "800" },
    ok: { color: colors.greenBright, fontSize: 15, fontWeight: "800" },
    userRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    userName: { color: colors.text, fontSize: 15, fontWeight: "800" },
    userHandle: { color: colors.muted, fontSize: 13, marginTop: 1 },
    input: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 24,
      minHeight: 120,
      textAlignVertical: "top",
    },
    fotoWrap: { position: "relative" },
    foto: { width: "100%", height: 240, borderRadius: 14, resizeMode: "cover" },
    fotoX: { position: "absolute", top: 8, right: 8 },
    fotoAdd: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "rgba(93,199,45,0.4)",
      backgroundColor: "rgba(93,199,45,0.06)",
    },
    fotoAddIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: "rgba(93,199,45,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    fotoAddTit: { color: colors.text, fontSize: 15, fontWeight: "800" },
    fotoAddSub: { color: colors.muted, fontSize: 12.5, marginTop: 1 },
    contador: { color: colors.muted, fontSize: 12.5, textAlign: "right" },
  });
