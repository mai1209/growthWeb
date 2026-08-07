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
        <GruposTab colors={colors} styles={styles} onAbrirPerfil={abrirPerfil} miId={miPerfil?.id} />
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
function GrupoCard({ g, colors, styles, onAbrir, onToggle }) {
  return (
    <TouchableOpacity style={styles.grupoCard} onPress={() => onAbrir(g)}>
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
      {onToggle ? (
        <TouchableOpacity
          style={g.soyMiembro ? styles.grupoBtnSec : styles.grupoBtnPrim}
          onPress={() => onToggle(g)}
        >
          <Text style={g.soyMiembro ? styles.grupoBtnSecTxt : styles.grupoBtnPrimTxt}>
            {g.soyMiembro ? "Unido" : "Unirme"}
          </Text>
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      )}
    </TouchableOpacity>
  );
}

function GruposTab({ colors, styles, onAbrirPerfil, miId }) {
  const [descubrir, setDescubrir] = useState([]);
  const [q, setQ] = useState("");
  const [crearOpen, setCrearOpen] = useState(false);
  const [misOpen, setMisOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const cargarDescubrir = useCallback(() => {
    gruposService.descubrir(q.trim()).then(({ data }) => setDescubrir(data?.grupos || [])).catch(() => {});
  }, [q]);
  useEffect(() => {
    const t = setTimeout(cargarDescubrir, 350);
    return () => clearTimeout(t);
  }, [cargarDescubrir]);

  const toggleUnirse = (g) => {
    const accion = g.soyMiembro ? gruposService.salir : gruposService.unirse;
    setDescubrir((arr) =>
      arr.map((x) =>
        x.id === g.id ? { ...x, soyMiembro: !g.soyMiembro, miembros: x.miembros + (g.soyMiembro ? -1 : 1) } : x
      )
    );
    accion(g.id).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
      <View style={styles.dobleBtnRow}>
        <TouchableOpacity style={styles.dobleBtnPrim} onPress={() => setCrearOpen(true)}>
          <Ionicons name="add" size={17} color="#06210a" />
          <Text style={styles.dobleBtnPrimTxt}>Crear un club</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dobleBtnSec} onPress={() => setMisOpen(true)}>
          <Ionicons name="people-outline" size={16} color={colors.greenBright} />
          <Text style={styles.dobleBtnSecTxt}>Mis clubes</Text>
        </TouchableOpacity>
      </View>

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
        descubrir.map((g) => (
          <GrupoCard key={String(g.id)} g={g} colors={colors} styles={styles} onAbrir={setDetalle} onToggle={toggleUnirse} />
        ))
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
            cargarDescubrir();
          }}
        />
      ) : null}
      {misOpen ? (
        <MisClubesModal
          colors={colors}
          styles={styles}
          onAbrirPerfil={onAbrirPerfil}
          miId={miId}
          onClose={() => setMisOpen(false)}
        />
      ) : null}
      {detalle ? (
        <GrupoDetalleModal
          colors={colors}
          styles={styles}
          grupo={detalle}
          onAbrirPerfil={onAbrirPerfil}
          miId={miId}
          onClose={() => {
            setDetalle(null);
            cargarDescubrir();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

// Pantalla "Mis clubes": switch Creados / Unidos.
function MisClubesModal({ colors, styles, onClose, onAbrirPerfil, miId }) {
  const insets = useSafeAreaInsets();
  const [seg, setSeg] = useState("creados");
  const [clubs, setClubs] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [editar, setEditar] = useState(null);

  const cargar = useCallback(() => {
    gruposService.mios().then(({ data }) => setClubs(data?.grupos || [])).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const lista = clubs.filter((c) => (seg === "creados" ? c.soyOwner : !c.soyOwner));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Mis clubes</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.segmento}>
          {[
            ["creados", "Creados"],
            ["unidos", "Unidos"],
          ].map(([k, l]) => (
            <TouchableOpacity key={k} style={[styles.segBtn, seg === k && styles.segBtnOn]} onPress={() => setSeg(k)}>
              <Text style={[styles.segTxt, seg === k && styles.segTxtOn]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
          {lista.length ? (
            lista.map((g) => (
              <View key={String(g.id)} style={styles.grupoCard}>
                <TouchableOpacity style={styles.grupoIcon} onPress={() => setDetalle(g)}>
                  {g.foto ? (
                    <Image source={{ uri: g.foto }} style={styles.grupoFoto} />
                  ) : (
                    <MaterialCommunityIcons name={DEP_ICON[g.deporte] || "account-group"} size={22} color={colors.greenBright} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setDetalle(g)}>
                  <Text style={styles.grupoNombre}>{g.nombre}</Text>
                  <Text style={styles.grupoSub}>
                    {DEP_LABEL[g.deporte] || "Mixto"}
                    {g.zona ? ` · ${g.zona}` : ""} · {g.miembros} {g.miembros === 1 ? "miembro" : "miembros"}
                  </Text>
                </TouchableOpacity>
                {g.soyOwner ? (
                  <TouchableOpacity onPress={() => setEditar(g)} hitSlop={8}>
                    <Ionicons name="create-outline" size={21} color={colors.greenBright} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                )}
              </View>
            ))
          ) : (
            <Text style={styles.vacioTxt}>
              {seg === "creados" ? "Todavía no creaste ningún club." : "Todavía no te uniste a ningún club."}
            </Text>
          )}
        </ScrollView>

        {detalle ? (
          <GrupoDetalleModal
            colors={colors}
            styles={styles}
            grupo={detalle}
            onAbrirPerfil={onAbrirPerfil}
            miId={miId}
            onClose={() => {
              setDetalle(null);
              cargar();
            }}
          />
        ) : null}
        {editar ? (
          <EditarGrupoModal
            colors={colors}
            styles={styles}
            grupo={editar}
            onClose={() => setEditar(null)}
            onGuardado={() => {
              setEditar(null);
              cargar();
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function EditarGrupoModal({ colors, styles, grupo, onClose, onGuardado }) {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState(grupo.nombre || "");
  const [descripcion, setDescripcion] = useState(grupo.descripcion || "");
  const [zona, setZona] = useState(grupo.zona || "");
  const [deporte, setDeporte] = useState(grupo.deporte || "mixto");
  const [foto, setFoto] = useState(grupo.foto || "");
  const [enviando, setEnviando] = useState(false);

  const elegir = async () => {
    const r = await elegirFotoComida();
    if (r?.base64) setFoto(`data:${r.mediaType};base64,${r.base64}`);
  };
  const guardar = () => {
    if (!nombre.trim() || enviando) return;
    setEnviando(true);
    gruposService
      .editar(grupo.id, { nombre: nombre.trim(), descripcion, zona, deporte, foto })
      .then(() => onGuardado())
      .catch(() => Alert.alert("Error", "No se pudo guardar."))
      .finally(() => setEnviando(false));
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.composeHeadFull}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={styles.composeCancel}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.composeTitulo}>Editar club</Text>
          <TouchableOpacity onPress={guardar} disabled={!nombre.trim() || enviando} hitSlop={8}>
            <Text style={[styles.composeOk, (!nombre.trim() || enviando) && { opacity: 0.4 }]}>Guardar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.editFotoWrap} onPress={elegir}>
            {foto ? (
              <Image source={{ uri: foto }} style={styles.editFoto} />
            ) : (
              <View style={[styles.editFoto, styles.editFotoVacia]}>
                <MaterialCommunityIcons name={DEP_ICON[deporte] || "account-group"} size={34} color={colors.greenBright} />
              </View>
            )}
            <Text style={styles.editFotoTxt}>Cambiar foto</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.grupoInput}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre del club"
            placeholderTextColor={colors.muted}
            maxLength={60}
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
            placeholder="Zona / ciudad"
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

// Posteo dentro de un club: con "me gusta" (kudos) y comentarios desplegables.
function PostClub({ post, colors, styles, onAbrirPerfil, onBorrar, miId }) {
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
      <View style={styles.postHead}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
          onPress={() => onAbrirPerfil && onAbrirPerfil(p.autor)}
        >
          <Avatar user={p.autor} colors={colors} />
          <View style={{ flex: 1 }}>
            <Text style={styles.postAutor}>{p.autor?.fullName || p.autor?.username || "Alguien"}</Text>
            <Text style={styles.postFecha}>
              {p.autor?.username ? `@${p.autor.username} · ` : ""}
              {haceCuanto(p.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
        {esMio ? (
          <TouchableOpacity onPress={() => onBorrar(p)} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {p.texto ? <Text style={styles.postTexto}>{p.texto}</Text> : null}
      {p.foto ? <Image source={{ uri: p.foto }} style={styles.postFoto} /> : null}
      <View style={styles.postAcciones}>
        <TouchableOpacity style={styles.kudosBtn} onPress={kudos} hitSlop={6}>
          <Ionicons
            name={p.leDiKudos ? "thumbs-up" : "thumbs-up-outline"}
            size={18}
            color={p.leDiKudos ? colors.greenBright : colors.muted}
          />
          <Text style={[styles.kudosTxt, p.leDiKudos && { color: colors.greenBright }]}>
            {p.kudos > 0 ? `${p.kudos} ` : ""}
            {p.kudos === 1 ? "kudo" : "kudos"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.kudosBtn} onPress={toggleComents} hitSlop={6}>
          <Ionicons name="chatbubble-outline" size={17} color={colors.muted} />
          <Text style={styles.kudosTxt}>
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

function GrupoDetalleModal({ colors, styles, grupo, onClose, onAbrirPerfil, miId }) {
  const insets = useSafeAreaInsets();
  const [g, setG] = useState(grupo);
  const [posts, setPosts] = useState([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [miembrosOpen, setMiembrosOpen] = useState(false);
  useEffect(() => {
    gruposService.get(grupo.id).then(({ data }) => data?.grupo && setG(data.grupo)).catch(() => {});
    communityService.postsDeGrupo(grupo.id).then(({ data }) => setPosts(data?.posts || [])).catch(() => {});
  }, [grupo.id]);
  const publicarEnClub = ({ texto, foto }) =>
    communityService.crearPost({ tipo: "texto", texto, foto, group: g.id }).then(({ data }) => {
      if (data?.post) setPosts((ps) => [data.post, ...ps]);
    });
  const borrarPostClub = (p) => {
    Alert.alert("Borrar posteo", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () =>
          communityService
            .borrarPost(p.id)
            .then(() => setPosts((ps) => ps.filter((x) => x.id !== p.id)))
            .catch(() => {}),
      },
    ]);
  };
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
  const cambiarFoto = async () => {
    const r = await elegirFotoComida();
    if (!r?.base64) return;
    const foto = `data:${r.mediaType};base64,${r.base64}`;
    setG((x) => ({ ...x, foto }));
    gruposService.editar(g.id, { foto }).catch(() => {});
  };
  const abrirAjustes = () => {
    const opciones = [];
    if (g.soyOwner) opciones.push({ text: "Borrar club", style: "destructive", onPress: borrar });
    else if (g.soyMiembro) opciones.push({ text: "Salir del grupo", style: "destructive", onPress: toggle });
    opciones.push({ text: "Cancelar", style: "cancel" });
    Alert.alert(g.nombre, undefined, opciones);
  };
  const IconoGrande = (
    <>
      {g.foto ? (
        <Image source={{ uri: g.foto }} style={styles.grupoFotoBig} />
      ) : (
        <MaterialCommunityIcons name={DEP_ICON[g.deporte] || "account-group"} size={40} color={colors.greenBright} />
      )}
      {g.soyOwner ? (
        <View style={styles.fotoBadge}>
          <Ionicons name="camera" size={14} color="#06210a" />
        </View>
      ) : null}
    </>
  );
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <TouchableOpacity onPress={() => setMiembrosOpen(true)} hitSlop={10}>
              <Ionicons name="people-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            {g.soyMiembro || g.soyOwner ? (
              <TouchableOpacity onPress={abrirAjustes} hitSlop={10}>
                <Ionicons name="settings-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
          <View style={{ alignItems: "center", gap: 8 }}>
            {g.soyOwner ? (
              <TouchableOpacity style={styles.grupoIconBig} onPress={cambiarFoto} activeOpacity={0.85}>
                {IconoGrande}
              </TouchableOpacity>
            ) : (
              <View style={styles.grupoIconBig}>{IconoGrande}</View>
            )}
            <Text style={styles.perfilUser}>
              {DEP_LABEL[g.deporte] || "Mixto"}
              {g.zona ? ` · ${g.zona}` : ""} · {g.miembros} miembros
            </Text>
            {g.descripcion ? <Text style={styles.perfilBio}>{g.descripcion}</Text> : null}
            {!g.soyMiembro ? (
              <TouchableOpacity style={styles.btnPrim} onPress={toggle}>
                <Text style={styles.btnPrimTxt}>Unirme</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.postsHeadRow}>
            <Text style={styles.postsHead}>Posteos</Text>
            {g.soyMiembro ? (
              <TouchableOpacity style={styles.postsAddBtn} onPress={() => setComposeOpen(true)} hitSlop={8}>
                <Ionicons name="create-outline" size={18} color={colors.greenBright} />
                <Text style={styles.postsAddTxt}>Publicar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {posts.length ? (
            posts.map((p) => (
              <PostClub
                key={String(p.id)}
                post={p}
                colors={colors}
                styles={styles}
                onAbrirPerfil={onAbrirPerfil}
                onBorrar={borrarPostClub}
                miId={miId}
              />
            ))
          ) : (
            <Text style={styles.vacioTxt}>
              {g.soyMiembro ? "Todavía no hay posteos. ¡Escribí el primero!" : "Todavía no hay posteos."}
            </Text>
          )}
        </ScrollView>

        {composeOpen ? (
          <ComposeModal
            colors={colors}
            styles={styles}
            onClose={() => setComposeOpen(false)}
            onPublicar={publicarEnClub}
          />
        ) : null}
        {miembrosOpen ? (
          <MiembrosModal
            colors={colors}
            styles={styles}
            grupoId={g.id}
            onAbrirPerfil={onAbrirPerfil}
            onClose={() => setMiembrosOpen(false)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

// Pantalla de miembros del club, con botón Seguir por cada uno.
function MiembrosModal({ colors, styles, grupoId, onClose, onAbrirPerfil }) {
  const insets = useSafeAreaInsets();
  const [miembros, setMiembros] = useState([]);
  useEffect(() => {
    gruposService.miembros(grupoId).then(({ data }) => setMiembros(data?.miembros || [])).catch(() => {});
  }, [grupoId]);
  const toggleSeguir = (m) => {
    const accion = m.loSigo ? communityService.dejarDeSeguir : communityService.seguir;
    setMiembros((arr) => arr.map((x) => (x.id === m.id ? { ...x, loSigo: !m.loSigo } : x)));
    accion(m.id).catch(() => {});
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Miembros</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
          {miembros.map((m) => (
            <View key={String(m.id)} style={styles.miembroRow}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}
                onPress={() => onAbrirPerfil && onAbrirPerfil(m)}
              >
                <Avatar user={m} size={38} colors={colors} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.userNombre}>{m.fullName || m.username}</Text>
                  <Text style={styles.userSub}>
                    @{m.username}
                    {m.rol === "owner" ? " · creador" : ""}
                  </Text>
                </View>
              </TouchableOpacity>
              {!m.esYo ? (
                <TouchableOpacity
                  style={m.loSigo ? styles.grupoBtnSec : styles.grupoBtnPrim}
                  onPress={() => toggleSeguir(m)}
                >
                  <Text style={m.loSigo ? styles.grupoBtnSecTxt : styles.grupoBtnPrimTxt}>
                    {m.loSigo ? "Siguiendo" : "Seguir"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------- Retos / desafíos ----------
function RetoCard({ r, colors, styles, onAbrir, onToggle }) {
  const est = estadoReto(r, colors);
  const pct = r.miProgreso != null && r.meta ? Math.min(100, Math.round((r.miProgreso / r.meta) * 100)) : null;
  return (
    <TouchableOpacity style={styles.retoCard} onPress={() => onAbrir(r)}>
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
      ) : onToggle ? (
        <TouchableOpacity style={r.meApunto ? styles.grupoBtnSec : styles.grupoBtnPrim} onPress={() => onToggle(r)}>
          <Text style={r.meApunto ? styles.grupoBtnSecTxt : styles.grupoBtnPrimTxt}>
            {r.meApunto ? "Apuntado" : "Sumarme"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

function RetosTab({ colors, styles, onAbrirPerfil }) {
  const [descubrir, setDescubrir] = useState([]);
  const [q, setQ] = useState("");
  const [crearOpen, setCrearOpen] = useState(false);
  const [misOpen, setMisOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const cargarDescubrir = useCallback(() => {
    retosService.descubrir(q.trim()).then(({ data }) => setDescubrir(data?.retos || [])).catch(() => {});
  }, [q]);
  useEffect(() => {
    const t = setTimeout(cargarDescubrir, 350);
    return () => clearTimeout(t);
  }, [cargarDescubrir]);

  const toggle = (r) => {
    const accion = r.meApunto ? retosService.salir : retosService.unirse;
    setDescubrir((arr) =>
      arr.map((x) =>
        x.id === r.id ? { ...x, meApunto: !r.meApunto, participantes: x.participantes + (r.meApunto ? -1 : 1) } : x
      )
    );
    accion(r.id).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
      <View style={styles.dobleBtnRow}>
        <TouchableOpacity style={styles.dobleBtnPrim} onPress={() => setCrearOpen(true)}>
          <Ionicons name="add" size={17} color="#06210a" />
          <Text style={styles.dobleBtnPrimTxt}>Crear un reto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dobleBtnSec} onPress={() => setMisOpen(true)}>
          <Ionicons name="trophy-outline" size={15} color={colors.greenBright} />
          <Text style={styles.dobleBtnSecTxt}>Mis retos</Text>
        </TouchableOpacity>
      </View>

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
        descubrir.map((r) => (
          <RetoCard key={String(r.id)} r={r} colors={colors} styles={styles} onAbrir={setDetalle} onToggle={toggle} />
        ))
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
            cargarDescubrir();
          }}
        />
      ) : null}
      {misOpen ? (
        <MisRetosModal colors={colors} styles={styles} onAbrirPerfil={onAbrirPerfil} onClose={() => setMisOpen(false)} />
      ) : null}
      {detalle ? (
        <RetoDetalleModal
          colors={colors}
          styles={styles}
          reto={detalle}
          onAbrirPerfil={onAbrirPerfil}
          onClose={() => {
            setDetalle(null);
            cargarDescubrir();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

// Pantalla "Mis retos": switch Creados / Apuntados.
function MisRetosModal({ colors, styles, onClose, onAbrirPerfil }) {
  const insets = useSafeAreaInsets();
  const [seg, setSeg] = useState("creados");
  const [retos, setRetos] = useState([]);
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(() => {
    retosService.mios().then(({ data }) => setRetos(data?.retos || [])).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const lista = retos.filter((r) => (seg === "creados" ? r.soyCreador : !r.soyCreador));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Mis retos</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.segmento}>
          {[
            ["creados", "Creados"],
            ["apuntados", "Apuntados"],
          ].map(([k, l]) => (
            <TouchableOpacity key={k} style={[styles.segBtn, seg === k && styles.segBtnOn]} onPress={() => setSeg(k)}>
              <Text style={[styles.segTxt, seg === k && styles.segTxtOn]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
          {lista.length ? (
            lista.map((r) => (
              <RetoCard key={String(r.id)} r={r} colors={colors} styles={styles} onAbrir={setDetalle} />
            ))
          ) : (
            <Text style={styles.vacioTxt}>
              {seg === "creados" ? "Todavía no creaste ningún reto." : "Todavía no te apuntaste a ningún reto."}
            </Text>
          )}
        </ScrollView>

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
      </View>
    </Modal>
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
  const toggleSeguir = (u) => {
    const accion = u.loSigo ? communityService.dejarDeSeguir : communityService.seguir;
    setRanking((arr) => arr.map((x) => (x.id === u.id ? { ...x, loSigo: !u.loSigo } : x)));
    accion(u.id).catch(() => {});
  };
  const borrar = () => {
    Alert.alert("Borrar reto", "¿Seguro que querés borrarlo? No se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => retosService.borrar(r.id).then(onClose).catch(() => {}) },
    ]);
  };
  const cambiarFoto = async () => {
    const f = await elegirFotoComida();
    if (!f?.base64) return;
    const foto = `data:${f.mediaType};base64,${f.base64}`;
    setR((x) => ({ ...x, foto }));
    retosService.editar(r.id, { foto }).catch(() => {});
  };
  const abrirAjustes = () => {
    const opciones = [];
    if (r.soyCreador) opciones.push({ text: "Borrar reto", style: "destructive", onPress: borrar });
    else if (r.meApunto) opciones.push({ text: "Salir del reto", style: "destructive", onPress: toggle });
    opciones.push({ text: "Cancelar", style: "cancel" });
    Alert.alert(r.nombre, undefined, opciones);
  };
  const IconoGrande = (
    <>
      {r.foto ? (
        <Image source={{ uri: r.foto }} style={styles.grupoFotoBig} />
      ) : (
        <MaterialCommunityIcons name={DEP_ICON[r.deporte] || "trophy"} size={38} color={colors.greenBright} />
      )}
      {r.soyCreador ? (
        <View style={styles.fotoBadge}>
          <Ionicons name="camera" size={14} color="#06210a" />
        </View>
      ) : null}
    </>
  );

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
          {r.meApunto || r.soyCreador ? (
            <TouchableOpacity onPress={abrirAjustes} hitSlop={10}>
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
          <View style={{ alignItems: "center", gap: 8 }}>
            {r.soyCreador ? (
              <TouchableOpacity style={styles.grupoIconBig} onPress={cambiarFoto} activeOpacity={0.85}>
                {IconoGrande}
              </TouchableOpacity>
            ) : (
              <View style={styles.grupoIconBig}>{IconoGrande}</View>
            )}
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

          {!r.meApunto ? (
            <TouchableOpacity style={styles.btnPrim} onPress={toggle}>
              <Text style={styles.btnPrimTxt}>Sumarme al reto</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.postsHead}>Tabla de posiciones</Text>
          {ranking.length ? (
            ranking.map((u, i) => (
              <View key={String(u.id)} style={styles.rankRow}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
                  onPress={() => onAbrirPerfil && onAbrirPerfil(u)}
                >
                  <Text style={[styles.rankPos, i < 3 && styles.rankPosTop]}>{i + 1}</Text>
                  <Avatar user={u} size={34} colors={colors} />
                  <Text style={styles.rankNombre} numberOfLines={1}>
                    {u.fullName || u.username}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.rankKm}>{fmtKm(u.metros)}</Text>
                {!u.esYo ? (
                  <TouchableOpacity onPress={() => toggleSeguir(u)} hitSlop={8}>
                    <Ionicons
                      name={u.loSigo ? "checkmark" : "person-add-outline"}
                      size={20}
                      color={u.loSigo ? colors.muted : colors.greenBright}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
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
  const insets = useSafeAreaInsets();
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
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Perfil</Text>
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
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            {/* Portada */}
            {perfil.banner ? (
              <Image source={{ uri: perfil.banner }} style={styles.perfilBannerU} />
            ) : (
              <View style={[styles.perfilBannerU, styles.perfilBannerVaciaU]} />
            )}

            {/* Avatar (encima de la portada) + botón Seguir a la derecha */}
            <View style={styles.perfilTopRowU}>
              <View style={styles.perfilAvatarU}>
                <Avatar user={perfil} size={80} colors={colors} />
              </View>
              {!perfil.esYo ? (
                <View style={styles.perfilFollowWrapU}>
                  <TouchableOpacity style={loSigo ? styles.btnSec : styles.btnPrim} onPress={toggleSeguir}>
                    <Text style={loSigo ? styles.btnSecTxt : styles.btnPrimTxt}>
                      {loSigo ? "Siguiendo" : "Seguir"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {/* Identidad */}
            <View style={styles.perfilIdentU}>
              <Text style={styles.perfilNameU}>{perfil.fullName || perfil.username}</Text>
              <Text style={styles.perfilHandleU}>@{perfil.username}</Text>
              {perfil.bio ? <Text style={styles.perfilBioU}>{perfil.bio}</Text> : null}
              <View style={styles.perfilStatsU}>
                <Text style={styles.perfilStatText}>
                  <Text style={styles.perfilStatNum}>{perfil.stats?.posteos || 0}</Text> posteos
                </Text>
                <Text style={styles.perfilStatText}>
                  <Text style={styles.perfilStatNum}>{perfil.stats?.seguidores || 0}</Text> seguidores
                </Text>
                <Text style={styles.perfilStatText}>
                  <Text style={styles.perfilStatNum}>{perfil.stats?.siguiendo || 0}</Text> siguiendo
                </Text>
              </View>
            </View>

            {/* Posteos */}
            <View style={{ paddingHorizontal: 18, gap: 10 }}>
              <Text style={styles.postsHead}>Posteos</Text>
              {posts.length === 0 ? (
                <Text style={styles.vacioTxt}>Todavía no publicó nada.</Text>
              ) : (
                posts.map((p) => (
                  <View key={String(p.id)} style={styles.post}>
                    <Text style={styles.postFecha}>{haceCuanto(p.createdAt)}</Text>
                    {p.texto ? <Text style={styles.postTexto}>{p.texto}</Text> : null}
                    {p.foto ? <Image source={{ uri: p.foto }} style={styles.postFoto} /> : null}
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
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    // ---- Clubes / grupos ----
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
    // ---- Doble botón (Crear / Mis…) ----
    dobleBtnRow: { flexDirection: "row", gap: 10 },
    dobleBtnPrim: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.greenBright,
      borderRadius: 12,
      paddingVertical: 12,
    },
    dobleBtnPrimTxt: { color: "#06210a", fontSize: 14.5, fontWeight: "800" },
    dobleBtnSec: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 12,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    dobleBtnSecTxt: { color: colors.greenBright, fontSize: 14.5, fontWeight: "800" },
    // ---- Switch / segmento ----
    segmento: {
      flexDirection: "row",
      marginHorizontal: 14,
      marginTop: 6,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 3,
      gap: 3,
    },
    segBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 9 },
    segBtnOn: { backgroundColor: colors.greenBright },
    segTxt: { color: colors.muted, fontSize: 14, fontWeight: "800" },
    segTxtOn: { color: "#06210a" },
    // ---- Editar club: foto ----
    editFotoWrap: { alignItems: "center", gap: 8, marginBottom: 4 },
    editFoto: { width: 96, height: 96, borderRadius: 24 },
    editFotoVacia: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    editFotoTxt: { color: colors.greenBright, fontSize: 14, fontWeight: "800" },
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
    postAcciones: { flexDirection: "row", alignItems: "center", gap: 22 },
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
      minHeight: 100,
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
    // ---- Perfil de otro usuario con portada (igual que el propio) ----
    perfilBannerU: { width: "100%", height: 130, backgroundColor: colors.card },
    perfilBannerVaciaU: { backgroundColor: colors.card },
    perfilTopRowU: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 14,
      marginTop: -44,
    },
    perfilAvatarU: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 4,
      borderColor: colors.bg,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    perfilFollowWrapU: { marginTop: 48 },
    perfilIdentU: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, gap: 4 },
    perfilNameU: { color: colors.text, fontSize: 21, fontWeight: "800" },
    perfilHandleU: { color: colors.muted, fontSize: 15 },
    perfilBioU: { color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 6 },
    perfilStatsU: { flexDirection: "row", gap: 18, marginTop: 12 },
    perfilStatText: { color: colors.muted, fontSize: 14 },
    perfilStatNum: { color: colors.text, fontWeight: "800" },
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
    fotoBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.greenBright,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.bg,
    },
    // ---- Posteos del club + comentarios ----
    postsHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    postsAddBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
    postsAddTxt: { color: colors.greenBright, fontSize: 14, fontWeight: "800" },
    comentSec: { marginTop: 10, gap: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 10 },
    comentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    comentBurbuja: {
      flex: 1,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    comentAutor: { color: colors.text, fontSize: 12.5, fontWeight: "800", marginBottom: 2 },
    comentTxt: { color: colors.text, fontSize: 14, lineHeight: 19 },
    comentInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    comentInput: {
      flex: 1,
      backgroundColor: colors.bg,
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
