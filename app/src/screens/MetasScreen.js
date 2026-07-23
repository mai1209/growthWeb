import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { metaService } from "../api";
import { useTheme } from "../theme";

const HORIZONTES = [
  { value: "corto", label: "Corto plazo" },
  { value: "mediano", label: "Mediano plazo" },
  { value: "largo", label: "Largo plazo" },
];

const MEDICIONES = [
  { value: "hitos", label: "Por hitos" },
  { value: "numero", label: "Por número" },
  { value: "manual", label: "Manual" },
];

const AREAS = ["Finanzas", "Salud", "Carrera", "Personal", "Aprendizaje"];

// Colores por plazo (los mismos que la web).
const PLAZO_COLORS = { corto: "#5b8ad6", mediano: "#c9a23a", largo: "#b06ad6" };

const FORM_VACIO = {
  id: null,
  titulo: "",
  descripcion: "",
  horizonte: "corto",
  area: "",
  fechaObjetivo: "",
  medicion: "hitos",
  hitos: [],
  objetivoNumero: "",
  actualNumero: "",
  unidad: "",
  progresoManual: 0,
};

const hoyLocal = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const progressOf = (m) => {
  if (m.estado === "completada") return 100;
  if (m.medicion === "hitos") {
    const total = m.hitos?.length || 0;
    if (!total) return 0;
    return Math.round((100 * m.hitos.filter((h) => h.hecho).length) / total);
  }
  if (m.medicion === "numero") {
    const objetivo = Number(m.objetivoNumero) || 0;
    if (objetivo <= 0) return 0;
    return Math.min(100, Math.round((100 * (Number(m.actualNumero) || 0)) / objetivo));
  }
  return Math.min(100, Math.max(0, Math.round(Number(m.progresoManual) || 0)));
};

const daysUntil = (fecha) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) return null;
  const [y, m, d] = fecha.split("-").map(Number);
  const [hy, hm, hd] = hoyLocal().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86400000);
};

const dueLabel = (m) => {
  if (m.estado === "completada") {
    return m.completadaEn
      ? `Completada el ${m.completadaEn.split("-").reverse().join("/")}`
      : "Completada";
  }
  const dias = daysUntil(m.fechaObjetivo);
  if (dias === null) return "Sin fecha límite";
  if (dias === 0) return "Vence hoy";
  if (dias > 0) return dias === 1 ? "Falta 1 día" : `Faltan ${dias} días`;
  return `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`;
};

const fmtNum = (n) => Number(n || 0).toLocaleString("es-AR");

const horizonteLabel = (value) => HORIZONTES.find((h) => h.value === value)?.label || value;

