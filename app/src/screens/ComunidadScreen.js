import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme } from "../theme";
import { communityService } from "../api";
import { elegirFotoComida } from "../utils/foto";

const ACT = {
  caminata: { label: "Caminata", icon: "walk" },
  carrera: { label: "Carrera", icon: "run" },
  bici: { label: "Bici", icon: "bike" },
};
const actMeta = (t) => ACT[t] || ACT.caminata;

const haceCuanto = (iso) => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};

const fmtTiempo = (secs) => {
  const m = Math.floor((secs || 0) / 60);
  return `${m} min`;
};

// Dibuja el trazado de un recorrido (proyección equirectangular) en un SVG chico.
function RutaMini({ ruta, colors, W = 320, H = 150 }) {
  if (!Array.isArray(ruta) || ruta.length < 2) return null;
  const pad = 14;
  const lats = ruta.map((p) => p.latitude);
  const lngs = ruta.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180) || 1;
  const spanLng = (maxLng - minLng) * kx || 1e-6;
  const spanLat = maxLat - minLat || 1e-6;
  const scale = Math.min((W - 2 * pad) / spanLng, (H - 2 * pad) / spanLat);
  const offX = (W - spanLng * scale) / 2;
  const offY = (H - spanLat * scale) / 2;
  const pts = ruta.map((p) => [
    offX + (p.longitude - minLng) * kx * scale,
    H - offY - (p.latitude - minLat) * scale,
  ]);
  const d = "M " + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ");
  const ini = pts[0];
  const fin = pts[pts.length - 1];
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path d={d} fill="none" stroke={colors.greenBright} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={ini[0]} cy={ini[1]} r={5} fill="#fff" stroke={colors.greenBright} strokeWidth={3} />
      <Circle cx={fin[0]} cy={fin[1]} r={6} fill={colors.greenBright} stroke="#fff" strokeWidth={2} />
    </Svg>
  );
}

// Avatar con inicial de fallback.
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

