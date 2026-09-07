// Listas de compras — mismo diseño que la web: cards tintadas por color con
// anillo de progreso y preview de ítems tildeables; detalle con hero de la
// lista, barra de agregar, precio × cantidad y barra de comprados.
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
import Svg, { Circle } from "react-native-svg";
import { taskService } from "../api";
import { useTheme } from "../theme";
import MoneyInput from "./MoneyInput";

const LIST_COLORS = ["color1", "color4", "color3", "color5", "color7", "color6", "color2"];

// Acento vivo por color de lista (mismos valores que la web)
const LIST_ACCENTS = {
  color1: "#6ee14b",
  color2: "#ff9d5c",
  color3: "#ffd35c",
  color4: "#3ed9a4",
  color5: "#69a7ff",
  color6: "#f070b8",
  color7: "#a78bfa",
  color8: "#ff7a6e",
  color9: "#9ab09a",
  color10: "#a9bfae",
  color11: "#8ea8a8",
};
const accentOf = (c) => LIST_ACCENTS[c] || LIST_ACCENTS.color1;

let itemSeq = 0;
const makeItemId = () => `it_${Date.now().toString(36)}_${(itemSeq++).toString(36)}`;

// Anillo de progreso (comprados / total) con el acento de la lista
function ProgressRing({ acc, done, total, size = 46, trackColor }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={acc}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text
        style={{
          position: "absolute",
          fontSize: 10.5,
          fontWeight: "800",
          color: acc,
          fontVariant: ["tabular-nums"],
        }}
      >
        {total ? `${done}/${total}` : "0"}
      </Text>
    </View>
  );
}

export default function ShoppingListsPanel({ visible, onClose }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, isDark);

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

  const handleSetPrice = (listId, itemId, precio, cantidad) =>
    mutateItems(listId, (items) =>
      items.map((it) =>
        it.id === itemId ? { ...it, precio, cantidad: cantidad || 1 } : it
      )
    );

  const openList = openListId ? lists.find((l) => l._id === openListId) : null;
  const totalPending = lists.reduce(
    (acc, l) => acc + (l.items || []).filter((it) => !it.done).length,
    0
  );

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
              {openList ? "Volver a las listas" : "Listas de compras"}
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
              onSetPrice={(id, precio, cantidad) =>
                handleSetPrice(openList._id, id, precio, cantidad)
              }
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
                  <View style={[styles.composerIcon, { backgroundColor: accentOf(newColor) + "38" }]}>
                    <Ionicons name="cart-outline" size={20} color={accentOf(newColor)} />
                  </View>
                  <TextInput
                    style={styles.composerInput}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    placeholder="Nueva lista (ej: Súper)"
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
                    <Ionicons name="add" size={18} color="#06210a" />
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
                          { backgroundColor: accentOf(c) },
                          active && styles.swatchActive,
                        ]}
                        onPress={() => setNewColor(c)}
                      >
                        {active ? <Ionicons name="checkmark" size={14} color="#0b1a10" /> : null}
                      </TouchableOpacity>
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
                <>
                  <View style={styles.statsRow}>
                    <Ionicons name="list-outline" size={15} color={colors.green} />
                    <Text style={styles.statsText}>
                      {lists.length} lista{lists.length === 1 ? "" : "s"} · {totalPending} pendiente
                      {totalPending === 1 ? "" : "s"}
                    </Text>
                  </View>
                  {lists.map((list) => (
                    <PreviewCard
                      key={list._id}
                      colors={colors}
                      isDark={isDark}
                      styles={styles}
                      list={list}
                      onOpen={() => setOpenListId(list._id)}
                      onDeleteList={() => handleDeleteList(list._id)}
                      onToggleItem={(id) => handleToggleItem(list._id, id)}
                    />
                  ))}
                </>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const PREVIEW_MAX = 4;
