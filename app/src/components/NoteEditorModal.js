import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RichEditor, RichToolbar, actions } from "react-native-pell-rich-editor";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { taskService } from "../api";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "../cloudinary";
import { useTheme } from "../theme";
import { NOTE_COLOR_KEYS, getNoteColor } from "../utils/notes";
import { TAG_COLOR_CHOICES, colorDeEtiqueta } from "../utils/etiquetasNotas";
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

// ===== Páginas (mismo formato que la web) =====
// Una sola página se guarda como HTML plano; varias, como <section
// data-note-page> una detrás de otra. Así una nota con páginas hecha en la
// web se abre y se guarda bien desde la app, y al revés.
const PAGE_OPEN = '<section data-note-page="true"';
const PAGE_CONTENT = 'data-note-page-content="true">';
const escapeHtml = (v) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const unescapeHtml = (v) =>
  String(v)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
const parsePages = (contenido = "") => {
  const raw = String(contenido || "");
  if (!raw.includes(PAGE_OPEN)) return [{ title: "Página 1", contenido: raw }];
  const pages = raw
    .split(PAGE_OPEN)
    .slice(1)
    .map((chunk, index) => {
      const title = chunk.match(/data-page-title="([^"]*)"/);
      const start = chunk.indexOf(PAGE_CONTENT);
      const end = chunk.lastIndexOf("</div>");
      const body =
        start >= 0 && end > start ? chunk.slice(start + PAGE_CONTENT.length, end) : "";
      return {
        title: title ? unescapeHtml(title[1]) : `Página ${index + 1}`,
        contenido: body,
      };
    });
  return pages.length ? pages : [{ title: "Página 1", contenido: raw }];
};
const serializePages = (pages, activeIndex, activeHtml) => {
  const list = pages.map((pg, i) => (i === activeIndex ? { ...pg, contenido: activeHtml } : pg));
  if (list.length <= 1) return list[0]?.contenido || "";
  return list
    .map(
      (pg, i) =>
        `<section data-note-page="true" data-page-title="${escapeHtml(
          pg.title || `Página ${i + 1}`
        )}"><div data-note-page-content="true">${pg.contenido || ""}</div></section>`
    )
    .join("");
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
  "toLower",
  "toUpper",
  "insertPhoto",
];

