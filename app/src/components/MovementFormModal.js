import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { movimientoService, categoriesService } from "../api";
import { formatMoney } from "../utils/finance";
import { useTheme } from "../theme";
import MoneyInput from "./MoneyInput";

// Íconos de categoría (mismos emojis que la web)
const CATEGORY_EMOJIS = [
  // Comida y bebida
  "🍔", "🍕", "🍎", "🥑", "🍞", "🥩", "🥦", "☕", "🍺", "🍷", "🧉", "🍰",
  // Compras y hogar
  "🛒", "🛍️", "🎁", "🏠", "🛋️", "🧹", "🧼", "🧻", "💡", "🔌",
  // Transporte
  "🚗", "🚕", "🚌", "🚆", "✈️", "⛽", "🚲", "🛵",
  // Salud y bienestar
  "💊", "🩺", "🏥", "🦷", "🏋️", "🧘", "🧴",
  // Ropa y personal
  "👕", "👟", "👗", "🕶️", "💇", "💅",
  // Ocio y entretenimiento
  "🎬", "🎮", "🎧", "🎵", "📺", "🎟️", "📚", "🎨", "⚽", "🏀", "🎾",
  // Tecnología y trabajo
  "📱", "💻", "🖥️", "💼", "🧾", "🖊️", "📈", "📊",
  // Dinero y finanzas
  "💵", "💳", "🏦", "💰", "🪙",
  // Educación, familia y mascotas
  "🎓", "🐶", "🐱", "🧸", "👶",
  // Herramientas y varios
  "🔧", "🛠️", "🧰", "🌱", "🌍", "🏖️", "🏨", "🎉", "🏷️",
];

// 6 modos = los accesos rápidos de la web
export const MOVEMENT_MODES = {
  "ingreso-fijo": { title: "Ingreso fijo", tipo: "ingreso", recurrente: true, tone: "ingreso" },
  ingreso: { title: "Nuevo ingreso", tipo: "ingreso", recurrente: false, tone: "ingreso" },
  ahorro: { title: "Nuevo ahorro", tipo: "ahorro", recurrente: false, tone: "ahorro" },
  "ahorro-uso": {
    title: "Usar ahorro",
    tipo: "egreso",
    recurrente: false,
    tone: "ahorro",
    desdeAhorro: true,
  },
  deuda: { title: "Cargar deuda", tipo: "deuda", recurrente: false, tone: "deuda" },
  "egreso-fijo": { title: "Gasto fijo", tipo: "egreso", recurrente: true, tone: "egreso" },
  egreso: { title: "Nuevo egreso", tipo: "egreso", recurrente: false, tone: "egreso" },
};

const TONE_COLORS = {
  ingreso: "#35b53a",
  egreso: "#e0703f",
  ahorro: "#2bb888",
  deuda: "#d6a92e",
};

// Color fuerte y liso de la tarjeta por tipo (igual que la web) y tinta oscura encima
const CARD_COLORS = {
  ingreso: "#75f94c",
  egreso: "#ff7b6b",
  ahorro: "#58eba4",
  deuda: "#ffd55c",
};
const INK = "#0e1a0e";
const INK_SOFT = "rgba(14, 26, 14, 0.6)";

const FRECUENCIAS = [
  { value: "mensual", label: "Todos los meses" },
  { value: "quincenal", label: "Cada 15 días" },
  { value: "semanal", label: "Todas las semanas" },
];

const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const modeFromMovement = (mov) => {
  if (mov.tipo === "deuda") return "deuda";
  if (mov.desdeAhorro) return "ahorro-uso";
  if (mov.esRecurrente) return mov.tipo === "ingreso" ? "ingreso-fijo" : "egreso-fijo";
  return mov.tipo === "ahorro" ? "ahorro" : mov.tipo === "ingreso" ? "ingreso" : "egreso";
};

