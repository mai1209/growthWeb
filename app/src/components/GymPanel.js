import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme } from "../theme";
import { gymService } from "../api";
import { EJERCICIOS_BASE } from "../utils/ejerciciosBase";

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoyKey = () => dayKey(new Date());
const addDays = (key, delta) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
};
const fechaLabel = (key) => {
  const hoy = hoyKey();
  if (key === hoy) return "Hoy";
  if (key === addDays(hoy, -1)) return "Ayer";
  if (key === addDays(hoy, 1)) return "Mañana";
  return new Date(`${key}T00:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" });
};
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

const DIAS_G = ["D", "L", "M", "M", "J", "V", "S"];
const MESES_G = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const RANGO = { semana: "los últimos 7 días", mes: "los últimos 30 días", anio: "los últimos 12 meses" };

// Path SVG suavizado (curvas).
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export default function GymPanel() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [data, setData] = useState({ ejercicios: [], rutinas: [], entrenos: {} });
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState("registro"); // rutinas | registro | progreso
  const [fecha, setFecha] = useState(hoyKey());
  const timerRef = useRef(null);

  useEffect(() => {
    gymService
      .get()
      .then(({ data: d }) => {
        setData({ ejercicios: d?.ejercicios || [], rutinas: d?.rutinas || [], entrenos: d?.entrenos || {} });
        if (!(d?.rutinas || []).length) setTab("rutinas");
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const push = (partial) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => gymService.update(partial).catch(() => {}), 500);
  };

  const dia = data.entrenos[fecha] || [];
  const guardarDia = (nuevo) => {
    setData((prev) => ({ ...prev, entrenos: { ...prev.entrenos, [fecha]: nuevo } }));
    push({ entrenos: { [fecha]: nuevo } });
  };
  const guardarRutinas = (rutinas) => {
    setData((prev) => ({ ...prev, rutinas }));
    push({ rutinas });
  };

  const historialEj = useMemo(() => {
    const map = new Map();
    Object.values(data.entrenos || {}).forEach((arr) =>
      (arr || []).forEach((e) => {
        const k = norm(e.nombre);
        if (k && !map.has(k)) map.set(k, { nombre: e.nombre, grupo: e.grupo || "" });
      })
    );
    return [...map.values()];
  }, [data.entrenos]);

  const buscarEjercicios = (q) => {
    const nq = norm(q);
    if (nq.length < 1) return EJERCICIOS_BASE.slice(0, 8);
    const propios = [...historialEj, ...(data.ejercicios || [])];
    const dePropios = propios.filter((e) => norm(e.nombre).includes(nq));
    const deBase = EJERCICIOS_BASE.filter(
      (e) => (norm(e.nombre).includes(nq) || norm(e.grupo).includes(nq)) && !dePropios.some((p) => norm(p.nombre) === norm(e.nombre))
    );
    return [...dePropios, ...deBase].slice(0, 8);
  };

  const agregarEjercicio = (ej) => guardarDia([...dia, { id: uid(), nombre: ej.nombre, grupo: ej.grupo || "", sets: [{ kg: 0, reps: 0, hecha: false }] }]);
  const borrarEjercicio = (id) => guardarDia(dia.filter((e) => e.id !== id));
  const editarSets = (id, sets) => guardarDia(dia.map((e) => (e.id === id ? { ...e, sets } : e)));
  const vaciarDia = () =>
    Alert.alert("Vaciar día", "Se borran los ejercicios de este día y podés asignar otra rutina.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Vaciar", style: "destructive", onPress: () => guardarDia([]) },
    ]);
  const usarRutina = (r) => {
    const nuevos = (r.ejercicios || []).map((e) => ({
      id: uid(),
      nombre: e.nombre,
      grupo: e.grupo || "",
      sets: Array.from({ length: Math.max(1, e.series || 1) }, () => ({ kg: e.kg || 0, reps: e.reps || 0, hecha: false })),
    }));
    guardarDia([...dia, ...nuevos]);
  };

  const TABS = [
    { k: "rutinas", label: "1 · Rutinas" },
    { k: "registro", label: "2 · Entrenar" },
    { k: "progreso", label: "Progreso" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="barbell-outline" size={22} color={colors.greenBright} />
          <Text style={styles.title}>Gym</Text>
        </View>
      </View>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.k} style={[styles.tab, tab === t.k && styles.tabOn]} onPress={() => setTab(t.k)}>
            <Text style={[styles.tabText, tab === t.k && styles.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <Text style={styles.muted}>Cargando tu gym…</Text>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, tab === "rutinas" && styles.scrollFill]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
        >
          {tab === "registro" ? (
            <Registro
              styles={styles}
              colors={colors}
              dia={dia}
              fecha={fecha}
              setFecha={setFecha}
              entrenos={data.entrenos}
              rutinas={data.rutinas}
              buscarEjercicios={buscarEjercicios}
              agregarEjercicio={agregarEjercicio}
              borrarEjercicio={borrarEjercicio}
              editarSets={editarSets}
              usarRutina={usarRutina}
              vaciarDia={vaciarDia}
            />
          ) : tab === "rutinas" ? (
            <Rutinas styles={styles} colors={colors} rutinas={data.rutinas} guardarRutinas={guardarRutinas} buscarEjercicios={buscarEjercicios} />
          ) : (
            <Progreso styles={styles} colors={colors} entrenos={data.entrenos} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ---------------- Calendario ---------------- */
function Calendario({ styles, colors, fecha, setFecha, entrenos }) {
  const [expandido, setExpandido] = useState(false);
  const [mes, setMes] = useState(() => {
    const d = new Date(`${fecha}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const hoy = hoyKey();

  const shiftFecha = (n) => {
    const d = new Date(`${fecha}T00:00:00`);
    d.setDate(d.getDate() + n);
    setFecha(dayKey(d));
  };

  const renderDia = (dObj, key) => {
    const k = dayKey(dObj);
    const tiene = (entrenos[k] || []).length > 0;
    const sel = k === fecha;
    const esHoy = k === hoy;
    return (
      <View key={key} style={styles.calCell}>
        <TouchableOpacity
          style={[styles.calDia, sel && styles.calDiaSel, esHoy && !sel && styles.calDiaHoy]}
          onPress={() => setFecha(k)}
        >
          <Text style={[styles.calDiaText, sel && styles.calDiaTextSel]}>{dObj.getDate()}</Text>
          {tiene ? <View style={[styles.calDot, sel && styles.calDotSel]} /> : null}
        </TouchableOpacity>
      </View>
    );
  };

  const dowHeader = ["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
    <View key={`d${i}`} style={styles.calCell}>
      <Text style={styles.calDow}>{d}</Text>
    </View>
  ));

  // ----- Colapsado: solo la semana de la fecha seleccionada -----
  if (!expandido) {
    const sel = new Date(`${fecha}T00:00:00`);
    const dow = (sel.getDay() + 6) % 7; // 0 = lunes
    const lunes = new Date(sel);
    lunes.setDate(sel.getDate() - dow);
    const semana = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return d;
    });
    return (
      <View style={styles.card}>
        <View style={styles.calHead}>
          <TouchableOpacity onPress={() => shiftFecha(-7)} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.calMes}>{sel.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</Text>
          <TouchableOpacity onPress={() => shiftFecha(7)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.calGrid}>
          {dowHeader}
          {semana.map((d, i) => renderDia(d, i))}
        </View>
        <TouchableOpacity
          style={styles.calToggle}
          onPress={() => {
            setMes(new Date(sel.getFullYear(), sel.getMonth(), 1));
            setExpandido(true);
          }}
        >
          <Ionicons name="chevron-down" size={16} color={colors.muted} />
          <Text style={styles.calToggleText}>Ver mes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ----- Expandido: mes completo -----
  const y = mes.getFullYear();
  const m = mes.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const primerDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const celdas = [...Array(primerDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];

  return (
    <View style={styles.card}>
      <View style={styles.calHead}>
        <TouchableOpacity onPress={() => setMes(new Date(y, m - 1, 1))} hitSlop={8}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.calMes}>{mes.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</Text>
        <TouchableOpacity onPress={() => setMes(new Date(y, m + 1, 1))} hitSlop={8}>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.calGrid}>
        {dowHeader}
        {celdas.map((d, i) => (d == null ? <View key={i} style={styles.calCell} /> : renderDia(new Date(y, m, d), i)))}
      </View>
      <TouchableOpacity style={styles.calToggle} onPress={() => setExpandido(false)}>
        <Ionicons name="chevron-up" size={16} color={colors.muted} />
        <Text style={styles.calToggleText}>Ver semana</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------------- Registro ---------------- */
function Registro({ styles, colors, dia, fecha, setFecha, entrenos, rutinas, buscarEjercicios, agregarEjercicio, borrarEjercicio, editarSets, usarRutina, vaciarDia }) {
  const [agregando, setAgregando] = useState(false);
  const [q, setQ] = useState("");
  const [eligiendoRutina, setEligiendoRutina] = useState(false);
  const sugerencias = agregando ? buscarEjercicios(q) : [];
  const totalSeries = dia.reduce((a, e) => a + e.sets.filter((s) => s.hecha).length, 0);
  const esFuturo = fecha > hoyKey();
  const sinEntreno = dia.length === 0;

  return (
    <>
      <Calendario styles={styles} colors={colors} fecha={fecha} setFecha={setFecha} entrenos={entrenos} />

      <View style={styles.dayBar}>
        <Text style={styles.diaSel}>{fechaLabel(fecha)}</Text>
        {dia.length ? (
          <View style={styles.dayBarDer}>
            <Text style={styles.muted}>{esFuturo ? `${dia.length} planificados` : `${totalSeries} series hechas`}</Text>
            <TouchableOpacity style={styles.vaciarBtn} onPress={vaciarDia}>
              <Ionicons name="trash-outline" size={13} color={colors.muted} />
              <Text style={styles.vaciarText}>Vaciar</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {dia.map((ej) => (
        <Ejercicio key={ej.id} styles={styles} colors={colors} ej={ej} onSets={(s) => editarSets(ej.id, s)} onBorrar={() => borrarEjercicio(ej.id)} />
      ))}

      {sinEntreno && !agregando ? (
        !eligiendoRutina ? (
          <View style={styles.heroBox}>
            <Text style={styles.muted}>{esFuturo ? "Este día no tiene rutina asignada." : "Todavía no entrenaste este día."}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setEligiendoRutina(true)}>
              <Text style={styles.primaryBtnText}>{esFuturo ? "Asignar rutina" : "Entrenar"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{esFuturo ? "¿Qué vas a entrenar?" : "¿Qué entrenás?"}</Text>
            {rutinas.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.rutinaMenuItem}
                onPress={() => {
                  usarRutina(r);
                  setEligiendoRutina(false);
                }}
              >
                <Text style={styles.rutinaMenuNombre}>{r.nombre}</Text>
                <Text style={styles.muted}>{(r.ejercicios || []).length} ej.</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => {
                setEligiendoRutina(false);
                setAgregando(true);
              }}
            >
              <Ionicons name="add" size={16} color={colors.greenBright} />
              <Text style={styles.linkText}>o cargar ejercicios sueltos</Text>
            </TouchableOpacity>
          </View>
        )
      ) : null}

      {agregando ? (
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder="Buscá un ejercicio…"
            placeholderTextColor={colors.muted}
          />
          {sugerencias.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={styles.sugRow}
              onPress={() => {
                agregarEjercicio(s);
                setQ("");
                setAgregando(false);
              }}
            >
              <Text style={styles.sugNombre}>{s.nombre}</Text>
              {s.grupo ? <Text style={styles.sugGrupo}>{s.grupo}</Text> : null}
            </TouchableOpacity>
          ))}
          {q.trim() && !sugerencias.some((s) => norm(s.nombre) === norm(q)) ? (
            <TouchableOpacity
              style={styles.sugRow}
              onPress={() => {
                agregarEjercicio({ nombre: q.trim(), grupo: "" });
                setQ("");
                setAgregando(false);
              }}
            >
              <Text style={styles.sugNombre}>➕ Crear "{q.trim()}"</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.linkRow} onPress={() => setAgregando(false)}>
            <Text style={styles.muted}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : dia.length ? (
        <TouchableOpacity style={styles.addBtn} onPress={() => setAgregando(true)}>
          <Ionicons name="add" size={18} color={colors.greenBright} />
          <Text style={styles.addBtnText}>Agregar ejercicio</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );
}

function Ejercicio({ styles, colors, ej, onSets, onBorrar }) {
  const setSet = (i, campo, val) => onSets(ej.sets.map((s, j) => (j === i ? { ...s, [campo]: val } : s)));
  const addSet = () => {
    const u = ej.sets[ej.sets.length - 1] || { kg: 0, reps: 0 };
    onSets([...ej.sets, { kg: u.kg, reps: u.reps, hecha: false }]);
  };
  const delSet = (i) => onSets(ej.sets.filter((_, j) => j !== i));
  const soloNum = (v) => v.replace(/[^0-9.]/g, "");

  return (
    <View style={styles.card}>
      <View style={styles.ejHead}>
        <View style={styles.ejHeadLeft}>
          <Text style={styles.cardTitle}>{ej.nombre}</Text>
          {ej.grupo ? <Text style={styles.ejGrupo}>{ej.grupo}</Text> : null}
        </View>
        <TouchableOpacity onPress={onBorrar} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>
      <View style={styles.setsHeadRow}>
        <Text style={[styles.setsHeadTxt, { width: 34 }]}>#</Text>
        <Text style={[styles.setsHeadTxt, { flex: 1 }]}>Kg</Text>
        <Text style={[styles.setsHeadTxt, { flex: 1 }]}>Reps</Text>
        <View style={{ width: 72 }} />
      </View>
      {ej.sets.map((s, i) => (
        <View key={i} style={[styles.setRow, s.hecha && styles.setRowOn]}>
          <Text style={styles.setNum}>{i + 1}</Text>
          <TextInput
            style={styles.setInput}
            value={s.kg ? String(s.kg) : ""}
            onChangeText={(v) => setSet(i, "kg", Number(soloNum(v)) || 0)}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
          />
          <TextInput
            style={styles.setInput}
            value={s.reps ? String(s.reps) : ""}
            onChangeText={(v) => setSet(i, "reps", Number(soloNum(v)) || 0)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
          />
          <View style={styles.setActions}>
            <TouchableOpacity style={[styles.check, s.hecha && styles.checkOn]} onPress={() => setSet(i, "hecha", !s.hecha)}>
              <Ionicons name="checkmark" size={16} color={s.hecha ? "#06210a" : colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => delSet(i)} hitSlop={6}>
              <Ionicons name="close" size={16} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.addSet} onPress={addSet}>
        <Ionicons name="add" size={15} color={colors.muted} />
        <Text style={styles.muted}>Agregar serie</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------------- Rutinas ---------------- */
function Rutinas({ styles, colors, rutinas, guardarRutinas, buscarEjercicios }) {
  const [editando, setEditando] = useState(null);

  const guardar = (r) => {
    if (!r.nombre.trim()) return;
    const existe = rutinas.some((x) => x.id === r.id);
    guardarRutinas(existe ? rutinas.map((x) => (x.id === r.id ? r : x)) : [...rutinas, r]);
    setEditando(null);
  };
  const borrar = (id) =>
    Alert.alert("Borrar rutina", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => guardarRutinas(rutinas.filter((x) => x.id !== id)) },
    ]);

  if (editando) {
    return <RutinaEditor styles={styles} colors={colors} rutina={editando} onGuardar={guardar} onCancelar={() => setEditando(null)} buscarEjercicios={buscarEjercicios} />;
  }

  return (
    <>
      <TouchableOpacity style={styles.addBtn} onPress={() => setEditando({ id: uid(), nombre: "", dia: "", ejercicios: [] })}>
        <Ionicons name="add" size={18} color={colors.greenBright} />
        <Text style={styles.addBtnText}>Nueva rutina</Text>
      </TouchableOpacity>
      {rutinas.length === 0 ? <Text style={styles.muted}>Todavía no tenés rutinas. Creá una para reutilizarla al entrenar.</Text> : null}
      {rutinas.map((r) => (
        <View key={r.id} style={styles.card}>
          <View style={styles.ejHead}>
            <View style={styles.ejHeadLeft}>
              <Text style={styles.cardTitle}>{r.nombre}</Text>
              {r.dia ? <Text style={styles.ejGrupo}>{r.dia}</Text> : null}
            </View>
            <View style={styles.rowGap}>
              <TouchableOpacity onPress={() => setEditando(r)} hitSlop={6}>
                <Ionicons name="create-outline" size={18} color={colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => borrar(r.id)} hitSlop={6}>
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
          {(r.ejercicios || []).map((e, i) => (
            <View key={i} style={styles.rutinaEjLi}>
              <Text style={styles.rutinaEjNombre}>{e.nombre}</Text>
              <Text style={styles.muted}>
                {e.series || 0} × {e.reps || 0}
                {e.kg ? ` · ${e.kg} kg` : ""}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

function RutinaEditor({ styles, colors, rutina, onGuardar, onCancelar, buscarEjercicios }) {
  const [nombre, setNombre] = useState(rutina.nombre);
  const [dia, setDia] = useState(rutina.dia || "");
  const [ejercicios, setEjercicios] = useState(rutina.ejercicios || []);
  const [q, setQ] = useState("");
  const sug = q.length >= 1 ? buscarEjercicios(q) : [];
  const soloNum = (v) => v.replace(/[^0-9.]/g, "");

  const addEj = (e) => {
    setEjercicios([...ejercicios, { nombre: e.nombre, grupo: e.grupo || "", series: 3, reps: 10, kg: 0 }]);
    setQ("");
  };
  const setEj = (i, c, v) => setEjercicios(ejercicios.map((e, j) => (j === i ? { ...e, [c]: v } : e)));
  const delEj = (i) => setEjercicios(ejercicios.filter((_, j) => j !== i));
  const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  return (
    <View style={[styles.card, styles.editorFill]}>
      <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre (ej: Push)" placeholderTextColor={colors.muted} />
      <View style={styles.diaChips}>
        {DIAS.map((d) => (
          <TouchableOpacity key={d || "libre"} style={[styles.diaChip, dia === d && styles.diaChipOn]} onPress={() => setDia(d)}>
            <Text style={[styles.diaChipText, dia === d && styles.diaChipTextOn]}>{d || "Sin día"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {ejercicios.map((e, i) => (
        <View key={i} style={styles.rutinaEjEdit}>
          <View style={styles.rutinaEjTop}>
            <Text style={styles.rutinaEjNombreBig} numberOfLines={1}>
              {e.nombre}
            </Text>
            <TouchableOpacity onPress={() => delEj(i)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={styles.campoRow}>
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Series</Text>
              <TextInput style={styles.campoInput} value={e.series ? String(e.series) : ""} onChangeText={(v) => setEj(i, "series", Number(soloNum(v)) || 0)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} />
            </View>
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Reps</Text>
              <TextInput style={styles.campoInput} value={e.reps ? String(e.reps) : ""} onChangeText={(v) => setEj(i, "reps", Number(soloNum(v)) || 0)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} />
            </View>
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Kg</Text>
              <TextInput style={styles.campoInput} value={e.kg ? String(e.kg) : ""} onChangeText={(v) => setEj(i, "kg", Number(soloNum(v)) || 0)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} />
            </View>
          </View>
        </View>
      ))}

      <TextInput style={styles.input} value={q} onChangeText={setQ} placeholder="Agregar ejercicio…" placeholderTextColor={colors.muted} />
      {sug.map((s, i) => (
        <TouchableOpacity key={i} style={styles.sugRow} onPress={() => addEj(s)}>
          <Text style={styles.sugNombre}>{s.nombre}</Text>
          {s.grupo ? <Text style={styles.sugGrupo}>{s.grupo}</Text> : null}
        </TouchableOpacity>
      ))}
      {q.trim() && !sug.some((s) => norm(s.nombre) === norm(q)) ? (
        <TouchableOpacity style={styles.sugRow} onPress={() => addEj({ nombre: q.trim(), grupo: "" })}>
          <Text style={styles.sugNombre}>➕ Crear "{q.trim()}"</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.editorSpacer} />

      <View style={styles.editorActions}>
        <TouchableOpacity style={styles.linkRow} onPress={onCancelar}>
          <Text style={styles.muted}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => onGuardar({ id: rutina.id, nombre, dia, ejercicios })}>
          <Text style={styles.primaryBtnText}>Guardar rutina</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------------- Progreso ---------------- */
function Progreso({ styles, colors, entrenos }) {
  const ejercicios = useMemo(() => {
    const map = new Map();
    Object.values(entrenos || {}).forEach((arr) => (arr || []).forEach((e) => map.set(norm(e.nombre), e.nombre)));
    return [...map.values()].sort();
  }, [entrenos]);
  const [idx, setIdx] = useState(0);
  const [periodo, setPeriodo] = useState("mes");
  const [metrica, setMetrica] = useState("kg");
  const elegido = ejercicios[idx] || ejercicios[0] || "";

  const datosDia = (k) => {
    const ej = (entrenos[k] || []).find((e) => norm(e.nombre) === norm(elegido));
    if (!ej) return null;
    return {
      maxKg: Math.max(0, ...ej.sets.map((s) => Number(s.kg) || 0)),
      reps: ej.sets.reduce((a, s) => a + (Number(s.reps) || 0), 0),
      series: ej.sets.length,
    };
  };

  const buckets = useMemo(() => {
    const ahora = new Date();
    if (periodo === "anio") {
      const arr = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const dim = new Date(y, m + 1, 0).getDate();
        const dias = [];
        for (let dd = 1; dd <= dim; dd++) dias.push(`${y}-${pad(m + 1)}-${pad(dd)}`);
        arr.push({ label: MESES_G[m], dias });
      }
      return arr;
    }
    const n = periodo === "mes" ? 30 : 7;
    const arr = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(ahora);
      d.setDate(d.getDate() - i);
      arr.push({ label: periodo === "semana" ? DIAS_G[d.getDay()] : String(d.getDate()), dias: [dayKey(d)] });
    }
    return arr;
  }, [periodo]);

  const { points, sesiones } = useMemo(() => {
    let ses = 0;
    const pts = [];
    buckets.forEach((b) => {
      let vKg = 0;
      let vReps = 0;
      let vSeries = 0;
      let tiene = false;
      b.dias.forEach((k) => {
        const d = datosDia(k);
        if (!d) return;
        tiene = true;
        ses += 1;
        vKg = Math.max(vKg, d.maxKg);
        vReps += d.reps;
        vSeries += d.series;
      });
      if (!tiene) return;
      const value = metrica === "kg" ? vKg : metrica === "reps" ? vReps : vSeries;
      if (value > 0) pts.push({ label: b.label, value });
    });
    return { points: pts, sesiones: ses };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets, entrenos, elegido, metrica]);

  const sesionesKg = useMemo(() => {
    const out = [];
    Object.keys(entrenos || {})
      .sort()
      .forEach((k) => {
        const d = datosDia(k);
        if (d && d.maxKg > 0) out.push(d.maxKg);
      });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrenos, elegido]);
  const record = sesionesKg.length ? Math.max(...sesionesKg) : 0;
  const delta = sesionesKg.length >= 2 ? sesionesKg[sesionesKg.length - 1] - sesionesKg[sesionesKg.length - 2] : null;

  const grande = !points.length ? 0 : metrica === "kg" ? Math.max(...points.map((p) => p.value)) : points.reduce((a, p) => a + p.value, 0);
  const INFO = {
    kg: { unidad: "kg", texto: `máximo de ${RANGO[periodo]}`, color: colors.greenBright },
    reps: { unidad: "reps", texto: `total de ${RANGO[periodo]}`, color: "#3aa0e0" },
    series: { unidad: "series", texto: `total de ${RANGO[periodo]}`, color: "#d6a92e" },
  };
  const info = INFO[metrica];

  if (!ejercicios.length) return <Text style={styles.muted}>Cuando registres entrenamientos, acá vas a ver tu progreso por ejercicio.</Text>;

  return (
    <>
      {/* Selector de ejercicio (chips horizontales) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
        {ejercicios.map((n, i) => (
          <TouchableOpacity key={n} style={[styles.chip, idx === i && styles.chipOn]} onPress={() => setIdx(i)}>
            <Text style={[styles.chipText, idx === i && styles.chipTextOn]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <View style={styles.progHead}>
          <View style={styles.rowGapSm}>
            {[
              { k: "kg", label: "Peso" },
              { k: "reps", label: "Reps" },
              { k: "series", label: "Series" },
            ].map((mm) => (
              <TouchableOpacity key={mm.k} style={[styles.chip, metrica === mm.k && styles.chipOn]} onPress={() => setMetrica(mm.k)}>
                <Text style={[styles.chipText, metrica === mm.k && styles.chipTextOn]}>{mm.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.periodoSel}>
            {[
              { k: "semana", label: "S" },
              { k: "mes", label: "M" },
              { k: "anio", label: "A" },
            ].map((p) => (
              <TouchableOpacity key={p.k} style={[styles.periodoBtn, periodo === p.k && styles.periodoBtnOn]} onPress={() => setPeriodo(p.k)}>
                <Text style={[styles.periodoText, periodo === p.k && styles.periodoTextOn]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.progTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.progValor, { color: info.color }]}>
              {grande.toLocaleString("es-AR")} {info.unidad}
              {metrica === "kg" && delta != null && delta !== 0 ? (
                <Text style={{ color: delta > 0 ? colors.green : colors.red, fontSize: 13 }}>
                  {"  "}
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} kg
                </Text>
              ) : null}
            </Text>
            <Text style={styles.muted}>
              {info.texto}
              {metrica === "kg" && delta != null ? " · vs tu sesión anterior" : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.muted}>
              {sesiones} {sesiones === 1 ? "sesión" : "sesiones"}
            </Text>
            {record > 0 ? (
              <View style={styles.recordRow}>
                <Ionicons name="trophy-outline" size={14} color={colors.text} />
                <Text style={styles.muted}> récord: {record} kg</Text>
              </View>
            ) : null}
          </View>
        </View>

        {points.length >= 1 ? (
          <GymChart points={points} color={info.color} unidad={info.unidad} colors={colors} />
        ) : (
          <Text style={styles.muted}>No entrenaste este ejercicio en {RANGO[periodo]}. Probá con M o A.</Text>
        )}
      </View>
    </>
  );
}

// Gráfico de línea suavizado con toque para ver el valor.
function GymChart({ points, color, unidad, colors }) {
  const [sel, setSel] = useState(null);
  const [ancho, setAncho] = useState(0);
  const W = 320;
  const H = 120;
  const padTop = 16;
  const padBottom = 20;
  const n = points.length;
  const max = Math.max(...points.map((p) => p.value), 1) * 1.15;
  const innerH = H - padTop - padBottom;
  const x = (i) => (n <= 1 ? W / 2 : 8 + (i / (n - 1)) * (W - 16));
  const y = (v) => padTop + innerH - (v / max) * innerH;
  const xy = points.map((p, i) => [x(i), y(p.value)]);
  const linea = smoothPath(xy);
  const selEff = sel != null ? sel : n - 1;

  const tocar = (e) => {
    if (!ancho) return;
    const rel = Math.max(0, Math.min(1, e.nativeEvent.locationX / ancho));
    setSel(n <= 1 ? 0 : Math.round(rel * (n - 1)));
  };

  return (
    <View
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={tocar}
      onResponderMove={tocar}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Path d={linea} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points[selEff] ? <Circle cx={xy[selEff][0]} cy={xy[selEff][1]} r={4.5} fill={color} /> : null}
      </Svg>
      {points[selEff] ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ color, fontWeight: "800", fontSize: 12 }}>
            {points[selEff].value.toLocaleString("es-AR")} {unidad}
            {points[selEff].label ? ` · ${points[selEff].label}` : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: 16, paddingTop: 4 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { color: colors.text, fontSize: 22, fontWeight: "800" },
    tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
    tab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
    },
    tabOn: { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
    tabText: { color: colors.muted, fontWeight: "800", fontSize: 12 },
    tabTextOn: { color: "#06210a" },
    scroll: { paddingHorizontal: 16, paddingBottom: 120, gap: 10 },
    scrollFill: { flexGrow: 1 },
    muted: { color: colors.muted, fontSize: 13, fontWeight: "600" },

    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 14,
      gap: 8,
    },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },

    // Calendario
    calHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    calMes: { color: colors.text, fontSize: 14, fontWeight: "800", textTransform: "capitalize" },
    calGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
    calCell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 2 },
    calDow: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    calDia: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    calDiaSel: { backgroundColor: colors.greenBright },
    calDiaHoy: { borderWidth: 1.5, borderColor: colors.greenBright },
    calDiaText: { color: colors.text, fontSize: 13, fontWeight: "700" },
    calDiaTextSel: { color: "#06210a" },
    calDot: { position: "absolute", bottom: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.greenBright },
    calDotSel: { backgroundColor: "#06210a" },
    calToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    calToggleText: { color: colors.muted, fontSize: 12, fontWeight: "700" },

    dayBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    diaSel: { color: colors.text, fontSize: 15, fontWeight: "800", textTransform: "capitalize" },
    dayBarDer: { flexDirection: "row", alignItems: "center", gap: 10 },
    vaciarBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    vaciarText: { color: colors.muted, fontSize: 12, fontWeight: "700" },

    // Ejercicio
    ejHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    ejHeadLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    ejGrupo: {
      color: colors.greenBright,
      fontSize: 11,
      fontWeight: "700",
      backgroundColor: "rgba(93,199,45,0.14)",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    setsHeadRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
    setsHeadTxt: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
    setRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    setRowOn: {},
    setNum: { width: 34, textAlign: "center", color: colors.muted, fontWeight: "800" },
    setInput: {
      flex: 1,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 10,
      paddingVertical: 9,
      color: colors.text,
      fontWeight: "700",
      textAlign: "center",
    },
    setActions: { width: 72, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
    check: {
      width: 32,
      height: 32,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    checkOn: { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
    addSet: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 4 },

    heroBox: { alignItems: "center", gap: 10, paddingVertical: 16 },
    primaryBtn: { backgroundColor: colors.greenBright, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
    primaryBtnText: { color: "#06210a", fontWeight: "800" },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    addBtnText: { color: colors.text, fontWeight: "800" },
    input: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    sugRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    sugNombre: { color: colors.text, fontSize: 14, fontWeight: "600", flex: 1 },
    sugGrupo: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6 },
    linkText: { color: colors.greenBright, fontWeight: "700", fontSize: 13 },

    rutinaMenuItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    rutinaMenuNombre: { color: colors.text, fontWeight: "700" },
    rutinaEjLi: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.bg,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    rutinaEjNombre: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1 },
    rutinaEjEdit: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    rutinaEjTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    rutinaEjNombreBig: { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 },
    campoRow: { flexDirection: "row", gap: 8 },
    campo: { flex: 1, gap: 4 },
    campoLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", textAlign: "center" },
    campoInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 10,
      paddingVertical: 13,
      color: colors.text,
      fontWeight: "800",
      textAlign: "center",
      fontSize: 17,
    },
    editorFill: { flex: 1 },
    editorSpacer: { flexGrow: 1, minHeight: 8 },
    miniInput: {
      width: 48,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 8,
      paddingVertical: 7,
      color: colors.text,
      fontWeight: "700",
      textAlign: "center",
      fontSize: 13,
    },
    diaChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    diaChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder },
    diaChipOn: { borderColor: colors.greenBright, backgroundColor: "rgba(93,199,45,0.14)" },
    diaChipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    diaChipTextOn: { color: colors.greenBright },
    editorActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 4 },
    rowGap: { flexDirection: "row", gap: 12 },
    rowGapSm: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

    // Progreso
    chipsScroll: { gap: 6, paddingRight: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder },
    chipOn: { borderColor: colors.greenBright, backgroundColor: "rgba(93,199,45,0.14)" },
    chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    chipTextOn: { color: colors.greenBright },
    progHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
    periodoSel: { flexDirection: "row", gap: 2, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 999, padding: 2 },
    periodoBtn: { width: 30, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    periodoBtnOn: { backgroundColor: colors.greenBright },
    periodoText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    periodoTextOn: { color: "#06210a" },
    progTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: 4 },
    progValor: { fontSize: 26, fontWeight: "900" },
    recordRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  });
