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
import { communityService, gruposService, retosService } from "../api";
import { elegirFotoComida } from "../utils/foto";

const ACT = {
  caminata: { label: "Caminata", icon: "walk" },
  carrera: { label: "Carrera", icon: "run" },
  bici: { label: "Bici", icon: "bike" },
};
const actMeta = (t) => ACT[t] || ACT.caminata;

const DEP_LABEL = { caminata: "Caminata", carrera: "Carrera", bici: "Bici", mixto: "Mixto" };
const DEP_ICON = { caminata: "walk", carrera: "run", bici: "bike", mixto: "account-group" };

const fmtKm = (m) => `${((Number(m) || 0) / 1000).toFixed(1)} km`;
const pad2 = (n) => String(n).padStart(2, "0");
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
// Estado del reto según el "hoy" del dispositivo (igual que el resto de la app).
const estadoReto = (r, colors) => {
  const h = hoyLocal();
  if (h < r.inicio) return { txt: "Próximo", fg: "#7a5b00", bg: "#ffe4a3" };
  if (h > r.fin) return { txt: "Terminado", fg: colors.muted, bg: colors.cardBorder };
  return { txt: "En curso", fg: "#06210a", bg: colors.greenBright };
};

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

  // Abrir un perfil: si sos vos, va al perfil principal (el de la portada);
  // si es otro usuario, abre el modal de perfil público.
  const abrirPerfil = useCallback(
    (u) => {
      if (!u) return;
      if (miPerfil && String(u.id) === String(miPerfil.id)) navigation.navigate("Perfil");
      else setPerfilUser(u);
    },
    [miPerfil, navigation]
  );

  const publicar = ({ texto, foto }) => {
    return communityService.crearPost({ tipo: "texto", texto, foto }).then(({ data }) => {
      if (data?.post) setFeed((prev) => [data.post, ...(prev || [])]);
      cargarMiPerfil();
    });
  };

  const renderPost = ({ item }) => (
    <View style={styles.post}>
      <TouchableOpacity
        style={styles.postHead}
        onPress={() => abrirPerfil(item.autor)}
      >
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
        <View style={styles.headerRight}>
          {tab === "inicio" ? (
            <TouchableOpacity onPress={() => setComposeOpen(true)} hitSlop={10}>
              <Ionicons name="create-outline" size={24} color={colors.greenBright} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => navigation.navigate("Perfil")} hitSlop={8}>
            <View style={styles.headerAvatar}>
              <Avatar user={miPerfil} size={30} colors={colors} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        {[
          ["inicio", "Inicio", "home-outline"],
          ["buscar", "Buscar", "search-outline"],
          ["grupos", "Clubes", "people-outline"],
          ["retos", "Retos", "trophy-outline"],
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
      ) : tab === "buscar" ? (
        <BuscarTab colors={colors} styles={styles} onAbrirPerfil={abrirPerfil} />
      ) : tab === "grupos" ? (
        <GruposTab colors={colors} styles={styles} />
      ) : (
        <RetosTab colors={colors} styles={styles} onAbrirPerfil={abrirPerfil} />
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

// ---------- Clubes / grupos ----------
function GruposTab({ colors, styles }) {
  const [mios, setMios] = useState([]);
  const [descubrir, setDescubrir] = useState([]);
  const [q, setQ] = useState("");
  const [crearOpen, setCrearOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(() => {
    gruposService.mios().then(({ data }) => setMios(data?.grupos || [])).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    const query = q.trim();
    const t = setTimeout(() => {
      gruposService
        .descubrir(query)
        .then(({ data }) => setDescubrir(data?.grupos || []))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const toggleUnirse = (g) => {
    const accion = g.soyMiembro ? gruposService.salir : gruposService.unirse;
    const upd = (arr) =>
      arr.map((x) =>
        x.id === g.id
          ? { ...x, soyMiembro: !g.soyMiembro, miembros: x.miembros + (g.soyMiembro ? -1 : 1) }
          : x
      );
    setDescubrir(upd);
    setMios(upd);
    accion(g.id).then(() => cargar()).catch(() => {});
  };

  const Card = (g) => (
    <TouchableOpacity key={String(g.id)} style={styles.grupoCard} onPress={() => setDetalle(g)}>
      <View style={styles.grupoIcon}>
        {g.foto ? (
          <Image source={{ uri: g.foto }} style={styles.grupoFoto} />
        ) : (
          <MaterialCommunityIcons name={DEP_ICON[g.deporte] || "account-group"} size={22} color={colors.greenBright} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.grupoNombre}>{g.nombre}</Text>
        <Text style={styles.grupoSub}>
          {DEP_LABEL[g.deporte] || "Mixto"}
          {g.zona ? ` · ${g.zona}` : ""} · {g.miembros} {g.miembros === 1 ? "miembro" : "miembros"}
        </Text>
      </View>
      <TouchableOpacity
        style={g.soyMiembro ? styles.grupoBtnSec : styles.grupoBtnPrim}
        onPress={() => toggleUnirse(g)}
      >
        <Text style={g.soyMiembro ? styles.grupoBtnSecTxt : styles.grupoBtnPrimTxt}>
          {g.soyMiembro ? "Unido" : "Unirme"}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
      <TouchableOpacity style={styles.crearGrupoBtn} onPress={() => setCrearOpen(true)}>
        <Ionicons name="add" size={18} color="#06210a" />
        <Text style={styles.crearGrupoTxt}>Crear un club</Text>
      </TouchableOpacity>

      {mios.length ? (
        <>
          <Text style={styles.grupoSecTit}>Tus clubes</Text>
          {mios.map(Card)}
        </>
      ) : null}

      <View style={styles.buscarWrap}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput
          style={styles.buscarInput}
          value={q}
          onChangeText={setQ}
          placeholder="Buscar clubes por nombre o zona"
          placeholderTextColor={colors.muted}
        />
      </View>
      <Text style={styles.grupoSecTit}>Descubrir</Text>
      {descubrir.length ? (
        descubrir.map(Card)
      ) : (
        <Text style={styles.vacioTxt}>Todavía no hay clubes. ¡Creá el primero!</Text>
      )}

      {crearOpen ? (
        <CrearGrupoModal
          colors={colors}
          styles={styles}
          onClose={() => setCrearOpen(false)}
          onCreado={() => {
            setCrearOpen(false);
            cargar();
          }}
        />
      ) : null}
      {detalle ? (
        <GrupoDetalleModal
          colors={colors}
          styles={styles}
          grupo={detalle}
          onClose={() => {
            setDetalle(null);
            cargar();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function CrearGrupoModal({ colors, styles, onClose, onCreado }) {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [zona, setZona] = useState("");
  const [deporte, setDeporte] = useState("mixto");
  const [enviando, setEnviando] = useState(false);
  const crear = () => {
    if (!nombre.trim() || enviando) return;
    setEnviando(true);
    gruposService
      .crear({ nombre: nombre.trim(), descripcion, zona, deporte })
      .then(() => onCreado())
      .catch(() => Alert.alert("Error", "No se pudo crear el club."))
      .finally(() => setEnviando(false));
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.composeHeadFull}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.composeCancel}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.composeTitulo}>Crear club</Text>
          <TouchableOpacity onPress={crear} disabled={!nombre.trim() || enviando} hitSlop={8}>
            <Text style={[styles.composeOk, (!nombre.trim() || enviando) && { opacity: 0.4 }]}>Crear</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.grupoInput}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre del club"
            placeholderTextColor={colors.muted}
            maxLength={60}
            autoFocus
          />
          <TextInput
            style={[styles.grupoInput, { minHeight: 80, textAlignVertical: "top" }]}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Descripción (opcional)"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={400}
          />
          <TextInput
            style={styles.grupoInput}
            value={zona}
            onChangeText={setZona}
            placeholder="Zona / ciudad (ej: Santa Fe)"
            placeholderTextColor={colors.muted}
            maxLength={80}
          />
          <Text style={styles.grupoLbl}>Deporte</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {[
              ["caminata", "Caminata"],
              ["carrera", "Carrera"],
              ["bici", "Bici"],
              ["mixto", "Mixto"],
            ].map(([k, l]) => (
              <TouchableOpacity
                key={k}
                style={[styles.depChip, deporte === k && styles.depChipOn]}
                onPress={() => setDeporte(k)}
              >
                <Text style={[styles.depChipTxt, deporte === k && styles.depChipTxtOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function GrupoDetalleModal({ colors, styles, grupo, onClose }) {
  const insets = useSafeAreaInsets();
  const [g, setG] = useState(grupo);
  const [miembros, setMiembros] = useState([]);
  useEffect(() => {
    gruposService.get(grupo.id).then(({ data }) => data?.grupo && setG(data.grupo)).catch(() => {});
    gruposService.miembros(grupo.id).then(({ data }) => setMiembros(data?.miembros || [])).catch(() => {});
  }, [grupo.id]);
  const toggle = () => {
    const accion = g.soyMiembro ? gruposService.salir : gruposService.unirse;
    setG((x) => ({ ...x, soyMiembro: !x.soyMiembro, miembros: x.miembros + (x.soyMiembro ? -1 : 1) }));
    accion(g.id)
      .then(({ data }) => setG((x) => ({ ...x, ...data })))
      .catch(() => {});
  };
  const borrar = () => {
    Alert.alert("Borrar club", "¿Seguro que querés borrarlo? No se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => gruposService.borrar(g.id).then(onClose).catch(() => {}),
      },
    ]);
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {g.nombre}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
          <View style={{ alignItems: "center", gap: 8 }}>
            <View style={styles.grupoIconBig}>
              {g.foto ? (
                <Image source={{ uri: g.foto }} style={styles.grupoFotoBig} />
              ) : (
                <MaterialCommunityIcons name={DEP_ICON[g.deporte] || "account-group"} size={40} color={colors.greenBright} />
              )}
            </View>
            <Text style={styles.perfilNombre}>{g.nombre}</Text>
            <Text style={styles.perfilUser}>
              {DEP_LABEL[g.deporte] || "Mixto"}
              {g.zona ? ` · ${g.zona}` : ""} · {g.miembros} miembros
            </Text>
            {g.descripcion ? <Text style={styles.perfilBio}>{g.descripcion}</Text> : null}
            <TouchableOpacity style={g.soyMiembro ? styles.btnSec : styles.btnPrim} onPress={toggle}>
              <Text style={g.soyMiembro ? styles.btnSecTxt : styles.btnPrimTxt}>
                {g.soyMiembro ? "Salir del club" : "Unirme"}
              </Text>
            </TouchableOpacity>
            {g.soyOwner ? (
              <TouchableOpacity onPress={borrar} hitSlop={8}>
                <Text style={styles.borrarClub}>Borrar club</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.postsHead}>Miembros</Text>
          {miembros.map((m) => (
            <View key={String(m.id)} style={styles.miembroRow}>
              <Avatar user={m} size={38} colors={colors} />
              <View style={{ flex: 1 }}>
                <Text style={styles.userNombre}>{m.fullName || m.username}</Text>
                <Text style={styles.userSub}>
                  @{m.username}
                  {m.rol === "owner" ? " · creador" : ""}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------- Retos / desafíos ----------
function RetosTab({ colors, styles, onAbrirPerfil }) {
  const [mios, setMios] = useState([]);
  const [descubrir, setDescubrir] = useState([]);
  const [q, setQ] = useState("");
  const [crearOpen, setCrearOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(() => {
    retosService.mios().then(({ data }) => setMios(data?.retos || [])).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    const query = q.trim();
    const t = setTimeout(() => {
      retosService.descubrir(query).then(({ data }) => setDescubrir(data?.retos || [])).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const toggle = (r) => {
    const accion = r.meApunto ? retosService.salir : retosService.unirse;
    const upd = (arr) =>
      arr.map((x) =>
        x.id === r.id ? { ...x, meApunto: !r.meApunto, participantes: x.participantes + (r.meApunto ? -1 : 1) } : x
      );
    setDescubrir(upd);
    setMios(upd);
    accion(r.id).then(() => cargar()).catch(() => {});
  };

  const Card = (r) => {
    const est = estadoReto(r, colors);
    const pct = r.miProgreso != null && r.meta ? Math.min(100, Math.round((r.miProgreso / r.meta) * 100)) : null;
    return (
      <TouchableOpacity key={String(r.id)} style={styles.retoCard} onPress={() => setDetalle(r)}>
        <View style={styles.retoTop}>
          <View style={styles.grupoIcon}>
            <MaterialCommunityIcons name={DEP_ICON[r.deporte] || "trophy"} size={20} color={colors.greenBright} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.grupoNombre}>{r.nombre}</Text>
            <Text style={styles.grupoSub}>
              {fmtKm(r.meta)} · {DEP_LABEL[r.deporte] || "Mixto"} · {r.participantes}{" "}
              {r.participantes === 1 ? "persona" : "personas"}
            </Text>
          </View>
          <View style={[styles.retoBadge, { backgroundColor: est.bg }]}>
            <Text style={[styles.retoBadgeTxt, { color: est.fg }]}>{est.txt}</Text>
          </View>
        </View>
        {pct != null ? (
          <View style={{ gap: 5 }}>
            <View style={styles.progBar}>
              <View style={[styles.progFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progTxt}>
              {fmtKm(r.miProgreso)} de {fmtKm(r.meta)} · {pct}%
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={r.meApunto ? styles.grupoBtnSec : styles.grupoBtnPrim}
            onPress={() => toggle(r)}
          >
            <Text style={r.meApunto ? styles.grupoBtnSecTxt : styles.grupoBtnPrimTxt}>
              {r.meApunto ? "Apuntado" : "Sumarme"}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
      <TouchableOpacity style={styles.crearGrupoBtn} onPress={() => setCrearOpen(true)}>
        <Ionicons name="add" size={18} color="#06210a" />
        <Text style={styles.crearGrupoTxt}>Crear un reto</Text>
      </TouchableOpacity>

      {mios.length ? (
        <>
          <Text style={styles.grupoSecTit}>Tus retos</Text>
          {mios.map(Card)}
        </>
      ) : null}

      <View style={styles.buscarWrap}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput
          style={styles.buscarInput}
          value={q}
          onChangeText={setQ}
          placeholder="Buscar retos"
          placeholderTextColor={colors.muted}
        />
      </View>
      <Text style={styles.grupoSecTit}>Descubrir</Text>
      {descubrir.length ? (
        descubrir.map(Card)
      ) : (
        <Text style={styles.vacioTxt}>Todavía no hay retos. ¡Creá el primero!</Text>
      )}

      {crearOpen ? (
        <CrearRetoModal
          colors={colors}
          styles={styles}
          onClose={() => setCrearOpen(false)}
          onCreado={() => {
            setCrearOpen(false);
            cargar();
          }}
        />
      ) : null}
      {detalle ? (
        <RetoDetalleModal
          colors={colors}
          styles={styles}
          reto={detalle}
          onAbrirPerfil={onAbrirPerfil}
          onClose={() => {
            setDetalle(null);
            cargar();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function CrearRetoModal({ colors, styles, onClose, onCreado }) {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [deporte, setDeporte] = useState("mixto");
  const [metaKm, setMetaKm] = useState("");
  const [dur, setDur] = useState("mes"); // "7" | "30" | "mes"
  const [enviando, setEnviando] = useState(false);

  const km = Number(String(metaKm).replace(",", "."));
  const puede = !!nombre.trim() && km > 0;

  const periodo = () => {
    const d = new Date();
    const fmt = (x) => `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
    const inicio = fmt(d);
    const finD =
      dur === "mes" ? new Date(d.getFullYear(), d.getMonth() + 1, 0) : new Date(d.getTime() + Number(dur) * 86400000);
    return { inicio, fin: fmt(finD) };
  };

  const crear = () => {
    if (!puede || enviando) return;
    setEnviando(true);
    const { inicio, fin } = periodo();
    retosService
      .crear({ nombre: nombre.trim(), descripcion, deporte, meta: Math.round(km * 1000), inicio, fin })
      .then(() => onCreado())
      .catch(() => Alert.alert("Error", "No se pudo crear el reto."))
      .finally(() => setEnviando(false));
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.composeHeadFull}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.composeCancel}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.composeTitulo}>Crear reto</Text>
          <TouchableOpacity onPress={crear} disabled={!puede || enviando} hitSlop={8}>
            <Text style={[styles.composeOk, (!puede || enviando) && { opacity: 0.4 }]}>Crear</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.grupoInput}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre del reto (ej: 100 km en agosto)"
            placeholderTextColor={colors.muted}
            maxLength={80}
            autoFocus
          />
          <TextInput
            style={[styles.grupoInput, { minHeight: 70, textAlignVertical: "top" }]}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Descripción (opcional)"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={400}
          />
          <Text style={styles.grupoLbl}>Meta (kilómetros)</Text>
          <TextInput
            style={styles.grupoInput}
            value={metaKm}
            onChangeText={setMetaKm}
            placeholder="Ej: 100"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            maxLength={6}
          />
          <Text style={styles.grupoLbl}>Deporte</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {[
              ["caminata", "Caminata"],
              ["carrera", "Carrera"],
              ["bici", "Bici"],
              ["mixto", "Mixto"],
            ].map(([k, l]) => (
              <TouchableOpacity
                key={k}
                style={[styles.depChip, deporte === k && styles.depChipOn]}
                onPress={() => setDeporte(k)}
              >
                <Text style={[styles.depChipTxt, deporte === k && styles.depChipTxtOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.grupoLbl}>Duración</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {[
              ["7", "7 días"],
              ["30", "30 días"],
              ["mes", "Este mes"],
            ].map(([k, l]) => (
              <TouchableOpacity
                key={k}
                style={[styles.depChip, dur === k && styles.depChipOn]}
                onPress={() => setDur(k)}
              >
                <Text style={[styles.depChipTxt, dur === k && styles.depChipTxtOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.grupoSub}>Arranca hoy. El progreso se cuenta con tus actividades registradas.</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function RetoDetalleModal({ colors, styles, reto, onClose, onAbrirPerfil }) {
  const insets = useSafeAreaInsets();
  const [r, setR] = useState(reto);
  const [ranking, setRanking] = useState([]);
  useEffect(() => {
    retosService.get(reto.id).then(({ data }) => data?.reto && setR(data.reto)).catch(() => {});
    retosService.ranking(reto.id).then(({ data }) => setRanking(data?.ranking || [])).catch(() => {});
  }, [reto.id]);

  const toggle = () => {
    const accion = r.meApunto ? retosService.salir : retosService.unirse;
    setR((x) => ({ ...x, meApunto: !x.meApunto, participantes: x.participantes + (x.meApunto ? -1 : 1) }));
    accion(r.id)
      .then(({ data }) => setR((x) => ({ ...x, ...data })))
      .catch(() => {});
  };
  const borrar = () => {
    Alert.alert("Borrar reto", "¿Seguro que querés borrarlo? No se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => retosService.borrar(r.id).then(onClose).catch(() => {}) },
    ]);
  };

  const pct = r.miProgreso != null && r.meta ? Math.min(100, Math.round((r.miProgreso / r.meta) * 100)) : 0;
  const est = estadoReto(r, colors);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {r.nombre}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
          <View style={{ alignItems: "center", gap: 8 }}>
            <View style={styles.grupoIconBig}>
              <MaterialCommunityIcons name={DEP_ICON[r.deporte] || "trophy"} size={38} color={colors.greenBright} />
            </View>
            <Text style={styles.perfilNombre}>{r.nombre}</Text>
            <Text style={styles.perfilUser}>
              {fmtKm(r.meta)} · {DEP_LABEL[r.deporte] || "Mixto"} · {r.participantes} apuntados
            </Text>
            <View style={[styles.retoBadge, { backgroundColor: est.bg }]}>
              <Text style={[styles.retoBadgeTxt, { color: est.fg }]}>
                {est.txt} · {r.inicio} → {r.fin}
              </Text>
            </View>
            {r.descripcion ? <Text style={styles.perfilBio}>{r.descripcion}</Text> : null}
          </View>

          {r.meApunto ? (
            <View style={{ gap: 6 }}>
              <View style={styles.progBar}>
                <View style={[styles.progFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.progTxt}>
                Vas {fmtKm(r.miProgreso || 0)} de {fmtKm(r.meta)} · {pct}%
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={r.meApunto ? styles.btnSec : styles.btnPrim} onPress={toggle}>
            <Text style={r.meApunto ? styles.btnSecTxt : styles.btnPrimTxt}>
              {r.meApunto ? "Salir del reto" : "Sumarme al reto"}
            </Text>
          </TouchableOpacity>
          {r.soyCreador ? (
            <TouchableOpacity onPress={borrar} hitSlop={8} style={{ alignItems: "center" }}>
              <Text style={styles.borrarClub}>Borrar reto</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.postsHead}>Tabla de posiciones</Text>
          {ranking.length ? (
            ranking.map((u, i) => (
              <TouchableOpacity
                key={String(u.id)}
                style={styles.rankRow}
                onPress={() => onAbrirPerfil && onAbrirPerfil(u)}
              >
                <Text style={[styles.rankPos, i < 3 && styles.rankPosTop]}>{i + 1}</Text>
                <Avatar user={u} size={34} colors={colors} />
                <Text style={styles.rankNombre} numberOfLines={1}>
                  {u.fullName || u.username}
                </Text>
                <Text style={styles.rankKm}>{fmtKm(u.metros)}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.vacioTxt}>Todavía nadie sumó kilómetros.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
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
    // ---- Clubes / grupos ----
    crearGrupoBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.greenBright,
      borderRadius: 12,
      paddingVertical: 12,
    },
    crearGrupoTxt: { color: "#06210a", fontSize: 15, fontWeight: "800" },
    grupoSecTit: {
      color: colors.muted,
      fontSize: 12.5,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 6,
    },
    grupoCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 12,
    },
    grupoIcon: {
      width: 46,
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    grupoFoto: { width: 46, height: 46 },
    grupoNombre: { color: colors.text, fontSize: 15, fontWeight: "700" },
    grupoSub: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
    grupoBtnPrim: {
      backgroundColor: colors.greenBright,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 16,
    },
    grupoBtnPrimTxt: { color: "#06210a", fontSize: 13, fontWeight: "800" },
    grupoBtnSec: {
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    grupoBtnSecTxt: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    grupoInput: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    grupoLbl: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 2 },
    depChip: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    depChipOn: { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
    depChipTxt: { color: colors.muted, fontSize: 13.5, fontWeight: "700" },
    depChipTxtOn: { color: "#06210a" },
    grupoIconBig: {
      width: 84,
      height: 84,
      borderRadius: 22,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    grupoFotoBig: { width: 84, height: 84 },
    borrarClub: { color: "#e0563b", fontSize: 13.5, fontWeight: "700", marginTop: 4 },
    miembroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    // ---- Retos ----
    retoCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 12,
      gap: 10,
    },
    retoTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    retoBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    retoBadgeTxt: { fontSize: 11, fontWeight: "800" },
    progBar: {
      height: 9,
      borderRadius: 999,
      backgroundColor: colors.cardBorder,
      overflow: "hidden",
    },
    progFill: { height: 9, borderRadius: 999, backgroundColor: colors.greenBright },
    progTxt: { color: colors.muted, fontSize: 12.5, fontWeight: "600" },
    rankRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
    rankPos: { width: 22, textAlign: "center", color: colors.muted, fontSize: 15, fontWeight: "800" },
    rankPosTop: { color: colors.greenBright },
    rankNombre: { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: "600" },
    rankKm: { color: colors.text, fontSize: 13.5, fontWeight: "800" },
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    title: { color: colors.text, fontSize: 18, fontWeight: "800" },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
    headerAvatar: {
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.greenBright,
      overflow: "hidden",
    },
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
