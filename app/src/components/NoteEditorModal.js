import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RichEditor, RichToolbar, actions } from "react-native-pell-rich-editor";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { taskService } from "../api";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "../cloudinary";
import { useTheme } from "../theme";
import { NOTE_COLOR_KEYS, getNoteColor } from "../utils/notes";
import ColorPickerModal from "./ColorPickerModal";

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
const snapshotOf = ({ meta, html, color, carpeta }) =>
  JSON.stringify([meta.trim(), html, color, carpeta.trim()]);
const textoPlano = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
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
  "toLower",
  "toUpper",
  "insertPhoto",
];

export default function NoteEditorModal({
  visible,
  note,
  folders = [],
  defaultCarpeta = "",
  onClose,
  onSaved,
  onDeleted,
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const richText = useRef(null);
  const titleRef = useRef(null);
  const tagInputRef = useRef(null);
  // Id de la nota en el servidor: la que vino abierta, o la que se crea sola
  // con el primer guardado automático de una nota nueva.
  const [noteId, setNoteId] = useState(null);
  const isEdit = !!noteId;
  const [editingTitle, setEditingTitle] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  // idle | saving | saved | error
  const [saveStatus, setSaveStatus] = useState("idle");
  const [meta, setMeta] = useState("");
  const [html, setHtml] = useState("");
  const [color, setColor] = useState("color1");
  const [carpeta, setCarpeta] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folderListOpen, setFolderListOpen] = useState(false);

  // Convierte el texto seleccionado a minúsculas / MAYÚSCULAS dentro del editor.
  // Arregla el texto que se pegó en mayúscula desde otra app.
  const setSelectionCase = (mode) => {
    const js = `
      (function(){
        try{
          var sel = window.getSelection();
          if(!sel || sel.rangeCount === 0) return;
          var text = sel.toString();
          if(!text) return;
          var next = ${mode === "upper" ? "text.toUpperCase()" : "text.toLowerCase()"};
          document.execCommand('insertText', false, next);
        }catch(e){}
      })();
    `;
    richText.current?.commandDOM(js);
  };

  // Insertar foto: elige de la galería, sube a Cloudinary e inserta la URL.
  const handleInsertImage = async () => {
    if (!isCloudinaryConfigured()) {
      Alert.alert(
        "Falta configurar",
        "Completá app/src/cloudinary.js con tu Cloud name y upload preset para subir fotos."
      );
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permiso necesario", "Permití el acceso a tus fotos para insertar una imagen.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      const url = await uploadImageToCloudinary(uri);
      richText.current?.insertImage(url);
    } catch {
      Alert.alert("Error", "No se pudo subir la imagen.");
    }
  };

  useEffect(() => {
    if (visible) {
      setMeta(note?.meta || "");
      setHtml(note?.contenido || "");
      setColor(note?.color || "color1");
      // Nota nueva: si venís desde una carpeta, la dejamos autocompletada.
      setCarpeta(note?.carpeta || defaultCarpeta || "");
      setDate(parseYMD(note?.fecha));
      setError("");
      setPickerOpen(false);
      setFolderListOpen(false);
      setPaperOpen(false);
      setNoteId(note?._id || null);
      noteIdRef.current = note?._id || null;
      // Nota nueva: arranca con el título listo para escribir
      setEditingTitle(!note);
      setSaveStatus(note ? "saved" : "idle");
      savedSnapshotRef.current = snapshotOf({
        meta: note?.meta || "",
        html: note?.contenido || "",
        color: note?.color || "color1",
        carpeta: note?.carpeta || defaultCarpeta || "",
      });
      changedRef.current = false;
      setEditorKey((k) => k + 1); // remonta el editor con el contenido nuevo
    }
    // Solo al abrir: si el padre refresca la lista mientras se escribe, no hay
    // que pisar lo que se está editando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Paleta del papel: el fondo elegido pinta el título y el área de escritura
  // (antes solo afectaba la tarjeta en la lista y parecía que no funcionaba).
  const palette = getNoteColor(color);
  const cambiarColor = (next) => {
    setColor(next);
    // El RichEditor aplica su estilo al montar: remontamos conservando el html vivo
    setEditorKey((k) => k + 1);
  };

  const isCustom = typeof color === "string" && color.startsWith("#");

  // ===== Guardado automático (como la web) =====
  const noteIdRef = useRef(null);
  const savedSnapshotRef = useRef("");
  const changedRef = useRef(false); // hubo al menos un guardado → refrescar la lista al cerrar
  const saveQueueRef = useRef(Promise.resolve(true));
  const saveTimerRef = useRef(null);
  const liveRef = useRef({});
  liveRef.current = { meta, html, color, carpeta, date };

  const doSave = async (htmlOverride) => {
    const cur = liveRef.current;
    const contenido = typeof htmlOverride === "string" ? htmlOverride : cur.html;
    const titulo = cur.meta.trim();
    const vacio = !titulo && !textoPlano(contenido);
    // Una nota nueva sin título ni texto todavía no existe: no se crea.
    if (!noteIdRef.current && vacio) return true;
    const snap = snapshotOf({ meta: cur.meta, html: contenido, color: cur.color, carpeta: cur.carpeta });
    if (snap === savedSnapshotRef.current) return true;

    setSaveStatus("saving");
    const payload = {
      tipo: "note",
      meta: titulo || "Sin título",
      contenido,
      fecha: toYMD(cur.date),
      horario: note?.horario || nowHM(),
      color: cur.color,
      carpeta: cur.carpeta.trim(),
      flashcards: note?.flashcards || [],
    };
    try {
      if (noteIdRef.current) {
        await taskService.update(noteIdRef.current, payload);
      } else {
        const res = await taskService.create(payload);
        const id = res.data?._id || res.data?.task?._id || null;
        noteIdRef.current = id;
        setNoteId(id);
      }
      savedSnapshotRef.current = snap;
      changedRef.current = true;
      setError("");
      setSaveStatus("saved");
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo guardar la nota.");
      setSaveStatus("error");
      return false;
    }
  };

  // Los guardados van en fila: nunca dos a la vez (evita crear la nota dos veces).
  const persist = (htmlOverride) => {
    saveQueueRef.current = saveQueueRef.current.then(() => doSave(htmlOverride));
    return saveQueueRef.current;
  };

  // Cada cambio (título, texto, papel, etiqueta) guarda solo tras una pausa corta.
  useEffect(() => {
    if (!visible) return undefined;
    if (snapshotOf({ meta, html, color, carpeta }) === savedSnapshotRef.current) return undefined;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persist(), 1200);
    return () => clearTimeout(saveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, html, color, carpeta, visible]);

  // Cerrar: guarda lo pendiente antes de salir.
  const handleClose = async () => {
    clearTimeout(saveTimerRef.current);
    let fresh;
    try {
      fresh = await richText.current?.getContentHtml();
    } catch {
      // usa el último onChange
    }
    const ok = await persist(typeof fresh === "string" ? fresh : undefined);
    const salir = () => {
      if (changedRef.current) onSaved?.();
      onClose?.();
    };
    if (ok) return salir();
    Alert.alert("No se pudo guardar", "¿Cerrar igual y perder los últimos cambios?", [
      { text: "Seguir editando", style: "cancel" },
      { text: "Cerrar igual", style: "destructive", onPress: salir },
    ]);
  };

  const handleDelete = () => {
    if (!noteIdRef.current) return;
    Alert.alert("¿Eliminar nota?", `Se va a borrar "${meta.trim() || "Sin título"}".`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            clearTimeout(saveTimerRef.current);
            await saveQueueRef.current;
            await taskService.delete(noteIdRef.current);
            onDeleted?.(noteIdRef.current);
            onClose?.();
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <View style={[styles.safe, { paddingBottom: insets.bottom }]}>
        {/* Header: cerrar · título (editable con el lápiz) · editar · borrar */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={handleClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={styles.kickerRow}>
              <Text style={styles.headerKicker}>EDITOR</Text>
              {saveStatus !== "idle" ? (
                <Text
                  style={[
                    styles.saveStatus,
                    saveStatus === "error" && { color: colors.red },
                    saveStatus === "saving" && { color: colors.muted },
                  ]}
                >
                  {saveStatus === "saving"
                    ? "· Guardando…"
                    : saveStatus === "error"
                    ? "· No se guardó"
                    : "· Guardado"}
                </Text>
              ) : null}
            </View>
            {editingTitle ? (
              <TextInput
                ref={titleRef}
                style={styles.headerTitleInput}
                value={meta}
                onChangeText={setMeta}
                placeholder="Título de la nota…"
                placeholderTextColor={colors.muted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => setEditingTitle(false)}
                onBlur={() => setEditingTitle(false)}
              />
            ) : (
              <TouchableOpacity onPress={() => setEditingTitle(true)} activeOpacity={0.7}>
                <Text
                  style={[styles.headerTitle, !meta.trim() && { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {meta.trim() || "Título de la nota…"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setEditingTitle((v) => !v)}
            hitSlop={10}
            style={styles.iconBtn}
            accessibilityLabel="Editar título"
          >
            <Ionicons
              name="pencil"
              size={19}
              color={editingTitle ? colors.greenBright : colors.muted}
            />
          </TouchableOpacity>
          {isEdit && (
            <TouchableOpacity onPress={handleDelete} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={21} color={colors.red} />
            </TouchableOpacity>
          )}
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
            {/* Etiqueta: escribí una nueva o elegí una del desplegable (flecha) */}
            <View style={styles.metaBar}>
              <View style={[styles.metaPill, { flex: 1 }]}>
                <Ionicons name="pricetag-outline" size={13} color={colors.greenDark} />
                <TextInput
                  ref={tagInputRef}
                  style={styles.metaInput}
                  value={carpeta}
                  onChangeText={setCarpeta}
                  placeholder="Sin etiquetas · escribí una nueva"
                  placeholderTextColor={colors.muted}
                />
                {carpeta ? (
                  <TouchableOpacity onPress={() => setCarpeta("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => setFolderListOpen((o) => !o)}
                  hitSlop={10}
                  style={styles.metaChevron}
                  accessibilityLabel="Ver etiquetas"
                >
                  <Ionicons
                    name={folderListOpen ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {folderListOpen ? (
              <View style={styles.folderDropdown}>
                <ScrollView
                  style={{ maxHeight: 220 }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  <TouchableOpacity
                    style={styles.folderRow2}
                    onPress={() => {
                      setCarpeta("");
                      setFolderListOpen(false);
                    }}
                  >
                    <Ionicons name="pricetag-outline" size={15} color={colors.muted} />
                    <Text
                      style={[styles.folderRowText, !carpeta.trim() && { color: colors.greenDark }]}
                    >
                      Sin etiquetas
                    </Text>
                  </TouchableOpacity>
                  {folders.map((f) => {
                    const active = carpeta.trim() === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        style={styles.folderRow2}
                        onPress={() => {
                          setCarpeta(f);
                          setFolderListOpen(false);
                        }}
                      >
                        <Ionicons
                          name={active ? "pricetag" : "pricetag-outline"}
                          size={15}
                          color={active ? colors.greenDark : colors.muted}
                        />
                        <Text style={[styles.folderRowText, active && { color: colors.greenDark }]}>
                          {f}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.folderRow2, { borderBottomWidth: 0 }]}
                    onPress={() => {
                      setCarpeta("");
                      setFolderListOpen(false);
                      tagInputRef.current?.focus();
                    }}
                  >
                    <Ionicons name="add" size={17} color={colors.greenBright} />
                    <Text style={[styles.folderRowText, { color: colors.greenDark }]}>
                      Nueva etiqueta
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            ) : null}

            {/* Papel: cerrado muestra solo el color elegido; al tocarlo se
                despliegan todos y al elegir uno se vuelve a cerrar. */}
            <View style={styles.paperRow}>
              <Text style={styles.paperLabel}>Papel</Text>
              {paperOpen ? (
                <View style={styles.colorRow}>
                  {NOTE_COLOR_KEYS.map((key) => {
                    const c = getNoteColor(key);
                    const active = color === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => {
                          if (!active) cambiarColor(key);
                          setPaperOpen(false);
                        }}
                        hitSlop={4}
                        style={[styles.colorDot, { backgroundColor: c.bg }, active && styles.colorDotActive]}
                      />
                    );
                  })}
                  {isCustom && (
                    <TouchableOpacity
                      onPress={() => setPaperOpen(false)}
                      hitSlop={4}
                      style={[
                        styles.colorDot,
                        { backgroundColor: palette.bg },
                        styles.colorDotActive,
                      ]}
                    />
                  )}
                  {/* "+" abre el selector libre */}
                  <TouchableOpacity
                    style={styles.colorMore}
                    hitSlop={4}
                    onPress={() => {
                      setPaperOpen(false);
                      setPickerOpen(true);
                    }}
                  >
                    <Ionicons name="add" size={15} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setPaperOpen(true)}
                  hitSlop={10}
                  style={styles.paperCurrent}
                  accessibilityLabel="Cambiar el color del papel"
                >
                  <View style={[styles.colorDot, { backgroundColor: palette.bg }, styles.colorDotActive]} />
                  <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Contenido enriquecido */}
            <View style={[styles.paper, { backgroundColor: palette.bg }]}>
              <RichEditor
                key={editorKey}
                ref={richText}
                initialContentHTML={html}
                onChange={setHtml}
                placeholder="Escribí tu nota…"
                useContainer
                initialHeight={280}
                editorStyle={{
                  backgroundColor: palette.bg,
                  color: palette.text,
                  placeholderColor: palette.text + "88",
                  caretColor: palette.text,
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
            toLower={() => setSelectionCase("lower")}
            toUpper={() => setSelectionCase("upper")}
            insertPhoto={handleInsertImage}
            iconMap={{
              [actions.heading1]: ({ tintColor }) => (
                <Text style={{ color: tintColor, fontWeight: "800", fontSize: 16 }}>H1</Text>
              ),
              [actions.heading2]: ({ tintColor }) => (
                <Text style={{ color: tintColor, fontWeight: "800", fontSize: 14 }}>H2</Text>
              ),
              toLower: ({ tintColor }) => (
                <Text style={{ color: tintColor, fontWeight: "800", fontSize: 15 }}>aa</Text>
              ),
              toUpper: ({ tintColor }) => (
                <Text style={{ color: tintColor, fontWeight: "800", fontSize: 15 }}>AA</Text>
              ),
              insertPhoto: ({ tintColor }) => (
                <Ionicons name="image-outline" size={20} color={tintColor} />
              ),
            }}
          />
        </KeyboardAvoidingView>
      </View>

      <ColorPickerModal
        visible={pickerOpen}
        initialColor={getNoteColor(color).bg}
        onClose={() => setPickerOpen(false)}
        onSelect={(hex) => cambiarColor(hex)}
      />
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
    kickerRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    headerKicker: { color: colors.greenDark, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
    saveStatus: { color: colors.greenDark, fontSize: 10, fontWeight: "700" },
    headerTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 1, paddingVertical: 4 },
    // Título en edición: mismo borde verde fino que la web
    headerTitleInput: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      marginTop: 2,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: colors.greenBright2,
      borderRadius: 9,
    },

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
    metaChevron: { paddingLeft: 6, marginLeft: 2, borderLeftWidth: 1, borderLeftColor: colors.cardBorder },
    metaPillText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    metaInput: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 13, paddingVertical: 0 },
    folderChips: { gap: 7, paddingVertical: 10, paddingRight: 8 },
    folderChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardSoft,
    },
    folderChipActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
    folderChipMore2: {
      paddingHorizontal: 10,
      backgroundColor: colors.greenSoft,
      borderColor: colors.greenBorder,
    },
    folderDropdown: {
      marginTop: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    folderRow2: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    folderRowText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    folderChipText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
    folderChipTextActive: { color: colors.greenDark },

    paperRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, marginBottom: 12 },
    paperLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    paperCurrent: { flexDirection: "row", alignItems: "center", gap: 6 },
    colorRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 9 },
    colorDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(127,127,127,0.35)",
    },
    colorDotActive: { borderWidth: 2, borderColor: colors.greenBright },
    colorMore: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
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