export default function ComunidadScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState("inicio"); // inicio | buscar | perfil
  const [composeOpen, setComposeOpen] = useState(false);
  const [perfilUser, setPerfilUser] = useState(null); // usuario que estás viendo (modal)

  // ---- Feed ----
  const [feed, setFeed] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const cargarFeed = useCallback(() => {
    communityService
      .feed({ limit: 20 })
      .then(({ data }) => setFeed(data?.posts || []))
      .catch(() => setFeed([]));
  }, []);
  useEffect(() => {
    cargarFeed();
  }, [cargarFeed]);
  const refrescarFeed = () => {
    setRefrescando(true);
    communityService
      .feed({ limit: 20 })
      .then(({ data }) => setFeed(data?.posts || []))
      .catch(() => {})
      .finally(() => setRefrescando(false));
  };

  const darKudos = (post) => {
    // Optimista
    setFeed((prev) =>
      (prev || []).map((p) =>
        p.id === post.id
          ? { ...p, leDiKudos: !p.leDiKudos, kudos: p.kudos + (p.leDiKudos ? -1 : 1) }
          : p
      )
    );
    communityService.kudos(post.id).catch(() => cargarFeed());
  };

  const borrarPost = (post) => {
    Alert.alert("Borrar posteo", "¿Seguro que querés borrarlo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => {
          setFeed((prev) => (prev || []).filter((p) => p.id !== post.id));
          communityService.borrarPost(post.id).catch(() => cargarFeed());
        },
      },
    ]);
  };

  // ---- Perfil propio ----
  const [miPerfil, setMiPerfil] = useState(null);
  const cargarMiPerfil = useCallback(() => {
    communityService
      .getMiPerfil()
      .then(({ data }) => setMiPerfil(data))
      .catch(() => {});
  }, []);
  useEffect(() => {
    cargarMiPerfil();
  }, [cargarMiPerfil]);

  const publicar = ({ texto, foto }) => {
    return communityService.crearPost({ tipo: "texto", texto, foto }).then(({ data }) => {
      if (data?.post) setFeed((prev) => [data.post, ...(prev || [])]);
      cargarMiPerfil();
    });
  };

  const renderPost = ({ item }) => (
    <View style={styles.post}>
      <TouchableOpacity style={styles.postHead} onPress={() => item.autor && setPerfilUser(item.autor)}>
        <Avatar user={item.autor} colors={colors} />
        <View style={{ flex: 1 }}>
          <Text style={styles.postAutor}>{item.autor?.fullName || item.autor?.username || "Alguien"}</Text>
          <Text style={styles.postFecha}>
            {item.autor?.username ? `@${item.autor.username} · ` : ""}
            {haceCuanto(item.createdAt)}
          </Text>
        </View>
        {miPerfil && item.autor && String(item.autor.id) === String(miPerfil.id) ? (
          <TouchableOpacity onPress={() => borrarPost(item)} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {item.texto ? <Text style={styles.postTexto}>{item.texto}</Text> : null}

      {item.foto ? <Image source={{ uri: item.foto }} style={styles.postFoto} /> : null}

      {item.tipo === "actividad" && item.actividad ? (
        <View style={styles.actWrap}>
          {Array.isArray(item.actividad.ruta) && item.actividad.ruta.length > 1 ? (
            <View style={styles.actMapa}>
              <RutaMini ruta={item.actividad.ruta} colors={colors} />
            </View>
          ) : null}
          <View style={styles.actCard}>
            <MaterialCommunityIcons name={actMeta(item.actividad.tipo).icon} size={20} color={colors.greenBright} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actTitulo}>{actMeta(item.actividad.tipo).label}</Text>
              <Text style={styles.actStats}>
                {(item.actividad.metros / 1000).toFixed(2)} km · {fmtTiempo(item.actividad.secs)}
                {item.actividad.kcal ? ` · ${item.actividad.kcal} kcal` : ""}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.postAcciones}>
        <TouchableOpacity style={styles.kudosBtn} onPress={() => darKudos(item)} hitSlop={6}>
          <Ionicons
            name={item.leDiKudos ? "thumbs-up" : "thumbs-up-outline"}
            size={18}
            color={item.leDiKudos ? colors.greenBright : colors.muted}
          />
          <Text style={[styles.kudosTxt, item.leDiKudos && { color: colors.greenBright }]}>
            {item.kudos > 0 ? item.kudos : ""} {item.kudos === 1 ? "kudo" : "kudos"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Comunidad</Text>
        {tab === "inicio" ? (
          <TouchableOpacity onPress={() => setComposeOpen(true)} hitSlop={10}>
            <Ionicons name="create-outline" size={24} color={colors.greenBright} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <View style={styles.tabs}>
        {[
          ["inicio", "Inicio", "home-outline"],
          ["buscar", "Buscar", "search-outline"],
        ].map(([k, l, ic]) => (
          <TouchableOpacity key={k} style={styles.tabBtn} onPress={() => setTab(k)}>
            <Ionicons name={ic} size={18} color={tab === k ? colors.greenBright : colors.muted} />
            <Text style={[styles.tabTxt, tab === k && styles.tabTxtOn]}>{l}</Text>
            {tab === k ? <View style={styles.tabInd} /> : null}
          </TouchableOpacity>
        ))}
      </View>

      {tab === "inicio" ? (
        feed === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.green} />
          </View>
        ) : (
          <FlatList
            data={feed}
            keyExtractor={(p) => String(p.id)}
            renderItem={renderPost}
            contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 12 }}
            refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescarFeed} tintColor={colors.green} />}
            ListEmptyComponent={
              <View style={styles.vacio}>
                <Ionicons name="people-outline" size={34} color={colors.muted} />
                <Text style={styles.vacioTxt}>
                  Tu feed está vacío. Seguí gente en "Buscar" o compartí algo con el lápiz de arriba.
                </Text>
              </View>
            }
          />
        )
      ) : (
        <BuscarTab
          colors={colors}
          styles={styles}
          onAbrirPerfil={setPerfilUser}
        />
      )}

      {composeOpen ? (
        <ComposeModal
          colors={colors}
          styles={styles}
          onClose={() => setComposeOpen(false)}
          onPublicar={publicar}
        />
      ) : null}

      {perfilUser ? (
        <PerfilUsuarioModal
          colors={colors}
          styles={styles}
          user={perfilUser}
          onClose={() => setPerfilUser(null)}
        />
      ) : null}
    </View>
  );
}