export default function MovementFormModal({
  visible,
  modeKey,
  editMovement = null,
  defaultCurrency = "ARS",
  movimientos = [],
  onClose,
  onSaved,
}) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const effectiveModeKey = editMovement ? modeFromMovement(editMovement) : modeKey;
  const mode = MOVEMENT_MODES[effectiveModeKey] || MOVEMENT_MODES.ingreso;
  const isDebt = mode.tipo === "deuda";
  const tone = TONE_COLORS[mode.tone] || colors.green;
  const cardColor = CARD_COLORS[mode.tone] || CARD_COLORS.ingreso;

  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [detalle, setDetalle] = useState("");
  const [moneda, setMoneda] = useState(defaultCurrency === "USD" ? "USD" : "ARS");
  const [medio, setMedio] = useState("efectivo");
  const [frecuencia, setFrecuencia] = useState("mensual");
  const [deudaAcreedor, setDeudaAcreedor] = useState("");
  const [fecha, setFecha] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingsPopup, setSavingsPopup] = useState(""); // aviso "ya gastaste tus ahorros"

  // Cerrar el popup NO deja el form de "usar ahorro": cierra el modal y
  // vuelve a Home (que ya está en la pestaña Ahorros) para cargar más.
  const closeSavingsPopup = () => {
    setSavingsPopup("");
    onClose?.();
  };

  // El popup de ahorro se cierra solo a los pocos segundos.
  useEffect(() => {
    if (!savingsPopup) return;
    const t = setTimeout(() => {
      setSavingsPopup("");
      onClose?.();
    }, 4000);
    return () => clearTimeout(t);
  }, [savingsPopup, onClose]);

  // Categorías del usuario: autocompletado + alta con ícono
  const [categories, setCategories] = useState([]);
  const [catFocused, setCatFocused] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🏷️");
  const [savingCat, setSavingCat] = useState(false);

  const loadCategories = async () => {
    try {
      const res = await categoriesService.getAll();
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      // sin categorías, no bloquea
    }
  };

  useEffect(() => {
    if (visible) loadCategories();
  }, [visible]);

  const term = categoria.trim().toLowerCase();
  const catSuggestions = (term
    ? categories.filter((c) => c.nombre.toLowerCase().includes(term))
    : categories
  ).slice(0, 5);
  const selectedCat = categories.find((c) => c.nombre.toLowerCase() === term);

  const handleCreateCategory = async () => {
    const nombre = newCatName.trim();
    if (!nombre) return;
    setSavingCat(true);
    try {
      const res = await categoriesService.create({ nombre, icono: newCatIcon });
      await loadCategories();
      setCategoria(res.data?.nombre || nombre);
      setCatModalOpen(false);
      setNewCatName("");
      setNewCatIcon("🏷️");
    } catch {
      // reintenta el usuario
    } finally {
      setSavingCat(false);
    }
  };

  // Al abrir: precargar (edición) o resetear (nuevo)
  useEffect(() => {
    if (!visible) return;
    if (editMovement) {
      setMonto(String(editMovement.monto ?? ""));
      setCategoria(editMovement.categoria || "");
      setDetalle(editMovement.detalle || "");
      setMoneda(editMovement.moneda === "USD" ? "USD" : "ARS");
      setMedio(editMovement.medio === "transferencia" ? "transferencia" : "efectivo");
      setFrecuencia(editMovement.frecuencia || "mensual");
      setDeudaAcreedor(editMovement.deudaAcreedor || "");
      setFecha(new Date(`${String(editMovement.fecha).slice(0, 10)}T12:00:00`));
    } else {
      setMonto("");
      setCategoria("");
      setDetalle("");
      setMoneda(defaultCurrency === "USD" ? "USD" : "ARS");
      setMedio("efectivo");
      setFrecuencia("mensual");
      setDeudaAcreedor("");
      setFecha(new Date());
    }
    setError("");
    setSaving(false);
  }, [visible, modeKey, editMovement, defaultCurrency]);

  const handleSave = async () => {
    setError("");
    const amount = parseFloat(monto);
    if (!monto || Number.isNaN(amount) || amount <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    if (!categoria.trim()) {
      setError("La categoría es obligatoria.");
      return;
    }
    if (isDebt && !deudaAcreedor.trim()) {
      setError("Indicá a quién le debés ese monto.");
      return;
    }

    // Guarda "usar ahorro": no dejar gastar más de lo ahorrado (por moneda).
    // Corta del lado del cliente aunque el backend todavía no valide.
    if (mode.desdeAhorro) {
      const cur = moneda === "USD" ? "USD" : "ARS";
      let disponible = 0;
      for (const m of movimientos) {
        if ((m.moneda || "ARS") !== cur) continue;
        if (editMovement && m._id === editMovement._id) continue;
        const amt = Number(m.monto) || 0;
        if (m.tipo === "ahorro") disponible += amt;
        else if (m.desdeAhorro) disponible -= amt;
      }
      if (amount > disponible) {
        setSavingsPopup(
          disponible <= 0
            ? "Ya gastaste tus ahorros. Cargá más ahorro para seguir gastando desde ahí."
            : `Te queda ${formatMoney(disponible, cur)} de ahorro disponible. Cargá más ahorro para gastar ese monto.`
        );
        return;
      }
    }

    setSaving(true);
    const payload = {
      tipo: mode.tipo,
      monto: amount,
      categoria: categoria.trim(),
      fecha: toYMD(fecha),
      detalle: detalle.trim(),
      moneda: moneda === "USD" ? "USD" : "ARS",
      medio,
      esRecurrente: mode.recurrente,
      frecuencia: mode.recurrente ? frecuencia : null,
      deudaAcreedor: isDebt ? deudaAcreedor.trim() : "",
      desdeAhorro: Boolean(mode.desdeAhorro),
    };
    try {
      if (editMovement) {
        await movimientoService.update(editMovement._id, payload);
      } else {
        await movimientoService.create(payload);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "AHORRO_INSUFICIENTE") {
        setSavingsPopup(data.error || "Ya gastaste tus ahorros. Cargá más para seguir gastando desde ahí.");
      } else {
        setError(data?.error || "No se pudo guardar el movimiento.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.sheet, { backgroundColor: cardColor }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: INK }]}>{editMovement ? "Editar movimiento" : mode.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={INK} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Monto</Text>
            <MoneyInput
              style={styles.input}
              value={monto}
              onChangeText={setMonto}
              placeholder="0"
              placeholderTextColor={INK_SOFT}
            />

            {/* Moneda */}
            <Text style={styles.label}>Moneda</Text>
            <View style={styles.toggleRow}>
              {["ARS", "USD"].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.toggle, moneda === c && styles.toggleActive]}
                  onPress={() => setMoneda(c)}
                >
                  <Text style={[styles.toggleText, moneda === c && styles.toggleTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Categoría</Text>
            <View style={styles.catInputRow}>
              {selectedCat ? <Text style={styles.catIcon}>{selectedCat.icono}</Text> : null}
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={categoria}
                onChangeText={setCategoria}
                onFocus={() => setCatFocused(true)}
                onBlur={() => setTimeout(() => setCatFocused(false), 150)}
                placeholder="Ej: Sueldo, Supermercado..."
                placeholderTextColor={INK_SOFT}
              />
            </View>
            {catFocused ? (
              <View style={styles.catDropdown}>
                {/* Crear siempre como primera opción */}
                <TouchableOpacity
                  style={[styles.catOption, styles.catOptionNew]}
                  onPress={() => {
                    setNewCatName(categoria.trim());
                    setCatModalOpen(true);
                    setCatFocused(false);
                  }}
                >
                  <View style={styles.catNewPlus}>
                    <Ionicons name="add" size={13} color={colors.segActive} />
                  </View>
                  <Text style={styles.catOptionNewText}>
                    Nueva categoría{categoria.trim() ? ` “${categoria.trim()}”` : ""}
                  </Text>
                </TouchableOpacity>

                {catSuggestions.map((c) => (
                  <TouchableOpacity
                    key={c._id}
                    style={styles.catOption}
                    onPress={() => {
                      setCategoria(c.nombre);
                      setCatFocused(false);
                    }}
                  >
                    <Text style={styles.catOptionIcon}>{c.icono}</Text>
                    <Text style={styles.catOptionText}>{c.nombre}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>Detalle (opcional)</Text>
            <TextInput
              style={styles.input}
              value={detalle}
              onChangeText={setDetalle}
              placeholder="Una nota corta"
              placeholderTextColor={INK_SOFT}
            />

            {/* Fecha */}
            <Text style={styles.label}>Fecha</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowDate(true)}>
              <Text style={{ color: INK, fontSize: 16 }}>{toYMD(fecha)}</Text>
            </TouchableOpacity>
            {showDate && (
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                themeVariant={isDark ? "dark" : "light"}
                onChange={(event, selected) => {
                  if (Platform.OS !== "ios") setShowDate(false);
                  if (selected) setFecha(selected);
                }}
              />
            )}

            {/* Medio (también para deuda: efectivo o transferencia) */}
            <Text style={styles.label}>Medio</Text>
            <View style={styles.toggleRow}>
              {[
                { v: "efectivo", l: "Efectivo" },
                { v: "transferencia", l: "Transferencia" },
              ].map((m) => (
                <TouchableOpacity
                  key={m.v}
                  style={[styles.toggle, medio === m.v && styles.toggleActive]}
                  onPress={() => setMedio(m.v)}
                >
                  <Text style={[styles.toggleText, medio === m.v && styles.toggleTextActive]}>
                    {m.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Deuda: acreedor */}
            {isDebt && (
              <>
                <Text style={styles.label}>¿A quién le debés?</Text>
                <TextInput
                  style={styles.input}
                  value={deudaAcreedor}
                  onChangeText={setDeudaAcreedor}
                  placeholder="Nombre del acreedor"
                  placeholderTextColor={INK_SOFT}
                />
              </>
            )}

            {/* Frecuencia (solo modos fijos) */}
            {mode.recurrente && (
              <>
                <Text style={styles.label}>Frecuencia</Text>
                <View style={styles.freqCol}>
                  {FRECUENCIAS.map((f) => (
                    <TouchableOpacity
                      key={f.value}
                      style={[styles.toggle, frecuencia === f.value && styles.toggleActive]}
                      onPress={() => setFrecuencia(f.value)}
                    >
                      <Text style={[styles.toggleText, frecuencia === f.value && styles.toggleTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: INK }, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>
                  {editMovement ? "Guardar cambios" : `Guardar ${mode.title.toLowerCase()}`}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Alta de categoría con ícono */}
      <Modal
        visible={catModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setCatModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.catOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.catModal}>
            <Text style={styles.catModalTitle}>Nueva categoría</Text>

            <TextInput
              style={styles.input}
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="Nombre (ej: Comida)"
              placeholderTextColor={INK_SOFT}
              maxLength={40}
              autoFocus
            />

            <Text style={styles.catModalLabel}>Ícono</Text>
            <ScrollView
              style={styles.catEmojiScroll}
              contentContainerStyle={styles.catEmojiGrid}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {CATEGORY_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.catEmoji, newCatIcon === emoji && styles.catEmojiActive]}
                  onPress={() => setNewCatIcon(emoji)}
                >
                  <Text style={{ fontSize: 19 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.catModalActions}>
              <TouchableOpacity
                style={styles.catCancelBtn}
                onPress={() => setCatModalOpen(false)}
              >
                <Text style={styles.catCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.catSaveBtn, (savingCat || !newCatName.trim()) && { opacity: 0.5 }]}
                onPress={handleCreateCategory}
                disabled={savingCat || !newCatName.trim()}
              >
                {savingCat ? (
                  <ActivityIndicator color="#04140b" size="small" />
                ) : (
                  <Text style={styles.catSaveText}>Crear {newCatIcon}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Popup centrado: en RN un <Modal> hermano no se muestra sobre otro
          <Modal>, por eso va como overlay absoluto dentro del formulario. */}
      {savingsPopup ? (
        <Pressable style={styles.popupOverlay} onPress={closeSavingsPopup}>
          <Pressable style={styles.popupCard} onPress={() => {}}>
            <View style={styles.popupIconWrap}>
              <Ionicons name="warning" size={32} color="#ffcf33" style={styles.popupIconGlow} />
            </View>
            <Text style={styles.popupText}>{savingsPopup}</Text>
            <TouchableOpacity style={styles.popupBtn} onPress={closeSavingsPopup}>
              <Text style={styles.popupBtnText}>Cargar ahorro</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      ) : null}
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,20,15,0.4)", justifyContent: "flex-end" },
  popupOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  popupCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 22,
    alignItems: "center",
    gap: 14,
  },
  popupIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,207,51,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  popupIconGlow: {
    textShadowColor: "rgba(255,207,51,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  popupText: { color: colors.text, fontSize: 15, fontWeight: "700", textAlign: "center", lineHeight: 21 },
  popupBtn: {
    marginTop: 4,
    backgroundColor: colors.greenBright,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  popupBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  toneDot: { width: 12, height: 12, borderRadius: 6 },
  title: { flex: 1, color: colors.text, fontSize: 20, fontWeight: "800" },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  // Sobre la tarjeta de color: rótulos y textos en tinta oscura
  label: {
    color: INK,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.10)",
    borderColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: INK,
    fontSize: 16,
  },
  toggleRow: { flexDirection: "row", gap: 8 },
  freqCol: { gap: 8 },
  toggle: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.22)",
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  toggleActive: { backgroundColor: INK, borderColor: INK },
  toggleText: { color: INK, fontWeight: "700" },
  toggleTextActive: { color: "#ffffff" },
  // ===== Categorías =====
  catInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  catOptionNew: { backgroundColor: "rgba(0,0,0,0.06)" },
  catOptionNewText: { color: INK, fontSize: 14.5, fontWeight: "700", flex: 1 },
  catNewPlus: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  catIcon: { fontSize: 20 },
  catDropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.22)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.88)",
    overflow: "hidden",
  },
  catOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  catOptionIcon: { fontSize: 17 },
  catOptionText: { color: INK, fontSize: 15, fontWeight: "600" },
  catOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  catModal: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "85%",
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  catEmojiScroll: { maxHeight: 200, alignSelf: "stretch" },
  catModalTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  catModalLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  catEmojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  catEmoji: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  catEmojiActive: { borderColor: colors.segActive, backgroundColor: colors.greenSoft },
  catModalActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 4 },
  catCancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  catCancelText: { color: colors.text, fontWeight: "700" },
  catSaveBtn: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: colors.segActive,
  },
  catSaveText: { color: colors.segActiveText, fontWeight: "800" },

  error: { color: "#8a1c1c", marginTop: 12, fontWeight: "700" },
  saveBtn: {
    marginTop: 22,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
