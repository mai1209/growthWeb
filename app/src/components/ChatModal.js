// Chat de comunidad para la app: ChatModal (DM privado o chat de club, con
// polling cada 3s) y BandejaModal (lista de conversaciones DM). Autocontenidos:
// arman sus propios estilos desde el tema, así se pueden usar en cualquier
// pantalla (Comunidad, Perfil, detalle de club).
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { communityService } from "../api";

const haceCuanto = (iso) => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};

function Avatar({ user, size = 44, colors }) {
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

export function ChatModal({ modo, id, titulo, miId, onClose }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const [mensajes, setMensajes] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const listRef = useRef(null);

  const cargar = useCallback(() => {
    const req = modo === "grupo" ? communityService.getChatGrupo(id) : communityService.getDM(id);
    req.then(({ data }) => setMensajes(data?.mensajes || [])).catch(() => setMensajes([]));
  }, [modo, id]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 3000);
    return () => clearInterval(t);
  }, [cargar]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setTexto("");
    try {
      const { data } =
        modo === "grupo"
          ? await communityService.enviarChatGrupo(id, t)
          : await communityService.enviarDM(id, t);
      if (data?.mensaje) setMensajes((xs) => [...(xs || []), data.mensaje]);
    } catch {
      setTexto(t);
    } finally {
      setEnviando(false);
    }
  };

  const puedeEnviar = !!texto.trim() && !enviando;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.safe, { paddingTop: insets.top, flex: 1 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
              {titulo}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          {mensajes === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.green} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={mensajes}
              keyExtractor={(m) => String(m.id)}
              contentContainerStyle={{
                padding: 14,
                gap: 8,
                flexGrow: 1,
                justifyContent: mensajes.length ? "flex-end" : "center",
              }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item: m }) => {
                const mio = m.autor && String(m.autor.id) === String(miId);
                return (
                  <View style={[styles.msg, mio ? styles.msgMio : styles.msgOtro]}>
                    {!mio && modo === "grupo" ? (
                      <Text style={styles.autor}>{m.autor?.fullName || m.autor?.username}</Text>
                    ) : null}
                    <View style={[styles.burbuja, mio ? styles.burbujaMio : styles.burbujaOtro]}>
                      <Text style={mio ? styles.txtMio : styles.txtOtro}>{m.texto}</Text>
                    </View>
                    <Text style={styles.hora}>{haceCuanto(m.createdAt)}</Text>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.vacio}>Todavía no hay mensajes. Escribí el primero 👋</Text>
              }
            />
          )}
          <View style={[styles.form, { paddingBottom: (insets.bottom || 8) + 6 }]}>
            <TextInput
              style={styles.input}
              value={texto}
              onChangeText={setTexto}
              placeholder="Escribí un mensaje…"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.send, !puedeEnviar && { opacity: 0.4 }]}
              onPress={enviar}
              disabled={!puedeEnviar}
            >
              <Ionicons name="send" size={17} color="#06210a" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function BandejaModal({ miId, onClose, onLeidas }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const [convos, setConvos] = useState(null);
  const [chatUser, setChatUser] = useState(null);
  const cargar = useCallback(() => {
    communityService
      .conversaciones()
      .then(({ data }) => setConvos(data?.conversaciones || []))
      .catch(() => setConvos([]));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top, flex: 1 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Mensajes</Text>
          <View style={{ width: 24 }} />
        </View>
        {convos === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.green} />
          </View>
        ) : convos.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.vacio}>
              Todavía no tenés conversaciones.{"\n"}Entrá a un perfil y tocá "Mensaje".
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 14, gap: 4 }}>
            {convos.map((c) => (
              <TouchableOpacity key={String(c.usuario.id)} style={styles.convoRow} onPress={() => setChatUser(c.usuario)}>
                <Avatar user={c.usuario} size={44} colors={colors} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.convoNombre}>{c.usuario.fullName || c.usuario.username}</Text>
                  <Text style={styles.convoUltimo} numberOfLines={1}>
                    {c.ultimo}
                  </Text>
                </View>
                {c.noLeidos > 0 ? (
                  <View style={styles.convoBadge}>
                    <Text style={styles.convoBadgeTxt}>{c.noLeidos > 9 ? "9+" : c.noLeidos}</Text>
                  </View>
                ) : (
                  <Text style={styles.hora}>{haceCuanto(c.cuando)}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {chatUser ? (
          <ChatModal
            modo="dm"
            id={chatUser.id}
            titulo={chatUser.fullName || chatUser.username}
            miId={miId}
            onClose={() => {
              setChatUser(null);
              onLeidas && onLeidas();
              cargar();
            }}
          />
        ) : null}
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
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    vacio: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
    msg: { maxWidth: "80%", gap: 2 },
    msgMio: { alignSelf: "flex-end", alignItems: "flex-end" },
    msgOtro: { alignSelf: "flex-start", alignItems: "flex-start" },
    autor: { color: colors.greenBright, fontSize: 11.5, fontWeight: "800", paddingHorizontal: 6 },
    burbuja: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16 },
    burbujaMio: { backgroundColor: colors.greenBright, borderBottomRightRadius: 5 },
    burbujaOtro: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderBottomLeftRadius: 5,
    },
    txtMio: { color: "#06210a", fontSize: 14.5, lineHeight: 20 },
    txtOtro: { color: colors.text, fontSize: 14.5, lineHeight: 20 },
    hora: { color: colors.muted, fontSize: 10.5, paddingHorizontal: 6 },
    form: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      backgroundColor: colors.bg,
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 120,
      backgroundColor: colors.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      color: colors.text,
      fontSize: 15,
    },
    send: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.greenBright,
      alignItems: "center",
      justifyContent: "center",
    },
    convoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    convoNombre: { color: colors.text, fontSize: 15, fontWeight: "800" },
    convoUltimo: { color: colors.muted, fontSize: 12.5, fontWeight: "600" },
    convoBadge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      borderRadius: 10,
      backgroundColor: "#ff5d5d",
      alignItems: "center",
      justifyContent: "center",
    },
    convoBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
  });