function PreviewCard({ colors, isDark, styles, list, onOpen, onDeleteList, onToggleItem }) {
  const items = list.items || [];
  const doneCount = items.filter((it) => it.done).length;
  const pending = items.length - doneCount;
  const acc = accentOf(list.color);
  const preview = items.slice(0, PREVIEW_MAX);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.previewCard,
        { backgroundColor: acc + (isDark ? "14" : "1c"), borderColor: acc + "55" },
      ]}
      onPress={onOpen}
    >
      <View style={styles.previewTop}>
        <View style={[styles.previewIcon, { backgroundColor: acc + "30" }]}>
          <Ionicons name="cart-outline" size={19} color={acc} />
        </View>
        <ProgressRing
          acc={acc}
          done={doneCount}
          total={items.length}
          trackColor={acc + "30"}
        />
      </View>

      <Text style={styles.previewTitle} numberOfLines={1}>
        {list.meta || "Sin título"}
      </Text>
      <Text style={styles.previewMeta}>
        {items.length
          ? `${items.length} ítem${items.length === 1 ? "" : "s"} · ${
              pending === 0 ? "todo comprado" : `${pending} pendiente${pending === 1 ? "" : "s"}`
            }`
          : "Lista vacía"}
      </Text>

      {preview.map((it) => (
        <View key={it.id} style={styles.previewItemRow}>
          <TouchableOpacity
            style={[
              styles.previewCheck,
              { borderColor: acc + "88" },
              it.done && { backgroundColor: acc, borderColor: acc },
            ]}
            onPress={() => onToggleItem(it.id)}
            hitSlop={6}
          >
            {it.done ? <Ionicons name="checkmark" size={12} color="#0b1a10" /> : null}
          </TouchableOpacity>
          <Text
            style={[styles.previewItemText, it.done && styles.previewItemTextDone]}
            numberOfLines={1}
          >
            {it.text}
          </Text>
        </View>
      ))}
      {items.length > PREVIEW_MAX ? (
        <Text style={styles.previewMore}>+{items.length - PREVIEW_MAX} más</Text>
      ) : null}

      <View style={[styles.previewFoot, { borderTopColor: acc + "30" }]}>
        <View style={styles.previewOpen}>
          <Text style={[styles.previewOpenText, { color: acc }]}>Ver lista</Text>
          <Ionicons name="arrow-forward" size={15} color={acc} />
        </View>
        <TouchableOpacity style={styles.trashBtn} onPress={onDeleteList} hitSlop={8}>
          <Ionicons name="trash-outline" size={17} color={colors.muted} />
        </TouchableOpacity>
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
  onSetPrice,
}) {
  const items = list.items || [];
  const doneCount = items.filter((it) => it.done).length;
  const pending = items.length - doneCount;
  const acc = accentOf(list.color);

  const [priceOpenId, setPriceOpenId] = useState(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [qtyDraft, setQtyDraft] = useState("1");
  const fmt = (n) => Number(n || 0).toLocaleString("es-AR");
  const lineaTotal = (it) => (Number(it.precio) || 0) * (Number(it.cantidad) || 1);
  const total = items.reduce((acc2, it) => acc2 + lineaTotal(it), 0);
  const abrirPrecio = (it) => {
    setPriceOpenId(it.id);
    setPriceDraft(it.precio != null ? String(it.precio) : "");
    setQtyDraft(it.cantidad ? String(it.cantidad) : "1");
  };
  const guardarPrecio = (itemId) => {
    const n = parseFloat(String(priceDraft).replace(",", "."));
    const q = parseInt(qtyDraft, 10);
    onSetPrice(
      itemId,
      Number.isFinite(n) && n >= 0 ? n : null,
      Number.isFinite(q) && q >= 1 ? q : 1
    );
    setPriceOpenId(null);
    setPriceDraft("");
    setQtyDraft("1");
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 10, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero de la lista */}
        <View style={styles.detailHero}>
          <View style={[styles.detailHeroIcon, { backgroundColor: acc }]}>
            <Ionicons name="cart-outline" size={24} color="#0b1a10" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.detailKicker, { color: acc }]}>LISTA DE COMPRAS</Text>
            <Text style={styles.detailTitle} numberOfLines={1}>
              {list.meta || "Sin título"}
            </Text>
            <Text style={styles.detailSub}>
              {items.length
                ? `${items.length} ítem${items.length === 1 ? "" : "s"} · ${
                    pending === 0 ? "todo comprado" : `${pending} pendiente${pending === 1 ? "" : "s"}`
                  }`
                : "Anotá lo que necesites comprar."}
            </Text>
          </View>
          <TouchableOpacity style={styles.trashBtn} onPress={onDeleteList} hitSlop={8}>
            <Ionicons name="trash-outline" size={19} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Barra de agregar */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={draft}
            onChangeText={onDraftChange}
            placeholder="Agregar un ítem..."
            placeholderTextColor={colors.muted}
            maxLength={120}
            returnKeyType="done"
            onSubmitEditing={onAddItem}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.addBtn, !draft.trim() && styles.btnDisabled]}
            onPress={onAddItem}
            disabled={!draft.trim()}
          >
            <Ionicons name="add" size={17} color="#06210a" />
            <Text style={styles.addBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <Text style={styles.empty}>Todavía no anotaste nada. Escribí arriba para empezar.</Text>
        ) : (
          items.map((it) => (
            <View key={it.id} style={styles.item}>
              <TouchableOpacity
                style={[
                  styles.check,
                  { borderColor: acc + "88" },
                  it.done && { backgroundColor: acc, borderColor: acc },
                ]}
                onPress={() => onToggleItem(it.id)}
                hitSlop={6}
              >
                {it.done ? <Ionicons name="checkmark" size={15} color="#0b1a10" /> : null}
              </TouchableOpacity>
              <Text style={[styles.itemText, it.done && styles.itemTextDone]} numberOfLines={1}>
                {it.text}
              </Text>

              {priceOpenId === it.id ? (
                <View style={styles.precioEdit}>
                  <MoneyInput
                    style={styles.precioInput}
                    value={priceDraft}
                    onChangeText={setPriceDraft}
                    onSubmitEditing={() => guardarPrecio(it.id)}
                    placeholder="$"
                    placeholderTextColor={colors.muted}
                    autoFocus
                  />
                  <Text style={styles.precioX}>×</Text>
                  <TextInput
                    style={styles.cantInput}
                    value={qtyDraft}
                    onChangeText={setQtyDraft}
                    onSubmitEditing={() => guardarPrecio(it.id)}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity style={styles.precioOk} onPress={() => guardarPrecio(it.id)}>
                    <Ionicons name="checkmark" size={16} color="#06210a" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.precioBtn, it.precio != null && { borderColor: acc + "77" }]}
                  onPress={() => abrirPrecio(it)}
                >
                  <Text
                    style={[styles.precioBtnText, it.precio != null && { color: colors.text }]}
                  >
                    {it.precio != null
                      ? Number(it.cantidad) > 1
                        ? `$ ${fmt(lineaTotal(it))} ×${it.cantidad}`
                        : `$ ${fmt(it.precio)}`
                      : "precio"}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.itemDelete}
                onPress={() => onDeleteItem(it.id)}
                hitSlop={6}
              >
                <Ionicons name="close" size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {total > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={[styles.totalMonto, { color: acc }]}>$ {fmt(total)}</Text>
          </View>
        ) : null}

        {/* Barra inferior: comprados + limpiar */}
        {items.length > 0 ? (
          <View style={styles.footBar}>
            <View style={styles.footBarInfo}>
              <Ionicons name="cart-outline" size={16} color={acc} />
              <Text style={styles.footBarText}>
                {doneCount} comprado{doneCount === 1 ? "" : "s"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.footBarDelete, doneCount === 0 && styles.btnDisabled]}
              onPress={onClearDone}
              disabled={doneCount === 0}
            >
              <Ionicons name="trash-outline" size={15} color="#ff6b5e" />
              <Text style={styles.footBarDeleteText}>Eliminar comprados</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors, isDark) =>
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
    btnDisabled: { opacity: 0.45 },

    // ---- Compositor ----
    composer: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 18,
      padding: 12,
      gap: 10,
      marginBottom: 14,
    },
    composerRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    composerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
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
      backgroundColor: colors.segActive,
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    createBtnText: { color: "#06210a", fontWeight: "800", fontSize: 14 },
    swatchRow: { flexDirection: "row", gap: 9, flexWrap: "wrap" },
    swatch: {
      width: 26,
      height: 26,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    swatchActive: {
      borderWidth: 2,
      borderColor: colors.text,
    },

    statsRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
    statsText: { color: colors.muted, fontSize: 13.5, fontWeight: "700" },

    empty: { color: colors.muted, textAlign: "center", marginTop: 24, lineHeight: 21, paddingHorizontal: 8 },

    // ---- Cards del board ----
    previewCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
      gap: 6,
    },
    previewTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    previewIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    previewTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
    previewMeta: { color: colors.muted, fontSize: 12.5, marginBottom: 4 },
    previewItemRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 3 },
    previewCheck: {
      width: 17,
      height: 17,
      borderRadius: 999,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    previewItemText: { flex: 1, color: colors.text, fontSize: 13.5 },
    previewItemTextDone: { color: colors.muted, textDecorationLine: "line-through" },
    previewMore: { color: colors.muted, fontSize: 12, paddingLeft: 26 },
    previewFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      paddingTop: 9,
      marginTop: 6,
    },
    previewOpen: { flexDirection: "row", alignItems: "center", gap: 5 },
    previewOpenText: { fontSize: 13.5, fontWeight: "800" },
    trashBtn: {
      width: 30,
      height: 30,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },

    // ---- Detalle ----
    detailHero: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
    detailHeroIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    detailKicker: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.4 },
    detailTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 1 },
    detailSub: { color: colors.muted, fontSize: 13, marginTop: 2 },

    addRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      padding: 8,
      marginBottom: 12,
    },
    addInput: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.segActive,
      borderRadius: 11,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    addBtnText: { color: "#06210a", fontWeight: "800", fontSize: 13.5 },

    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      paddingVertical: 11,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    itemText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
    itemTextDone: { textDecorationLine: "line-through", color: colors.muted },
    itemDelete: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },

    // Precio × cantidad, integrado al tema (sin fondos blancos)
    precioBtn: {
      paddingVertical: 5,
      paddingHorizontal: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardSoft,
    },
    precioBtnText: { color: colors.muted, fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] },
    precioEdit: { flexDirection: "row", alignItems: "center", gap: 5 },
    precioX: { color: colors.muted, fontWeight: "800", fontSize: 14 },
    precioInput: {
      width: 84,
      paddingVertical: 7,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardSoft,
      color: colors.text,
      fontSize: 14.5,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    cantInput: {
      width: 46,
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardSoft,
      color: colors.text,
      fontSize: 14.5,
      fontWeight: "700",
      textAlign: "center",
      fontVariant: ["tabular-nums"],
    },
    precioOk: {
      width: 30,
      height: 30,
      borderRadius: 999,
      backgroundColor: colors.segActive,
      alignItems: "center",
      justifyContent: "center",
    },

    totalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    totalLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: colors.muted },
    totalMonto: { fontSize: 17, fontWeight: "800", fontVariant: ["tabular-nums"] },

    footBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    footBarInfo: { flexDirection: "row", alignItems: "center", gap: 7 },
    footBarText: { color: colors.muted, fontSize: 13.5, fontWeight: "700" },
    footBarDelete: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: "rgba(255, 107, 94, 0.45)",
      backgroundColor: "rgba(255, 107, 94, 0.12)",
      borderRadius: 11,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    footBarDeleteText: { color: "#ff6b5e", fontWeight: "800", fontSize: 13 },
  });
