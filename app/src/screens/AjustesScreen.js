import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Switch,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService, googleService, fiscalService } from "../api";
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
    { key: "facturacion", label: "Facturación (ARCA)", desc: "Emití facturas de este perfil", icon: "receipt-outline" },
  ];

  const confirmLogout = () => {
    Alert.alert("Cerrar sesión", "¿Querés salir de tu cuenta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => logout() },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Eliminar cuenta",
      "Se borrarán tu cuenta y todos tus datos (movimientos, tareas, notas y los grupos que creaste) de forma permanente. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar mi cuenta",
          style: "destructive",
          onPress: async () => {
            try {
              await authService.deleteAccount();
              Alert.alert("Cuenta eliminada", "Tu cuenta y tus datos fueron eliminados.");
              logout();
            } catch {
              Alert.alert("Error", "No se pudo eliminar la cuenta. Probá de nuevo.");
            }
          },
        },
      ]
    );
  };

  const recoverPassword = async () => {
    try {
      const res = await authService.getProfile();
      const email = res.data?.email;
      if (!email) throw new Error("no email");
      await authService.forgotPassword({ email });
      Alert.alert("Email enviado", `Te enviamos un enlace a ${email} para restablecer tu contraseña.`);
    } catch {
      Alert.alert("Error", "No se pudo enviar el email de recuperación. Probá de nuevo.");
    }
  };

  const SUPPORT_ROWS = [
    {
      key: "soporte",
      label: "Ayuda y soporte",
      desc: "Escribinos por email",
      icon: "help-buoy-outline",
      action: () => Linking.openURL("mailto:soporte@growthmanager.app?subject=Soporte%20Growth%20Manager"),
    },
    {
      key: "recover",
      label: "Recuperar contraseña",
      desc: "Te enviamos un email para restablecerla",
      icon: "key-outline",
      action: recoverPassword,
    },
    {
      key: "privacy",
      label: "Política de privacidad",
      desc: "",
      icon: "shield-checkmark-outline",
      action: () => Linking.openURL("https://www.growthmanager.app/privacidad.html"),
    },
    {
      key: "terms",
      label: "Términos y condiciones",
      desc: "",
      icon: "document-text-outline",
      action: () => Linking.openURL("https://www.growthmanager.app/terminos.html"),
    },
    {
      key: "review",
      label: "Calificar la app",
      desc: "Dejanos tu reseña en App Store",
      icon: "star-outline",
      action: () => Linking.openURL("https://apps.apple.com/app/id6781464707?action=write-review"),
    },
  ];

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

        <Text style={styles.sectionLabel}>Soporte y legal</Text>
        <View style={styles.card}>
          {SUPPORT_ROWS.map((r, i) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.row, i < SUPPORT_ROWS.length - 1 && styles.rowBorder]}
              onPress={r.action}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={r.icon} size={20} color={colors.greenDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                {r.desc ? <Text style={styles.rowDesc}>{r.desc}</Text> : null}
              </View>
              <Ionicons name="open-outline" size={18} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.red} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={confirmDeleteAccount}>
          <Ionicons name="trash-outline" size={18} color={colors.red} />
          <Text style={styles.deleteText}>Eliminar cuenta</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Growth Manager · versión 1.0.0</Text>
      </ScrollView>

      <PerfilModal visible={section === "perfil"} onClose={() => setSection(null)} colors={colors} styles={styles} />
      <PasswordModal visible={section === "password"} onClose={() => setSection(null)} colors={colors} styles={styles} />
      <IntegracionesModal visible={section === "integraciones"} onClose={() => setSection(null)} colors={colors} styles={styles} />
      <FiscalModal visible={section === "facturacion"} onClose={() => setSection(null)} colors={colors} styles={styles} />
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

