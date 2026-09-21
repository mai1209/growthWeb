import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiAlignCenter,
  FiAlignLeft,
  FiImage,
  FiAlignRight,
  FiBold,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiCheckSquare,
  FiCode,
  FiEdit2,
  FiFilePlus,
  FiFileText,
  FiFolder,
  FiFolderPlus,
  FiHash,
  FiItalic,
  FiLayers,
  FiBookOpen,
  FiList,
  FiMaximize2,
  FiMinimize2,
  FiMessageSquare,
  FiMinus,
  FiPlus,
  FiShoppingCart,
  FiBook,
  FiFeather,
  FiTrash2,
  FiType,
  FiUnderline,
  FiX,
  FiRotateCcw,
  FiRotateCw,
  FiMoreVertical,
  FiDroplet,
  FiStar,
  FiTag,
} from "react-icons/fi";
import Quill from "quill";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "../cloudinary";
import "quill/dist/quill.snow.css";
import { taskService } from "../api";
import ShoppingLists from "./ShoppingLists";
import Afirmaciones from "./Afirmaciones";
import Journaling from "./Journaling";
import style from "../style/TaskStudio.module.css";

// Habilita tamaño de fuente por píxeles (ej. "16px") en vez de small/large.
const SizeStyle = Quill.import("attributors/style/size");
SizeStyle.whitelist = null; // permitir cualquier valor en px
Quill.register(SizeStyle, true);

const MIN_FONT_PX = 8;
const MAX_FONT_PX = 96;
const DEFAULT_FONT_PX = 16;

// Vistas del estudio (las que se pueden deep-linkear desde el nav con ?view=).
const VALID_VIEWS = ["notes", "shopping", "afirmaciones", "journal", "calendar"];

// Puntito de color por carpeta (determinístico por nombre), como las etiquetas del mockup.
const FOLDER_DOT_COLORS = ["#75f94c", "#69a7ff", "#a78bfa", "#f070b8", "#ffd55c", "#ff9d5c", "#3ed9a4"];
const folderColor = (name) => {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FOLDER_DOT_COLORS[h % FOLDER_DOT_COLORS.length];
};

// Estilo inline para colores libres (hex) elegidos con el picker de la app.
// El color del texto se decide por luminancia del fondo.
const customNoteStyle = (c) => {
  if (typeof c !== "string" || !/^#[0-9a-f]{6}$/i.test(c)) return undefined;
  const n = parseInt(c.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return { background: c, color: lum > 150 ? "#121814" : "#f7fff9" };
};

const COLOR_OPTIONS = [
  { value: "color1", label: "Verde" },
  { value: "color2", label: "Naranja" },
  { value: "color3", label: "Amarillo" },
  { value: "color4", label: "Turquesa" },
  { value: "color5", label: "Azul" },
  { value: "color6", label: "Rosa" },
  { value: "color7", label: "Lila" },
  { value: "color8", label: "Rojo" },
  { value: "color9", label: "Gris" },
  { value: "color10", label: "Blanco" },
  { value: "color11", label: "Negro" },
];

const SHEET_WIDTH_OPTIONS = [
  { value: "narrow", label: "S", title: "Hoja angosta" },
  { value: "medium", label: "M", title: "Hoja media" },
  { value: "wide", label: "L", title: "Hoja ancha" },
  { value: "full", label: "Full", title: "Ancho completo" },
];

const SHEET_WIDTH_VALUES = SHEET_WIDTH_OPTIONS.map((option) => option.value);
const SHEET_WIDTH_STORAGE_KEY = "growth-note-sheet-width";

const readStoredSheetWidth = () => {
  try {
    const stored = localStorage.getItem(SHEET_WIDTH_STORAGE_KEY);
    return SHEET_WIDTH_VALUES.includes(stored) ? stored : "wide";
  } catch {
    return "wide";
  }
};

const TEXT_COLOR_OPTIONS = [
  { value: false, label: "Predeterminado", swatch: "#172018" },
  { value: "#1f2933", label: "Negro", swatch: "#1f2933" },
  { value: "#2f7d32", label: "Verde", swatch: "#2f7d32" },
  { value: "#2563eb", label: "Azul", swatch: "#2563eb" },
  { value: "#9333ea", label: "Violeta", swatch: "#9333ea" },
  { value: "#db2777", label: "Rosa", swatch: "#db2777" },
  { value: "#dc2626", label: "Rojo", swatch: "#dc2626" },
  { value: "#d97706", label: "Naranja", swatch: "#d97706" },
];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const getMonthInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTimeInputValue = (date = new Date()) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const getLocalDateFromValue = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (matched) {
      const [, year, month, day] = matched;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatShortDate = (value) =>
  getLocalDateFromValue(value)?.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  }) || "--/--";

const formatMonthLabel = (value) => {
  const [year, month] = String(value || "").split("-").map(Number);

  if (!year || !month) return "Mes";

  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
};

const formatMonthTitle = (value) => {
  const label = formatMonthLabel(value);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const stripHtml = (value = "") =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const createNotePage = (index = 0, contenido = "") => ({
  title: `Página ${index + 1}`,
  contenido,
});

const parseNotePages = (contenido = "") => {
  if (!contenido.includes('data-note-page="true"')) {
    return [createNotePage(0, contenido)];
  }

  const parser = new DOMParser();
  const documentContent = parser.parseFromString(contenido, "text/html");
  const pageNodes = Array.from(documentContent.querySelectorAll('[data-note-page="true"]'));

  if (!pageNodes.length) {
    return [createNotePage(0, contenido)];
  }

  return pageNodes.map((pageNode, index) => {
    const contentNode = pageNode.querySelector("[data-note-page-content]");

    return {
      title: pageNode.getAttribute("data-page-title") || `Página ${index + 1}`,
      contenido: contentNode?.innerHTML || pageNode.innerHTML || "",
    };
  });
};

const serializeNotePages = (pages = []) => {
  const normalizedPages = pages.length ? pages : [createNotePage()];

  if (normalizedPages.length === 1) {
    return normalizedPages[0].contenido;
  }

  return normalizedPages
    .map(
      (page, index) => `
        <section data-note-page="true" data-page-title="${escapeHtml(page.title || `Página ${index + 1}`)}">
          <div data-note-page-content="true">${page.contenido || ""}</div>
        </section>
      `
    )
    .join("");
};

const buildInitialFormState = () => ({
  id: null,
  meta: "",
  contenido: "",
  fecha: getDateInputValue(new Date()),
  horario: getTimeInputValue(new Date()),
  color: "color10", // papel blanco por defecto
  carpeta: "",
  flashcards: [],
});

const ALL_FOLDERS = "__all__";
const FAV_FOLDER = "__fav__"; // Favoritas
const TRASH_FOLDER = "__trash__"; // Papelera

const getFoldersStorageKey = (workspace) => `growth-note-folders:${workspace || "personal"}`;

const readStoredFolders = (workspace) => {
  try {
    const raw = localStorage.getItem(getFoldersStorageKey(workspace));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string" && name.trim()) : [];
  } catch {
    return [];
  }
};

const createFlashcardId = () =>
  `fc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// Repaso espaciado (Leitner): días hasta el próximo repaso según la "caja".
const SR_INTERVALS = [0, 1, 3, 7, 16];
const MAX_BOX = SR_INTERVALS.length - 1;

const getTodayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
};

const dateKeyInDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

const isCardDue = (card) => !card?.due || card.due <= getTodayKey();

const formatDueLabel = (card) => {
  if (isCardDue(card)) return "Para repasar hoy";
  try {
    const [, m, d] = card.due.split("-").map(Number);
    return `Próximo repaso: ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  } catch {
    return "";
  }
};

const groupNotesForBoard = (notes = []) => {
  const sorted = [...notes].sort((a, b) => {
    const aTime = getLocalDateFromValue(a.fecha)?.getTime() || 0;
    const bTime = getLocalDateFromValue(b.fecha)?.getTime() || 0;
    return bTime - aTime;
  });

  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const recent = [];
  const byMonth = new Map();

  sorted.forEach((note) => {
    const date = getLocalDateFromValue(note.fecha) || now;
    if (date >= cutoff) {
      recent.push(note);
    } else {
      const key = getMonthInputValue(date);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(note);
    }
  });

  const groups = [];
  if (recent.length) {
    groups.push({ key: "recent", label: "Últimos 30 días", notes: recent });
  }
  [...byMonth.keys()]
    .sort()
    .reverse()
    .forEach((key) => {
      groups.push({ key, label: formatMonthTitle(key), notes: byMonth.get(key) });
    });

  return groups;
};

// Contador de palabras / tiempo de lectura + índice (títulos) de la nota.
const computeEditorMeta = (instance) => {
  const text = instance.getText().trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const stats = { words, minutes: words ? Math.max(1, Math.ceil(words / 200)) : 0 };
  const nodes = instance.root.querySelectorAll("h1, h2");
  const outline = Array.from(nodes).map((node, index) => ({
    id: index,
    text: (node.textContent || "").trim() || "Sin título",
    level: node.tagName === "H1" ? 1 : 2,
  }));
  return { stats, outline };
};

