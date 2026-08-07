import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { authService, communityService } from "../api";
import { COMUNIDAD_HABILITADA } from "../config";
import { useTheme } from "../theme";
import { useWorkspace } from "../workspace/WorkspaceContext";

// Fecha "se unió {mes año}" a partir de createdAt.
const joinedLabel = (createdAt) => {
  if (!createdAt) return "hace poco";
  try {
    return new Date(createdAt).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  } catch {
    return "hace poco";
  }
};

const ACT_LABEL = { caminata: "Caminata", carrera: "Carrera", bici: "Bici" };
const haceCuanto = (iso) => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};

// Elige una imagen del teléfono, la achica y la devuelve como data URL (base64).
const pickImageAsDataUrl = async (maxW, aspect) => {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permiso necesario", "Permití el acceso a las fotos para elegir una imagen.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 1,
  });
  if (result.canceled) return null;
  const uri = result.assets[0].uri;
  const manip = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxW } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return `data:image/jpeg;base64,${manip.base64}`;
};

const USERNAME_HINT = {
  checking: "Verificando disponibilidad…",
  ok: "¡Disponible!",
  self: "Es tu usuario actual.",
  taken: "Ese usuario ya está en uso.",
  invalid: "3 a 20 caracteres: minúsculas, números o guion bajo.",
  idle: "Tu @usuario único.",
};

