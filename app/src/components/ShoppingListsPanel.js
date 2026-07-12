import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { taskService } from "../api";
import { useTheme } from "../theme";
import { getNoteColor } from "../utils/notes";

const LIST_COLORS = ["color1", "color4", "color3", "color5", "color7", "color6", "color2"];

let itemSeq = 0;
const makeItemId = () => `it_${Date.now().toString(36)}_${(itemSeq++).toString(36)}`;

export default function ShoppingListsPanel({ visible, onClose }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState(LIST_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [openListId, setOpenListId] = useState(null);
  const [draft, setDraft] = useState("");
  const listsRef = useRef(lists);

  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  const fetchLists = useCallback(async () => {
    setError("");
    try {
      const res = await taskService.getAll({ tipo: "shopping" });
      const data = Array.isArray(res.data) ? res.data : res.data?.tasks || [];
      // Guarda: si el backend todavía no filtra por "shopping", no dejamos
      // que se cuelen tareas/notas en el panel de listas.
      setLists(data.filter((d) => d && d.tipo === "shopping"));
    } catch {
      setError("No se pudieron cargar las listas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setOpenListId(null);
    setDraft("");
    fetchLists();
  }, [visible, fetchLists]);

  const persistItems = useCallback(
    async (listId, items) => {
      try {
        await taskService.update(listId, { items });
      } catch {
        setError("No se pudo guardar el cambio. Reintentá.");
        fetchLists();
      }
    },
    [fetchLists]
  );

  const mutateItems = useCallback(
    (listId, updater) => {
      const target = listsRef.current.find((l) => l._id === listId);
      if (!target) return;
      const nextItems = updater(target.items || []);
      const nextLists = listsRef.current.map((l) =>
        l._id === listId ? { ...l, items: nextItems } : l
      );
      listsRef.current = nextLists;
      setLists(nextLists);
      persistItems(listId, nextItems);
    },
    [persistItems]
  );

  const handleCreateList = async () => {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await taskService.create({
        meta: title,
        tipo: "shopping",
        color: newColor,
        items: [],
        fecha: new Date().toISOString(),
      });
      setLists((prev) => [res.data, ...prev]);
      setNewTitle("");
      setNewColor((prev) => {
        const idx = LIST_COLORS.indexOf(prev);
        return LIST_COLORS[(idx + 1) % LIST_COLORS.length];
      });
    } catch {
      setError("No se pudo crear la lista.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteList = (listId) => {
    Alert.alert("Eliminar lista", "¿Borrar esta lista y todos sus ítems?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          const snapshot = listsRef.current;
          if (openListId === listId) setOpenListId(null);
          setLists((prev) => prev.filter((l) => l._id !== listId));
          try {
            await taskService.delete(listId);
          } catch {
            setError("No se pudo eliminar la lista.");
            setLists(snapshot);
          }
        },
      },
    ]);
  };

  const handleToggleItem = (listId, itemId) =>
    mutateItems(listId, (items) =>
      items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it))
    );

  const handleDeleteItem = (listId, itemId) =>
    mutateItems(listId, (items) => items.filter((it) => it.id !== itemId));

  const handleAddItem = (listId) => {
    const text = draft.trim();
    if (!text) return;
    mutateItems(listId, (items) => [...items, { id: makeItemId(), text, done: false }]);
    setDraft("");
  };

  const handleClearDone = (listId) =>
    mutateItems(listId, (items) => items.filter((it) => !it.done));

  const openList = openListId ? lists.find((l) => l._id === openListId) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={[styles.safe, { paddingTop: insets.top + 6, paddingBottom: insets.bottom }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            {openList ? (
              <TouchableOpacity style={styles.headerBtn} onPress={() => { setOpenListId(null); setDraft(""); }} hitSlop={8}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerBtn}>
                <Ionicons name="cart" size={20} color={colors.greenDark} />
              </View>
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>
              {openList ? openList.meta || "Sin título" : "Listas de compras"}
            </Text>
            <TouchableOpacity style={styles.headerBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {openList ? (
            <ListDetail
              colors={colors}
              styles={styles}
              list={openList}
              draft={draft}
              onDraftChange={setDraft}
              onAddItem={() => handleAddItem(openList._id)}
              onToggleItem={(id) => handleToggleItem(openList._id, id)}
              onDeleteItem={(id) => handleDeleteItem(openList._id, id)}
              onDeleteList={() => handleDeleteList(openList._id)}
              onClearDone={() => handleClearDone(openList._id)}
            />
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl refreshing={false} onRefresh={fetchLists} tintColor={colors.green} />
              }
            >
              {/* Compositor */}
              <View style={styles.composer}>
                <View style={styles.composerRow}>
                  <TextInput
                    style={styles.composerInput}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    placeholder="Nueva lista (ej. Supermercado)"
                    placeholderTextColor={colors.muted}
                    maxLength={80}
                    returnKeyType="done"
                    onSubmitEditing={handleCreateList}
                  />
                  <TouchableOpacity
                    style={[styles.createBtn, (!newTitle.trim() || creating) && styles.btnDisabled]}
                    onPress={handleCreateList}
                    disabled={!newTitle.trim() || creating}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.createBtnText}>Crear</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.swatchRow}>
                  {LIST_COLORS.map((c) => {
                    const active = newColor === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.swatch,
                          { backgroundColor: getNoteColor(c).bg },
                          active && styles.swatchActive,
                        ]}
                        onPress={() => setNewColor(c)}
                      />
                    );
                  })}
                </View>
              </View>

              {loading ? (
                <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />
              ) : lists.length === 0 ? (
                <Text style={styles.empty}>
                  Todavía no tenés listas. Creá la primera arriba y después entrá para anotar.
                </Text>
              ) : (
                lists.map((list) => (
                  <PreviewCard
                    key={list._id}
                    colors={colors}
                    styles={styles}
                    list={list}
                    onOpen={() => setOpenListId(list._id)}
                    onDeleteList={() => handleDeleteList(list._id)}
                  />
                ))
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function PreviewCard({ colors, styles, list, onOpen, onDeleteList }) {
  const items = list.items || [];
  const doneCount = items.filter((it) => it.done).length;
  const pending = items.length - doneCount;
  const palette = getNoteColor(list.color);

  const summary = !items.length
    ? "Lista vacía"
    : pending === 0
    ? "Todo comprado"
    : `${pending} pendiente${pending === 1 ? "" : "s"} · ${items.length} ítem${items.length === 1 ? "" : "s"}`;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.previewCard, { backgroundColor: palette.bg }]}
      onPress={onOpen}
    >
      <View style={styles.previewTop}>
        <Text style={[styles.previewTitle, { color: palette.text }]} numberOfLines={2}>
          {list.meta || "Sin título"}
        </Text>
        <TouchableOpacity
          style={styles.trashBtn}
          onPress={onDeleteList}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color={palette.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.previewBottom}>
        <Text style={[styles.previewSummary, { color: palette.text }]}>{summary}</Text>
        <Ionicons name="chevron-forward" size={18} color={palette.text} style={{ opacity: 0.5 }} />
      </View>
    </TouchableOpacity>
  );
}

