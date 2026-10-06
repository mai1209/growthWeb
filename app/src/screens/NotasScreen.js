import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { taskService } from "../api";
import { useTheme } from "../theme";
import {
  notePreview,
  getNoteColor,
  groupNotesForBoard,
  formatShortDate,
} from "../utils/notes";
import NoteEditorModal from "../components/NoteEditorModal";
import ShoppingListsPanel from "../components/ShoppingListsPanel";
import AfirmacionesPanel from "../components/AfirmacionesPanel";
import JournalingPanel from "../components/JournalingPanel";
import { getCustomFolders, setCustomFolders } from "../storage";
import ColorPickerModal from "../components/ColorPickerModal";
import { TAG_COLOR_CHOICES, colorDeEtiqueta, hashTagColor } from "../utils/etiquetasNotas";

const ALL_FOLDERS = "__all__";

export default function NotasScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeNote, setActiveNote] = useState(null);
  const [folder, setFolder] = useState(ALL_FOLDERS);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [afirmacionesOpen, setAfirmacionesOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");
  const [customFolders, setCustom] = useState([]);
  const route = useRoute();
  const navigation = useNavigation();

  // Compras / Journaling / Afirmaciones son paneles que viven en esta pantalla,
  // pero se abren desde el menú estando en cualquier otra (ej. Finanzas → Compras).
  // Al cerrarlos hay que volver a la pantalla desde la que se abrieron, no
  // quedarse en Notas.
  const cerrarPanel = (setOpen) => {
    setOpen(false);
    const origen = route.params?.view ? route.params?._from : null;
    navigation.setParams({ view: undefined, _from: undefined });
    if (origen && origen !== route.name) navigation.navigate(origen);
  };

  // Permite abrir un sub-panel directo desde el menú (Compras / Journaling / Afirmaciones).
  useEffect(() => {
    const v = route.params?.view;
    if (v === "shopping") setShoppingOpen(true);
    else if (v === "journal") setJournalOpen(true);
    else if (v === "afirmaciones") setAfirmacionesOpen(true);
  }, [route.params?.view, route.params?._navTs]);
  const [newFolderName, setNewFolderName] = useState("");
  // Color elegido para la etiqueta nueva + colores guardados por etiqueta
  const [newFolderColor, setNewFolderColor] = useState(TAG_COLOR_CHOICES[0]);
  const [newFolderPickerOpen, setNewFolderPickerOpen] = useState(false);
  const [tagColors, setTagColors] = useState({});
  const insets = useSafeAreaInsets();

  // Etiquetas con color guardadas en el usuario (compartidas con la web).
  // Reemplaza la lista local: así una etiqueta borrada en la web también se va acá.
  const cargarEtiquetas = useCallback(async () => {
    try {
      const { data } = await taskService.getEtiquetasNotas();
      if (!Array.isArray(data?.etiquetas)) return;
      const map = {};
      data.etiquetas.forEach((e) => {
        if (e?.nombre && e?.color) map[e.nombre.toLowerCase()] = e.color;
      });
      setTagColors(map);
      const nombres = data.etiquetas.map((e) => e?.nombre).filter(Boolean);
      setCustom(nombres);
      setCustomFolders(nombres).catch(() => {});
    } catch {
      // sin red: quedan las guardadas en el teléfono
    }
  }, []);

  useEffect(() => {
    getCustomFolders().then((arr) => setCustom(arr));
    cargarEtiquetas();
    // Al volver a la pantalla se vuelve a leer (por si se creó/borró una en la web)
    const unsub = navigation.addListener("focus", cargarEtiquetas);
    return unsub;
  }, [cargarEtiquetas, navigation]);

  // Borra una etiqueta vacía (sin notas): local + backend.
  const handleDeleteFolder = (name) => {
    const next = customFolders.filter((f) => f !== name);
    const nextColors = { ...tagColors };
    delete nextColors[name.toLowerCase()];
    setCustom(next);
    setTagColors(nextColors);
    setCustomFolders(next).catch(() => {});
    if (folder === name) setFolder(ALL_FOLDERS);
    guardarEtiquetas(folders.filter((f) => f !== name), nextColors);
  };

  // Guarda en el backend la lista completa de etiquetas con su color.
  const guardarEtiquetas = async (nombres, colores) => {
    const lista = [...new Set(nombres)].map((n) => ({
      nombre: n,
      color: colores[n.toLowerCase()] || hashTagColor(n),
    }));
    try {
      await taskService.saveEtiquetasNotas(lista);
    } catch {
      // noop: el color queda en esta sesión igual
    }
  };

  // Etiqueta creada desde el editor de una nota (nombre + color).
  const handleTagCreated = (name, color) => {
    const limpio = String(name || "").trim();
    if (!limpio) return;
    const nextColors = { ...tagColors, [limpio.toLowerCase()]: color };
    setTagColors(nextColors);
    const exists = [...customFolders, ...folders].some((f) => f.toLowerCase() === limpio.toLowerCase());
    const next = exists ? customFolders : [...customFolders, limpio];
    setCustom(next);
    setCustomFolders(next).catch(() => {});
    guardarEtiquetas([...folders, limpio], nextColors);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    // no duplicar (ignorando mayúsculas)
    const exists = [...customFolders, ...folders].some(
      (f) => f.toLowerCase() === name.toLowerCase()
    );
    const next = exists ? customFolders : [...customFolders, name];
    const nextColors = { ...tagColors, [name.toLowerCase()]: newFolderColor };
    setTagColors(nextColors);
    setCustom(next);
    setNewFolderName("");
    setNewFolderColor(TAG_COLOR_CHOICES[0]);
    setFolder(name); // la dejamos seleccionada
    setFoldersOpen(false);
    try {
      await setCustomFolders(next);
    } catch {
      // noop
    }
    guardarEtiquetas([...folders, name], nextColors);
  };

  const fetchNotes = useCallback(async () => {
    try {
      const res = await taskService.getAll({ tipo: "note" });
      const list = Array.isArray(res.data) ? res.data : res.data?.tasks || [];
      setNotes(list);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Carpetas: las de las notas + las creadas por el usuario (aunque estén vacías),
  // ordenadas por cantidad de notas (las más usadas primero) + su conteo.
  const { folders, folderCounts } = useMemo(() => {
    const counts = new Map();
    notes.forEach((n) => {
      const f = (n.carpeta || "").trim();
      if (f) counts.set(f, (counts.get(f) || 0) + 1);
    });
    const names = new Set(counts.keys());
    customFolders.forEach((f) => {
      if (f && f.trim()) names.add(f.trim());
    });
    const list = Array.from(names).sort(
      (a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b, "es")
    );
    return { folders: list, folderCounts: counts };
  }, [notes, customFolders]);

  const MAX_CHIPS = 4;
  const foldersFiltered = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    return q ? folders.filter((f) => f.toLowerCase().includes(q)) : folders;
  }, [folders, folderSearch]);

  const visibleNotes = useMemo(
    () => (folder === ALL_FOLDERS ? notes : notes.filter((n) => (n.carpeta || "").trim() === folder)),
    [notes, folder]
  );

  const groups = useMemo(() => groupNotesForBoard(visibleNotes), [visibleNotes]);

  const openNew = () => {
    setActiveNote(null);
    setEditorOpen(true);
  };
  const openNote = (note) => {
    setActiveNote(note);
    setEditorOpen(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Carpetas */}
      {folders.length > 0 && (
        <View style={styles.folderRowWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.folderRow}
          >
            {[
              { key: ALL_FOLDERS, label: "Todas" },
              ...folders.slice(0, MAX_CHIPS).map((f) => ({ key: f, label: f })),
            ].map((f) => {
              const active = folder === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.folderChip, active && styles.folderChipActive]}
                  onPress={() => setFolder(f.key)}
                >
                  {f.key !== ALL_FOLDERS ? (
                    <View style={[styles.tagDot, { backgroundColor: colorDeEtiqueta(tagColors, f.key) }]} />
                  ) : null}
                  <Text style={[styles.folderChipText, active && styles.folderChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.folderChip, styles.folderChipMore]}
              onPress={() => {
                setFolderSearch("");
                setFoldersOpen(true);
              }}
              accessibilityLabel="Ver todas las etiquetas"
            >
              <Ionicons name="chevron-down" size={16} color={colors.greenDark} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 2, paddingBottom: 90 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={fetchNotes} tintColor={colors.green} />
          }
        >
          {visibleNotes.length === 0 ? (
            <Text style={styles.empty}>
              {folder === ALL_FOLDERS
                ? 'Todavía no tenés notas. Creá la primera con "Nueva nota".'
                : `La etiqueta "${folder}" no tiene notas.`}
            </Text>
          ) : (
            groups.map((g) => (
              <View key={g.key} style={{ marginBottom: 18 }}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{g.label}</Text>
                  <View style={styles.groupCount}>
                    <Text style={styles.groupCountText}>{g.notes.length}</Text>
                  </View>
                  <View style={styles.groupLine} />
                </View>

                <View style={styles.grid}>
                  {g.notes.map((n) => {
                    const palette = getNoteColor(n.color);
                    const preview = notePreview(n.contenido, 120);
                    return (
                      <TouchableOpacity
                        key={n._id}
                        style={[styles.card, { backgroundColor: palette.bg }]}
                        activeOpacity={0.85}
                        onPress={() => openNote(n)}
                      >
                        <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={2}>
                          {n.meta || "Sin título"}
                        </Text>
                        <Text
                          style={[styles.cardPreview, { color: palette.text, opacity: 0.7 }]}
                          numberOfLines={4}
                        >
                          {preview || "Sin contenido"}
                        </Text>
                        <View style={styles.cardFooter}>
                          <Text style={[styles.cardDate, { color: palette.text, opacity: 0.6 }]}>
                            {formatShortDate(n.fecha)}
                          </Text>
                          {n.carpeta ? (
                            <View style={styles.cardFolder}>
                              <Ionicons
                                name="pricetag-outline"
                                size={11}
                                color={palette.text}
                                style={{ opacity: 0.6 }}
                              />
                              <Text
                                style={[styles.cardFolderText, { color: palette.text, opacity: 0.6 }]}
                                numberOfLines={1}
                              >
                                {n.carpeta}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {/* relleno si el grupo tiene cantidad impar, para mantener 2 columnas */}
                  {g.notes.length % 2 === 1 && <View style={[styles.card, styles.cardGhost]} />}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={openNew}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <NoteEditorModal
        visible={editorOpen}
        note={activeNote}
        folders={folders}
        tagColors={tagColors}
        onTagCreated={handleTagCreated}
        defaultCarpeta={!activeNote && folder !== ALL_FOLDERS ? folder : ""}
        onClose={() => setEditorOpen(false)}
        onSaved={fetchNotes}
        onDeleted={fetchNotes}
      />

      <ShoppingListsPanel visible={shoppingOpen} onClose={() => cerrarPanel(setShoppingOpen)} />
      <AfirmacionesPanel
        visible={afirmacionesOpen}
        onClose={() => cerrarPanel(setAfirmacionesOpen)}
      />
      <JournalingPanel visible={journalOpen} onClose={() => cerrarPanel(setJournalOpen)} />

      {/* Todas las carpetas: buscador + lista con conteo */}
      <Modal
        visible={foldersOpen}
        animationType="slide"
        onRequestClose={() => setFoldersOpen(false)}
      >
        <View style={[styles.foldersModal, { paddingTop: insets.top + 6, paddingBottom: insets.bottom }]}>
          <View style={styles.foldersHeader}>
            <Text style={styles.foldersTitle}>Etiquetas</Text>
            <TouchableOpacity onPress={() => setFoldersOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={folderSearch}
              onChangeText={setFolderSearch}
              placeholder="Buscar etiqueta..."
              placeholderTextColor={colors.muted}
              autoCorrect={false}
            />
            {folderSearch ? (
              <TouchableOpacity onPress={() => setFolderSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Crear nueva carpeta */}
          <View style={styles.newFolderRow}>
            <Ionicons name="pricetag-outline" size={16} color={colors.greenDark} />
            <TextInput
              style={styles.searchInput}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Nueva etiqueta..."
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleCreateFolder}
            />
            <TouchableOpacity
              style={[styles.newFolderBtn, { backgroundColor: newFolderColor }, !newFolderName.trim() && { opacity: 0.4 }]}
              onPress={handleCreateFolder}
              disabled={!newFolderName.trim()}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {/* Color de la etiqueta nueva: 5 a la vista + "+" para cualquier otro */}
          <View style={styles.newFolderColors}>
            {[
              ...TAG_COLOR_CHOICES,
              ...(TAG_COLOR_CHOICES.includes(newFolderColor) ? [] : [newFolderColor]),
            ].map((c) => {
              const active = newFolderColor === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.tagColor, { backgroundColor: c }, active && styles.tagColorActive]}
                  onPress={() => setNewFolderColor(c)}
                >
                  {active ? <Ionicons name="checkmark" size={14} color="#16241d" /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.tagColorMore}
              onPress={() => setNewFolderPickerOpen(true)}
              accessibilityLabel="Elegir otro color"
            >
              <Ionicons name="add" size={16} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingTop: 6 }}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              style={styles.folderItem}
              onPress={() => {
                setFolder(ALL_FOLDERS);
                setFoldersOpen(false);
              }}
            >
              <Ionicons name="albums-outline" size={18} color={colors.greenDark} />
              <Text style={styles.folderItemName}>Todas</Text>
              <Text style={styles.folderItemCount}>{notes.length}</Text>
            </TouchableOpacity>

            {foldersFiltered.map((f) => (
              <TouchableOpacity
                key={f}
                style={styles.folderItem}
                onPress={() => {
                  setFolder(f);
                  setFoldersOpen(false);
                }}
              >
                <View style={[styles.tagDot, { width: 11, height: 11, backgroundColor: colorDeEtiqueta(tagColors, f) }]} />
                <Text style={styles.folderItemName} numberOfLines={1}>
                  {f}
                </Text>
                <Text style={styles.folderItemCount}>{folderCounts.get(f) || 0}</Text>
                {(folderCounts.get(f) || 0) === 0 ? (
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert("¿Borrar etiqueta?", `Se va a borrar "${f}".`, [
                        { text: "Cancelar", style: "cancel" },
                        { text: "Borrar", style: "destructive", onPress: () => handleDeleteFolder(f) },
                      ])
                    }
                    hitSlop={8}
                    accessibilityLabel={`Borrar etiqueta ${f}`}
                  >
                    <Ionicons name="trash-outline" size={17} color="#e5484d" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            ))}

            {foldersFiltered.length === 0 ? (
              <Text style={styles.foldersEmpty}>No hay etiquetas que coincidan.</Text>
            ) : null}
          </ScrollView>
          <ColorPickerModal
            visible={newFolderPickerOpen}
            initialColor={newFolderColor}
            onClose={() => setNewFolderPickerOpen(false)}
            onSelect={(hex) => setNewFolderColor(hex)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
    gap: 10,
  },
  kicker: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  countBadge: {
    minWidth: 24,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: colors.greenDark, fontSize: 12, fontWeight: "800" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.greenBright,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 4,
  },
  newBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  folderRowWrap: { paddingBottom: 4 },
  folderRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  folderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  folderChipActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  tagDot: { width: 8, height: 8, borderRadius: 999 },
  newFolderColors: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  tagColor: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  tagColorActive: { borderWidth: 2.5, borderColor: colors.greenBright, transform: [{ scale: 1.06 }] },
  tagColorMore: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  folderChipText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  folderChipTextActive: { color: colors.greenDark },
  folderChipMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder,
  },
  newFolderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    backgroundColor: colors.greenSoft,
  },
  newFolderBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.greenBright,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal "todas las carpetas"
  foldersModal: { flex: 1, backgroundColor: colors.bg },
  foldersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  foldersTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
  folderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 8,
  },
  folderItemName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  folderItemCount: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.cardSoft,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    overflow: "hidden",
  },
  foldersEmpty: { color: colors.muted, textAlign: "center", marginTop: 24 },

  empty: { color: colors.muted, textAlign: "center", marginTop: 30, lineHeight: 21 },

  groupHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  groupTitle: { color: colors.text, fontSize: 15, fontWeight: "800", textTransform: "capitalize" },
  groupCount: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  groupCountText: { color: colors.greenDark, fontSize: 11, fontWeight: "800" },
  groupLine: { flex: 1, height: 1, backgroundColor: colors.cardBorder },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    width: "48%",
    minHeight: 130,
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cardGhost: { backgroundColor: "transparent", borderColor: "transparent", minHeight: 0 },
  cardTitle: { fontSize: 15, fontWeight: "800" },
  cardPreview: { fontSize: 13, lineHeight: 18, marginTop: 6, flex: 1 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 10,
  },
  cardDate: { fontSize: 11, fontWeight: "700" },
  cardFolder: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1 },
  cardFolderText: { fontSize: 11, fontWeight: "700" },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.greenBright,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
