import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService, googleService } from "../api";
import { useTheme } from "../theme";
import { useAuth } from "../auth/AuthContext";

export default function AjustesScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [section, setSection] = useState(null);

  const ROWS = [
    { key: "perfil", label: "Perfil", desc: "Tu nombre y datos de contacto", icon: "person-outline" },
    { key: "password", label: "Cambiar contraseña", desc: "Actualizá tu clave de acceso", icon: "lock-closed-outline" },
    { key: "integraciones", label: "Integraciones", desc: "Google Calendar", icon: "link-outline" },
  ];

  const confirmLogout = () => {
    Alert.alert("Cerrar sesión", "¿Querés salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <View style={[styles.safe, { paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajustes</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <View style={styles.card}>
          {ROWS.map((r, i) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.row, i < ROWS.length - 1 && styles.rowBorder]}
              onPress={() => setSection(r.key)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={r.icon} size={20} color={colors.greenDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={styles.rowDesc}>{r.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.red} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      <PerfilModal visible={section === "perfil"} onClose={() => setSection(null)} colors={colors} styles={styles} />
      <PasswordModal visible={section === "password"} onClose={() => setSection(null)} colors={colors} styles={styles} />
      <IntegracionesModal visible={section === "integraciones"} onClose={() => setSection(null)} colors={colors} styles={styles} />
    </View>
  );
}

/* ---------- Perfil ---------- */
function PerfilModal({ visible, onClose, colors, styles }) {
  const [profile, setProfile] = useState(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await authService.getProfile();
      setProfile(res.data);
      setFullName(res.data.fullName || "");
      setPhone(res.data.phone || "");
    } catch {
      setMsg("No se pudo cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await authService.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        profilePhotoUrl: profile?.profilePhotoUrl || "",
        businessProfile: profile?.businessProfile || undefined,
      });
      setMsg("Perfil actualizado.");
    } catch (err) {
      setMsg(err.response?.data?.error || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="Perfil" colors={colors} styles={styles}>
      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 20 }} />
      ) : (
        <>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={{ color: colors.muted, fontSize: 16 }}>{profile?.email || "—"}</Text>
          </View>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Tu nombre" placeholderTextColor={colors.muted} />
          <Text style={styles.label}>Teléfono</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Opcional" placeholderTextColor={colors.muted} keyboardType="phone-pad" />
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Guardar cambios</Text>}
          </TouchableOpacity>
        </>
      )}
    </SheetModal>
  );
}

/* ---------- Cambiar contraseña ---------- */
function PasswordModal({ visible, onClose, colors, styles }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (visible) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg("");
      setSaving(false);
    }
  }, [visible]);

  const save = async () => {
    setMsg("");
    if (!current || !next) return setMsg("Completá la contraseña actual y la nueva.");
    if (next.length < 6) return setMsg("La nueva contraseña debe tener al menos 6 caracteres.");
    if (next !== confirm) return setMsg("Las contraseñas nuevas no coinciden.");
    setSaving(true);
    try {
      await authService.changePassword({ currentPassword: current, newPassword: next });
      setMsg("Contraseña cambiada correctamente.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setMsg(err.response?.data?.error || "No se pudo cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="Cambiar contraseña" colors={colors} styles={styles}>
      <Text style={styles.label}>Contraseña actual</Text>
      <TextInput style={styles.input} value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••" placeholderTextColor={colors.muted} />
      <Text style={styles.label}>Nueva contraseña</Text>
      <TextInput style={styles.input} value={next} onChangeText={setNext} secureTextEntry placeholder="Mínimo 6 caracteres" placeholderTextColor={colors.muted} />
      <Text style={styles.label}>Repetir nueva</Text>
      <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Repetir" placeholderTextColor={colors.muted} />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Cambiar contraseña</Text>}
      </TouchableOpacity>
    </SheetModal>
  );
}

/* ---------- Integraciones (Google) ---------- */
function IntegracionesModal({ visible, onClose, colors, styles }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await googleService.getStatus();
      setStatus(res.data);
    } catch {
      setMsg("No se pudo obtener el estado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const connect = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await googleService.getAuthUrl();
      if (res.data?.url) await Linking.openURL(res.data.url);
      setMsg("Autorizá en el navegador y volvé. Tocá «Actualizar estado».");
    } catch {
      setMsg("No se pudo iniciar la conexión.");
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    setMsg("");
    try {
      await googleService.sync();
      setMsg("Sincronizado con Google Calendar.");
    } catch {
      setMsg("No se pudo sincronizar.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setMsg("");
    try {
      await googleService.disconnect();
      await load();
      setMsg("Desconectado.");
    } catch {
      setMsg("No se pudo desconectar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="Integraciones" colors={colors} styles={styles}>
      <View style={styles.integHeader}>
        <Ionicons name="calendar-outline" size={22} color={colors.greenDark} />
        <Text style={styles.integTitle}>Google Calendar</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 20 }} />
      ) : (
        <>
          {status?.connected ? (
            <>
              <Text style={styles.integDesc}>Conectado como {status.email || "tu cuenta"}.</Text>
              <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={sync} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sincronizar ahora</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={disconnect} disabled={busy}>
                <Text style={styles.secondaryText}>Desconectar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.integDesc}>
                Conectá tu Google Calendar para sincronizar tus tareas con el calendario.
              </Text>
              <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={connect} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Conectar Google Calendar</Text>}
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={styles.refreshBtn} onPress={load} disabled={busy}>
            <Ionicons name="refresh" size={16} color={colors.greenDark} />
            <Text style={styles.refreshText}>Actualizar estado</Text>
          </TouchableOpacity>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
        </>
      )}
    </SheetModal>
  );
}

/* ---------- Hoja base reutilizable ---------- */
function SheetModal({ visible, onClose, title, colors, styles, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
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
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 18,
      overflow: "hidden",
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.greenSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    rowLabel: { color: colors.text, fontSize: 15, fontWeight: "800" },
    rowDesc: { color: colors.muted, fontSize: 13, marginTop: 2 },

    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 18,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    logoutText: { color: colors.red, fontWeight: "800", fontSize: 15 },

    overlay: { flex: 1, backgroundColor: "rgba(11,20,15,0.4)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "92%",
      paddingTop: 8,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
    sheetBody: { paddingHorizontal: 20, paddingBottom: 40 },

    label: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 16,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: colors.text,
      fontSize: 16,
    },
    inputDisabled: { opacity: 0.7 },
    msg: { color: colors.greenDark, marginTop: 14, fontWeight: "600" },
    primaryBtn: {
      marginTop: 22,
      backgroundColor: colors.greenBright,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
    },
    primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    secondaryBtn: {
      marginTop: 10,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    secondaryText: { color: colors.red, fontSize: 15, fontWeight: "800" },

    integHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    integTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
    integDesc: { color: colors.muted, fontSize: 14, marginTop: 12, lineHeight: 20 },
    refreshBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
    refreshText: { color: colors.greenDark, fontWeight: "700", fontSize: 13 },
  });