function ListDetail({
  colors,
  styles,
  list,
  draft,
  onDraftChange,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onDeleteList,
  onClearDone,
}) {
  const items = list.items || [];
  const doneCount = items.filter((it) => it.done).length;
  const palette = getNoteColor(list.color);

  return (
    <View style={{ flex: 1 }}>
      {/* Barra de agregar ítem (arriba, para anotar directo) */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={draft}
          onChangeText={onDraftChange}
          placeholder="Anotá un ítem y presioná +"
          placeholderTextColor={colors.muted}
          maxLength={120}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onAddItem}
        />
        <TouchableOpacity
          style={[styles.addBtn, !draft.trim() && styles.btnDisabled]}
          onPress={onAddItem}
          disabled={!draft.trim()}
        >
          <Ionicons name="add" size={22} color="#16241d" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {items.length === 0 ? (
          <Text style={styles.empty}>Todavía no anotaste nada. Escribí arriba para empezar.</Text>
        ) : (
          items.map((it) => (
            <View
              key={it.id}
              style={[styles.item, { backgroundColor: palette.bg }]}
            >
              <TouchableOpacity style={styles.itemDelete} onPress={() => onDeleteItem(it.id)} hitSlop={6}>
                <Ionicons name="close" size={16} color={palette.text} />
              </TouchableOpacity>
              <Text
                style={[
                  styles.itemText,
                  { color: palette.text },
                  it.done && styles.itemTextDone,
                ]}
              >
                {it.text}
              </Text>
              <TouchableOpacity
                style={[
                  styles.check,
                  it.done && { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
                ]}
                onPress={() => onToggleItem(it.id)}
              >
                {it.done ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
              </TouchableOpacity>
            </View>
          ))
        )}

        {doneCount > 0 ? (
          <TouchableOpacity style={styles.clearDone} onPress={onClearDone}>
            <Text style={styles.clearDoneText}>
              Quitar {doneCount} comprado{doneCount === 1 ? "" : "s"}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.deleteListRow} onPress={onDeleteList}>
          <Ionicons name="trash-outline" size={16} color={colors.red} />
          <Text style={styles.deleteListText}>Eliminar lista</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" },
    error: { color: colors.red, paddingHorizontal: 16, paddingTop: 10 },

    composer: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 12,
      gap: 10,
      marginBottom: 16,
    },
    composerRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    composerInput: {
      flex: 1,
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    createBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.greenBright,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    createBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
    btnDisabled: { opacity: 0.45 },

    swatchRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    swatch: { width: 26, height: 26, borderRadius: 999, borderWidth: 2, borderColor: "rgba(0,0,0,0.12)" },
    swatchActive: { borderColor: colors.greenDark, borderWidth: 3 },

    empty: { color: colors.muted, textAlign: "center", marginTop: 24, lineHeight: 21, paddingHorizontal: 8 },

    previewCard: {
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      gap: 14,
      minHeight: 92,
      justifyContent: "space-between",
    },
    previewTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    previewTitle: { flex: 1, fontSize: 16, fontWeight: "800" },
    trashBtn: {
      width: 30,
      height: 30,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.08)",
    },
    previewBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    previewSummary: { fontSize: 13, fontWeight: "700", opacity: 0.75, flex: 1 },

    addRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
    },
    addInput: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: colors.text,
      fontSize: 15,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.12)",
      alignItems: "center",
      justifyContent: "center",
    },

    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2.5,
      borderColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    itemText: { flex: 1, fontSize: 15, fontWeight: "600" },
    itemTextDone: { textDecorationLine: "line-through", opacity: 0.5 },
    itemDelete: { width: 26, height: 26, alignItems: "center", justifyContent: "center", opacity: 0.6 },

    clearDone: {
      alignSelf: "flex-start",
      backgroundColor: colors.cardSoft,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginTop: 4,
    },
    clearDoneText: { color: colors.text, fontWeight: "700", fontSize: 13 },

    deleteListRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "center",
      marginTop: 22,
      paddingVertical: 8,
    },
    deleteListText: { color: colors.red, fontWeight: "700", fontSize: 14 },
  });