// ---------- Compartir (posteo de texto) ----------
function ComposeModal({ colors, styles, onClose, onPublicar }) {
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const vacio = !texto.trim() && !foto;
  const agregarFoto = async () => {
    const r = await elegirFotoComida();
    if (r?.base64) setFoto(`data:${r.mediaType};base64,${r.base64}`);
  };
  const enviar = () => {
    if (vacio || enviando) return;
    setEnviando(true);
    onPublicar({ texto: texto.trim(), foto })
      .then(() => onClose())
      .catch(() => Alert.alert("Error", "No se pudo publicar."))
      .finally(() => setEnviando(false));
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.composeFull, { paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.composeHeadFull}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.composeCancel}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.composeTitulo}>Nuevo posteo</Text>
          <TouchableOpacity onPress={enviar} disabled={vacio || enviando} hitSlop={8}>
            <Text style={[styles.composeOk, (vacio || enviando) && { opacity: 0.4 }]}>Publicar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.composeInput}
            value={texto}
            onChangeText={setTexto}
            placeholder="¿Qué querés compartir?"
            placeholderTextColor={colors.muted}
            multiline
            autoFocus
            maxLength={600}
          />
          {foto ? (
            <View style={styles.composeFotoWrap}>
              <Image source={{ uri: foto }} style={styles.composeFoto} />
              <TouchableOpacity style={styles.composeFotoX} onPress={() => setFoto("")} hitSlop={8}>
                <Ionicons name="close-circle" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
          <TouchableOpacity style={styles.composeFotoBtn} onPress={agregarFoto}>
            <Ionicons name="image-outline" size={18} color={colors.greenBright} />
            <Text style={styles.composeFotoBtnTxt}>{foto ? "Cambiar foto" : "Agregar foto"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- Buscar / descubrir gente ----------
function BuscarTab({ colors, styles, onAbrirPerfil }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setRes([]);
      return undefined;
    }
    setCargando(true);
    const t = setTimeout(() => {
      communityService
        .buscar(query)
        .then(({ data }) => setRes(data?.usuarios || []))
        .catch(() => setRes([]))
        .finally(() => setCargando(false));
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.buscarWrap}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput
          style={styles.buscarInput}
          value={q}
          onChangeText={setQ}
          placeholder="Buscá gente por nombre o usuario"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
      </View>
      {cargando ? <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} /> : null}
      <FlatList
        data={res}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={{ padding: 14, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.userRow} onPress={() => onAbrirPerfil(item)}>
            <Avatar user={item} size={42} colors={colors} />
            <View style={{ flex: 1 }}>
              <Text style={styles.userNombre}>{item.fullName || item.username}</Text>
              <Text style={styles.userSub}>@{item.username}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          q.trim().length >= 2 && !cargando ? (
            <Text style={styles.vacioTxt}>No encontramos a nadie con eso.</Text>
          ) : null
        }
      />
    </View>
  );
}

// ---------- Mi perfil ----------
function MiPerfilTab({ colors, styles, perfil, onGuardado }) {
  const [editando, setEditando] = useState(false);
  const [bio, setBio] = useState("");
  const [publico, setPublico] = useState(true);
  useEffect(() => {
    if (perfil) {
      setBio(perfil.bio || "");
      setPublico(perfil.perfilPublico !== false);
    }
  }, [perfil]);
  if (!perfil) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }
  const guardar = () => {
    communityService
      .updateMiPerfil({ bio, perfilPublico: publico })
      .then(() => {
        setEditando(false);
        onGuardado?.();
      })
      .catch(() => Alert.alert("Error", "No se pudo guardar."));
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 18, alignItems: "center", gap: 10 }}>
      <Avatar user={perfil} size={84} colors={colors} />
      <Text style={styles.perfilNombre}>{perfil.fullName || perfil.username}</Text>
      <Text style={styles.perfilUser}>@{perfil.username}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{perfil.stats?.posteos || 0}</Text>
          <Text style={styles.statLbl}>posteos</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{perfil.stats?.seguidores || 0}</Text>
          <Text style={styles.statLbl}>seguidores</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{perfil.stats?.siguiendo || 0}</Text>
          <Text style={styles.statLbl}>siguiendo</Text>
        </View>
      </View>

      {editando ? (
        <View style={{ alignSelf: "stretch", gap: 10, marginTop: 8 }}>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Escribí una bio (máx 160)"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={160}
          />
          <TouchableOpacity style={styles.toggleRow} onPress={() => setPublico((v) => !v)}>
            <Ionicons
              name={publico ? "checkbox" : "square-outline"}
              size={20}
              color={publico ? colors.greenBright : colors.muted}
            />
            <Text style={styles.toggleTxt}>Perfil público (otros pueden encontrarte y seguirte)</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={styles.btnSec} onPress={() => setEditando(false)}>
              <Text style={styles.btnSecTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrim} onPress={guardar}>
              <Text style={styles.btnPrimTxt}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {perfil.bio ? <Text style={styles.perfilBio}>{perfil.bio}</Text> : null}
          <Text style={styles.perfilPriv}>
            {perfil.perfilPublico !== false ? "Perfil público" : "Perfil privado"}
          </Text>
          <TouchableOpacity style={styles.btnSec} onPress={() => setEditando(true)}>
            <Ionicons name="create-outline" size={15} color={colors.text} />
            <Text style={styles.btnSecTxt}>Editar bio / privacidad</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

// ---------- Perfil de otro usuario (modal) ----------
function PerfilUsuarioModal({ colors, styles, user, onClose }) {
  const [perfil, setPerfil] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loSigo, setLoSigo] = useState(false);
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    setPerfil(null);
    communityService
      .getPerfil(user.username)
      .then(({ data }) => {
        setPerfil(data);
        setLoSigo(!!data.loSigo);
        if (data.id) communityService.postsDeUsuario(data.id).then(({ data: d }) => setPosts(d?.posts || [])).catch(() => {});
      })
      .catch(() => setPerfil({ error: true }));
  }, [user.username]);

  const toggleSeguir = () => {
    if (!perfil?.id || cargando) return;
    setCargando(true);
    const accion = loSigo ? communityService.dejarDeSeguir : communityService.seguir;
    setLoSigo((v) => !v);
    accion(perfil.id).catch(() => setLoSigo((v) => !v)).finally(() => setCargando(false));
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: 12 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>@{user.username}</Text>
          <View style={{ width: 24 }} />
        </View>
        {!perfil ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.green} />
          </View>
        ) : perfil.error ? (
          <View style={styles.center}>
            <Text style={styles.vacioTxt}>No se pudo cargar el perfil.</Text>
          </View>
        ) : perfil.perfilPublico === false && !perfil.esYo ? (
          <View style={styles.center}>
            <Ionicons name="lock-closed-outline" size={30} color={colors.muted} />
            <Text style={styles.vacioTxt}>Este perfil es privado.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 18, gap: 10 }}>
            <View style={{ alignItems: "center", gap: 8 }}>
              <Avatar user={perfil} size={80} colors={colors} />
              <Text style={styles.perfilNombre}>{perfil.fullName || perfil.username}</Text>
              <Text style={styles.perfilUser}>@{perfil.username}</Text>
              {perfil.bio ? <Text style={styles.perfilBio}>{perfil.bio}</Text> : null}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{perfil.stats?.posteos || 0}</Text>
                  <Text style={styles.statLbl}>posteos</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{perfil.stats?.seguidores || 0}</Text>
                  <Text style={styles.statLbl}>seguidores</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{perfil.stats?.siguiendo || 0}</Text>
                  <Text style={styles.statLbl}>siguiendo</Text>
                </View>
              </View>
              {!perfil.esYo ? (
                <TouchableOpacity style={loSigo ? styles.btnSec : styles.btnPrim} onPress={toggleSeguir}>
                  <Text style={loSigo ? styles.btnSecTxt : styles.btnPrimTxt}>
                    {loSigo ? "Siguiendo" : "Seguir"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.postsHead}>Posteos</Text>
            {posts.length === 0 ? (
              <Text style={styles.vacioTxt}>Todavía no publicó nada.</Text>
            ) : (
              posts.map((p) => (
                <View key={String(p.id)} style={styles.post}>
                  <Text style={styles.postFecha}>{haceCuanto(p.createdAt)}</Text>
                  {p.texto ? <Text style={styles.postTexto}>{p.texto}</Text> : null}
                  {p.tipo === "actividad" && p.actividad ? (
                    <View style={styles.actCard}>
                      <MaterialCommunityIcons name={actMeta(p.actividad.tipo).icon} size={20} color={colors.greenBright} />
                      <Text style={styles.actStats}>
                        {(p.actividad.metros / 1000).toFixed(2)} km · {fmtTiempo(p.actividad.secs)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        )}
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
      paddingVertical: 10,
    },
    title: { color: colors.text, fontSize: 18, fontWeight: "800" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 30 },

    tabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 3 },
    tabTxt: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    tabTxtOn: { color: colors.greenBright },
    tabInd: {
      position: "absolute",
      bottom: -1,
      height: 2,
      width: "60%",
      backgroundColor: colors.greenBright,
      borderRadius: 2,
    },

    post: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    postHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    postAutor: { color: colors.text, fontSize: 15, fontWeight: "800" },
    postFecha: { color: colors.muted, fontSize: 12, fontWeight: "600" },
    postTexto: { color: colors.text, fontSize: 15, lineHeight: 21 },
    postFoto: { width: "100%", height: 200, borderRadius: 12, resizeMode: "cover" },
    actWrap: { gap: 8 },
    actMapa: { backgroundColor: "rgba(93,199,45,0.08)", borderRadius: 12, padding: 8 },
    actCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "rgba(93,199,45,0.08)",
      borderRadius: 12,
      padding: 12,
    },
    actTitulo: { color: colors.text, fontSize: 14, fontWeight: "800" },
    actStats: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    postAcciones: { flexDirection: "row", alignItems: "center" },
    kudosBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    kudosTxt: { color: colors.muted, fontSize: 13, fontWeight: "700" },

    vacio: { alignItems: "center", gap: 12, padding: 40 },
    vacioTxt: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
    composeCard: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      gap: 12,
      minHeight: 220,
    },
    composeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    composeCancel: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    composeTitulo: { color: colors.text, fontSize: 16, fontWeight: "800" },
    composeOk: { color: colors.greenBright, fontSize: 15, fontWeight: "800" },
    composeFull: { flex: 1, backgroundColor: colors.bg },
    composeHeadFull: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    composeInput: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 23,
      minHeight: 160,
      textAlignVertical: "top",
    },
    composeFotoWrap: { position: "relative", marginTop: 4 },
    composeFoto: { width: "100%", height: 180, borderRadius: 12, resizeMode: "cover" },
    composeFotoX: { position: "absolute", top: 8, right: 8 },
    composeFotoBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 8 },
    composeFotoBtnTxt: { color: colors.greenBright, fontWeight: "800", fontSize: 14 },

    buscarWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      margin: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    buscarInput: { flex: 1, color: colors.text, fontSize: 15 },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    userNombre: { color: colors.text, fontSize: 15, fontWeight: "800" },
    userSub: { color: colors.muted, fontSize: 12.5, fontWeight: "600" },

    perfilNombre: { color: colors.text, fontSize: 20, fontWeight: "900" },
    perfilUser: { color: colors.muted, fontSize: 14, fontWeight: "700" },
    perfilBio: { color: colors.text, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 4 },
    perfilPriv: { color: colors.muted, fontSize: 12.5, fontWeight: "700" },
    statsRow: { flexDirection: "row", gap: 26, marginTop: 8 },
    statBox: { alignItems: "center" },
    statNum: { color: colors.text, fontSize: 20, fontWeight: "900" },
    statLbl: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    postsHead: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 8 },

    bioInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      padding: 12,
      color: colors.text,
      fontSize: 15,
      minHeight: 80,
      textAlignVertical: "top",
    },
    toggleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    toggleTxt: { color: colors.muted, fontSize: 13, fontWeight: "600", flex: 1 },

    btnPrim: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 24,
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: colors.greenBright,
    },
    btnPrimTxt: { color: "#06210a", fontSize: 14, fontWeight: "800" },
    btnSec: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    btnSecTxt: { color: colors.text, fontSize: 14, fontWeight: "800" },
  });