export default function PerfilScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors, isDark);
  const insets = useSafeAreaInsets();
  const { refreshProfiles, workspace, activeProfile, rawProfile } = useWorkspace();

  // Sembramos con el perfil ya cacheado por el contexto: entra al instante y
  // refresca en segundo plano (sin spinner) en vez de esperar la red cada vez.
  const [profile, setProfile] = useState(rawProfile);
  const [loading, setLoading] = useState(!rawProfile);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos editables.
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [perfilPublico, setPerfilPublico] = useState(true); // comunidad: perfil visible
  const [photo, setPhoto] = useState("");
  const [banner, setBanner] = useState("");
  const [userStatus, setUserStatus] = useState("idle");

  const load = useCallback(async () => {
    // No bloqueamos con spinner: si ya hay datos (cacheados o de antes),
    // se refresca en segundo plano sin interrumpir la vista.
    try {
      const res = await authService.getProfile();
      setProfile(res.data);
    } catch {
      Alert.alert("Error", "No se pudo cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener("focus", load);
    return unsub;
  }, [load, navigation]);

  // Comunidad: stats + posteos propios para el perfil personal.
  const [comuStats, setComuStats] = useState(null);
  const [misPosts, setMisPosts] = useState([]);
  useEffect(() => {
    if (!COMUNIDAD_HABILITADA) return undefined;
    const traer = () =>
      communityService
        .getMiPerfil()
        .then(({ data }) => {
          setComuStats(data?.stats || null);
          setPerfilPublico(data?.perfilPublico !== false);
          if (data?.id) {
            communityService
              .postsDeUsuario(data.id)
              .then(({ data: d }) => setMisPosts(d?.posts || []))
              .catch(() => {});
          }
        })
        .catch(() => {});
    traer();
    const unsub = navigation.addListener("focus", traer);
    return unsub;
  }, [navigation]);

  // Al abrir la edición, copiamos los valores actuales.
  const openEdit = () => {
    setUsername(profile?.username || "");
    setFullName(profile?.fullName || "");
    setPhone(profile?.phone || "");
    setBio(profile?.bio || "");
    setPhoto(profile?.profilePhotoUrl || "");
    setBanner(profile?.bannerUrl || "");
    setUserStatus("idle");
    setEditing(true);
  };

  const onUsernameChange = (v) => {
    setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20));
  };

  // Chequeo de disponibilidad del @usuario (con debounce).
  const debounceRef = useRef(null);
  useEffect(() => {
    if (!editing) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const handle = (username || "").trim().toLowerCase();
    if (!handle) {
      setUserStatus("idle");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      setUserStatus("invalid");
      return;
    }
    setUserStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await authService.checkUsername(handle);
        if (res.data?.available) setUserStatus(res.data.reason === "self" ? "self" : "ok");
        else setUserStatus(res.data?.reason === "invalid" ? "invalid" : "taken");
      } catch {
        setUserStatus("idle");
      }
    }, 450);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [username, editing]);

  const pickPhoto = async () => {
    const url = await pickImageAsDataUrl(512, [1, 1]);
    if (url) setPhoto(url);
  };
  const pickBanner = async () => {
    const url = await pickImageAsDataUrl(1280, [3, 1]);
    if (url) setBanner(url);
  };

  const save = async () => {
    if (userStatus === "taken" || userStatus === "invalid" || userStatus === "checking") return;
    setSaving(true);
    try {
      const res = await authService.updateProfile({
        username: username.trim(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        profilePhotoUrl: photo,
        bannerUrl: banner,
        businessProfiles: profile?.businessProfiles || undefined,
      });
      setProfile(res.data?.profile || res.data);
      // Privacidad de comunidad (campo aparte).
      if (COMUNIDAD_HABILITADA) {
        communityService.updateMiPerfil({ perfilPublico }).catch(() => {});
      }
      setEditing(false);
      refreshProfiles?.();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  // ----- Vista de negocio (cuando el workspace activo es un negocio) -----
  const isBusiness = activeProfile?.kind === "business";
  const businessList = Array.isArray(profile?.businessProfiles)
    ? profile.businessProfiles
    : profile?.businessProfile?.name
    ? [{ ...profile.businessProfile, _id: "legacy" }]
    : [];
  const bizIndex = !isBusiness
    ? -1
    : workspace === "business"
    ? 0
    : businessList.findIndex((b) => String(b._id) === String(workspace).split(":")[1]);
  const business = bizIndex >= 0 ? businessList[bizIndex] : null;

  const [bizEditing, setBizEditing] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizLogo, setBizLogo] = useState("");
  const [bizSaving, setBizSaving] = useState(false);

  const openBizEdit = () => {
    setBizName(business?.name || "");
    setBizLogo(business?.logoUrl || "");
    setBizEditing(true);
  };
  const pickBizLogo = async () => {
    const url = await pickImageAsDataUrl(512, [1, 1]);
    if (url) setBizLogo(url);
  };
  const saveBiz = async () => {
    if (bizIndex < 0) return;
    setBizSaving(true);
    try {
      const nextList = businessList.map((b, i) =>
        i === bizIndex ? { ...b, name: bizName.trim(), logoUrl: bizLogo } : b
      );
      const res = await authService.updateProfile({
        username: profile?.username,
        fullName: profile?.fullName || "",
        phone: profile?.phone || "",
        bio: profile?.bio || "",
        profilePhotoUrl: profile?.profilePhotoUrl || "",
        bannerUrl: profile?.bannerUrl || "",
        businessProfiles: nextList,
      });
      setProfile(res.data?.profile || res.data);
      setBizEditing(false);
      refreshProfiles?.();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "No se pudo guardar el negocio.");
    } finally {
      setBizSaving(false);
    }
  };

  const initials = (profile?.fullName || profile?.username || profile?.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  const negocios = Array.isArray(profile?.businessProfiles) ? profile.businessProfiles.length : 0;
  const userOk = userStatus === "ok" || userStatus === "self";
  const userBad = userStatus === "taken" || userStatus === "invalid";

  return (
    <View style={[styles.safe, { paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={{ width: 70 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.greenBright} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {isBusiness && business ? (
            <View style={styles.card}>
              {/* Cabecera del negocio */}
              <View style={[styles.banner, styles.bannerPlaceholder]} />
              <View style={styles.topRow}>
                <View style={styles.avatar}>
                  {business.logoUrl ? (
                    <Image source={{ uri: business.logoUrl }} style={styles.avatarImg} />
                  ) : (
                    <Ionicons name="briefcase" size={30} color={colors.greenDark} />
                  )}
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={openBizEdit}>
                  <Text style={styles.editBtnText}>Editar negocio</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.identity}>
                <View style={styles.bizBadge}>
                  <Ionicons name="briefcase-outline" size={13} color={colors.greenDark} />
                  <Text style={styles.bizBadgeText}>Negocio</Text>
                </View>
                <Text style={styles.name}>{business.name}</Text>
              </View>
            </View>
          ) : (
          <View style={styles.card}>
            {/* Banner */}
            {profile?.bannerUrl ? (
              <Image source={{ uri: profile.bannerUrl }} style={styles.banner} />
            ) : (
              <View style={[styles.banner, styles.bannerPlaceholder]} />
            )}

            {/* Avatar (solo, encima de la portada) */}
            <View style={styles.topRow}>
              <View style={styles.avatar}>
                {profile?.profilePhotoUrl ? (
                  <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
              {/* Botones a la derecha, junto a la portada */}
              <View style={styles.perfilBtns}>
                <TouchableOpacity style={styles.editBtn} onPress={openEdit} hitSlop={6}>
                  <Text style={styles.editBtnText}>Editar perfil</Text>
                </TouchableOpacity>
                {COMUNIDAD_HABILITADA ? (
                  <TouchableOpacity
                    style={styles.comunidadBtn}
                    onPress={() => navigation.navigate("Comunidad")}
                    hitSlop={6}
                  >
                    <Ionicons name="globe-outline" size={15} color={colors.greenBright} />
                    <Text style={styles.comunidadBtnText}>Comunidad</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Identidad */}
            <View style={styles.identity}>
              <Text style={styles.name}>{profile?.fullName || profile?.username || "Tu perfil"}</Text>
              <Text style={styles.handle}>@{profile?.username || "usuario"}</Text>
              {profile?.bio ? (
                <Text style={styles.bio}>{profile.bio}</Text>
              ) : (
                <Text style={styles.bioEmpty}>Todavía no escribiste una bio.</Text>
              )}

              <View style={styles.stats}>
                <Text style={styles.statText}>
                  <Text style={styles.statNum}>{comuStats?.posteos ?? 0}</Text> posteos
                </Text>
                <Text style={styles.statText}>
                  <Text style={styles.statNum}>{comuStats?.seguidores ?? 0}</Text> seguidores
                </Text>
                <Text style={styles.statText}>
                  <Text style={styles.statNum}>{comuStats?.siguiendo ?? 0}</Text> siguiendo
                </Text>
              </View>
            </View>

            {COMUNIDAD_HABILITADA && misPosts.length > 0 ? (
              <View style={styles.posteosSec}>
                <Text style={styles.posteosTitulo}>Posteos</Text>
                {misPosts.map((p) => (
                  <View key={String(p.id)} style={styles.postCard}>
                    <Text style={styles.postFecha}>{haceCuanto(p.createdAt)}</Text>
                    {p.texto ? <Text style={styles.postTexto}>{p.texto}</Text> : null}
                    {p.foto ? <Image source={{ uri: p.foto }} style={styles.postFoto} /> : null}
                    {p.tipo === "actividad" && p.actividad ? (
                      <Text style={styles.postAct}>
                        {ACT_LABEL[p.actividad.tipo] || "Actividad"} ·{" "}
                        {(p.actividad.metros / 1000).toFixed(2)} km ·{" "}
                        {Math.floor((p.actividad.secs || 0) / 60)} min
                        {p.actividad.kcal ? ` · ${p.actividad.kcal} kcal` : ""}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          )}
        </ScrollView>
      )}

      {/* ===== Modal de edición ===== */}
      <Modal visible={editing} animationType="slide" transparent onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <TouchableOpacity onPress={() => setEditing(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Editar perfil</Text>
              <TouchableOpacity
                style={[styles.saveBtn, (saving || userBad || userStatus === "checking") && { opacity: 0.5 }]}
                onPress={save}
                disabled={saving || userBad || userStatus === "checking"}
              >
                {saving ? (
                  <ActivityIndicator color="#06210a" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
              {/* Portada */}
              <Text style={styles.label}>Portada</Text>
              <TouchableOpacity style={styles.bannerEdit} onPress={pickBanner} activeOpacity={0.85}>
                {banner ? (
                  <Image source={{ uri: banner }} style={styles.bannerEditImg} />
                ) : (
                  <View style={[styles.bannerEditImg, styles.bannerPlaceholder]} />
                )}
                <View style={styles.bannerEditOverlay}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={styles.bannerEditText}>Cambiar portada</Text>
                </View>
              </TouchableOpacity>

              {/* Foto */}
              <Text style={styles.label}>Foto de perfil</Text>
              <View style={styles.photoRow}>
                <View style={styles.photoPreview}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.avatarImg} />
                  ) : (
                    <Ionicons name="person" size={26} color={colors.greenDark} />
                  )}
                </View>
                <TouchableOpacity style={styles.uploadBtn} onPress={pickPhoto}>
                  <Ionicons name="cloud-upload-outline" size={16} color={colors.greenDark} />
                  <Text style={styles.uploadBtnText}>Subir foto</Text>
                </TouchableOpacity>
                {photo ? (
                  <TouchableOpacity onPress={() => setPhoto("")}>
                    <Text style={styles.removeText}>Quitar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Usuario */}
              <Text style={styles.label}>Nombre de usuario</Text>
              <View
                style={[
                  styles.handleField,
                  userOk && { borderColor: colors.greenBright },
                  userBad && { borderColor: colors.red },
                ]}
              >
                <Text style={styles.handleAt}>@</Text>
                <TextInput
                  style={styles.handleInput}
                  value={username}
                  onChangeText={onUsernameChange}
                  placeholder="tu_usuario"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {userStatus === "checking" ? (
                  <ActivityIndicator color={colors.muted} size="small" />
                ) : userOk ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.greenBright} />
                ) : userBad ? (
                  <Ionicons name="alert-circle" size={20} color={colors.red} />
                ) : null}
              </View>
              <Text style={styles.hint}>{USERNAME_HINT[userStatus] || USERNAME_HINT.idle}</Text>

              {/* Nombre */}
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nombre para mostrar"
                placeholderTextColor={colors.muted}
              />

              {/* Email (solo lectura) */}
              <Text style={styles.label}>Email de ingreso</Text>
              <View style={[styles.input, styles.inputDisabled]}>
                <Text style={{ color: colors.muted, fontSize: 15 }}>{profile?.email || "—"}</Text>
              </View>

              {/* Teléfono */}
              <Text style={styles.label}>Teléfono</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+54 9 ..."
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
              />

              {/* Bio */}
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={(v) => setBio(v.slice(0, 160))}
                placeholder="Contá algo sobre vos (máx. 160)"
                placeholderTextColor={colors.muted}
                multiline
              />
              <Text style={styles.counter}>{bio.length}/160</Text>

              {COMUNIDAD_HABILITADA ? (
                <>
                  <Text style={styles.label}>Comunidad</Text>
                  <TouchableOpacity style={styles.privRow} onPress={() => setPerfilPublico((v) => !v)}>
                    <Ionicons
                      name={perfilPublico ? "checkbox" : "square-outline"}
                      size={22}
                      color={perfilPublico ? colors.greenBright : colors.muted}
                    />
                    <Text style={styles.privTxt}>
                      Perfil público (otros pueden encontrarte y seguirte en la comunidad)
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== Modal de edición de negocio ===== */}
      <Modal visible={bizEditing} animationType="slide" transparent onRequestClose={() => setBizEditing(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <TouchableOpacity onPress={() => setBizEditing(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Editar negocio</Text>
              <TouchableOpacity
                style={[styles.saveBtn, bizSaving && { opacity: 0.5 }]}
                onPress={saveBiz}
                disabled={bizSaving}
              >
                {bizSaving ? (
                  <ActivityIndicator color="#06210a" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Logo</Text>
              <View style={styles.photoRow}>
                <View style={styles.photoPreview}>
                  {bizLogo ? (
                    <Image source={{ uri: bizLogo }} style={styles.avatarImg} />
                  ) : (
                    <Ionicons name="briefcase" size={26} color={colors.greenDark} />
                  )}
                </View>
                <TouchableOpacity style={styles.uploadBtn} onPress={pickBizLogo}>
                  <Ionicons name="cloud-upload-outline" size={16} color={colors.greenDark} />
                  <Text style={styles.uploadBtnText}>Subir logo</Text>
                </TouchableOpacity>
                {bizLogo ? (
                  <TouchableOpacity onPress={() => setBizLogo("")}>
                    <Text style={styles.removeText}>Quitar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={styles.label}>Nombre del negocio</Text>
              <TextInput
                style={styles.input}
                value={bizName}
                onChangeText={setBizName}
                placeholder="Nombre del negocio"
                placeholderTextColor={colors.muted}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors, isDark) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    backBtn: { flexDirection: "row", alignItems: "center", gap: 2, width: 70 },
    backText: { color: colors.text, fontWeight: "700", fontSize: 15 },
    headerTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },

    card: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: colors.card,
    },
    banner: { width: "100%", height: 130, backgroundColor: colors.greenSoft },
    bannerPlaceholder: { backgroundColor: colors.greenBright2 },

    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 14,
      marginTop: -44,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 4,
      borderColor: colors.bg,
      backgroundColor: colors.greenSoft,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImg: { width: "100%", height: "100%" },
    bizBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      backgroundColor: colors.greenSoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 6,
    },
    bizBadgeText: {
      color: colors.greenDark,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    avatarInitials: { color: colors.greenDark, fontSize: 30, fontWeight: "800" },
    perfilBtns: {
      marginTop: 48,
      gap: 4,
      alignItems: "flex-end",
    },
    editBtn: {
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    editBtnText: { color: colors.greenBright, fontWeight: "800", fontSize: 14 },
    comunidadBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 6,
    },
    comunidadBtnText: { color: colors.greenBright, fontWeight: "800", fontSize: 14 },
    posteosSec: { paddingHorizontal: 16, marginTop: 18, gap: 10 },
    posteosTitulo: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 2 },
    postCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      padding: 14,
      gap: 8,
    },
    postFecha: { color: colors.muted, fontSize: 12, fontWeight: "600" },
    postTexto: { color: colors.text, fontSize: 15, lineHeight: 21 },
    postFoto: { width: "100%", height: 180, borderRadius: 12, resizeMode: "cover" },
    postAct: {
      color: colors.greenBright,
      fontSize: 13.5,
      fontWeight: "800",
      backgroundColor: "rgba(93,199,45,0.08)",
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },

    identity: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, gap: 4, marginTop: -34 },
    name: { color: colors.text, fontSize: 21, fontWeight: "800" },
    handle: { color: colors.muted, fontSize: 15 },
    bio: { color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 6 },
    bioEmpty: { color: colors.muted, fontSize: 15, fontStyle: "italic", marginTop: 6 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6 },
    metaText: { color: colors.muted, fontSize: 13.5 },
    stats: { flexDirection: "row", gap: 18, marginTop: 12 },
    statText: { color: colors.muted, fontSize: 14 },
    statNum: { color: colors.text, fontWeight: "800" },

    /* Modal */
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: "92%",
    },
    sheetHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    sheetTitle: { color: colors.text, fontSize: 17, fontWeight: "800", flex: 1, marginLeft: 10 },
    saveBtn: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: colors.greenBright,
    },
    saveBtnText: { color: "#06210a", fontWeight: "800", fontSize: 14 },

    label: {
      color: colors.muted,
      fontSize: 12.5,
      fontWeight: "700",
      marginTop: 16,
      marginBottom: 7,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    inputDisabled: { opacity: 0.7 },
    bioInput: { minHeight: 80, textAlignVertical: "top" },
    counter: { color: colors.muted, fontSize: 12, alignSelf: "flex-end", marginTop: 5 },
    privRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    privTxt: { color: colors.text, fontSize: 13.5, fontWeight: "600", flex: 1 },

    handleField: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    handleAt: { color: colors.muted, fontWeight: "700", fontSize: 15 },
    handleInput: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 15 },
    hint: { color: colors.muted, fontSize: 12.5, marginTop: 6 },

    photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    photoPreview: {
      width: 64,
      height: 64,
      borderRadius: 32,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.greenDark,
      backgroundColor: colors.greenSoft,
    },
    uploadBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.greenDark,
      backgroundColor: colors.greenSoft,
    },
    uploadBtnText: { color: colors.greenDark, fontWeight: "800", fontSize: 14 },
    removeText: { color: colors.muted, fontSize: 13, textDecorationLine: "underline" },

    bannerEdit: { borderRadius: 14, overflow: "hidden" },
    bannerEditImg: { width: "100%", height: 110 },
    bannerEditOverlay: {
      position: "absolute",
      left: 10,
      bottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    bannerEditText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  });