export default function NoteEditorModal({
  visible,
  note,
  folders = [],
  // Colores guardados por etiqueta y aviso al crear una nueva (nombre, color)
  tagColors = {},
  onTagCreated,
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
  const [tagEditing, setTagEditing] = useState(false);
  // idle | saving | saved | error
  const [saveStatus, setSaveStatus] = useState("idle");
  const [meta, setMeta] = useState("");
  const [html, setHtml] = useState(""); // HTML de la página activa
  const [pages, setPages] = useState([{ title: "Página 1", contenido: "" }]);
  const [activePage, setActivePage] = useState(0);
  const [color, setColor] = useState("color1");
  const [carpeta, setCarpeta] = useState("");
  const [date, setDate] = useState(new Date());
  const [error, setError] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Popup "Nueva etiqueta": null o { nombre, color, error }
  // Cierra el teclado (el del editor y el nativo) al tocar fuera del texto
  const cerrarTeclado = () => {
    Keyboard.dismiss();
    richText.current?.dismissKeyboard?.();
    setTagEditing(false);
  };
  const [tagPopup, setTagPopup] = useState(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const confirmarNuevaEtiqueta = () => {
    if (!tagPopup) return;
    const nombre = tagPopup.nombre.trim();
    if (!nombre) {
      setTagPopup((prev) => ({ ...prev, error: "Escribí un nombre." }));
      return;
    }
    const existente = folders.find((f) => f.toLowerCase() === nombre.toLowerCase());
    const nombreFinal = existente || nombre;
    setCarpeta(nombreFinal);
    onTagCreated?.(nombreFinal, tagPopup.color);
    setTagPopup(null);
  };
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
      const parsed = parsePages(note?.contenido || "");
      setPages(parsed);
      setActivePage(0);
      setHtml(parsed[0].contenido);
      setColor(note?.color || "color1");
      // Nota nueva: si venís desde una carpeta, la dejamos autocompletada.
      setCarpeta(note?.carpeta || defaultCarpeta || "");
      setDate(parseYMD(note?.fecha));
      setError("");
      setPickerOpen(false);
      setFolderListOpen(false);
      setPaperOpen(false);
      setTagEditing(false);
      setNoteId(note?._id || null);
      noteIdRef.current = note?._id || null;
      // Nota nueva: arranca con el título listo para escribir
      setEditingTitle(!note);
      setSaveStatus(note ? "saved" : "idle");
      savedSnapshotRef.current = snapshotOf({
        meta: note?.meta || "",
        html: serializePages(parsed, 0, parsed[0].contenido),
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
  liveRef.current = { meta, html, color, carpeta, date, pages, activePage };
  // Contenido completo de la nota (todas las páginas) tal como se guarda
  const fullContent = serializePages(pages, activePage, html);

  const doSave = async (htmlOverride) => {
    const cur = liveRef.current;
    const contenido = serializePages(
      cur.pages,
      cur.activePage,
      typeof htmlOverride === "string" ? htmlOverride : cur.html
    );
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
    if (snapshotOf({ meta, html: fullContent, color, carpeta }) === savedSnapshotRef.current)
      return undefined;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persist(), 1200);
    return () => clearTimeout(saveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, fullContent, color, carpeta, visible]);

  // ===== Páginas =====
  const irAPagina = (index) => {
    if (index === activePage) return;
    // Guarda en la lista lo escrito en la página actual antes de cambiar
    const next = pages.map((pg, i) => (i === activePage ? { ...pg, contenido: html } : pg));
    setPages(next);
    setActivePage(index);
    setHtml(next[index]?.contenido || "");
    setEditorKey((k) => k + 1);
  };

  const agregarPagina = () => {
    const next = pages.map((pg, i) => (i === activePage ? { ...pg, contenido: html } : pg));
    next.push({ title: `Página ${next.length + 1}`, contenido: "" });
    setPages(next);
    setActivePage(next.length - 1);
    setHtml("");
    setEditorKey((k) => k + 1);
  };

  const eliminarPagina = (index) => {
    if (pages.length <= 1) return;
    const next = pages
      .map((pg, i) => (i === activePage ? { ...pg, contenido: html } : pg))
      .filter((_, i) => i !== index);
    const nuevoActivo = Math.min(index === activePage ? index : activePage > index ? activePage - 1 : activePage, next.length - 1);
    setPages(next);
    setActivePage(nuevoActivo);
    setHtml(next[nuevoActivo].contenido);
    setEditorKey((k) => k + 1);
  };

  const renombrarPagina = (index, titulo) => {
    const limpio = String(titulo || "").trim();
    if (!limpio) return;
    setPages((prev) => prev.map((pg, i) => (i === index ? { ...pg, title: limpio } : pg)));
  };

  // Mantener apretada una pestaña: renombrar / eliminar
  const opcionesPagina = (index) => {
    const pg = pages[index];
    const botones = [];
    if (Platform.OS === "ios") {
      botones.push({
        text: "Renombrar",
        onPress: () =>
          Alert.prompt(
            "Nombre de la página",
            undefined,
            (texto) => renombrarPagina(index, texto),
            "plain-text",
            pg.title
          ),
      });
    }
    if (pages.length > 1) {
      botones.push({
        text: "Eliminar página",
        style: "destructive",
        onPress: () =>
          Alert.alert("¿Eliminar página?", `Se va a borrar "${pg.title}" con todo su texto.`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Eliminar", style: "destructive", onPress: () => eliminarPagina(index) },
          ]),
      });
    }
    if (!botones.length) return;
    botones.push({ text: "Cancelar", style: "cancel" });
    Alert.alert(pg.title, undefined, botones);
  };

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
        <Pressable
          style={[styles.header, { paddingTop: insets.top + 10 }]}
          onPress={cerrarTeclado}
          accessible={false}
        >
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
        </Pressable>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
          >
            {/* Etiqueta: escribí una nueva o elegí una del desplegable (flecha) */}
            <View style={styles.metaBar}>
              {/* Como en la web: borde de rayitas si no tiene etiqueta, liso si tiene */}
              <View
                style={[styles.metaPill, { flex: 1 }, !carpeta.trim() && styles.metaPillEmpty]}
              >
                {carpeta.trim() ? (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: colorDeEtiqueta(tagColors, carpeta.trim()),
                    }}
                  />
                ) : (
                  <Ionicons name="pricetag-outline" size={14} color={colors.greenBright2} />
                )}
                {/* En reposo es un Text (queda centrado seguro); recién al
                    tocarlo pasa a ser un input para escribir. */}
                {tagEditing ? (
                  <TextInput
                    ref={tagInputRef}
                    style={styles.metaInput}
                    value={carpeta}
                    onChangeText={setCarpeta}
                    placeholder="Escribí una etiqueta"
                    placeholderTextColor={colors.muted}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => setTagEditing(false)}
                    onBlur={() => setTagEditing(false)}
                  />
                ) : (
                  <Pressable style={styles.metaTextWrap} onPress={() => setTagEditing(true)}>
                    <Text
                      style={[styles.metaText, !carpeta.trim() && { color: colors.muted }]}
                      numberOfLines={1}
                    >
                      {carpeta.trim() || "Sin etiquetas · escribí una nueva"}
                    </Text>
                  </Pressable>
                )}
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
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: colorDeEtiqueta(tagColors, f),
                          }}
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
                      setFolderListOpen(false);
                      setTagPopup({ nombre: "", color: TAG_COLOR_CHOICES[0], error: "" });
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

            {/* Páginas como pestañas pegadas a la hoja (mantener apretada:
                renombrar / eliminar) + "Página" para agregar otra */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={styles.pageTabsScroll}
              contentContainerStyle={styles.pageTabs}
            >
              {pages.map((pg, i) => {
                const active = i === activePage;
                return (
                  <TouchableOpacity
                    key={`${i}-${pg.title}`}
                    style={[styles.pageTab, active && { backgroundColor: palette.bg }]}
                    onPress={() => irAPagina(i)}
                    onLongPress={() => opcionesPagina(i)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[styles.pageTabNum, active && { color: palette.text, opacity: 0.55 }]}
                    >
                      {i + 1}
                    </Text>
                    <Text
                      style={[styles.pageTabText, active && { color: palette.text }]}
                      numberOfLines={1}
                    >
                      {pg.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.pageTabAdd} onPress={agregarPagina} activeOpacity={0.8}>
                <Ionicons name="add" size={14} color={colors.greenDark} />
                <Text style={styles.pageTabAddText}>Página</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Hoja: llega hasta el final de la pantalla; tocar la parte vacía
                también pone el cursor en el texto */}
            <Pressable
              style={[styles.paper, { backgroundColor: palette.bg }]}
              onPress={() => richText.current?.focusContentEditor?.()}
            >
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
                style={[styles.editor, { backgroundColor: palette.bg }]}
              />
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {/* Espacio vacío debajo del texto: tocarlo cierra el teclado */}
            <Pressable style={{ flex: 1, minHeight: 90 }} onPress={cerrarTeclado} accessible={false} />
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

      {/* Popup "Nueva etiqueta": nombre + color (5 a la vista + "+") */}
      <Modal
        visible={!!tagPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setTagPopup(null)}
      >
        <KeyboardAvoidingView
          style={styles.tagPopupOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTagPopup(null)} />
          {tagPopup ? (
            <View style={styles.tagPopup}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="pricetag-outline" size={16} color={colors.greenBright} />
                <Text style={styles.tagPopupTitle}>Nueva etiqueta</Text>
              </View>
              <TextInput
                style={styles.tagPopupInput}
                value={tagPopup.nombre}
                onChangeText={(t) => setTagPopup((prev) => ({ ...prev, nombre: t, error: "" }))}
                placeholder="Nombre de la etiqueta"
                placeholderTextColor={colors.muted}
                maxLength={30}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={confirmarNuevaEtiqueta}
              />
              <Text style={styles.tagPopupLabel}>Color</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  ...TAG_COLOR_CHOICES,
                  ...(TAG_COLOR_CHOICES.includes(tagPopup.color) ? [] : [tagPopup.color]),
                ].map((c) => {
                  const active = tagPopup.color === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.tagPopupColor, { backgroundColor: c }, active && styles.tagPopupColorActive]}
                      onPress={() => setTagPopup((prev) => ({ ...prev, color: c }))}
                    >
                      {active ? <Ionicons name="checkmark" size={14} color="#16241d" /> : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={styles.tagPopupColorMore}
                  onPress={() => setTagPickerOpen(true)}
                  accessibilityLabel="Elegir otro color"
                >
                  <Ionicons name="add" size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>
              {tagPopup.error ? <Text style={styles.tagPopupError}>{tagPopup.error}</Text> : null}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <TouchableOpacity style={styles.tagPopupBtn} onPress={() => setTagPopup(null)}>
                  <Text style={[styles.tagPopupBtnText, { color: colors.muted }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tagPopupBtn, { borderColor: colors.greenBright }]}
                  onPress={confirmarNuevaEtiqueta}
                >
                  <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: tagPopup.color }} />
                  <Text style={[styles.tagPopupBtnText, { color: colors.greenDark }]}>Crear etiqueta</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
        <ColorPickerModal
          visible={tagPickerOpen}
          initialColor={tagPopup?.color || TAG_COLOR_CHOICES[0]}
          onClose={() => setTagPickerOpen(false)}
          onSelect={(hex) => setTagPopup((prev) => (prev ? { ...prev, color: hex } : prev))}
        />
      </Modal>
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
      // Mismo fondo oscuro que el resto de la pantalla (antes: color de tarjeta)
      backgroundColor: colors.bg,
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

    // flexGrow: la hoja estira hasta abajo aunque la nota tenga poco texto
    body: { flexGrow: 1, padding: 16, paddingBottom: 0 },
    metaBar: { flexDirection: "row", gap: 8, alignItems: "center" },
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      // Alto fijo y más chico; todo lo de adentro se centra en vertical
      height: 30,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    metaPillEmpty: { borderStyle: "dashed", borderColor: colors.muted },
    metaChevron: { paddingLeft: 6, marginLeft: 2, borderLeftWidth: 1, borderLeftColor: colors.cardBorder },
    metaPillText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    metaTextWrap: { flex: 1, alignSelf: "stretch", justifyContent: "center" },
    metaText: { color: colors.text, fontWeight: "700", fontSize: 12.5 },
    metaInput: {
      flex: 1,
      color: colors.text,
      fontWeight: "700",
      fontSize: 12.5,
      padding: 0,
    },
    metaChevron: { paddingLeft: 6, marginLeft: 2, borderLeftWidth: 1, borderLeftColor: colors.cardBorder },
    metaPillText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    // El alto lo da el padding de la pastilla, NO el del input: en iOS, cuanto
    // más alto es el TextInput, más abajo dibuja el texto (quedaba descentrado).
    metaInput: {
      flex: 1,
      color: colors.text,
      fontWeight: "700",
      fontSize: 13,
      paddingVertical: 1,
    },
    metaChevron: { paddingLeft: 6, marginLeft: 2, borderLeftWidth: 1, borderLeftColor: colors.cardBorder },
    metaPillText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    // Sin alto fijo (dejaba el texto caído hacia abajo): el alto sale del
    // padding, con un punto más abajo que arriba para que quede centrado a ojo.
    metaInput: {
      flex: 1,
      color: colors.text,
      fontWeight: "700",
      fontSize: 13,
      paddingTop: 8,
      paddingBottom: 10,
      includeFontPadding: false,
      textAlignVertical: "center",
    },
    metaChevron: { paddingLeft: 6, marginLeft: 2, borderLeftWidth: 1, borderLeftColor: colors.cardBorder },
    metaPillText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    // Alto fijo: con paddingVertical 0 y sin alto, el placeholder salía cortado
    metaInput: {
      flex: 1,
      height: 34,
      color: colors.text,
      fontWeight: "700",
      fontSize: 13,
      paddingVertical: 0,
      textAlignVertical: "center",
    },
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
    // Popup "Nueva etiqueta"
    tagPopupOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.45)",
      padding: 20,
    },
    tagPopup: {
      width: "100%",
      maxWidth: 360,
      gap: 10,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.bg,
    },
    tagPopupTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    tagPopupInput: {
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: colors.text,
      fontSize: 15,
    },
    tagPopupLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    tagPopupColor: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    tagPopupColorActive: { borderWidth: 2.5, borderColor: colors.greenBright, transform: [{ scale: 1.06 }] },
    tagPopupColorMore: {
      width: 30,
      height: 30,
      borderRadius: 9,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    tagPopupError: { color: "#e5484d", fontSize: 12, fontWeight: "700" },
    tagPopupBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 13,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    tagPopupBtnText: { fontSize: 13, fontWeight: "800" },
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
    pageTabsScroll: { flexGrow: 0 },
    pageTabs: { alignItems: "flex-end", gap: 4 },
    pageTab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: 170,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      backgroundColor: colors.cardSoft,
    },
    pageTabNum: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    pageTabText: { color: colors.muted, fontSize: 13, fontWeight: "700", flexShrink: 1 },
    pageTabAdd: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderStyle: "dashed",
      borderColor: colors.greenBorder,
    },
    pageTabAddText: { color: colors.greenDark, fontSize: 13, fontWeight: "700" },
    // Hoja: pegada a las pestañas arriba y hasta el borde de abajo
    paper: {
      flex: 1,
      minHeight: 300,
      borderTopRightRadius: 14,
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