export default function MetasScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  const [metas, setMetas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [horizonteFiltro, setHorizonteFiltro] = useState("todas");
  const [estadoFiltro, setEstadoFiltro] = useState("activa");
  const [detalle, setDetalle] = useState(null);
  const [form, setForm] = useState(null);
  const [hitoNuevo, setHitoNuevo] = useState("");
  const [numeroNuevo, setNumeroNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const { data } = await metaService.getAll();
      setMetas(Array.isArray(data) ? data : []);
    } catch {
      /* dejamos lo que haya */
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const reemplazar = (metaActualizada) => {
    setMetas((prev) => prev.map((m) => (m._id === metaActualizada._id ? metaActualizada : m)));
    setDetalle((prev) => (prev && prev._id === metaActualizada._id ? metaActualizada : prev));
  };

  const actualizar = async (meta, cambios) => {
    try {
      const { data } = await metaService.update(meta._id, cambios);
      reemplazar(data);
    } catch {
      /* optimista: queda lo local */
    }
  };

  const toggleHito = (meta, indice) => {
    const hitos = meta.hitos.map((h, i) => (i === indice ? { ...h, hecho: !h.hecho } : h));
    reemplazar({ ...meta, hitos });
    actualizar(meta, { hitos });
  };

  const agregarHito = (meta) => {
    const texto = hitoNuevo.trim();
    if (!texto) return;
    const hitos = [...(meta.hitos || []), { texto, hecho: false }];
    setHitoNuevo("");
    reemplazar({ ...meta, hitos });
    actualizar(meta, { hitos });
  };

  const borrarHito = (meta, indice) => {
    const hitos = meta.hitos.filter((_, i) => i !== indice);
    reemplazar({ ...meta, hitos });
    actualizar(meta, { hitos });
  };

  const registrarAvance = (meta) => {
    const valor = Number(numeroNuevo);
    if (!Number.isFinite(valor)) return;
    setNumeroNuevo("");
    reemplazar({ ...meta, actualNumero: valor });
    actualizar(meta, { actualNumero: valor });
  };

  const ajustarManual = (meta, delta) => {
    const valor = Math.min(100, Math.max(0, (Number(meta.progresoManual) || 0) + delta));
    reemplazar({ ...meta, progresoManual: valor });
    actualizar(meta, { progresoManual: valor });
  };

  const cambiarEstado = (meta, estado) => {
    reemplazar({ ...meta, estado, completadaEn: estado === "completada" ? hoyLocal() : "" });
    actualizar(meta, { estado, fechaLocal: hoyLocal() });
  };

  const eliminar = (meta) => {
    Alert.alert("Eliminar meta", `¿Borrar "${meta.titulo}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await metaService.delete(meta._id);
            setMetas((prev) => prev.filter((m) => m._id !== meta._id));
            setDetalle(null);
          } catch {
            /* nada */
          }
        },
      },
    ]);
  };

  const abrirCrear = () => setForm({ ...FORM_VACIO });

  const abrirEditar = (meta) => {
    setForm({
      id: meta._id,
      titulo: meta.titulo || "",
      descripcion: meta.descripcion || "",
      horizonte: meta.horizonte || "corto",
      area: meta.area || "",
      fechaObjetivo: meta.fechaObjetivo || "",
      medicion: meta.medicion || "hitos",
      hitos: (meta.hitos || []).map((h) => ({ ...h })),
      objetivoNumero: String(meta.objetivoNumero || ""),
      actualNumero: String(meta.actualNumero || ""),
      unidad: meta.unidad || "",
      progresoManual: meta.progresoManual || 0,
    });
  };

  const guardarForm = async () => {
    if (!form.titulo.trim() || guardando) return;
    setGuardando(true);
    const payload = {
      titulo: form.titulo,
      descripcion: form.descripcion,
      horizonte: form.horizonte,
      area: form.area,
      fechaObjetivo: form.fechaObjetivo,
      medicion: form.medicion,
      hitos: form.hitos,
      objetivoNumero: Number(form.objetivoNumero) || 0,
      actualNumero: Number(form.actualNumero) || 0,
      unidad: form.unidad,
      progresoManual: Number(form.progresoManual) || 0,
    };
    try {
      if (form.id) {
        const { data } = await metaService.update(form.id, payload);
        reemplazar(data);
      } else {
        const { data } = await metaService.create(payload);
        setMetas((prev) => [data, ...prev]);
      }
      setForm(null);
    } catch {
      /* reintenta guardando de nuevo */
    } finally {
      setGuardando(false);
    }
  };

  const visibles = useMemo(
    () =>
      metas.filter((m) => {
        if (horizonteFiltro !== "todas" && m.horizonte !== horizonteFiltro) return false;
        if (estadoFiltro !== "todas" && m.estado !== estadoFiltro) return false;
        return true;
      }),
    [metas, horizonteFiltro, estadoFiltro]
  );

  const stats = useMemo(() => {
    const activas = metas.filter((m) => m.estado === "activa");
    const completadas = metas.filter((m) => m.estado === "completada");
    const promedio = activas.length
      ? Math.round(activas.reduce((acc, m) => acc + progressOf(m), 0) / activas.length)
      : 0;
    return { activas: activas.length, completadas: completadas.length, promedio };
  }, [metas]);

  // Distribución por plazo (sin las completadas) para la barra apilada.
  const plazoItems = useMemo(() => {
    const items = HORIZONTES.map((h) => ({
      ...h,
      color: PLAZO_COLORS[h.value],
      value: metas.filter((m) => m.horizonte === h.value && m.estado !== "completada").length,
    }));
    const total = items.reduce((a, i) => a + i.value, 0);
    return { items, total };
  }, [metas]);

  const barrasAvance = useMemo(
    () =>
      metas
        .filter((m) => m.estado === "activa")
        .map((m) => ({ id: m._id, titulo: m.titulo, progreso: progressOf(m), horizonte: m.horizonte }))
        .sort((a, b) => b.progreso - a.progreso)
        .slice(0, 5),
    [metas]
  );

  const medidaLabel = (m) => {
    if (m.medicion === "hitos") {
      const hechos = (m.hitos || []).filter((h) => h.hecho).length;
      return `${hechos} de ${(m.hitos || []).length} hitos`;
    }
    if (m.medicion === "numero") {
      return `${m.unidad}${fmtNum(m.actualNumero)} de ${m.unidad}${fmtNum(m.objetivoNumero)}`;
    }
    return "Avance manual";
  };

  /* ===== Render ===== */

  const renderProgress = (progreso) => (
    <View style={styles.progressRow}>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progreso}%` },
            progreso >= 100 && { backgroundColor: colors.segActive },
          ]}
        />
      </View>
      <Text style={styles.progressPct}>{progreso}%</Text>
    </View>
  );

  const renderCard = (meta) => {
    const progreso = progressOf(meta);
    const dias = daysUntil(meta.fechaObjetivo);
    const vencida = meta.estado === "activa" && dias !== null && dias < 0;

    return (
      <TouchableOpacity
        key={meta._id}
        style={[
          styles.card,
          meta.estado === "completada" && styles.cardCompletada,
          meta.estado === "pausada" && { opacity: 0.6 },
        ]}
        onPress={() => setDetalle(meta)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={[styles.pill, { backgroundColor: `${PLAZO_COLORS[meta.horizonte]}29` }]}>
            <Text style={[styles.pillText, { color: PLAZO_COLORS[meta.horizonte] }]}>
              {horizonteLabel(meta.horizonte)}
            </Text>
          </View>
          {meta.area ? (
            <View style={styles.pillArea}>
              <Text style={styles.pillAreaText}>{meta.area}</Text>
            </View>
          ) : null}
          {meta.estado === "pausada" ? (
            <View style={styles.pillArea}>
              <Text style={styles.pillAreaText}>En pausa</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.cardTitulo}>{meta.titulo}</Text>
        {meta.descripcion ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {meta.descripcion}
          </Text>
        ) : null}

        {renderProgress(progreso)}

        <View style={styles.cardFoot}>
          <Text style={styles.medida}>{medidaLabel(meta)}</Text>
          <Text style={[styles.due, vencida && { color: colors.red }]}>{dueLabel(meta)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const chipRow = (opciones, valor, onChange) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      {opciones.map((o) => {
        const activo = valor === o.value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.chip, activo && styles.chipActivo]}
            onPress={() => onChange(o.value)}
          >
            <Text style={[styles.chipText, activo && styles.chipTextActivo]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  /* ===== Detalle ===== */
  const renderDetalle = () => {
    const meta = detalle;
    const progreso = progressOf(meta);
    const todosHechos =
      meta.medicion === "hitos" && meta.hitos.length > 0 && meta.hitos.every((h) => h.hecho);

    return (
      <Modal visible animationType="slide" onRequestClose={() => setDetalle(null)}>
        <View style={[styles.modalSafe, { paddingTop: insets.top }]}>
          <View style={styles.modalHead}>
            <TouchableOpacity onPress={() => setDetalle(null)} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.iconBtn} onPress={() => abrirEditar(meta)}>
              <Ionicons name="pencil" size={18} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => eliminar(meta)}>
              <Ionicons name="trash-outline" size={18} color={colors.red} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.cardTop}>
              <View style={[styles.pill, { backgroundColor: `${PLAZO_COLORS[meta.horizonte]}29` }]}>
                <Text style={[styles.pillText, { color: PLAZO_COLORS[meta.horizonte] }]}>
                  {horizonteLabel(meta.horizonte)}
                </Text>
              </View>
              {meta.area ? (
                <View style={styles.pillArea}>
                  <Text style={styles.pillAreaText}>{meta.area}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.detalleTitulo}>{meta.titulo}</Text>
            {meta.descripcion ? <Text style={styles.detalleDesc}>{meta.descripcion}</Text> : null}
            <Text style={styles.detalleDue}>{dueLabel(meta)}</Text>

            {renderProgress(progreso)}

            {meta.medicion === "hitos" ? (
              <View style={styles.box}>
                <Text style={styles.boxLabel}>HITOS</Text>
                {meta.hitos.length === 0 ? (
                  <Text style={styles.boxVacio}>
                    Sumá pasos chicos: hacen que la meta grande se sienta alcanzable.
                  </Text>
                ) : (
                  meta.hitos.map((hito, indice) => (
                    <View key={indice} style={styles.hitoItem}>
                      <TouchableOpacity
                        style={[styles.hitoCheck, hito.hecho && styles.hitoCheckOn]}
                        onPress={() => toggleHito(meta, indice)}
                      >
                        {hito.hecho ? <Ionicons name="checkmark" size={14} color="#0e1a0e" /> : null}
                      </TouchableOpacity>
                      <Text style={[styles.hitoTexto, hito.hecho && styles.hitoHecho]}>
                        {hito.texto}
                      </Text>
                      <TouchableOpacity onPress={() => borrarHito(meta, indice)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={colors.muted} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
                <View style={styles.addRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={hitoNuevo}
                    onChangeText={setHitoNuevo}
                    placeholder="Nuevo hito…"
                    placeholderTextColor={colors.muted}
                    onSubmitEditing={() => agregarHito(meta)}
                  />
                  <TouchableOpacity style={styles.btnChico} onPress={() => agregarHito(meta)}>
                    <Ionicons name="add" size={16} color={colors.green} />
                    <Text style={styles.btnChicoText}>Agregar</Text>
                  </TouchableOpacity>
                </View>
                {todosHechos && meta.estado === "activa" ? (
                  <Text style={styles.festejo}>🎉 ¡Todos los hitos cumplidos! Marcala como completada.</Text>
                ) : null}
              </View>
            ) : null}

            {meta.medicion === "numero" ? (
              <View style={styles.box}>
                <Text style={styles.boxLabel}>AVANCE</Text>
                <Text style={styles.numeroActual}>
                  {meta.unidad}
                  {fmtNum(meta.actualNumero)}{" "}
                  <Text style={styles.numeroObjetivo}>
                    de {meta.unidad}
                    {fmtNum(meta.objetivoNumero)}
                  </Text>
                </Text>
                <View style={styles.addRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={numeroNuevo}
                    onChangeText={setNumeroNuevo}
                    keyboardType="numeric"
                    placeholder="Nuevo valor acumulado"
                    placeholderTextColor={colors.muted}
                    onSubmitEditing={() => registrarAvance(meta)}
                  />
                  <TouchableOpacity style={styles.btnChico} onPress={() => registrarAvance(meta)}>
                    <Ionicons name="checkmark" size={16} color={colors.green} />
                    <Text style={styles.btnChicoText}>Registrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {meta.medicion === "manual" ? (
              <View style={styles.box}>
                <Text style={styles.boxLabel}>AVANCE MANUAL</Text>
                <View style={styles.manualRow}>
                  <TouchableOpacity style={styles.manualBtn} onPress={() => ajustarManual(meta, -5)}>
                    <Ionicons name="remove" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.manualValor}>{meta.progresoManual || 0}%</Text>
                  <TouchableOpacity style={styles.manualBtn} onPress={() => ajustarManual(meta, 5)}>
                    <Ionicons name="add" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.accionesRow}>
              {meta.estado === "activa" ? (
                <>
                  <TouchableOpacity
                    style={styles.btnCompletar}
                    onPress={() => cambiarEstado(meta, "completada")}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.btnCompletarText}>Marcar completada</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnSecundario}
                    onPress={() => cambiarEstado(meta, "pausada")}
                  >
                    <Ionicons name="pause" size={16} color={colors.muted} />
                    <Text style={styles.btnSecundarioText}>Pausar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.btnCompletar}
                  onPress={() => cambiarEstado(meta, "activa")}
                >
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.btnCompletarText}>
                    {meta.estado === "completada" ? "Reabrir meta" : "Reactivar"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  /* ===== Formulario ===== */
  const renderForm = () => (
    <Modal visible animationType="slide" onRequestClose={() => setForm(null)}>
      <View style={[styles.modalSafe, { paddingTop: insets.top }]}>
        <View style={styles.modalHead}>
          <TouchableOpacity onPress={() => setForm(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitulo}>{form.id ? "Editar meta" : "Nueva meta"}</Text>
          <View style={{ width: 30 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top + 8}
        >
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.campoLabel}>¿Qué querés lograr?</Text>
            <TextInput
              style={styles.input}
              value={form.titulo}
              onChangeText={(v) => setForm({ ...form, titulo: v })}
              placeholder="Ej: Ahorrar para el viaje"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.campoLabel}>Detalle (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={form.descripcion}
              onChangeText={(v) => setForm({ ...form, descripcion: v })}
              placeholder="Por qué importa, cómo lo vas a encarar…"
              placeholderTextColor={colors.muted}
              multiline
            />

            <Text style={styles.campoLabel}>Plazo</Text>
            <View style={styles.chipsWrap}>
              {HORIZONTES.map((h) => {
                const activo = form.horizonte === h.value;
                return (
                  <TouchableOpacity
                    key={h.value}
                    style={[styles.chip, activo && styles.chipActivo]}
                    onPress={() => setForm({ ...form, horizonte: h.value })}
                  >
                    <Text style={[styles.chipText, activo && styles.chipTextActivo]}>{h.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.campoLabel}>Área</Text>
            <TextInput
              style={styles.input}
              value={form.area}
              onChangeText={(v) => setForm({ ...form, area: v })}
              placeholder="Finanzas, Salud…"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.chipsWrap}>
              {AREAS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.chip, form.area === a && styles.chipActivo]}
                  onPress={() => setForm({ ...form, area: a })}
                >
                  <Text style={[styles.chipText, form.area === a && styles.chipTextActivo]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.campoLabel}>Fecha objetivo (opcional)</Text>
            <View style={styles.addRow}>
              <TouchableOpacity style={[styles.input, styles.dateBtn]} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={16} color={colors.muted} />
                <Text style={form.fechaObjetivo ? styles.dateText : styles.datePlaceholder}>
                  {form.fechaObjetivo
                    ? form.fechaObjetivo.split("-").reverse().join("/")
                    : "Elegir fecha"}
                </Text>
              </TouchableOpacity>
              {form.fechaObjetivo ? (
                <TouchableOpacity
                  style={styles.btnChico}
                  onPress={() => setForm({ ...form, fechaObjetivo: "" })}
                >
                  <Ionicons name="close" size={16} color={colors.muted} />
                  <Text style={styles.btnChicoText}>Quitar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {showDatePicker ? (
              <DateTimePicker
                value={
                  form.fechaObjetivo
                    ? new Date(`${form.fechaObjetivo}T12:00:00`)
                    : new Date()
                }
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selected) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (selected) {
                    const local = new Date(
                      selected.getTime() - selected.getTimezoneOffset() * 60000
                    );
                    setForm((prev) => ({ ...prev, fechaObjetivo: local.toISOString().slice(0, 10) }));
                  }
                }}
              />
            ) : null}

            <Text style={styles.campoLabel}>¿Cómo medís el avance?</Text>
            <View style={styles.chipsWrap}>
              {MEDICIONES.map((m) => {
                const activo = form.medicion === m.value;
                return (
                  <TouchableOpacity
                    key={m.value}
                    style={[styles.chip, activo && styles.chipActivo]}
                    onPress={() => setForm({ ...form, medicion: m.value })}
                  >
                    <Text style={[styles.chipText, activo && styles.chipTextActivo]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {form.medicion === "numero" ? (
              <View style={styles.numRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.campoLabel}>Objetivo</Text>
                  <TextInput
                    style={styles.input}
                    value={String(form.objetivoNumero)}
                    onChangeText={(v) => setForm({ ...form, objetivoNumero: v })}
                    keyboardType="numeric"
                    placeholder="500000"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.campoLabel}>Llevás</Text>
                  <TextInput
                    style={styles.input}
                    value={String(form.actualNumero)}
                    onChangeText={(v) => setForm({ ...form, actualNumero: v })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={{ width: 90 }}>
                  <Text style={styles.campoLabel}>Unidad</Text>
                  <TextInput
                    style={styles.input}
                    value={form.unidad}
                    onChangeText={(v) => setForm({ ...form, unidad: v })}
                    placeholder="$"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>
            ) : null}

            {form.medicion === "hitos" ? (
              <>
                <Text style={styles.campoLabel}>Hitos iniciales</Text>
                {form.hitos.map((hito, indice) => (
                  <View key={indice} style={styles.addRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={hito.texto}
                      onChangeText={(v) =>
                        setForm({
                          ...form,
                          hitos: form.hitos.map((h, i) => (i === indice ? { ...h, texto: v } : h)),
                        })
                      }
                      placeholder={`Hito ${indice + 1}`}
                      placeholderTextColor={colors.muted}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setForm({ ...form, hitos: form.hitos.filter((_, i) => i !== indice) })
                      }
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.btnChico, { alignSelf: "flex-start" }]}
                  onPress={() => setForm({ ...form, hitos: [...form.hitos, { texto: "", hecho: false }] })}
                >
                  <Ionicons name="add" size={16} color={colors.green} />
                  <Text style={styles.btnChicoText}>Agregar hito</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </ScrollView>

          <View style={[styles.modalFoot, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={[styles.btnGuardar, (!form.titulo.trim() || guardando) && { opacity: 0.5 }]}
              onPress={guardarForm}
              disabled={!form.titulo.trim() || guardando}
            >
              <Text style={styles.btnGuardarText}>
                {guardando ? "Guardando…" : form.id ? "Guardar cambios" : "Crear meta"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>METAS</Text>
          <Text style={styles.title}>Tus metas</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={abrirCrear}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newBtnText}>Nueva meta</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                cargar();
              }}
              tintColor={colors.green}
            />
          }
        >
          {/* Resumen */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNumero}>{stats.activas}</Text>
              <Text style={styles.statLabel}>En curso</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumero}>{stats.completadas}</Text>
              <Text style={styles.statLabel}>Completadas</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumero}>{stats.promedio}%</Text>
              <Text style={styles.statLabel}>Avance prom.</Text>
            </View>
          </View>

          {/* Gráfico: distribución por plazo (barra apilada) */}
          {plazoItems.total > 0 ? (
            <View style={styles.box}>
              <Text style={styles.boxLabel}>METAS POR PLAZO</Text>
              <View style={styles.stackTrack}>
                {plazoItems.items
                  .filter((i) => i.value > 0)
                  .map((i) => (
                    <View
                      key={i.value + i.label}
                      style={{
                        flex: i.value,
                        backgroundColor: i.color,
                      }}
                    />
                  ))}
              </View>
              <View style={styles.legendRow}>
                {plazoItems.items.map((i) => (
                  <View key={i.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: i.color }]} />
                    <Text style={styles.legendText}>
                      {i.label} · {i.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Gráfico: avance de las activas */}
          {barrasAvance.length > 0 ? (
            <View style={styles.box}>
              <Text style={styles.boxLabel}>AVANCE DE TUS METAS ACTIVAS</Text>
              {barrasAvance.map((b) => (
                <View key={b.id} style={styles.barRow}>
                  <Text style={styles.barNombre} numberOfLines={1}>
                    {b.titulo}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${b.progreso}%`, backgroundColor: PLAZO_COLORS[b.horizonte] },
                      ]}
                    />
                  </View>
                  <Text style={styles.barPct}>{b.progreso}%</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Filtros */}
          {chipRow(
            [{ value: "todas", label: "Todas" }, ...HORIZONTES],
            horizonteFiltro,
            setHorizonteFiltro
          )}
          {chipRow(
            [
              { value: "activa", label: "Activas" },
              { value: "pausada", label: "Pausadas" },
              { value: "completada", label: "Completadas" },
              { value: "todas", label: "Todas" },
            ],
            estadoFiltro,
            setEstadoFiltro
          )}

          {/* Lista */}
          {visibles.length === 0 ? (
            <View style={styles.vacioBox}>
              <Ionicons name="flag-outline" size={30} color={colors.green} />
              <Text style={styles.vacioTitulo}>
                {metas.length === 0 ? "Todavía no tenés metas" : "Nada con estos filtros"}
              </Text>
              <Text style={styles.vacioTexto}>
                {metas.length === 0
                  ? "Arrancá con una meta corta y concreta: es la forma más fácil de agarrar ritmo."
                  : "Probá cambiando el plazo o el estado."}
              </Text>
            </View>
          ) : (
            visibles.map(renderCard)
          )}
        </ScrollView>
      )}

      {detalle ? renderDetalle() : null}
      {form ? renderForm() : null}
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 10,
    },
    kicker: { color: colors.greenDark, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
    title: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 3 },
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

    scroll: { paddingHorizontal: 16, paddingBottom: 30, gap: 10 },

    statsRow: { flexDirection: "row", gap: 8 },
    stat: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    statNumero: { color: colors.text, fontSize: 19, fontWeight: "800" },
    statLabel: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 2 },

    box: {
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      gap: 9,
    },
    boxLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
    boxVacio: { color: colors.muted, fontSize: 13 },

    stackTrack: {
      flexDirection: "row",
      height: 10,
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: colors.cardSoft,
    },
    legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 3 },
    legendText: { color: colors.muted, fontSize: 12, fontWeight: "600" },

    barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    barNombre: { width: 110, color: colors.text, fontSize: 12, fontWeight: "700" },
    barTrack: {
      flex: 1,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.cardSoft,
      overflow: "hidden",
    },
    barFill: { height: "100%", borderRadius: 999 },
    barPct: { width: 38, textAlign: "right", color: colors.muted, fontSize: 12, fontWeight: "800" },

    chipsRow: { gap: 7, paddingVertical: 2 },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    chip: {
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    chipActivo: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
    chipText: { color: colors.muted, fontSize: 12.5, fontWeight: "700" },
    chipTextActivo: { color: colors.green },

    card: {
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      gap: 8,
    },
    cardCompletada: { borderColor: colors.greenBorder, backgroundColor: colors.greenSoft },
    cardTop: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
    pill: { paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: 999 },
    pillText: { fontSize: 10.5, fontWeight: "800" },
    pillArea: {
      paddingHorizontal: 9,
      paddingVertical: 3.5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    pillAreaText: { color: colors.muted, fontSize: 10.5, fontWeight: "700" },
    cardTitulo: { color: colors.text, fontSize: 15.5, fontWeight: "800", lineHeight: 20 },
    cardDesc: { color: colors.muted, fontSize: 12.5, lineHeight: 17 },
    cardFoot: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      flexWrap: "wrap",
    },
    medida: { color: colors.muted, fontSize: 11.5, fontWeight: "600" },
    due: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },

    progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    progressTrack: {
      flex: 1,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.cardSoft,
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.greenBright },
    progressPct: {
      width: 40,
      textAlign: "right",
      color: colors.text,
      fontSize: 12.5,
      fontWeight: "800",
    },

    vacioBox: {
      alignItems: "center",
      gap: 6,
      paddingVertical: 34,
      paddingHorizontal: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.cardBorder,
    },
    vacioTitulo: { color: colors.text, fontSize: 15, fontWeight: "800" },
    vacioTexto: { color: colors.muted, fontSize: 12.5, textAlign: "center", lineHeight: 17 },

    /* Modales */
    modalSafe: { flex: 1, backgroundColor: colors.bg },
    modalHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    backBtn: { padding: 4 },
    modalTitulo: { flex: 1, textAlign: "center", color: colors.text, fontSize: 16, fontWeight: "800" },
    iconBtn: { padding: 8 },
    modalScroll: { paddingHorizontal: 16, paddingBottom: 26, gap: 10 },

    detalleTitulo: { color: colors.text, fontSize: 21, fontWeight: "800", lineHeight: 27 },
    detalleDesc: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },
    detalleDue: { color: colors.muted, fontSize: 12, fontWeight: "700" },

    hitoItem: { flexDirection: "row", alignItems: "center", gap: 9 },
    hitoCheck: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    hitoCheckOn: { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
    hitoTexto: { flex: 1, color: colors.text, fontSize: 14 },
    hitoHecho: { color: colors.muted, textDecorationLine: "line-through" },

    addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    input: {
      minHeight: 42,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      color: colors.text,
      fontSize: 14,
    },
    inputMultiline: { minHeight: 64, textAlignVertical: "top" },
    dateBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
    dateText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    datePlaceholder: { color: colors.muted, fontSize: 14 },

    btnChico: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.cardBorder,
    },
    btnChicoText: { color: colors.muted, fontSize: 12.5, fontWeight: "700" },

    festejo: { color: colors.green, fontSize: 13, fontWeight: "700" },
    numeroActual: { color: colors.text, fontSize: 20, fontWeight: "800" },
    numeroObjetivo: { color: colors.muted, fontSize: 13, fontWeight: "600" },

    manualRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18 },
    manualBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    manualValor: { color: colors.text, fontSize: 20, fontWeight: "800", minWidth: 64, textAlign: "center" },

    accionesRow: { flexDirection: "row", gap: 8, marginTop: 4 },
    btnCompletar: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 13,
      backgroundColor: colors.greenBright,
    },
    btnCompletarText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    btnSecundario: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    btnSecundarioText: { color: colors.muted, fontSize: 14, fontWeight: "700" },

    modalFoot: {
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      backgroundColor: colors.bg,
    },
    btnGuardar: {
      alignItems: "center",
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.greenBright,
    },
    btnGuardarText: { color: "#fff", fontSize: 15, fontWeight: "800" },

    campoLabel: {
      color: colors.muted,
      fontSize: 11.5,
      fontWeight: "800",
      letterSpacing: 0.4,
      marginBottom: -2,
    },
    numRow: { flexDirection: "row", gap: 8 },
  });