/* ---------- Facturación (ARCA) ---------- */
function FiscalModal({ visible, onClose, colors, styles }) {
  const [cfg, setCfg] = useState({
    activo: false,
    cuit: "",
    razonSocial: "",
    condicionIVA: "monotributo",
    puntoVenta: 1,
    modo: "manual",
    arcaAutorizado: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fiscalService.get();
      if (res.data) setCfg(res.data);
    } catch {
      setMsg("No se pudo cargar la configuración.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const set = (k, v) => setCfg((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fiscalService.update(cfg);
      if (res.data) setCfg(res.data);
      setMsg("Configuración guardada.");
    } catch (err) {
      setMsg(err.response?.data?.error || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const CONDS = [
    ["monotributo", "Monotributo"],
    ["responsable_inscripto", "Resp. Inscripto"],
    ["exento", "Exento"],
  ];
  const MODOS = [
    ["manual", "Manual"],
    ["automatico", "Automático"],
  ];

  return (
    <SheetModal visible={visible} onClose={onClose} title="Facturación (ARCA)" colors={colors} styles={styles}>
      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 20 }} />
      ) : (
        <>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Activar facturación en este perfil</Text>
            <Switch
              value={cfg.activo}
              onValueChange={(v) => set("activo", v)}
              trackColor={{ true: colors.greenBright }}
            />
          </View>

          {cfg.activo ? (
            <>
              <Text style={styles.label}>CUIT</Text>
              <TextInput
                style={styles.input}
                value={cfg.cuit}
                onChangeText={(t) => set("cuit", t.replace(/\D/g, ""))}
                keyboardType="number-pad"
                placeholder="11 dígitos"
                placeholderTextColor={colors.muted}
                maxLength={11}
              />

              <Text style={styles.label}>Razón social</Text>
              <TextInput
                style={styles.input}
                value={cfg.razonSocial}
                onChangeText={(t) => set("razonSocial", t)}
                placeholder="Nombre o razón social"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.label}>Condición frente al IVA</Text>
              <View style={styles.chipRow}>
                {CONDS.map(([v, l]) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.chip, cfg.condicionIVA === v && styles.chipActive]}
                    onPress={() => set("condicionIVA", v)}
                  >
                    <Text style={[styles.chipText, cfg.condicionIVA === v && styles.chipTextActive]}>
                      {l}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Punto de venta</Text>
              <TextInput
                style={styles.input}
                value={String(cfg.puntoVenta)}
                onChangeText={(t) => set("puntoVenta", Number(t.replace(/\D/g, "")) || 1)}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.label}>Modo de emisión</Text>
              <View style={styles.chipRow}>
                {MODOS.map(([v, l]) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.chip, cfg.modo === v && styles.chipActive]}
                    onPress={() => set("modo", v)}
                  >
                    <Text style={[styles.chipText, cfg.modo === v && styles.chipTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.arcaBox}>
                {cfg.arcaAutorizado ? (
                  <Text style={styles.arcaOk}>✓ Autorizado en ARCA</Text>
                ) : (
                  <>
                    <Text style={styles.arcaHint}>
                      Falta autorizar a Growth en ARCA: un paso único con tu Clave Fiscal
                      (Administrador de Relaciones → Facturación Electrónica). El asistente guiado
                      llega en la próxima etapa.
                    </Text>
                    <View style={styles.arcaActions}>
                      <TouchableOpacity
                        style={styles.ghostBtn}
                        onPress={() =>
                          Linking.openURL("https://auth.afip.gob.ar/contribuyente_/login.xhtml")
                        }
                      >
                        <Text style={styles.ghostText}>Abrir ARCA</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.ghostBtn} onPress={() => set("arcaAutorizado", true)}>
                        <Text style={styles.ghostText}>Ya lo autoricé</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </>
          ) : null}

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Guardar facturación</Text>}
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
    sectionLabel: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 22,
      marginBottom: 10,
      marginLeft: 4,
    },
    version: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 18, opacity: 0.8 },

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
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      marginTop: 10,
      paddingVertical: 12,
    },
    deleteText: { color: colors.red, fontWeight: "700", fontSize: 14 },

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

    // Facturación (ARCA)
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 6,
    },
    switchLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
    chipText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
    chipTextActive: { color: colors.greenDark },
    arcaBox: {
      marginTop: 18,
      gap: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardSoft,
    },
    arcaOk: { color: colors.greenDark, fontWeight: "800", fontSize: 15 },
    arcaHint: { color: colors.muted, fontSize: 13.5, lineHeight: 20 },
    arcaActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    ghostBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    ghostText: { color: colors.text, fontWeight: "700", fontSize: 13.5 },
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