function TaskStudioPage({ activeWorkspace = "personal" }) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const titleInputRef = useRef(null);
  const selectionRef = useRef(null);
  const monthInputRef = useRef(null);
  const activeNotePageIndexRef = useRef(0);
  const isDirtyRef = useRef(false);
  const historyTrapRef = useRef(false);
  const autoCapEnabledRef = useRef(true);
  const [autoCapEnabled, setAutoCapEnabled] = useState(() => {
    try {
      return localStorage.getItem("growth-note-autocap") !== "off";
    } catch {
      return true;
    }
  });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getMonthInputValue(new Date()));
  const [form, setForm] = useState(buildInitialFormState);
  const [notePages, setNotePages] = useState([createNotePage()]);
  const [activeNotePageIndex, setActiveNotePageIndex] = useState(0);
  const [editingPageIndex, setEditingPageIndex] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [sheetWidth, setSheetWidth] = useState(readStoredSheetWidth);
  const [editorStats, setEditorStats] = useState({ words: 0, minutes: 0 });
  // Menús plegables de la toolbar: "aa" (tamaño/mayúsculas), "color" (papel/texto), "more" (ancho)
  const [toolMenu, setToolMenu] = useState(null);
  useEffect(() => {
    if (!toolMenu) return undefined;
    const close = () => setToolMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [toolMenu]);
  // Fecha corta de la nota para el header ("lun 21 sep · 12:12")
  const fechaNotaLabel = useMemo(() => {
    if (!form.fecha) return "";
    const d = new Date(`${form.fecha}T00:00:00`);
    if (Number.isNaN(d.getTime())) return form.fecha;
    const txt = d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
    return `${txt}${form.horario ? ` · ${form.horario}` : ""}`;
  }, [form.fecha, form.horario]);
  const [outline, setOutline] = useState([]);
  const [showOutline, setShowOutline] = useState(false);
  const [isCardFormOpen, setIsCardFormOpen] = useState(false);
  const [isDeckOpen, setIsDeckOpen] = useState(false);
  const [deckScope, setDeckScope] = useState("all");
  const [cardForm, setCardForm] = useState({ front: "", back: "" });
  const [cardSaving, setCardSaving] = useState(false);
  const [cardError, setCardError] = useState("");
  const [isStudyOpen, setIsStudyOpen] = useState(false);
  const [studyDeck, setStudyDeck] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyFlipped, setStudyFlipped] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  // Autoguardado (como el journaling): no hay botón de guardar. Estado del
  // último guardado para el indicador del header.
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const autosaveTimerRef = useRef(null);
  const savePromiseRef = useRef(null); // guardado en curso (para encadenar)
  const saveAgainRef = useRef(false); // hubo cambios mientras se guardaba
  const formRef = useRef(null); // form fresco para el timer (evita closures viejos)
  const notePagesRef = useRef(null);
  const [sizeInput, setSizeInput] = useState(DEFAULT_FONT_PX);
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(() => {
    const v = searchParams.get("view");
    return VALID_VIEWS.includes(v) ? v : "notes";
  });
  const [activeFolder, setActiveFolder] = useState(ALL_FOLDERS);
  const [customFolders, setCustomFolders] = useState(() => readStoredFolders(activeWorkspace));

  // URL ⇄ vista: el nav deep-linkea (?view=shopping/journal) y las pestañas
  // internas mantienen la URL en sync (así el nav resalta la sección correcta).
  useEffect(() => {
    const v = searchParams.get("view");
    const next = VALID_VIEWS.includes(v) ? v : "notes";
    setView((cur) => (cur === next ? cur : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const v = searchParams.get("view");
    const fromUrl = VALID_VIEWS.includes(v) ? v : "notes";
    if (view === fromUrl) return;
    const next = new URLSearchParams(searchParams);
    if (view === "notes") next.delete("view");
    else next.set("view", view);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const [isCompact, setIsCompact] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 760 : false
  );
  const [activeFormats, setActiveFormats] = useState({
    align: "",
    bold: false,
    blockquote: false,
    codeBlock: false,
    color: "",
    header: false,
    italic: false,
    orderedList: false,
    checkList: false,
    strike: false,
    size: "",
    underline: false,
    bulletList: false,
  });

  const getFormatState = (formats = {}) => ({
    align: formats.align || "",
    bold: Boolean(formats.bold),
    blockquote: formats.blockquote === true,
    background: Boolean(formats.background),
    codeBlock: Boolean(formats["code-block"]),
    color: formats.color || "",
    header: formats.header || false,
    italic: Boolean(formats.italic),
    orderedList: formats.list === "ordered",
    checkList: formats.list === "checked" || formats.list === "unchecked",
    strike: Boolean(formats.strike),
    size: formats.size || "",
    underline: Boolean(formats.underline),
    bulletList: formats.list === "bullet",
  });

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    notePagesRef.current = notePages;
  }, [notePages]);

  const markDirty = () => {
    isDirtyRef.current = true;
    setIsDirty(true);
    programarAutosave();
  };

  const clearDirty = () => {
    isDirtyRef.current = false;
    setIsDirty(false);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  };

  // ===== Autoguardado =====
  const AUTOSAVE_MS = 900;
  const textoPlano = (html) =>
    String(html || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

  // Nota nueva sin título ni contenido: no se crea nada.
  const notaVacia = () => {
    const f = formRef.current || form;
    if (f.meta.trim()) return false;
    if (textoPlano(getCurrentEditorHtml())) return false;
    const pages = notePagesRef.current || notePages;
    return !pages.some(
      (p, i) => i !== activeNotePageIndexRef.current && textoPlano(p.contenido)
    );
  };

  const construirPayload = () => {
    const f = formRef.current || form;
    const pages = notePagesRef.current || notePages;
    return {
      tipo: "note",
      workspace: activeWorkspace,
      // Sin título no es un error: se guarda igual (la gente perdía notas por esto).
      meta: f.meta.trim() || "Sin título",
      contenido: serializeNotePages(
        pages.map((page, index) =>
          index === activeNotePageIndexRef.current
            ? { ...page, contenido: getCurrentEditorHtml() }
            : page
        )
      ),
      fecha: f.fecha,
      horario: f.horario,
      color: f.color,
      carpeta: f.carpeta || "",
      flashcards: f.flashcards || [],
    };
  };

  // Guarda ya (crea la nota si es nueva, la actualiza si existe). Devuelve una
  // promesa con true/false. Si ya hay un guardado en curso, se encola detrás.
  const guardarAhora = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (savePromiseRef.current) {
      saveAgainRef.current = true;
      return savePromiseRef.current;
    }
    if (!isDirtyRef.current) return Promise.resolve(true);
    const f = formRef.current || form;
    if (!f.id && notaVacia()) {
      clearDirty();
      return Promise.resolve(true);
    }

    // Limpio ANTES de la request: si siguen escribiendo, vuelve a ensuciarse.
    isDirtyRef.current = false;
    setIsDirty(false);
    setSaving(true);
    setSaveStatus("saving");
    setError("");

    const tarea = (async () => {
      try {
        const payload = construirPayload();
        const response = f.id
          ? await taskService.update(f.id, payload)
          : await taskService.create(payload);
        const savedTask = response.data;
        setTasks((prev) =>
          f.id
            ? prev.map((task) => (task._id === savedTask._id ? savedTask : task))
            : [savedTask, ...prev]
        );
        if (!f.id) {
          // La nota nueva ya existe: de acá en más se actualiza.
          formRef.current = { ...(formRef.current || f), id: savedTask._id };
          setForm((prev) => ({ ...prev, id: savedTask._id }));
        }
        setSaveStatus("saved");
        return true;
      } catch (saveError) {
        isDirtyRef.current = true;
        setIsDirty(true);
        setSaveStatus("error");
        setError(saveError.response?.data?.message || "No se pudo guardar la nota.");
        return false;
      } finally {
        setSaving(false);
      }
    })().then((ok) => {
      savePromiseRef.current = null;
      if (saveAgainRef.current) {
        saveAgainRef.current = false;
        isDirtyRef.current = true;
        return guardarAhora();
      }
      return ok;
    });
    savePromiseRef.current = tarea;
    return tarea;
  };

  const programarAutosave = () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      guardarAhora();
    }, AUTOSAVE_MS);
  };

  // Al cerrar/guardar consumimos la entrada extra de historial que metimos
  // al abrir el editor (para que el botón "atrás" no quede trabado).
  const consumeHistoryTrap = () => {
    if (!historyTrapRef.current) return;
    historyTrapRef.current = false;
    setTimeout(() => {
      window.history.back();
    }, 0);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const response = await taskService.getAll({ tipo: "note", workspace: activeWorkspace });
        if (isMounted) {
          setTasks(Array.isArray(response.data) ? response.data : []);
          setError("");
        }
      } catch (fetchError) {
        if (isMounted) {
          setError("No se pudieron cargar las notas.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTasks();
    return () => {
      isMounted = false;
    };
  }, [activeWorkspace]);

  useEffect(() => {
    if (!editorRef.current || quillRef.current) return undefined;

    const quill = new Quill(editorRef.current, {
      theme: "snow",
      placeholder: "Escribí acá… seleccioná texto para darle formato con la barra de arriba",
      modules: {
        toolbar: false,
      },
    });

    // Capitalización automática del teclado en móvil.
    quill.root.setAttribute("autocapitalize", "sentences");

    // Calcula contador de palabras/tiempo de lectura e índice (títulos) de la nota.
    const refreshEditorMeta = (instance) => {
      const { stats, outline: nextOutline } = computeEditorMeta(instance);
      setEditorStats(stats);
      setOutline(nextOutline);
    };

    // Capitaliza la primera letra de cada oración mientras escribís (también en desktop).
    const autoCapitalizeSentence = (delta) => {
      if (!autoCapEnabledRef.current) return;
      if (!delta || !Array.isArray(delta.ops)) return;

      let index = 0;
      let inserted = null;
      for (const op of delta.ops) {
        if (typeof op.retain === "number") {
          index += op.retain;
        } else if (op.delete) {
          return;
        } else if (typeof op.insert === "string") {
          if (op.insert.length !== 1) return; // solo un caracter tipeado (no pegado)
          inserted = op.insert;
          break;
        } else {
          return;
        }
      }

      if (inserted === null) return;

      const upper = inserted.toUpperCase();
      if (upper === inserted) return; // no es una letra que se pueda capitalizar

      const before = quill.getText(0, index).replace(/[^\S\n]+$/, "");
      const isSentenceStart = before === "" || /[.!?\n]$/.test(before);
      if (!isSentenceStart) return;

      const format = quill.getFormat(index, 1);
      quill.deleteText(index, 1, "silent");
      quill.insertText(index, upper, format, "silent");
      quill.setSelection(index + 1, 0, "silent");
    };

    const handleTextChange = (delta, oldDelta, source) => {
      if (source === "user") {
        markDirty();
        autoCapitalizeSentence(delta);
      }

      const html = quill.root.innerHTML === "<p><br></p>" ? "" : quill.root.innerHTML;
      setForm((prev) => (prev.contenido === html ? prev : { ...prev, contenido: html }));
      setNotePages((prev) =>
        prev.map((page, index) =>
          index === activeNotePageIndexRef.current ? { ...page, contenido: html } : page
        )
      );

      refreshEditorMeta(quill);

      const range = quill.getSelection();
      if (!range) return;

      const formats = quill.getFormat(range);
      setActiveFormats(getFormatState(formats));
    };

    const handleSelectionChange = (range) => {
      if (!range) return;

      selectionRef.current = range;
      const formats = quill.getFormat(range);
      setActiveFormats(getFormatState(formats));
    };

    // Pegar una foto: en vez de incrustarla como base64 (pesadísimo y el server
    // la rechaza), la subimos a Cloudinary e insertamos solo la URL.
    const handleImagePaste = (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageItem = Array.from(items).find((it) => it.type?.startsWith("image/"));
      if (!imageItem) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const file = imageItem.getAsFile();
      if (!file) return;

      if (!isCloudinaryConfigured()) {
        setError("Para pegar fotos falta configurar Cloudinary (src/cloudinary.js).");
        return;
      }

      const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
      const index = range.index;
      const placeholder = "⏳ Subiendo imagen…";
      quill.insertText(index, placeholder + "\n", "user");

      uploadImageToCloudinary(file)
        .then((url) => {
          quill.deleteText(index, placeholder.length + 1, "user");
          quill.insertEmbed(index, "image", url, "user");
          quill.setSelection(index + 1, 0, "silent");
        })
        .catch(() => {
          quill.deleteText(index, placeholder.length + 1, "user");
          setError("No se pudo subir la imagen.");
        });
    };
    quill.root.addEventListener("paste", handleImagePaste, true);

    quill.on("text-change", handleTextChange);
    quill.on("selection-change", handleSelectionChange);
    quillRef.current = quill;

    return () => {
      quill.root.removeEventListener("paste", handleImagePaste, true);
      quill.off("text-change", handleTextChange);
      quill.off("selection-change", handleSelectionChange);
      quillRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeNotePageIndexRef.current = activeNotePageIndex;
  }, [activeNotePageIndex]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const handleChange = (event) => setIsCompact(event.matches);

    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    setCustomFolders(readStoredFolders(activeWorkspace));
    setActiveFolder(ALL_FOLDERS);
  }, [activeWorkspace]);

  useEffect(() => {
    try {
      localStorage.setItem(getFoldersStorageKey(activeWorkspace), JSON.stringify(customFolders));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [customFolders, activeWorkspace]);

  useEffect(() => {
    try {
      localStorage.setItem(SHEET_WIDTH_STORAGE_KEY, sheetWidth);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [sheetWidth]);

  useEffect(() => {
    autoCapEnabledRef.current = autoCapEnabled;
    if (quillRef.current) {
      quillRef.current.root.setAttribute(
        "autocapitalize",
        autoCapEnabled ? "sentences" : "off"
      );
    }
    try {
      localStorage.setItem("growth-note-autocap", autoCapEnabled ? "on" : "off");
    } catch {
      /* almacenamiento no disponible */
    }
  }, [autoCapEnabled]);

  // Refleja en el input el tamaño del texto donde está el cursor/selección.
  useEffect(() => {
    const px = parseInt(activeFormats.size, 10);
    setSizeInput(px || DEFAULT_FONT_PX);
  }, [activeFormats.size]);

  // Aviso del navegador al recargar / cerrar pestaña con cambios sin guardar.
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isEditorOpen && (isDirtyRef.current || savePromiseRef.current)) {
        guardarAhora(); // intenta guardar en el acto
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEditorOpen]);

  // Guarda contra el botón "atrás" del navegador dentro de la app:
  // al abrir el editor metemos una entrada de historial; si vuelven atrás
  // con cambios sin guardar, pedimos confirmación antes de dejar salir.
  useEffect(() => {
    if (!isEditorOpen) return undefined;

    window.history.pushState(null, "", window.location.href);
    historyTrapRef.current = true;

    const handlePopState = () => {
      // Con autoguardado no hace falta preguntar: guardamos y dejamos salir.
      if (isDirtyRef.current) guardarAhora();

      historyTrapRef.current = false;
      window.removeEventListener("popstate", handlePopState);
      window.history.back();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isEditorOpen]);

  useEffect(() => {
    if (!quillRef.current) return;

    const currentHtml =
      quillRef.current.root.innerHTML === "<p><br></p>" ? "" : quillRef.current.root.innerHTML;

    if (currentHtml === form.contenido) return;

    if (!form.contenido) {
      quillRef.current.setText("");
      const empty = computeEditorMeta(quillRef.current);
      setEditorStats(empty.stats);
      setOutline(empty.outline);
      return;
    }

    quillRef.current.clipboard.dangerouslyPasteHTML(form.contenido);
    const meta = computeEditorMeta(quillRef.current);
    setEditorStats(meta.stats);
    setOutline(meta.outline);
  }, [form.contenido]);

  const scrollToHeading = (index) => {
    const quill = quillRef.current;
    if (!quill) return;
    const nodes = quill.root.querySelectorAll("h1, h2");
    nodes[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filteredTasks = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);

    return tasks
      .filter((task) => {
        if (!task?.fecha) return false;

        const taskDate = getLocalDateFromValue(task.fecha);
        if (!taskDate) return false;

        return (
          taskDate.getFullYear() === monthStart.getFullYear() &&
          taskDate.getMonth() === monthStart.getMonth()
        );
      })
      .sort((a, b) => {
        const aTime = getLocalDateFromValue(a.fecha)?.getTime() || 0;
        const bTime = getLocalDateFromValue(b.fecha)?.getTime() || 0;
        return bTime - aTime;
      });
  }, [tasks, selectedMonth]);

  const notesByDay = useMemo(() => {
    const map = new Map();
    filteredTasks.forEach((task) => {
      if (task.papelera) return; // la papelera no va al calendario
      const key = getDateInputValue(getLocalDateFromValue(task.fecha) || new Date());
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    });
    return map;
  }, [filteredTasks]);

  const monthMatrix = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    if (!year || !month) return [];

    const firstOfMonth = new Date(year, month - 1, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // semana arranca lunes
    const lastDay = new Date(year, month, 0).getDate();
    const totalCells = Math.ceil((startOffset + lastDay) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) =>
      new Date(year, month - 1, 1 - startOffset + index)
    );
  }, [selectedMonth]);

  const monthIndex = Number(selectedMonth.split("-")[1]) - 1;
  const todayKey = getDateInputValue(new Date());
  // En móvil dejamos Notas, Lista de compras y Afirmaciones; el Calendario queda
  // solo en desktop.
  const effectiveView = isCompact
    ? view === "shopping" || view === "afirmaciones" || view === "journal"
      ? view
      : "notes"
    : view;

  // Notas "vivas" (fuera de la papelera) para todo lo que no sea la papelera
  const notasVivas = useMemo(() => tasks.filter((task) => !task.papelera), [tasks]);
  const favCount = useMemo(() => notasVivas.filter((task) => task.favorita).length, [notasVivas]);
  const trashCount = tasks.length - notasVivas.length;

  const folderCounts = useMemo(() => {
    const counts = new Map();
    notasVivas.forEach((task) => {
      const folder = (task.carpeta || "").trim();
      if (folder) counts.set(folder, (counts.get(folder) || 0) + 1);
    });
    return counts;
  }, [notasVivas]);

  const folders = useMemo(() => {
    const set = new Set(customFolders.filter(Boolean));
    folderCounts.forEach((_, folder) => set.add(folder));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [customFolders, folderCounts]);

  const boardTasks = useMemo(() => {
    if (activeFolder === TRASH_FOLDER) return tasks.filter((task) => task.papelera);
    if (activeFolder === FAV_FOLDER) return notasVivas.filter((task) => task.favorita);
    if (activeFolder === ALL_FOLDERS) return notasVivas;
    return notasVivas.filter((task) => (task.carpeta || "").trim() === activeFolder);
  }, [tasks, notasVivas, activeFolder]);

  const boardGroups = useMemo(() => groupNotesForBoard(boardTasks), [boardTasks]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    markDirty();
  };

  const getCurrentEditorHtml = () => {
    if (!quillRef.current) return form.contenido;

    return quillRef.current.root.innerHTML === "<p><br></p>" ? "" : quillRef.current.root.innerHTML;
  };

  const syncCurrentPage = () => {
    const currentHtml = getCurrentEditorHtml();

    setNotePages((prev) =>
      prev.map((page, index) =>
        index === activeNotePageIndexRef.current ? { ...page, contenido: currentHtml } : page
      )
    );

    return currentHtml;
  };

  const handleSelectPage = (index) => {
    const currentHtml = syncCurrentPage();

    setNotePages((prev) =>
      prev.map((page, pageIndex) =>
        pageIndex === activeNotePageIndexRef.current ? { ...page, contenido: currentHtml } : page
      )
    );
    activeNotePageIndexRef.current = index;
    setActiveNotePageIndex(index);
    setForm((prev) => ({ ...prev, contenido: notePages[index]?.contenido || "" }));
    selectionRef.current = null;
  };

  const handleAddPage = () => {
    const currentHtml = syncCurrentPage();
    const nextPage = createNotePage(notePages.length);
    const nextPages = notePages.map((page, index) =>
      index === activeNotePageIndexRef.current ? { ...page, contenido: currentHtml } : page
    );
    const nextIndex = nextPages.length;

    setNotePages([...nextPages, nextPage]);
    activeNotePageIndexRef.current = nextIndex;
    setActiveNotePageIndex(nextIndex);
    setForm((prev) => ({ ...prev, contenido: "" }));
    selectionRef.current = null;
    markDirty();
  };

  const getPageLabel = (page, index) => {
    const title = page?.title || "";
    if (!title || /^Página\s+\d+$/i.test(title)) {
      return `Página ${index + 1}`;
    }
    return title;
  };

  const startRename = (index) => {
    setEditingPageIndex(index);
    setEditingTitle(getPageLabel(notePages[index], index));
  };

  const cancelRename = () => {
    setEditingPageIndex(null);
    setEditingTitle("");
  };

  const commitRename = (index) => {
    const value = editingTitle.trim();
    setNotePages((prev) =>
      prev.map((page, pageIndex) =>
        pageIndex === index ? { ...page, title: value || `Página ${pageIndex + 1}` } : page
      )
    );
    setEditingPageIndex(null);
    setEditingTitle("");
    markDirty();
  };

  const handleDeletePage = (index) => {
    if (notePages.length <= 1) return;

    const targetHtml =
      index === activeNotePageIndexRef.current
        ? getCurrentEditorHtml()
        : notePages[index]?.contenido || "";

    if (stripHtml(targetHtml) && !window.confirm("¿Eliminar esta página y su contenido?")) {
      return;
    }

    const currentHtml = getCurrentEditorHtml();
    const synced = notePages.map((page, pageIndex) =>
      pageIndex === activeNotePageIndexRef.current ? { ...page, contenido: currentHtml } : page
    );
    const nextPages = synced.filter((_, pageIndex) => pageIndex !== index);

    let nextActive = activeNotePageIndexRef.current;
    if (index === activeNotePageIndexRef.current) {
      nextActive = Math.max(0, index - 1);
    } else if (index < activeNotePageIndexRef.current) {
      nextActive = activeNotePageIndexRef.current - 1;
    }
    nextActive = Math.min(nextActive, nextPages.length - 1);

    activeNotePageIndexRef.current = nextActive;
    setNotePages(nextPages);
    setActiveNotePageIndex(nextActive);
    setForm((prev) => ({ ...prev, contenido: nextPages[nextActive]?.contenido || "" }));
    if (editingPageIndex !== null) {
      cancelRename();
    }
    selectionRef.current = null;
    markDirty();
  };

  const shiftMonth = (delta) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    setSelectedMonth(getMonthInputValue(new Date(year, month - 1 + delta, 1)));
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(getMonthInputValue(new Date()));
  };

  const isCurrentMonth = selectedMonth === getMonthInputValue(new Date());

  const openMonthPicker = () => {
    const input = monthInputRef.current;

    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  const handleCreateFolder = () => {
    const name = window.prompt("Nombre de la carpeta")?.trim();
    if (!name) return;

    setCustomFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setActiveFolder(name);
  };

  const handleDeleteFolder = (name) => {
    setCustomFolders((prev) => prev.filter((folder) => folder !== name));
    setActiveFolder((current) => (current === name ? ALL_FOLDERS : current));
  };

  const handleCreateFolderInEditor = () => {
    const name = window.prompt("Nombre de la carpeta")?.trim();
    if (!name) return;

    setCustomFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
    handleFieldChange("carpeta", name);
  };

  // Insertar imagen desde el selector de archivos (sube a Cloudinary → URL).
  const handleInsertImage = () => {
    if (!isCloudinaryConfigured()) {
      setError("Para subir fotos falta configurar Cloudinary (src/cloudinary.js).");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      const quill = quillRef.current;
      if (!file || !quill) return;
      const range = quill.getSelection(true) || { index: quill.getLength() };
      const index = range.index;
      const placeholder = "⏳ Subiendo imagen…";
      quill.insertText(index, placeholder + "\n", "user");
      uploadImageToCloudinary(file)
        .then((url) => {
          quill.deleteText(index, placeholder.length + 1, "user");
          quill.insertEmbed(index, "image", url, "user");
          quill.setSelection(index + 1, 0, "silent");
        })
        .catch(() => {
          quill.deleteText(index, placeholder.length + 1, "user");
          setError("No se pudo subir la imagen.");
        });
    };
    input.click();
  };

  const getEditorRange = () => {
    if (!quillRef.current) return null;

    // Toda acción del toolbar (negrita, color, listas, alineación...) pasa por
    // acá, así que aprovechamos para marcar la nota como "con cambios".
    markDirty();
    return quillRef.current.getSelection() || selectionRef.current;
  };

  const applyInlineFormat = (format) => {
    if (!quillRef.current) return;

    const quill = quillRef.current;
    const range = getEditorRange();

    quill.focus();

    if (range) {
      quill.setSelection(range);
      selectionRef.current = range;
      const formats = quill.getFormat(range);
      quill.format(format, !formats[format]);
      return;
    }

    quill.format(format, true);
  };

  // Convierte a minúsculas / MAYÚSCULAS el texto seleccionado, conservando el
  // formato (negrita, color, etc.) de cada tramo. Sirve para arreglar textos
  // que se pegaron en mayúscula desde otra app.
  const applyCaseToSelection = (mode) => {
    const quill = quillRef.current;
    if (!quill) return;

    markDirty();
    quill.focus();

    const range = quill.getSelection() || selectionRef.current;
    if (!range || range.length === 0) return;

    const contents = quill.getContents(range.index, range.length);
    const Delta = Quill.import("delta");
    const rebuilt = new Delta().retain(range.index);

    contents.ops.forEach((op) => {
      if (typeof op.insert === "string") {
        const next =
          mode === "upper" ? op.insert.toUpperCase() : op.insert.toLowerCase();
        rebuilt.delete(op.insert.length).insert(next, op.attributes || {});
      } else if (op.insert !== undefined) {
        rebuilt.retain(1);
      }
    });

    quill.updateContents(rebuilt, "user");
    quill.setSelection(range.index, range.length, "silent");
    selectionRef.current = { index: range.index, length: range.length };
  };

  const toggleBulletList = () => {
    if (!quillRef.current) return;

    const quill = quillRef.current;
    const range = getEditorRange();

    quill.focus();

    if (range) {
      quill.setSelection(range);
      selectionRef.current = range;
      const formats = quill.getFormat(range);
      quill.format("list", formats.list === "bullet" ? false : "bullet");
      return;
    }

    quill.format("list", "bullet");
  };

  const toggleOrderedList = () => {
    if (!quillRef.current) return;

    const quill = quillRef.current;
    const range = getEditorRange();

    quill.focus();

    if (range) {
      quill.setSelection(range);
      selectionRef.current = range;
      const formats = quill.getFormat(range);
      quill.format("list", formats.list === "ordered" ? false : "ordered");
      return;
    }

    quill.format("list", "ordered");
  };

  const toggleCheckList = () => {
    if (!quillRef.current) return;

    const quill = quillRef.current;
    const range = getEditorRange();

    quill.focus();

    if (range) {
      quill.setSelection(range);
      selectionRef.current = range;
      const formats = quill.getFormat(range);
      quill.format(
        "list",
        formats.list === "checked" || formats.list === "unchecked" ? false : "checked"
      );
      return;
    }

    quill.format("list", "checked");
  };

  const applyBlockFormat = (format, value = true) => {
    if (!quillRef.current) return;

    const quill = quillRef.current;
    const range = getEditorRange();

    quill.focus();

    if (range) {
      quill.setSelection(range);
      selectionRef.current = range;
      const formats = quill.getFormat(range);
      const activeValue = formats[format];
      const isActive = value === true ? Boolean(activeValue) : activeValue === value;
      quill.format(format, isActive ? false : value);
      return;
    }

    quill.format(format, value);
  };

  const applyAlign = (value) => {
    if (!quillRef.current) return;

    const quill = quillRef.current;
    const range = getEditorRange();

    quill.focus();

    if (range) {
      quill.setSelection(range);
      selectionRef.current = range;
    }

    quill.format("align", value || false);
  };

  const applyTextColor = (value) => {
    if (!quillRef.current) return;

    const quill = quillRef.current;
    const range = getEditorRange();

    quill.focus();

    if (range) {
      quill.setSelection(range);
      selectionRef.current = range;
    }

    quill.format("color", value || false);
  };

  // Aplica un tamaño de fuente en píxeles (a la selección o al cursor).
  const applySizePx = (px) => {
    if (!quillRef.current) return;

    const clamped = Math.min(MAX_FONT_PX, Math.max(MIN_FONT_PX, Number(px) || DEFAULT_FONT_PX));
    setSizeInput(clamped);

    const quill = quillRef.current;
    const range = getEditorRange();

    quill.focus();

    if (range) {
      quill.setSelection(range);
      selectionRef.current = range;
    }

    // 16px es el tamaño base: si lo eligen, quitamos el formato para que quede "normal".
    quill.format("size", clamped === DEFAULT_FONT_PX ? false : `${clamped}px`);
  };

  const stepFontSize = (delta) => {
    applySizePx((Number(sizeInput) || DEFAULT_FONT_PX) + delta);
  };

  const commitSizeInput = () => {
    const value = Number(sizeInput);
    if (!value || Number.isNaN(value)) {
      setSizeInput(DEFAULT_FONT_PX);
      return;
    }
    applySizePx(value);
  };

  // Resalta (o quita) la selección con color marcador.
  const toggleHighlight = () => {
    if (!quillRef.current) return;

    const quill = quillRef.current;
    const range = getEditorRange();

    quill.focus();

    if (range) {
      quill.setSelection(range);
      selectionRef.current = range;
      const formats = quill.getFormat(range);
      quill.format("background", formats.background ? false : "#fff2a8");
      return;
    }

    quill.format("background", "#fff2a8");
  };

  // Devuelve el texto seleccionado en el editor (para crear flashcards).
  const getSelectedText = () => {
    const quill = quillRef.current;
    if (!quill) return "";
    const range = quill.getSelection() || selectionRef.current;
    if (!range || range.length === 0) return "";
    return quill.getText(range.index, range.length).trim();
  };

  const openCardForm = () => {
    const selected = getSelectedText();
    setCardForm({ front: "", back: selected });
    setCardError("");
    setIsCardFormOpen(true);
  };

  // Tarjetas de la nota abierta (fuente viva, incluye cambios sin guardar).
  const noteCards = form.flashcards || [];

  // Todas las tarjetas de todas las notas (para el repaso global), con su origen.
  const allCards = useMemo(() => {
    const list = [];
    tasks.forEach((task) => {
      const cards = (form.id === task._id ? form.flashcards : task.flashcards) || [];
      cards.forEach((card) => list.push({ ...card, noteId: task._id, noteTitle: task.meta }));
    });
    if (!form.id) {
      (form.flashcards || []).forEach((card) =>
        list.push({ ...card, noteId: null, noteTitle: form.meta || "Nota nueva" })
      );
    }
    return list;
  }, [tasks, form.id, form.flashcards, form.meta]);

  const visibleDeckCards = deckScope === "note" ? noteCards : allCards;
  const visibleDueCards = visibleDeckCards.filter(isCardDue);
  const dueCountAll = allCards.filter(isCardDue).length;
  const dueCountNote = noteCards.filter(isCardDue).length;

  // Tarjetas agrupadas por nota (para la vista "Todas" separada por nota).
  const cardsByNote = useMemo(() => {
    const groups = new Map();
    allCards.forEach((card) => {
      const key = card.noteId || "__none__";
      if (!groups.has(key)) {
        groups.set(key, { noteId: card.noteId, noteTitle: card.noteTitle || "Sin nota", cards: [] });
      }
      groups.get(key).cards.push(card);
    });
    return Array.from(groups.values()).sort((a, b) =>
      a.noteTitle.localeCompare(b.noteTitle)
    );
  }, [allCards]);

  // Guarda el array de tarjetas de una nota: estado local + servidor.
  const persistNoteCards = async (noteId, nextCards) => {
    if (form.id === noteId || !noteId) {
      setForm((prev) => ({ ...prev, flashcards: nextCards }));
    }
    if (!noteId) {
      // Nota sin guardar: las tarjetas se guardarán al guardar la nota.
      markDirty();
      return true;
    }
    setTasks((prev) =>
      prev.map((task) => (task._id === noteId ? { ...task, flashcards: nextCards } : task))
    );
    try {
      await taskService.update(noteId, { flashcards: nextCards });
      return true;
    } catch {
      return false;
    }
  };

  const cardsForNote = (noteId) =>
    (form.id === noteId ? form.flashcards : tasks.find((task) => task._id === noteId)?.flashcards) ||
    [];

  const handleSaveFlashcard = async (event) => {
    event.preventDefault();
    const front = cardForm.front.trim();
    const back = cardForm.back.trim();
    if (!front || !back) {
      setCardError("Completá la pregunta y la respuesta.");
      return;
    }

    setCardError("");
    setCardSaving(true);

    const newCard = {
      id: createFlashcardId(),
      front,
      back,
      box: 0,
      due: getTodayKey(),
      createdAt: new Date().toISOString(),
    };

    const ok = await persistNoteCards(form.id, [newCard, ...(form.flashcards || [])]);
    setCardSaving(false);

    if (ok) {
      setCardForm({ front: "", back: "" });
      setIsCardFormOpen(false);
      setMessage("Flashcard creada.");
    } else {
      setCardError(
        "No se pudo guardar la tarjeta. Revisá tu conexión o cerrá sesión y volvé a entrar."
      );
    }
  };

  const handleDeleteFlashcard = (card) => {
    const noteId = card.noteId || form.id;
    const nextCards = cardsForNote(noteId).filter((item) => item.id !== card.id);
    persistNoteCards(noteId, nextCards);
  };

  const startStudy = (cards) => {
    const source = cards && cards.length ? cards : allCards;
    if (source.length === 0) return;
    // Mazo ordenado por "caja" (lo menos sabido primero), fijo durante la sesión.
    const deck = [...source].sort((a, b) => (a.box || 0) - (b.box || 0));
    setStudyDeck(deck);
    setStudyIndex(0);
    setStudyFlipped(false);
    setIsDeckOpen(false);
    setIsStudyOpen(true);
  };

  const handleGradeCard = (known) => {
    const current = studyDeck[studyIndex];
    let deck = studyDeck;

    if (current) {
      const noteId = current.noteId || form.id;
      const newBox = known ? Math.min((current.box || 0) + 1, MAX_BOX) : 0;
      const due = dateKeyInDays(known ? SR_INTERVALS[newBox] : 0);
      const nextCards = cardsForNote(noteId).map((card) =>
        card.id === current.id ? { ...card, box: newBox, due } : card
      );
      persistNoteCards(noteId, nextCards);

      // "Otra vez": re-encolamos la tarjeta al final para volver a verla.
      if (!known) {
        deck = [...studyDeck, current];
        setStudyDeck(deck);
      }
    }

    if (studyIndex + 1 >= deck.length) {
      setIsStudyOpen(false);
      setMessage("¡Repaso terminado!");
      return;
    }

    setStudyIndex((prev) => prev + 1);
    setStudyFlipped(false);
  };

  const resetForm = () => {
    setForm(buildInitialFormState());
    setNotePages([createNotePage()]);
    setActiveNotePageIndex(0);
    activeNotePageIndexRef.current = 0;
    setMessage("");
    setActiveFormats(getFormatState());
    selectionRef.current = null;
    if (quillRef.current) {
      quillRef.current.setText("");
      quillRef.current.setSelection(0, 0);
    }
  };

  const handleNewNote = (dateValue) => {
    resetForm();
    clearDirty();
    const defaults = {};
    if (typeof dateValue === "string" && dateValue) {
      defaults.fecha = dateValue;
    }
    if (activeFolder !== ALL_FOLDERS) {
      defaults.carpeta = activeFolder;
    }
    if (Object.keys(defaults).length) {
      setForm((prev) => ({ ...prev, ...defaults }));
    }
    setError("");
    setSaveStatus("idle");
    setIsEditorOpen(true);
  };

  const handleCloseEditor = async () => {
    // Antes de cerrar, guardamos lo pendiente. Solo si falla preguntamos.
    const ok = await guardarAhora();
    if (
      !ok &&
      !window.confirm("No se pudo guardar la nota. ¿Cerrar igual y perder los últimos cambios?")
    ) {
      return;
    }

    clearDirty();
    setSaveStatus("idle");
    setIsEditorOpen(false);
    setIsEditorExpanded(false);
    resetForm();
    consumeHistoryTrap();
  };

  const handleEdit = (task) => {
    const pages = parseNotePages(task.contenido || "");
    activeNotePageIndexRef.current = 0;
    setNotePages(pages);
    setActiveNotePageIndex(0);
    setForm({
      id: task._id,
      meta: task.meta || "",
      contenido: pages[0]?.contenido || "",
      fecha: task.fecha ? String(task.fecha).slice(0, 10) : getDateInputValue(new Date()),
      horario: task.horario || "12:00",
      color: task.color || "color1",
      carpeta: task.carpeta || "",
      flashcards: Array.isArray(task.flashcards) ? task.flashcards : [],
    });
    setMessage("");
    setError("");
    clearDirty();
    setSaveStatus("saved");
    setIsEditorOpen(true);
  };

  // Borrar = mandar a la papelera (se puede restaurar). Sin confirmación: es reversible.
  const handleDelete = async (taskId) => {
    const snapshot = tasks;
    setTasks((prev) =>
      prev.map((task) =>
        task._id === taskId ? { ...task, papelera: true, eliminadaAt: new Date().toISOString() } : task
      )
    );
    if (form.id === taskId) {
      clearDirty();
      handleCloseEditor();
    }
    try {
      await taskService.update(taskId, { papelera: true });
    } catch {
      setTasks(snapshot);
      setError("No se pudo mover la nota a la papelera.");
    }
  };

  const restaurarNota = async (taskId) => {
    const snapshot = tasks;
    setTasks((prev) =>
      prev.map((task) => (task._id === taskId ? { ...task, papelera: false, eliminadaAt: null } : task))
    );
    try {
      await taskService.update(taskId, { papelera: false });
    } catch {
      setTasks(snapshot);
      setError("No se pudo restaurar la nota.");
    }
  };

  const eliminarDefinitivo = async (taskId) => {
    if (!window.confirm("¿Eliminar esta nota para siempre? No se puede deshacer.")) return;
    try {
      await taskService.delete(taskId);
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
    } catch {
      setError("No se pudo eliminar la nota.");
    }
  };

  const vaciarPapelera = async () => {
    const enPapelera = tasks.filter((task) => task.papelera);
    if (!enPapelera.length) return;
    if (!window.confirm(`¿Vaciar la papelera? Se eliminan ${enPapelera.length} nota${enPapelera.length === 1 ? "" : "s"} para siempre.`)) return;
    try {
      await Promise.all(enPapelera.map((task) => taskService.delete(task._id)));
      setTasks((prev) => prev.filter((task) => !task.papelera));
    } catch {
      setError("No se pudo vaciar la papelera del todo.");
    }
  };

  const toggleFavorita = async (task) => {
    const next = !task.favorita;
    const snapshot = tasks;
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, favorita: next } : t)));
    try {
      await taskService.update(task._id, { favorita: next });
    } catch {
      setTasks(snapshot);
      setError("No se pudo marcar la nota.");
    }
  };
  const notaAbierta = form.id ? tasks.find((task) => task._id === form.id) : null;

  // Enter en el título / Cmd+S: guarda ya, sin cerrar.
  const handleSubmit = (event) => {
    event.preventDefault();
    guardarAhora();
  };

  useEffect(() => {
    if (!isEditorOpen) return undefined;
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        guardarAhora();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditorOpen]);

  return (
    <section className={style.page}>
   

      <div
        className={`${style.layout} ${
          isEditorOpen && effectiveView === "notes" && !isEditorExpanded ? style.layoutEditing : ""
        }`}
      >
        <section className={style.listCard}>
            {/* En la vista notas el título va dentro de la columna de carpetas
                (izquierda) para que la grilla quede a la misma altura.
                Compras trae su propio encabezado (ShoppingLists), no va acá. */}
            {effectiveView !== "notes" && effectiveView !== "shopping" && (
              <div className={style.editorHeader}>
                <div>
                  <p className={style.cardKicker}>
                    {effectiveView === "shopping"
                      ? "Listas"
                      : effectiveView === "afirmaciones"
                      ? "Afirmaciones"
                      : effectiveView === "journal"
                      ? "Journaling"
                      : "Notas"}
                  </p>
                  {/* En journal y afirmaciones no mostramos título grande: alcanza
                      con el rótulo de arriba (la fecha / el propio panel hacen de título). */}
                  {effectiveView !== "journal" && effectiveView !== "afirmaciones" && (
                    <h2 className={style.listTitle}>
                      {effectiveView === "shopping"
                        ? "Listas de compras"
                        : "Tus notas"}
                      {effectiveView !== "shopping" && boardTasks.length ? (
                        <span className={style.listCount}>{boardTasks.length}</span>
                      ) : null}
                    </h2>
                  )}
                </div>
              </div>
            )}

            {effectiveView === "calendar" ? (
              <div className={style.monthNav}>
                <button
                  type="button"
                  className={style.monthNavArrow}
                  onClick={() => shiftMonth(-1)}
                  aria-label="Mes anterior"
                  title="Mes anterior"
                >
                  <FiChevronLeft />
                </button>

                <div
                  className={style.monthNavLabel}
                  role="button"
                  tabIndex={0}
                  onClick={openMonthPicker}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openMonthPicker();
                    }
                  }}
                  title="Elegir mes"
                >
                  <FiCalendar />
                  <strong>{formatMonthTitle(selectedMonth)}</strong>
                  <span className={style.monthNavCount}>
                    {filteredTasks.length} {filteredTasks.length === 1 ? "nota" : "notas"}
                  </span>
                  <input
                    ref={monthInputRef}
                    type="month"
                    tabIndex={-1}
                    value={selectedMonth}
                    onChange={(event) => {
                      if (event.target.value) {
                        setSelectedMonth(event.target.value);
                      }
                    }}
                  />
                </div>

                <button
                  type="button"
                  className={style.monthNavArrow}
                  onClick={() => shiftMonth(1)}
                  aria-label="Mes siguiente"
                  title="Mes siguiente"
                >
                  <FiChevronRight />
                </button>

                {!isCurrentMonth ? (
                  <button
                    type="button"
                    className={style.monthTodayButton}
                    onClick={goToCurrentMonth}
                  >
                    Hoy
                  </button>
                ) : null}
              </div>
            ) : null}

            {loading ? (
              <p className={style.emptyState}>Cargando notas...</p>
            ) : effectiveView === "calendar" ? (
              <div className={style.calendar}>
                <div className={style.calendarWeekdays}>
                  {WEEKDAYS.map((weekday) => (
                    <span key={weekday}>{weekday}</span>
                  ))}
                </div>

                <div className={style.calendarGrid}>
                  {monthMatrix.map((day) => {
                    const dayKey = getDateInputValue(day);
                    const dayNotes = notesByDay.get(dayKey) || [];
                    const inMonth = day.getMonth() === monthIndex;
                    const isToday = dayKey === todayKey;

                    return (
                      <div
                        key={dayKey}
                        className={`${style.calendarCell} ${!inMonth ? style.calendarCellMuted : ""} ${
                          isToday ? style.calendarCellToday : ""
                        }`}
                      >
                        <div className={style.calendarCellHeader}>
                          {inMonth ? (
                            <span className={style.calendarCellDay}>{day.getDate()}</span>
                          ) : (
                            <button
                              type="button"
                              className={style.calendarCellDay}
                              onClick={() => setSelectedMonth(getMonthInputValue(day))}
                              title="Ir a este mes"
                            >
                              {day.getDate()}
                            </button>
                          )}
                          {inMonth ? (
                            <button
                              type="button"
                              className={style.calendarCellAdd}
                              onClick={() => handleNewNote(dayKey)}
                              aria-label="Nueva nota este día"
                              title="Nueva nota"
                            >
                              <FiPlus />
                            </button>
                          ) : null}
                        </div>

                        <div className={style.calendarCellNotes}>
                          {dayNotes.map((task) => {
                            const preview = stripHtml(task.contenido || "");

                            return (
                              <button
                                key={task._id}
                                type="button"
                                className={`${style.calendarNote} ${style[task.color] || style.color1}`}
                                style={customNoteStyle(task.color)}
                                onClick={() => handleEdit(task)}
                                title={task.meta}
                              >
                                <strong>{task.meta || "Sin título"}</strong>
                                {preview ? <span>{preview}</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : effectiveView === "shopping" ? (
              <ShoppingLists activeWorkspace={activeWorkspace} />
            ) : effectiveView === "afirmaciones" ? (
              <Afirmaciones />
            ) : effectiveView === "journal" ? (
              <Journaling />
            ) : (
              <div className={style.notesLayout}>
                <div className={style.notesLeftCol}>
                  <aside className={style.sidePanel} aria-label="Notas">
                    <button type="button" className={style.newNoteSideBtn} onClick={() => handleNewNote()}>
                      <FiPlus />
                      Nueva nota
                    </button>

                    <nav className={style.sideNav} aria-label="Vistas">
                      <button
                        type="button"
                        className={`${style.sideItem} ${activeFolder === ALL_FOLDERS ? style.sideItemOn : ""}`}
                        onClick={() => setActiveFolder(ALL_FOLDERS)}
                      >
                        <FiFileText />
                        <span className={style.sideItemName}>Todas las notas</span>
                        <span className={style.sideCount}>{notasVivas.length}</span>
                      </button>
                      <button
                        type="button"
                        className={`${style.sideItem} ${activeFolder === FAV_FOLDER ? style.sideItemOn : ""}`}
                        onClick={() => setActiveFolder(FAV_FOLDER)}
                      >
                        <FiStar />
                        <span className={style.sideItemName}>Favoritas</span>
                        <span className={style.sideCount}>{favCount}</span>
                      </button>
                      <button
                        type="button"
                        className={`${style.sideItem} ${activeFolder === TRASH_FOLDER ? style.sideItemOn : ""}`}
                        onClick={() => setActiveFolder(TRASH_FOLDER)}
                      >
                        <FiTrash2 />
                        <span className={style.sideItemName}>Papelera</span>
                        <span className={style.sideCount}>{trashCount}</span>
                      </button>
                    </nav>

                    <div className={style.sideDivider} />

                    <div className={style.sideSectionHead}>
                      <FiTag />
                      <span>Etiquetas</span>
                      <button
                        type="button"
                        className={style.sideSectionAdd}
                        onClick={handleCreateFolder}
                        aria-label="Nueva etiqueta"
                        title="Nueva etiqueta"
                      >
                        <FiPlus />
                      </button>
                    </div>

                    <div className={style.sideNav} aria-label="Etiquetas">
                      {folders.length === 0 ? (
                        <span className={style.sideEmpty}>Creá una etiqueta con el +</span>
                      ) : null}
                      {folders.map((folder) => {
                        const count = folderCounts.get(folder) || 0;
                        const isActive = activeFolder === folder;
                        return (
                          <div key={folder} className={style.sideRow}>
                            <button
                              type="button"
                              className={`${style.sideItem} ${isActive ? style.sideItemOn : ""}`}
                              onClick={() => setActiveFolder(folder)}
                            >
                              <span className={style.folderDot} style={{ background: folderColor(folder) }} />
                              <span className={style.sideItemName}>{folder}</span>
                              <span className={style.sideCount}>{count}</span>
                            </button>
                            {count === 0 ? (
                              <button
                                type="button"
                                className={style.sideRowDelete}
                                onClick={() => handleDeleteFolder(folder)}
                                aria-label={`Eliminar etiqueta ${folder}`}
                                title="Eliminar etiqueta vacía"
                              >
                                <FiX />
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </aside>
                </div>

                <div className={style.notesBoardWrap}>
                  {activeFolder === TRASH_FOLDER && boardTasks.length > 0 ? (
                    <div className={style.trashBar}>
                      <span>
                        <FiTrash2 /> Las notas en la papelera se pueden restaurar cuando quieras.
                      </span>
                      <button type="button" className={style.trashEmptyBtn} onClick={vaciarPapelera}>
                        Vaciar papelera
                      </button>
                    </div>
                  ) : null}
                  {boardTasks.length === 0 ? (
                    <p className={style.emptyState}>
                      {activeFolder === ALL_FOLDERS
                        ? "Todavía no tenés notas. Creá la primera con “Nueva nota”."
                        : activeFolder === FAV_FOLDER
                          ? "Todavía no marcaste favoritas. Tocá la ⭐ de una nota para tenerla a mano."
                          : activeFolder === TRASH_FOLDER
                            ? "La papelera está vacía."
                            : `La etiqueta “${activeFolder}” está vacía.`}
                    </p>
                  ) : (
                    <div className={style.notesBoard}>
                      {boardGroups.map((group, index) => (
                        <section key={group.key} className={style.boardGroup}>
                          <div
                            className={`${style.boardGroupHeader} ${index === 0 ? style.boardGroupHeaderTop : ""}`}
                          >
                            <span className={style.boardGroupTitle}>{group.label}</span>
                            <span className={style.boardGroupCount}>{group.notes.length}</span>
                            {index === 0 ? (
                              <>
                                <span className={style.boardHeaderLine} />
                                <div className={style.boardHeaderActions}>
                                  {!isCompact ? (
                                    <button
                                      type="button"
                                      className={`${style.viewToggleButton} ${view === "calendar" ? style.viewToggleButtonActive : ""}`}
                                      onClick={() => setView("calendar")}
                                    >
                                      <FiCalendar />
                                      Calendario
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={style.viewToggleButton}
                                    onClick={() => {
                                      setDeckScope("all");
                                      setIsDeckOpen(true);
                                    }}
                                    title="Tus flashcards de repaso"
                                  >
                                    <FiBookOpen />
                                    Repaso{dueCountAll ? ` (${dueCountAll})` : ""}
                                  </button>
                                </div>
                              </>
                            ) : null}
                          </div>

                          <div className={style.boardGrid}>
                            {group.notes.map((task) => {
                              const preview = stripHtml(task.contenido || "");

                              return (
                                <article
                                  key={task._id}
                                  role="button"
                                  tabIndex={0}
                                  className={`${style.noteCard} ${style[task.color] || style.color1}`}
                                  style={customNoteStyle(task.color)}
                                  onClick={() => handleEdit(task)}
                                  onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget) return;
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      handleEdit(task);
                                    }
                                  }}
                                  title={task.meta}
                                >
                                  {task.papelera ? (
                                    <span className={style.noteCardTrashActions}>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          restaurarNota(task._id);
                                        }}
                                        title="Restaurar nota"
                                        aria-label="Restaurar nota"
                                      >
                                        <FiRotateCcw />
                                      </button>
                                      <button
                                        type="button"
                                        className={style.noteCardTrashDanger}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          eliminarDefinitivo(task._id);
                                        }}
                                        title="Eliminar para siempre"
                                        aria-label="Eliminar para siempre"
                                      >
                                        <FiTrash2 />
                                      </button>
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className={`${style.noteCardStar} ${task.favorita ? style.noteCardStarOn : ""}`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleFavorita(task);
                                        }}
                                        aria-label={task.favorita ? "Quitar de favoritas" : "Marcar favorita"}
                                        title={task.favorita ? "Quitar de favoritas" : "Marcar favorita"}
                                        aria-pressed={Boolean(task.favorita)}
                                      >
                                        <FiStar />
                                      </button>
                                      <button
                                        type="button"
                                        className={style.noteCardDelete}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleDelete(task._id);
                                        }}
                                        aria-label="Mover a la papelera"
                                        title="Mover a la papelera"
                                      >
                                        <FiTrash2 />
                                      </button>
                                    </>
                                  )}

                                  <div className={style.noteCardBody}>
                                    <strong>{task.meta || "Sin título"}</strong>
                                    <p>{preview || "Sin contenido"}</p>
                                  </div>
                                  <div className={style.noteCardFooter}>
                                    <span>{formatShortDate(task.fecha)}</span>
                                    {task.carpeta ? (
                                      <span className={style.noteCardFolder}>
                                        <FiFolder />
                                        {task.carpeta}
                                      </span>
                                    ) : null}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
        </section>

        <div
          className={`${style.panelBackdrop} ${isEditorOpen ? style.panelBackdropVisible : ""}`}
          onClick={handleCloseEditor}
          aria-hidden="true"
        />

        <section
          className={`${style.editorCard} ${isEditorOpen ? style.editorCardOpen : ""} ${
            isEditorExpanded ? style.editorExpanded : ""
          }`}
          data-sheet={sheetWidth}
        >
            <div className={style.editorHeader}>
              <div className={style.headerTitleWrap}>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={form.meta}
                  onChange={(event) => handleFieldChange("meta", event.target.value)}
                  placeholder="Título de la nota…"
                  className={style.titleGhost}
                  aria-label="Título de la nota"
                />
                <button
                  type="button"
                  className={style.titleEditBtn}
                  onClick={() => {
                    titleInputRef.current?.focus();
                    titleInputRef.current?.select();
                  }}
                  aria-label="Editar título"
                  title="Editar título"
                >
                  <FiEdit2 />
                </button>
              </div>
              <div className={style.editorActions}>
                <span className={style.noteFolderSelect} title="Cambiar la nota a otra carpeta">
                  <FiFolder />
                  <select
                    value={form.carpeta || ""}
                    onChange={(event) => handleFieldChange("carpeta", event.target.value)}
                    aria-label="Cambiar la nota a otra carpeta"
                  >
                    <option value="">Sin carpeta</option>
                    {(form.carpeta && !folders.includes(form.carpeta)
                      ? [form.carpeta, ...folders]
                      : folders
                    ).map((folder) => (
                      <option key={folder} value={folder}>
                        {folder}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={style.noteFolderAdd}
                    onClick={handleCreateFolderInEditor}
                    aria-label="Nueva carpeta"
                    title="Nueva carpeta"
                  >
                    <FiFolderPlus />
                  </button>
                </span>
                {fechaNotaLabel ? (
                  <span className={style.editorDate} title="Fecha de la nota">
                    {fechaNotaLabel}
                  </span>
                ) : null}
                {notaAbierta ? (
                  <button
                    type="button"
                    className={`${style.iconButton} ${notaAbierta.favorita ? style.iconStarOn : ""}`}
                    onClick={() => toggleFavorita(notaAbierta)}
                    aria-label={notaAbierta.favorita ? "Quitar de favoritas" : "Marcar favorita"}
                    title={notaAbierta.favorita ? "Quitar de favoritas" : "Marcar favorita"}
                    aria-pressed={Boolean(notaAbierta.favorita)}
                  >
                    <FiStar />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={style.iconButton}
                  onClick={() => {
                    setDeckScope("note");
                    setIsDeckOpen(true);
                  }}
                  aria-label="Flashcards de esta nota"
                  title="Flashcards de esta nota"
                >
                  <FiLayers />
                  {dueCountNote ? (
                    <span className={style.iconBadge}>{dueCountNote}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={`${style.iconButton} ${isEditorExpanded ? style.iconButtonActive : ""}`}
                  onClick={() => setIsEditorExpanded((prev) => !prev)}
                  aria-label="Modo foco"
                  title="Modo foco"
                >
                  {isEditorExpanded ? <FiMinimize2 /> : <FiMaximize2 />}
                </button>
                {saveStatus === "error" ? (
                  <button
                    type="button"
                    className={`${style.unsavedBadge} ${style.retryBadge}`}
                    onClick={guardarAhora}
                    title="Volver a intentar guardar"
                  >
                    <span className={style.unsavedDot} />
                    No se guardó · reintentar
                  </button>
                ) : isDirty || saving ? (
                  <span className={`${style.unsavedBadge} ${style.savingBadge}`}>
                    <span className={style.unsavedDot} />
                    Guardando…
                  </span>
                ) : form.id ? (
                  <span className={style.savedBadge}>
                    <span className={style.savedDot} />
                    Guardado
                  </span>
                ) : (
                  <span className={style.savedBadge} style={{ opacity: 0.6 }}>
                    Se guarda solo
                  </span>
                )}
                <button type="button" className={style.iconButton} onClick={handleCloseEditor} aria-label="Cerrar panel">
                  <FiX />
                </button>
              </div>
            </div>

          <form id="note-editor-form" className={style.form} onSubmit={handleSubmit}>
            <div className={style.editorBody}>
                            <div className={style.editorWorkspace}>
              <aside className={style.editorToolbar} aria-label="Herramientas de texto">
                {/* Una sola fila compacta; lo secundario vive en los menús Aa / colores / ⋮ */}
                <div className={style.toolGroup} role="group" aria-label="Deshacer y rehacer">
                  <button
                    type="button"
                    className={style.toolbarButton}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => quillRef.current?.history?.undo()}
                    aria-label="Deshacer"
                    title="Deshacer (Cmd+Z)"
                  >
                    <FiRotateCcw />
                  </button>
                  <button
                    type="button"
                    className={style.toolbarButton}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => quillRef.current?.history?.redo()}
                    aria-label="Rehacer"
                    title="Rehacer (Cmd+Shift+Z)"
                  >
                    <FiRotateCw />
                  </button>
                </div>
                <div className={style.toolGroup} role="group" aria-label="Títulos">
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.header === 1 ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyBlockFormat("header", 1)}
                    aria-label="Título grande"
                    title="Título grande"
                  >
                    <FiType />
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.header === 2 ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyBlockFormat("header", 2)}
                    aria-label="Subtítulo"
                    title="Subtítulo"
                  >
                    <FiHash />
                  </button>
                </div>

                <div className={style.toolGroup} role="group" aria-label="Formato de texto">
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.bold ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyInlineFormat("bold")}
                    aria-label="Negrita"
                    title="Negrita"
                  >
                    <FiBold />
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.italic ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyInlineFormat("italic")}
                    aria-label="Itálica"
                    title="Itálica"
                  >
                    <FiItalic />
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.underline ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyInlineFormat("underline")}
                    aria-label="Subrayado"
                    title="Subrayado"
                  >
                    <FiUnderline />
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.strike ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyInlineFormat("strike")}
                    aria-label="Tachado"
                    title="Tachado"
                  >
                    <FiMinus />
                  </button>
                </div>

                <div className={style.toolGroup} role="group" aria-label="Listas">
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.bulletList ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={toggleBulletList}
                    aria-label="Lista con viñetas"
                    title="Lista con viñetas"
                  >
                    <FiList />
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.orderedList ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={toggleOrderedList}
                    aria-label="Lista numerada"
                    title="Lista numerada"
                  >
                    <span className={style.toolbarText}>1.</span>
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.checkList ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={toggleCheckList}
                    aria-label="Lista con check"
                    title="Lista con check"
                  >
                    <FiCheckSquare />
                  </button>
                </div>

                <div className={style.toolGroup} role="group" aria-label="Bloques">
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.blockquote ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyBlockFormat("blockquote")}
                    aria-label="Cita"
                    title="Cita"
                  >
                    <FiMessageSquare />
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.codeBlock ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyBlockFormat("code-block")}
                    aria-label="Bloque de código"
                    title="Bloque de código"
                  >
                    <FiCode />
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${style.highlightButton} ${activeFormats.background ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={toggleHighlight}
                    aria-label="Resaltar"
                    title="Resaltar (marcador)"
                  >
                    <span className={style.highlightSwatch} />
                  </button>
                </div>

                <div className={style.toolGroup} role="group" aria-label="Insertar y alinear">
                  <button
                    type="button"
                    className={style.toolbarButton}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleInsertImage}
                    aria-label="Insertar imagen"
                    title="Insertar imagen (se sube a la nube)"
                  >
                    <FiImage />
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.align === "" ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyAlign("")}
                    aria-label="Alinear izquierda"
                    title="Alinear izquierda"
                  >
                    <FiAlignLeft />
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.align === "center" ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyAlign("center")}
                    aria-label="Centrar"
                    title="Centrar"
                  >
                    <FiAlignCenter />
                  </button>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${activeFormats.align === "right" ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyAlign("right")}
                    aria-label="Alinear derecha"
                    title="Alinear derecha"
                  >
                    <FiAlignRight />
                  </button>
                </div>

                <div className={style.toolSpacer} />

                {/* Aa: tamaño de letra + mayúsculas */}
                <div className={style.toolMenuWrap} onMouseDown={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${toolMenu === "aa" ? style.toolbarButtonActive : ""}`}
                    onClick={() => setToolMenu((m) => (m === "aa" ? null : "aa"))}
                    aria-label="Tamaño de letra y mayúsculas"
                    title="Tamaño de letra y mayúsculas"
                    aria-expanded={toolMenu === "aa"}
                  >
                    <span className={style.toolbarText}>Aa</span>
                  </button>
                  {toolMenu === "aa" ? (
                    <div className={style.toolMenu} role="group" aria-label="Tamaño y mayúsculas">
                      <span className={style.toolMenuTitle}>Tamaño de letra</span>
                  <div className={style.fontSizeControl} aria-label="Tamaño de letra">
                    <button
                      type="button"
                      className={style.fontSizeStep}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => stepFontSize(-1)}
                      aria-label="Achicar letra"
                      title="Achicar letra"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className={style.fontSizeInput}
                      value={sizeInput}
                      min={MIN_FONT_PX}
                      max={MAX_FONT_PX}
                      onChange={(event) => setSizeInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitSizeInput();
                        }
                      }}
                      onBlur={commitSizeInput}
                      aria-label="Tamaño de letra en píxeles"
                      title="Tamaño de letra (px)"
                    />
                    <span className={style.fontSizeUnit}>px</span>
                    <button
                      type="button"
                      className={style.fontSizeStep}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => stepFontSize(1)}
                      aria-label="Agrandar letra"
                      title="Agrandar letra"
                    >
                      +
                    </button>
                  </div>
                
                      <span className={style.toolMenuTitle}>Mayúsculas</span>
                      <div className={style.toolMenuRow}>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${autoCapEnabled ? style.toolbarButtonActive : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setAutoCapEnabled((prev) => !prev)}
                    aria-pressed={autoCapEnabled}
                    aria-label="Mayúscula automática"
                    title={
                      autoCapEnabled
                        ? "Mayúscula automática: activada (tocá para escribir en minúscula)"
                        : "Mayúscula automática: desactivada"
                    }
                  >
                    <span className={style.toolbarText}>Aa</span>
                  </button>
                  <button
                    type="button"
                    className={style.toolbarButton}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyCaseToSelection("lower")}
                    aria-label="Pasar a minúsculas"
                    title="Pasar la selección a minúsculas"
                  >
                    <span className={style.toolbarText}>aa</span>
                  </button>
                  <button
                    type="button"
                    className={style.toolbarButton}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyCaseToSelection("upper")}
                    aria-label="Pasar a mayúsculas"
                    title="Pasar la selección a MAYÚSCULAS"
                  >
                    <span className={style.toolbarText}>AA</span>
                  </button>
                
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Colores: papel + texto */}
                <div className={style.toolMenuWrap} onMouseDown={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${toolMenu === "color" ? style.toolbarButtonActive : ""}`}
                    onClick={() => setToolMenu((m) => (m === "color" ? null : "color"))}
                    aria-label="Color del papel y del texto"
                    title="Color del papel y del texto"
                    aria-expanded={toolMenu === "color"}
                  >
                    <FiDroplet />
                  </button>
                  {toolMenu === "color" ? (
                    <div className={style.toolMenu} role="group" aria-label="Colores">
                      <span className={style.toolMenuTitle}>Papel</span>
                      <div className={style.colorGrid}>
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            className={`${style.colorOption} ${style[color.value]} ${
                              form.color === color.value ? style.colorOptionActive : ""
                            }`}
                            onClick={() => handleFieldChange("color", color.value)}
                            aria-label={`Color de fondo ${color.label}`}
                            title={`Fondo ${color.label}`}
                          />
                        ))}
                      </div>
                      <span className={style.toolMenuTitle}>Texto</span>
                  <div className={style.textColorGrid} aria-label="Color de texto">
                    {TEXT_COLOR_OPTIONS.map((color) => {
                      const isDefault = !color.value && !activeFormats.color;
                      const isActive = color.value && activeFormats.color === color.value;

                      return (
                        <button
                          key={color.label}
                          type="button"
                          className={`${style.textColorOption} ${isDefault || isActive ? style.textColorOptionActive : ""}`}
                          style={{ backgroundColor: color.swatch }}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyTextColor(color.value)}
                          aria-label={`Texto ${color.label}`}
                          title={`Texto ${color.label}`}
                        />
                      );
                    })}
                  </div>
                
                    </div>
                  ) : null}
                </div>

                {/* ⋮: ancho de la hoja */}
                <div className={style.toolMenuWrap} onMouseDown={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className={`${style.toolbarButton} ${toolMenu === "more" ? style.toolbarButtonActive : ""}`}
                    onClick={() => setToolMenu((m) => (m === "more" ? null : "more"))}
                    aria-label="Más opciones"
                    title="Más opciones (ancho de la hoja)"
                    aria-expanded={toolMenu === "more"}
                  >
                    <FiMoreVertical />
                  </button>
                  {toolMenu === "more" ? (
                    <div className={style.toolMenu} role="group" aria-label="Más opciones">
                      <span className={style.toolMenuTitle}>Ancho de la hoja</span>
                <div className={style.widthControl} role="group" aria-label="Ancho de la hoja">
                  <span className={style.widthLabel}>Ancho</span>
                  {SHEET_WIDTH_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${style.widthButton} ${sheetWidth === opt.value ? style.widthButtonActive : ""}`}
                      onClick={() => setSheetWidth(opt.value)}
                      title={opt.title}
                      aria-pressed={sheetWidth === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                    </div>
                  ) : null}
                </div>

              </aside>

              {showOutline && outline.length > 0 ? (
                <div className={style.outlinePanel}>
                  <div className={style.outlinePanelHead}>
                    <p className={style.outlineTitle}>Índice</p>
                    <button
                      type="button"
                      className={style.outlineClose}
                      onClick={() => setShowOutline(false)}
                      aria-label="Cerrar índice"
                    >
                      <FiX />
                    </button>
                  </div>
                  <div className={style.outlineList}>
                    {outline.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`${style.outlineItem} ${item.level === 2 ? style.outlineItemSub : ""}`}
                        onClick={() => scrollToHeading(item.id)}
                      >
                        {item.text}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

                            {/* Páginas como pestañas del papel (como solapas de cuaderno) */}
              <div className={style.pagesTabs} aria-label="Páginas de la nota">
                {notePages.map((page, index) => {
                  const isActive = index === activeNotePageIndex;
                  const isEditing = editingPageIndex === index;

                  return (
                    <div
                      key={`page-${index}`}
                      className={`${style.pageTab} ${isActive ? style.pageTabActive : ""}`}
                    >
                      {isEditing ? (
                        <input
                          className={style.notePageRenameInput}
                          value={editingTitle}
                          autoFocus
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onBlur={() => commitRename(index)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitRename(index);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            className={style.pageTabSelect}
                            onClick={() => handleSelectPage(index)}
                            onDoubleClick={() => startRename(index)}
                            title={getPageLabel(page, index)}
                          >
                            <span className={style.notePageNumber}>{index + 1}</span>
                            <span className={style.pageTabName}>{getPageLabel(page, index)}</span>
                          </button>
                          {isActive ? (
                            <span className={style.pageTabActions}>
                              <button
                                type="button"
                                className={style.notePageActionButton}
                                onClick={() => startRename(index)}
                                aria-label="Renombrar página"
                                title="Renombrar"
                              >
                                <FiEdit2 />
                              </button>
                              <button
                                type="button"
                                className={`${style.notePageActionButton} ${style.notePageDeleteButton}`}
                                onClick={() => handleDeletePage(index)}
                                disabled={notePages.length <= 1}
                                aria-label="Eliminar página"
                                title={notePages.length <= 1 ? "No podés eliminar la única página" : "Eliminar página"}
                              >
                                <FiTrash2 />
                              </button>
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className={style.pageTabAdd}
                  onClick={handleAddPage}
                  aria-label="Agregar página"
                  title="Agregar página"
                >
                  <FiFilePlus />
                  Página
                </button>
              </div>

              <div className={`${style.field} ${style.editorField}`}>
                <div
                  className={`${style.editorShell} ${style.notePaper} ${style[form.color] || style.color1}`}
                  style={customNoteStyle(form.color)}
                >
                  <button
                    type="button"
                    className={style.expandButton}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setIsEditorExpanded((prev) => !prev)}
                    aria-label={isEditorExpanded ? "Achicar área de escritura" : "Expandir área de escritura"}
                    title={isEditorExpanded ? "Achicar" : "Expandir"}
                  >
                    {isEditorExpanded ? <FiMinimize2 /> : <FiMaximize2 />}
                  </button>
                  <div ref={editorRef} className={style.editor} />
                </div>
                <span className={style.wordCountPill} title="Palabras escritas">
                  {editorStats.words} palabra{editorStats.words === 1 ? "" : "s"}
                </span>
              </div>
              </div>
            </div>

            {error ? <p className={style.errorText}>{error}</p> : null}
            {message ? <p className={style.successText}>{message}</p> : null}

          </form>
        </section>
      </div>

      {isCardFormOpen ? (
        <div className={`${style.fcOverlay} ${style.fcOverlayElevated}`} onClick={() => setIsCardFormOpen(false)}>
          <form
            className={style.fcModal}
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSaveFlashcard}
          >
            <div className={style.fcModalHead}>
              <div>
                <p className={style.cardKicker}>Flashcard</p>
                <h3>Nueva tarjeta de repaso</h3>
              </div>
              <button
                type="button"
                className={style.iconButton}
                onClick={() => setIsCardFormOpen(false)}
                aria-label="Cerrar"
              >
                <FiX />
              </button>
            </div>
            <label className={style.fcField}>
              <span>Pregunta (frente)</span>
              <textarea
                value={cardForm.front}
                onChange={(event) => setCardForm((prev) => ({ ...prev, front: event.target.value }))}
                placeholder="¿Qué querés recordar?"
                autoFocus
              />
            </label>
            <label className={style.fcField}>
              <span>Respuesta (dorso)</span>
              <textarea
                value={cardForm.back}
                onChange={(event) => setCardForm((prev) => ({ ...prev, back: event.target.value }))}
                placeholder="La respuesta, definición o concepto"
              />
            </label>
            {cardError ? <p className={style.fcCardError}>{cardError}</p> : null}
            <div className={style.fcActions}>
              <button type="button" className={style.ghostButton} onClick={() => setIsCardFormOpen(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                className={style.saveButton}
                disabled={cardSaving || !cardForm.front.trim() || !cardForm.back.trim()}
              >
                <FiPlus />
                {cardSaving ? "Guardando..." : "Guardar tarjeta"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isDeckOpen ? (
        <div className={style.fcOverlay} onClick={() => setIsDeckOpen(false)}>
          <div className={style.fcModal} onClick={(event) => event.stopPropagation()}>
            <div className={style.fcModalHead}>
              <div>
                <p className={style.cardKicker}>Repaso</p>
                <h3>
                  {deckScope === "note"
                    ? "Tarjetas de esta nota"
                    : "Todas tus flashcards"}{" "}
                  ({visibleDeckCards.length})
                </h3>
              </div>
              <button
                type="button"
                className={style.iconButton}
                onClick={() => setIsDeckOpen(false)}
                aria-label="Cerrar"
              >
                <FiX />
              </button>
            </div>

            {form.id ? (
              <div className={style.fcScopeTabs}>
                <button
                  type="button"
                  className={`${style.fcScopeTab} ${deckScope === "note" ? style.fcScopeTabActive : ""}`}
                  onClick={() => setDeckScope("note")}
                >
                  Esta nota ({noteCards.length})
                </button>
                <button
                  type="button"
                  className={`${style.fcScopeTab} ${deckScope === "all" ? style.fcScopeTabActive : ""}`}
                  onClick={() => setDeckScope("all")}
                >
                  Todas ({allCards.length})
                </button>
              </div>
            ) : null}

            {isEditorOpen ? (
              <button type="button" className={style.fcNewButton} onClick={openCardForm}>
                <FiPlus />
                Nueva tarjeta {getSelectedText() ? "(de la selección)" : ""}
              </button>
            ) : null}

            {visibleDeckCards.length === 0 ? (
              <p className={style.fcEmpty}>
                {deckScope === "note"
                  ? "Esta nota todavía no tiene tarjetas. Seleccioná texto y tocá “Nueva tarjeta” para crear una desde tus apuntes."
                  : "Todavía no tenés tarjetas. Abrí una nota, seleccioná texto y creá una flashcard."}
              </p>
            ) : (
              <>
                {visibleDueCards.length > 0 ? (
                  <button
                    type="button"
                    className={style.fcStudyButton}
                    onClick={() => startStudy(visibleDueCards)}
                  >
                    <FiBookOpen />
                    Repasar {visibleDueCards.length} para hoy
                  </button>
                ) : (
                  <div className={style.fcUpToDate}>
                    <strong>¡Estás al día!</strong>
                    <span>No hay tarjetas para repasar hoy.</span>
                    <button
                      type="button"
                      className={style.fcStudyGhost}
                      onClick={() => startStudy(visibleDeckCards)}
                    >
                      Repasar todas igual ({visibleDeckCards.length})
                    </button>
                  </div>
                )}
                {deckScope === "all" ? (
                  cardsByNote.map((group) => {
                    const groupDue = group.cards.filter(isCardDue);
                    return (
                      <div key={group.noteId || "__none__"} className={style.fcGroup}>
                        <div className={style.fcGroupHead}>
                          <strong>{group.noteTitle}</strong>
                          <button
                            type="button"
                            className={style.fcGroupStudy}
                            onClick={() => startStudy(groupDue.length ? groupDue : group.cards)}
                          >
                            <FiBookOpen />
                            Repasar{groupDue.length ? ` (${groupDue.length})` : ""}
                          </button>
                        </div>
                        <div className={style.fcList}>
                          {group.cards.map((card) => (
                            <div key={card.id} className={style.fcRow}>
                              <div className={style.fcRowText}>
                                <strong>{card.front}</strong>
                                <span>{card.back}</span>
                                <small className={isCardDue(card) ? style.fcDueNow : ""}>
                                  {formatDueLabel(card)}
                                </small>
                              </div>
                              <button
                                type="button"
                                className={style.fcDelete}
                                onClick={() => handleDeleteFlashcard(card)}
                                aria-label="Eliminar tarjeta"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={style.fcList}>
                    {visibleDeckCards.map((card) => (
                      <div key={card.id} className={style.fcRow}>
                        <div className={style.fcRowText}>
                          <strong>{card.front}</strong>
                          <span>{card.back}</span>
                          <small className={isCardDue(card) ? style.fcDueNow : ""}>
                            {formatDueLabel(card)}
                          </small>
                        </div>
                        <button
                          type="button"
                          className={style.fcDelete}
                          onClick={() => handleDeleteFlashcard(card)}
                          aria-label="Eliminar tarjeta"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      {isStudyOpen && studyDeck[studyIndex] ? (
        <div className={style.fcOverlay}>
          <div className={style.fcStudyModal}>
            <div className={style.fcStudyTop}>
              <span>
                {studyIndex + 1} / {studyDeck.length}
              </span>
              <button
                type="button"
                className={style.iconButton}
                onClick={() => setIsStudyOpen(false)}
                aria-label="Salir del repaso"
              >
                <FiX />
              </button>
            </div>

            <button
              type="button"
              className={`${style.fcCard} ${studyFlipped ? style.fcCardFlipped : ""}`}
              onClick={() => setStudyFlipped((prev) => !prev)}
            >
              <span className={style.fcCardLabel}>{studyFlipped ? "Respuesta" : "Pregunta"}</span>
              <p className={style.fcCardText}>
                {studyFlipped ? studyDeck[studyIndex].back : studyDeck[studyIndex].front}
              </p>
              {!studyFlipped ? (
                <span className={style.fcCardHint}>Tocá la tarjeta para ver la respuesta</span>
              ) : null}
            </button>

            {studyFlipped ? (
              <div className={style.fcGrade}>
                <button type="button" className={style.fcAgain} onClick={() => handleGradeCard(false)}>
                  Otra vez
                </button>
                <button type="button" className={style.fcKnown} onClick={() => handleGradeCard(true)}>
                  Lo sé
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={style.fcStudyButton}
                onClick={() => setStudyFlipped(true)}
              >
                Mostrar respuesta
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default TaskStudioPage;
