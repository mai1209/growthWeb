import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlignCenter,
  FiAlignLeft,
  FiAlignRight,
  FiBold,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiCheckSquare,
  FiClock,
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
  FiTrash2,
  FiType,
  FiUnderline,
  FiX,
} from "react-icons/fi";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { taskService } from "../api";
import style from "../style/TaskStudio.module.css";

// Habilita tamaño de fuente por píxeles (ej. "16px") en vez de small/large.
const SizeStyle = Quill.import("attributors/style/size");
SizeStyle.whitelist = null; // permitir cualquier valor en px
Quill.register(SizeStyle, true);

const MIN_FONT_PX = 8;
const MAX_FONT_PX = 96;
const DEFAULT_FONT_PX = 16;

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
  color: "color1",
  carpeta: "",
  flashcards: [],
});

const ALL_FOLDERS = "__all__";

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
  const [sizeInput, setSizeInput] = useState(DEFAULT_FONT_PX);
  const [view, setView] = useState("notes");
  const [activeFolder, setActiveFolder] = useState(ALL_FOLDERS);
  const [customFolders, setCustomFolders] = useState(() => readStoredFolders(activeWorkspace));
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

  const markDirty = () => {
    isDirtyRef.current = true;
    setIsDirty(true);
  };

  const clearDirty = () => {
    isDirtyRef.current = false;
    setIsDirty(false);
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
      placeholder: "Escribí el contenido de la nota...",
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

    quill.on("text-change", handleTextChange);
    quill.on("selection-change", handleSelectionChange);
    quillRef.current = quill;

    return () => {
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
      if (isEditorOpen && isDirtyRef.current) {
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
      if (isDirtyRef.current) {
        const leave = window.confirm(
          "Tenés cambios sin guardar en la nota. Si salís se pierden.\n\n¿Salir igual sin actualizar?"
        );

        if (!leave) {
          // Se queda: re-armamos la trampa para mantenerlo en la nota.
          window.history.pushState(null, "", window.location.href);
          return;
        }
      }

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
  const effectiveView = isCompact ? "notes" : view;

  const folderCounts = useMemo(() => {
    const counts = new Map();
    tasks.forEach((task) => {
      const folder = (task.carpeta || "").trim();
      if (folder) counts.set(folder, (counts.get(folder) || 0) + 1);
    });
    return counts;
  }, [tasks]);

  const folders = useMemo(() => {
    const set = new Set(customFolders.filter(Boolean));
    folderCounts.forEach((_, folder) => set.add(folder));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [customFolders, folderCounts]);

  const boardTasks = useMemo(() => {
    const base =
      activeFolder === ALL_FOLDERS
        ? tasks
        : tasks.filter((task) => (task.carpeta || "").trim() === activeFolder);

    return base;
  }, [tasks, activeFolder]);

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
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    if (
      isDirtyRef.current &&
      !window.confirm(
        "Tenés cambios sin guardar en la nota. Si cerrás se pierden.\n\n¿Cerrar igual sin actualizar?"
      )
    ) {
      return;
    }

    clearDirty();
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
    setIsEditorOpen(true);
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm("¿Eliminar nota?")) return;

    try {
      await taskService.delete(taskId);
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
      if (form.id === taskId) {
        clearDirty();
        handleCloseEditor();
      }
    } catch (deleteError) {
      setError("No se pudo eliminar la nota.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    if (!form.meta.trim()) {
      setError("El título es obligatorio.");
      setSaving(false);
      return;
    }

    const payload = {
      tipo: "note",
      workspace: activeWorkspace,
      meta: form.meta.trim(),
      contenido: serializeNotePages(
        notePages.map((page, index) =>
          index === activeNotePageIndexRef.current ? { ...page, contenido: getCurrentEditorHtml() } : page
        )
      ),
      fecha: form.fecha,
      horario: form.horario,
      color: form.color,
      carpeta: form.carpeta || "",
      flashcards: form.flashcards || [],
    };

    try {
      const response = form.id
        ? await taskService.update(form.id, payload)
        : await taskService.create(payload);

      const savedTask = response.data;

      setTasks((prev) =>
        form.id
          ? prev.map((task) => (task._id === savedTask._id ? savedTask : task))
          : [savedTask, ...prev]
      );

      setMessage(form.id ? "Nota actualizada." : "Nota creada.");
      clearDirty();
      resetForm();
      setIsEditorOpen(false);
      consumeHistoryTrap();
    } catch (submitError) {
      setError(submitError.response?.data?.message || "No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={style.page}>
   

      <div className={style.layout}>
        <section className={style.listCard}>
            <div className={style.editorHeader}>
              <div>
                <p className={style.cardKicker}>Notas</p>
                <h2 className={style.listTitle}>
                  Tus notas
                  {boardTasks.length ? (
                    <span className={style.listCount}>{boardTasks.length}</span>
                  ) : null}
                </h2>
              </div>
              <div className={style.listHeaderActions}>
                {!isCompact ? (
                  <div className={style.viewToggle} role="tablist" aria-label="Vista de notas">
                    <button
                      type="button"
                      className={`${style.viewToggleButton} ${view === "notes" ? style.viewToggleButtonActive : ""}`}
                      onClick={() => setView("notes")}
                      aria-pressed={view === "notes"}
                    >
                      <FiFileText />
                      Notas
                    </button>
                    <button
                      type="button"
                      className={`${style.viewToggleButton} ${view === "calendar" ? style.viewToggleButtonActive : ""}`}
                      onClick={() => setView("calendar")}
                      aria-pressed={view === "calendar"}
                    >
                      <FiCalendar />
                      Calendario
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className={style.secondaryButton}
                  onClick={() => {
                    setDeckScope("all");
                    setIsDeckOpen(true);
                  }}
                  title="Tus flashcards de repaso"
                >
                  <FiBookOpen />
                  Repaso{dueCountAll ? ` (${dueCountAll})` : ""}
                </button>
                <button type="button" className={style.secondaryButton} onClick={() => handleNewNote()}>
                  <FiPlus />
                  Nueva nota
                </button>
              </div>
            </div>

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
            ) : (
              <div className={style.notesLayout}>
                <aside className={style.folderSidebar} aria-label="Carpetas">
                  <div className={style.folderSidebarTop}>
                    <span className={style.folderSidebarTitle}>Carpetas</span>
                    <button
                      type="button"
                      className={style.folderAddIcon}
                      onClick={handleCreateFolder}
                      aria-label="Nueva carpeta"
                      title="Nueva carpeta"
                    >
                      <FiFolderPlus />
                    </button>
                  </div>

                  <div className={style.folderList}>
                    <button
                      type="button"
                      className={`${style.folderItem} ${activeFolder === ALL_FOLDERS ? style.folderItemActive : ""}`}
                      onClick={() => setActiveFolder(ALL_FOLDERS)}
                    >
                      <FiFolder />
                      <span className={style.folderItemName}>Todas</span>
                      <span className={style.folderItemCount}>{tasks.length}</span>
                    </button>

                    {folders.map((folder) => {
                      const count = folderCounts.get(folder) || 0;
                      const isActive = activeFolder === folder;

                      return (
                        <div
                          key={folder}
                          className={`${style.folderItem} ${isActive ? style.folderItemActive : ""}`}
                        >
                          <button
                            type="button"
                            className={style.folderItemMain}
                            onClick={() => setActiveFolder(folder)}
                          >
                            <FiFolder />
                            <span className={style.folderItemName}>{folder}</span>
                            <span className={style.folderItemCount}>{count}</span>
                          </button>
                          {count === 0 ? (
                            <button
                              type="button"
                              className={style.folderItemDelete}
                              onClick={() => handleDeleteFolder(folder)}
                              aria-label={`Eliminar carpeta ${folder}`}
                              title="Eliminar carpeta vacía"
                            >
                              <FiX />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </aside>

                <div className={style.notesBoardWrap}>
                  {boardTasks.length === 0 ? (
                    <p className={style.emptyState}>
                      {activeFolder === ALL_FOLDERS
                        ? "Todavía no tenés notas. Creá la primera con “Nueva nota”."
                        : `La carpeta “${activeFolder}” está vacía.`}
                    </p>
                  ) : (
                    <div className={style.notesBoard}>
                      {boardGroups.map((group) => (
                        <section key={group.key} className={style.boardGroup}>
                          <div className={style.boardGroupHeader}>
                            <span className={style.boardGroupTitle}>{group.label}</span>
                            <span className={style.boardGroupCount}>{group.notes.length}</span>
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
                                  <button
                                    type="button"
                                    className={style.noteCardDelete}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDelete(task._id);
                                    }}
                                    aria-label="Eliminar nota"
                                    title="Eliminar nota"
                                  >
                                    <FiTrash2 />
                                  </button>

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
              <div>
                <p className={style.cardKicker}>Editor</p>
                <h2>{form.id ? form.meta || "Editar nota" : "Nueva nota"}</h2>
              </div>
              <div className={style.editorActions}>
                <span className={style.wordCount} title="Palabras y tiempo de lectura">
                  {editorStats.words} palabra{editorStats.words === 1 ? "" : "s"}
                  {editorStats.minutes ? ` · ${editorStats.minutes} min` : ""}
                </span>
                <button
                  type="button"
                  className={`${style.iconButton} ${style.outlineButton} ${showOutline ? style.iconButtonActive : ""}`}
                  onClick={() => setShowOutline((prev) => !prev)}
                  aria-label="Índice de la nota"
                  title="Índice"
                  disabled={outline.length === 0}
                >
                  <FiList />
                </button>
                <div className={style.widthControl} role="group" aria-label="Ancho de la hoja">
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
                {isDirty ? (
                  <span className={style.unsavedBadge}>
                    <span className={style.unsavedDot} />
                    Sin guardar
                  </span>
                ) : null}
                <button
                  type="submit"
                  form="note-editor-form"
                  className={style.saveButton}
                  disabled={saving}
                >
                  <FiPlus />
                  {saving ? "Guardando..." : form.id ? "Actualizar nota" : "Guardar nota"}
                </button>
                <button type="button" className={style.iconButton} onClick={handleCloseEditor} aria-label="Cerrar panel">
                  <FiX />
                </button>
              </div>
            </div>

          <form id="note-editor-form" className={style.form} onSubmit={handleSubmit}>
            <div className={style.noteMetaBar}>
              <div className={style.noteMetaInfo} aria-label="Fecha y hora de la nota">
                <span>
                  <FiCalendar /> {form.fecha}
                </span>
                <span>
                  <FiClock /> {form.horario}
                </span>
                <span className={style.noteFolderSelect}>
                  <FiFolder />
                  <select
                    value={form.carpeta || ""}
                    onChange={(event) => handleFieldChange("carpeta", event.target.value)}
                    aria-label="Carpeta de la nota"
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
              </div>

              <div className={style.backgroundPicker}>
                <span>Fondo</span>
                <div className={style.colorGrid}>
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`${style.colorOption} ${style[color.value]} ${
                        form.color === color.value ? style.colorOptionActive : ""
                      }`}
                      onClick={() => handleFieldChange("color", color.value)}
                      aria-label={`Color ${color.label}`}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <label className={`${style.field} ${style.titleField}`}>
              <span>Título</span>
              <input
                type="text"
                value={form.meta}
                onChange={(event) => handleFieldChange("meta", event.target.value)}
                placeholder="Ej: Ideas para promociones de junio"
                className={`${style.input} ${style.titleInput}`}
              />
            </label>

            <div className={style.editorBody}>
              <aside className={style.pagesColumn} aria-label="Páginas de la nota">
                <p className={style.pagesColumnTitle}>Páginas</p>
                <div className={style.pagesList}>
                  {notePages.map((page, index) => {
                    const isActive = index === activeNotePageIndex;
                    const isEditing = editingPageIndex === index;

                    return (
                      <div
                        key={`page-${index}`}
                        className={`${style.notePageItem} ${isActive ? style.notePageItemActive : ""}`}
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
                          <button
                            type="button"
                            className={style.notePageSelect}
                            onClick={() => handleSelectPage(index)}
                            onDoubleClick={() => startRename(index)}
                            title={getPageLabel(page, index)}
                          >
                            <span className={style.notePageNumber}>{index + 1}</span>
                            <span className={style.notePageName}>{getPageLabel(page, index)}</span>
                          </button>
                        )}

                        {!isEditing ? (
                          <div className={style.notePageItemActions}>
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
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={style.addPageButton}
                  onClick={handleAddPage}
                  aria-label="Agregar página"
                  title="Agregar página"
                >
                  <FiFilePlus />
                  Agregar página
                </button>
              </aside>

              <div className={style.editorWorkspace}>
              <aside className={style.editorToolbar} aria-label="Herramientas de texto">
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

              <div className={`${style.field} ${style.editorField}`}>
                <div className={`${style.editorShell} ${style.notePaper} ${style[form.color] || style.color1}`}>
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
