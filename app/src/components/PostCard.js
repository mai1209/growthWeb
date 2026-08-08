// Tarjeta de posteo reutilizable: cabecera + texto/foto + (actividad si no hay
// foto) + "me gusta" (kudos) + comentarios desplegables. Se usa en el feed
// (Inicio) y en el perfil. Autocontenido (trae sus propios estilos y helpers).
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, TextInput, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { communityService } from "../api";

const ACT = {
  caminata: { label: "Caminata", icon: "walk" },
  carrera: { label: "Carrera", icon: "run" },
  bici: { label: "Bici", icon: "bike" },
};
const actMeta = (t) => ACT[t] || ACT.caminata;

const haceCuanto = (iso) => {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
};

// Imagen del posteo que se adapta a su proporción (como Instagram): no se
// recorta. Toma el alto real al cargar y ajusta el aspect ratio (con un tope
// para que un retrato muy alto no ocupe media pantalla).
function FotoPost({ uri, colors }) {
  const [ratio, setRatio] = useState(null);
  return (
    <Image
      source={{ uri }}
      style={[
        { width: "100%", borderRadius: 12 },
        ratio ? { aspectRatio: ratio } : { height: 260, backgroundColor: colors.card },
      ]}
      resizeMode="cover"
      onLoad={(e) => {
        const s = e?.nativeEvent?.source;
        if (s?.width && s?.height) setRatio(Math.max(0.6, Math.min(1.91, s.width / s.height)));
      }}
    />
  );
}

function Avatar({ user, size = 44, colors }) {
  const inicial = (user?.fullName || user?.username || "?").trim().charAt(0).toUpperCase() || "?";
  if (user?.foto) {
    return <Image source={{ uri: user.foto }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
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

export default function PostCard({ post, miId, onAbrirPerfil, onBorrar }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [p, setP] = useState(post);
  const [openC, setOpenC] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [txt, setTxt] = useState("");
  const [enviando, setEnviando] = useState(false);

  const kudos = () => {
    setP((x) => ({ ...x, leDiKudos: !x.leDiKudos, kudos: Math.max(0, x.kudos + (x.leDiKudos ? -1 : 1)) }));
    communityService.kudos(p.id).then(({ data }) => setP((x) => ({ ...x, ...data }))).catch(() => {});
  };
  const toggleComents = () => {
    const nuevo = !openC;
    setOpenC(nuevo);
    if (nuevo) communityService.comentarios(p.id).then(({ data }) => setComentarios(data?.comentarios || [])).catch(() => {});
  };
  const enviar = () => {
    const t = txt.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setTxt("");
    communityService
      .comentar(p.id, t)
      .then(({ data }) => {
        if (data?.comentario) {
          setComentarios((c) => [...c, data.comentario]);
          setP((x) => ({ ...x, comentarios: (x.comentarios || 0) + 1 }));
        }
      })
      .catch(() => {})
      .finally(() => setEnviando(false));
  };

  const esMio = miId && p.autor && String(p.autor.id) === String(miId);

  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
          onPress={() => onAbrirPerfil && onAbrirPerfil(p.autor)}
        >
          <Avatar user={p.autor} colors={colors} />
          <View style={{ flex: 1 }}>
            <Text style={styles.autor}>{p.autor?.fullName || p.autor?.username || "Alguien"}</Text>
            <Text style={styles.fecha}>
              {p.autor?.username ? `@${p.autor.username} · ` : ""}
              {haceCuanto(p.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
        {esMio ? (
          <TouchableOpacity onPress={() => onBorrar && onBorrar(p)} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {p.texto ? <Text style={styles.texto}>{p.texto}</Text> : null}
      {p.foto ? <FotoPost uri={p.foto} colors={colors} /> : null}
      {p.tipo === "actividad" && p.actividad && !p.foto ? (
        <View style={styles.actCard}>
          <MaterialCommunityIcons name={actMeta(p.actividad.tipo).icon} size={20} color={colors.greenBright} />
          <Text style={styles.actTxt}>
            {actMeta(p.actividad.tipo).label} · {(p.actividad.metros / 1000).toFixed(2)} km ·{" "}
            {Math.floor((p.actividad.secs || 0) / 60)} min
          </Text>
        </View>
      ) : null}

      <View style={styles.acciones}>
        <TouchableOpacity style={styles.accBtn} onPress={kudos} hitSlop={6}>
          <Ionicons
            name={p.leDiKudos ? "thumbs-up" : "thumbs-up-outline"}
            size={18}
            color={p.leDiKudos ? colors.greenBright : colors.muted}
          />
          <Text style={[styles.accTxt, p.leDiKudos && { color: colors.greenBright }]}>
            {p.kudos > 0 ? `${p.kudos} ` : ""}
            {p.kudos === 1 ? "kudo" : "kudos"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.accBtn} onPress={toggleComents} hitSlop={6}>
          <Ionicons name="chatbubble-outline" size={17} color={colors.muted} />
          <Text style={styles.accTxt}>
            {p.comentarios > 0 ? `${p.comentarios} ` : ""}
            {p.comentarios === 1 ? "comentario" : "comentarios"}
          </Text>
        </TouchableOpacity>
      </View>

      {openC ? (
        <View style={styles.comentSec}>
          {comentarios.map((c) => (
            <View key={String(c.id)} style={styles.comentRow}>
              <Avatar user={c.autor} size={28} colors={colors} />
              <View style={styles.comentBurbuja}>
                <Text style={styles.comentAutor}>{c.autor?.fullName || c.autor?.username || "Alguien"}</Text>
                <Text style={styles.comentTxt}>{c.texto}</Text>
              </View>
            </View>
          ))}
          <View style={styles.comentInputRow}>
            <TextInput
              style={styles.comentInput}
              value={txt}
              onChangeText={setTxt}
              placeholder="Escribí un comentario…"
              placeholderTextColor={colors.muted}
              multiline
            />
            <TouchableOpacity onPress={enviar} hitSlop={8} disabled={!txt.trim() || enviando}>
              <Ionicons name="send" size={20} color={txt.trim() ? colors.greenBright : colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    post: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 12,
      gap: 10,
    },
    head: { flexDirection: "row", alignItems: "center", gap: 10 },
    autor: { color: colors.text, fontSize: 15, fontWeight: "800" },
    fecha: { color: colors.muted, fontSize: 12.5, marginTop: 1 },
    texto: { color: colors.text, fontSize: 15, lineHeight: 21 },
    foto: { width: "100%", height: 300, borderRadius: 12, resizeMode: "cover" },
    actCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
    },
    actTxt: { color: colors.text, fontSize: 13.5, fontWeight: "700", flex: 1 },
    acciones: { flexDirection: "row", alignItems: "center", gap: 22 },
    accBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    accTxt: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    comentSec: { gap: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 10 },
    comentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    comentBurbuja: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    comentAutor: { color: colors.text, fontSize: 12.5, fontWeight: "800", marginBottom: 2 },
    comentTxt: { color: colors.text, fontSize: 14, lineHeight: 19 },
    comentInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    comentInput: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 14,
      paddingVertical: 9,
      color: colors.text,
      fontSize: 14,
      maxHeight: 90,
    },
  });
