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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [afirmacionesOpen, setAfirmacionesOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");
  const [customFolders, setCustom] = useState([]);
  const [newFolderName, setNewFolderName] = useState("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getCustomFolders().then((arr) => setCustom(arr));
  }, []);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    // no duplicar (ignorando mayúsculas)
    const exists = [...customFolders, ...folders].some(
      (f) => f.toLowerCase() === name.toLowerCase()
    );
    const next = exists ? customFolders : [...customFolders, name];
    setCustom(next);
    setNewFolderName("");
    setFolder(name); // la dejamos seleccionada
    setFoldersOpen(false);
    try {
      await setCustomFolders(next);
    } catch {
      // noop
    }
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
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>NOTAS</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Tus notas</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{notes.length}</Text>
            </View>
          </View>
        </View>
        {/* Un solo acceso: "Más herramientas" despliega las secciones extra */}
        <TouchableOpacity
          style={styles.toolsBtn}
          onPress={() => setToolsOpen(true)}
          accessibilityLabel="Más herramientas"
        >
          <Text style={styles.toolsBtnText}>Más herramientas</Text>
          <Ionicons name="chevron-down" size={15} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Menú de herramientas */}
      <Modal visible={toolsOpen} transparent animationType="fade" onRequestClose={() => setToolsOpen(false)}>
        <TouchableOpacity
          style={styles.toolsBackdrop}
          activeOpacity={1}
          onPress={() => setToolsOpen(false)}
        >
          <View style={styles.toolsMenu}>
            <TouchableOpacity
              style={styles.toolsItem}
              onPress={() => {
                setToolsOpen(false);
                setShoppingOpen(true);
              }}
            >
              <Ionicons name="cart-outline" size={19} color={colors.green} />
              <Text style={styles.toolsItemText}>Lista de compras</Text>
            </TouchableOpacity>
            <View style={styles.toolsDivider} />
            <TouchableOpacity
              style={styles.toolsItem}
              onPress={() => {
                setToolsOpen(false);
                setAfirmacionesOpen(true);
              }}
            >
              <Ionicons name="reader-outline" size={19} color={colors.green} />
              <Text style={styles.toolsItemText}>Afirmaciones</Text>
            </TouchableOpacity>
            <View style={styles.toolsDivider} />
            <TouchableOpacity
              style={styles.toolsItem}
              onPress={() => {
                setToolsOpen(false);
                setJournalOpen(true);
              }}
            >
              <Ionicons name="create-outline" size={19} color={colors.green} />
              <Text style={styles.toolsItemText}>Journaling</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
              accessibilityLabel="Ver todas las carpetas"
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
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 90 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={fetchNotes} tintColor={colors.green} />
          }
        >
          {visibleNotes.length === 0 ? (
            <Text style={styles.empty}>
              {folder === ALL_FOLDERS
                ? 'Todavía no tenés notas. Creá la primera con "Nueva nota".'
                : `La carpeta "${folder}" está vacía.`}
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
                                name="folder-outline"
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
        defaultCarpeta={!activeNote && folder !== ALL_FOLDERS ? folder : ""}
        onClose={() => setEditorOpen(false)}
        onSaved={fetchNotes}
        onDeleted={fetchNotes}
      />

      <ShoppingListsPanel visible={shoppingOpen} onClose={() => setShoppingOpen(false)} />
      <AfirmacionesPanel
        visible={afirmacionesOpen}
        onClose={() => setAfirmacionesOpen(false)}
      />
      <JournalingPanel visible={journalOpen} onClose={() => setJournalOpen(false)} />

      {/* Todas las carpetas: buscador + lista con conteo */}
      <Modal
        visible={foldersOpen}
        animationType="slide"
        onRequestClose={() => setFoldersOpen(false)}
      >
        <View style={[styles.foldersModal, { paddingTop: insets.top + 6, paddingBottom: insets.bottom }]}>
          <View style={styles.foldersHeader}>
            <Text style={styles.foldersTitle}>Carpetas</Text>
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
              placeholder="Buscar carpeta..."
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
            <Ionicons name="folder-open-outline" size={16} color={colors.greenDark} />
            <TextInput
              style={styles.searchInput}
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Nueva carpeta..."
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleCreateFolder}
            />
            <TouchableOpacity
              style={[styles.newFolderBtn, !newFolderName.trim() && { opacity: 0.4 }]}
              onPress={handleCreateFolder}
              disabled={!newFolderName.trim()}
            >
              <Ionicons name="add" size={20} color="#fff" />
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
                <Ionicons name="folder-outline" size={18} color={colors.muted} />
                <Text style={styles.folderItemName} numberOfLines={1}>
                  {f}
                </Text>
                <Text style={styles.folderItemCount}>{folderCounts.get(f) || 0}</Text>
              </TouchableOpacity>
            ))}

            {foldersFiltered.length === 0 ? (
              <Text style={styles.foldersEmpty}>No hay carpetas que coincidan.</Text>
            ) : null}
          </ScrollView>
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
    paddingTop: 12,
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

  toolsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.greenBright,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  toolsBtnText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
  toolsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "flex-end",
    paddingTop: 150,
    paddingRight: 16,
  },
  toolsMenu: {
    minWidth: 210,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toolsItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toolsItemText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  toolsDivider: { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: 10 },

  folderRowWrap: { paddingBottom: 4 },
  folderRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  folderChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  folderChipActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
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
