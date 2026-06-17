import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { movimientoService } from "../api";
import { useTheme } from "../theme";

// 6 modos = los accesos rápidos de la web
export const MOVEMENT_MODES = {
  "ingreso-fijo": { title: "Ingreso fijo", tipo: "ingreso", recurrente: true, tone: "ingreso" },
  ingreso: { title: "Nuevo ingreso", tipo: "ingreso", recurrente: false, tone: "ingreso" },
  ahorro: { title: "Nuevo ahorro", tipo: "ahorro", recurrente: false, tone: "ahorro" },
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

const FRECUENCIAS = [
  { value: "mensual", label: "Todos los meses" },
  { value: "quincenal", label: "Cada 15 días" },
  { value: "semanal", label: "Todas las semanas" },
];

const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const modeFromMovement = (mov) => {
  if (mov.tipo === "deuda") return "deuda";
  if (mov.esRecurrente) return mov.tipo === "ingreso" ? "ingreso-fijo" : "egreso-fijo";
  return mov.tipo === "ahorro" ? "ahorro" : mov.tipo === "ingreso" ? "ingreso" : "egreso";
};

export default function MovementFormModal({
  visible,
  modeKey,
  editMovement = null,
  defaultCurrency = "ARS",
  onClose,
  onSaved,
}) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const effectiveModeKey = editMovement ? modeFromMovement(editMovement) : modeKey;
  const mode = MOVEMENT_MODES[effectiveModeKey] || MOVEMENT_MODES.ingreso;
  const isDebt = mode.tipo === "deuda";
  const tone = TONE_COLORS[mode.tone] || colors.green;

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

    setSaving(true);
    const payload = {
      tipo: mode.tipo,
      monto: amount,
      categoria: categoria.trim(),
      fecha: toYMD(fecha),
      detalle: detalle.trim(),
      moneda: moneda === "USD" ? "USD" : "ARS",
      medio: isDebt ? undefined : medio,
      esRecurrente: mode.recurrente,
      frecuencia: mode.recurrente ? frecuencia : null,
      deudaAcreedor: isDebt ? deudaAcreedor.trim() : "",
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
      setError(err.response?.data?.error || "No se pudo guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={[styles.toneDot, { backgroundColor: tone }]} />
            <Text style={styles.title}>{editMovement ? "Editar movimiento" : mode.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Monto</Text>
            <TextInput
              style={styles.input}
              value={monto}
              onChangeText={setMonto}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
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
            <TextInput
              style={styles.input}
              value={categoria}
              onChangeText={setCategoria}
              placeholder="Ej: Sueldo, Supermercado..."
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Detalle (opcional)</Text>
            <TextInput
              style={styles.input}
              value={detalle}
              onChangeText={setDetalle}
              placeholder="Una nota corta"
              placeholderTextColor={colors.muted}
            />

            {/* Fecha */}
            <Text style={styles.label}>Fecha</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowDate(true)}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{toYMD(fecha)}</Text>
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

            {/* Medio (no para deuda) */}
            {!isDebt && (
              <>
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
              </>
            )}

            {/* Deuda: acreedor */}
            {isDebt && (
              <>
                <Text style={styles.label}>¿A quién le debés?</Text>
                <TextInput
                  style={styles.input}
                  value={deudaAcreedor}
                  onChangeText={setDeudaAcreedor}
                  placeholder="Nombre del acreedor"
                  placeholderTextColor={colors.muted}
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
              style={[styles.saveBtn, { backgroundColor: tone }, saving && { opacity: 0.6 }]}
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
      </View>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,20,15,0.4)", justifyContent: "flex-end" },
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
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
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
  toggleRow: { flexDirection: "row", gap: 8 },
  freqCol: { gap: 8 },
  toggle: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  toggleActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  toggleText: { color: colors.muted, fontWeight: "700" },
  toggleTextActive: { color: colors.greenDark },
  error: { color: colors.red, marginTop: 12 },
  saveBtn: {
    marginTop: 22,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
