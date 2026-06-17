import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RichEditor, RichToolbar, actions } from "react-native-pell-rich-editor";
import { Ionicons } from "@expo/vector-icons";
import { taskService } from "../api";
import { useTheme } from "../theme";
import { NOTE_COLOR_KEYS, getNoteColor } from "../utils/notes";

const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nowHM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const parseYMD = (value) => {
  if (!value) return new Date();
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};
const TOOLBAR_ACTIONS = [
  actions.setBold,
  actions.setItalic,
  actions.setUnderline,
  actions.setStrikethrough,
  actions.heading1,
  actions.heading2,
  actions.insertBulletsList,
  actions.insertOrderedList,
  actions.checkboxList,
  actions.blockquote,
  actions.code,
  actions.alignLeft,
  actions.alignCenter,
  actions.alignRight,
  actions.removeFormat,
];

export default function NoteEditorModal({ visible, note, folders = [], onClose, onSaved, onDeleted }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const richText = useRef(null);
  const isEdit = !!note;
  const [meta, setMeta] = useState("");
  const [html, setHtml] = useState("");
  const [color, setColor] = useState("color1");
  const [carpeta, setCarpeta] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (visible) {
      setMeta(note?.meta || "");
      setHtml(note?.contenido || "");
      setColor(note?.color || "color1");
      setCarpeta(note?.carpeta || "");
      setDate(parseYMD(note?.fecha));
      setError("");
      setSaving(false);
      setEditorKey((k) => k + 1); // remonta el editor con el contenido nuevo
    }
  }, [visible, note]);

  const handleSave = async () => {
    if (!meta.trim()) return setError("El título es obligatorio.");
    setError("");
    setSaving(true);
    let contenido = html;
    try {
      const fresh = await richText.current?.getContentHtml();
      if (typeof fresh === "string") contenido = fresh;
    } catch {
      // usa el último onChange
    }
    const payload = {
      tipo: "note",
      meta: meta.trim(),
      contenido,
      fecha: toYMD(date),
      horario: note?.horario || nowHM(),
      color,
      carpeta: carpeta.trim(),
      flashcards: note?.flashcards || [],
    };
    try {
      const res = isEdit
        ? await taskService.update(note._id, payload)
        : await taskService.create(payload);
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!note) return;
    Alert.alert("¿Eliminar nota?", `Se va a borrar "${note.meta}".`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await taskService.delete(note._id);
            onDeleted?.(note._id);
            onClose?.();
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.safe, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerKicker}>EDITOR</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isEdit ? meta || "Editar nota" : "Nueva nota"}
            </Text>
          </View>
          {isEdit && (
            <TouchableOpacity onPress={handleDelete} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={21} color={colors.red} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.saveText}>{isEdit ? "Actualizar" : "Guardar"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {/* Carpeta */}
            <View style={styles.metaBar}>
              <View style={[styles.metaPill, { flex: 1 }]}>
                <Ionicons name="folder-outline" size={13} color={colors.muted} />
                <TextInput
                  style={styles.metaInput}
                  value={carpeta}
                  onChangeText={setCarpeta}
                  placeholder="Sin carpeta"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            {/* Fondo */}
            <Text style={styles.fieldLabel}>Fondo</Text>
            <View style={styles.colorGrid}>
              {NOTE_COLOR_KEYS.map((key) => {
                const c = getNoteColor(key);
                const active = color === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setColor(key)}
                    style={[styles.colorDot, { backgroundColor: c.bg }, active && styles.colorDotActive]}
                  >
                    {active && <Ionicons name="checkmark" size={15} color={c.text} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Título */}
            <Text style={styles.fieldLabel}>Título</Text>
            <TextInput
              style={styles.titleInput}
              value={meta}
              onChangeText={setMeta}
              placeholder="Ej: Ideas para promociones de junio"
              placeholderTextColor={colors.muted}
            />

            {/* Contenido enriquecido */}
            <Text style={styles.fieldLabel}>Contenido</Text>
            <View style={styles.paper}>
              <RichEditor
                key={editorKey}
                ref={richText}
                initialContentHTML={note?.contenido || ""}
                onChange={setHtml}
                placeholder="Escribí tu nota…"
                useContainer
                initialHeight={280}
                editorStyle={{
                  backgroundColor: colors.card,
                  color: colors.text,
                  placeholderColor: colors.muted,
                  caretColor: colors.greenDark,
                  contentCSSText:
                    "font-size: 16px; line-height: 1.6; padding: 12px; min-height: 280px;",
                }}
                style={styles.editor}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          {/* Barra de formato (pegada abajo, sobre el teclado) */}
          <RichToolbar
            editor={richText}
            actions={TOOLBAR_ACTIONS}
            iconTint={colors.muted}
            selectedIconTint={colors.greenDark}
            disabledIconTint={colors.cardBorder}
            style={styles.toolbar}
            iconMap={{
              [actions.heading1]: ({ tintColor }) => (
                <Text style={{ color: tintColor, fontWeight: "800", fontSize: 16 }}>H1</Text>
              ),
              [actions.heading2]: ({ tintColor }) => (
                <Text style={{ color: tintColor, fontWeight: "800", fontSize: 14 }}>H2</Text>
              ),
            }}
          />
        </KeyboardAvoidingView>
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
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    closeBtn: { padding: 2 },
    iconBtn: { padding: 4 },
    headerKicker: { color: colors.greenDark, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
    headerTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 1 },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.greenBright,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
      minWidth: 96,
      justifyContent: "center",
    },
    saveText: { color: "#fff", fontWeight: "800", fontSize: 13 },

    body: { padding: 16, paddingBottom: 30 },
    metaBar: { flexDirection: "row", gap: 8, alignItems: "center" },
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardSoft,
    },
    metaPillText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    metaInput: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 13, paddingVertical: 0 },

    fieldLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginTop: 18,
      marginBottom: 9,
    },
    colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    colorDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: "rgba(17,24,20,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },
    colorDotActive: { borderColor: colors.text, transform: [{ scale: 1.08 }] },

    titleInput: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.card,
    },
    paper: {
      marginTop: 4,
      borderRadius: 16,
      minHeight: 300,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: "hidden",
      backgroundColor: colors.card,
    },
    editor: { minHeight: 300, backgroundColor: colors.card },
    toolbar: {
      backgroundColor: colors.cardSoft,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    error: { color: colors.red, marginTop: 14 },
  });
