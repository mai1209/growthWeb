import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlignCenter,
  FiAlignLeft,
  FiAlignRight,
  FiBold,
  FiCalendar,
  FiChevronDown,
  FiCheckSquare,
  FiClock,
  FiCode,
  FiEdit2,
  FiEdit3,
  FiFilePlus,
  FiHash,
  FiItalic,
  FiList,
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
import { isTaskCompletedOnDate } from "../utils/tasks";
import style from "../style/TaskStudio.module.css";

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

const formatDayGroupLabel = (value) => {
  const date = getLocalDateFromValue(value);

  if (!date) return "Día · Sin fecha";

  return `Día · ${date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
};

const formatTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const getNoteCardTime = (task) => {
  if (task?.horario && task.horario !== "12:00") {
    return task.horario;
  }

  return formatTime(task?.createdAt || task?.updatedAt) || task?.horario || "--:--";
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

const groupNotesByDay = (items = []) => {
  const grouped = items.reduce((accumulator, task) => {
    const key = getDateInputValue(getLocalDateFromValue(task.fecha) || new Date());

    if (!accumulator.has(key)) {
      accumulator.set(key, []);
    }

    accumulator.get(key).push(task);
    return accumulator;
  }, new Map());

  return [...grouped.entries()].map(([key, notes]) => ({
    key,
    label: formatDayGroupLabel(key),
    notes,
  }));
};

const buildInitialFormState = () => ({
  id: null,
  meta: "",
  contenido: "",
  fecha: getDateInputValue(new Date()),
  horario: getTimeInputValue(new Date()),
  color: "color1",
});

function TaskStudioPage({ activeWorkspace = "personal" }) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const selectionRef = useRef(null);
  const calendarInputRef = useRef(null);
  const activeNotePageIndexRef = useRef(0);
  const isDirtyRef = useRef(false);
  const historyTrapRef = useRef(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getMonthInputValue(new Date()));
  const [selectedDay, setSelectedDay] = useState("");
  const [form, setForm] = useState(buildInitialFormState);
  const [notePages, setNotePages] = useState([createNotePage()]);
  const [activeNotePageIndex, setActiveNotePageIndex] = useState(0);
  const [editingPageIndex, setEditingPageIndex] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
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

    const handleTextChange = (delta, oldDelta, source) => {
      const html = quill.root.innerHTML === "<p><br></p>" ? "" : quill.root.innerHTML;
      if (source === "user") {
        markDirty();
      }
      setForm((prev) => (prev.contenido === html ? prev : { ...prev, contenido: html }));
      setNotePages((prev) =>
        prev.map((page, index) =>
          index === activeNotePageIndexRef.current ? { ...page, contenido: html } : page
        )
      );

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
      return;
    }

    quillRef.current.clipboard.dangerouslyPasteHTML(form.contenido);
  }, [form.contenido]);

  const filteredTasks = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);

    return tasks
      .filter((task) => {
        if (!task?.fecha) return false;

        const taskDate = getLocalDateFromValue(task.fecha);
        if (!taskDate) return false;

        const matchesMonth =
          taskDate.getFullYear() === monthStart.getFullYear() &&
          taskDate.getMonth() === monthStart.getMonth();

        if (!matchesMonth) return false;

        if (!selectedDay) return true;

        return getDateInputValue(taskDate) === selectedDay;
      })
      .sort((a, b) => {
        const aTime = getLocalDateFromValue(a.fecha)?.getTime() || 0;
        const bTime = getLocalDateFromValue(b.fecha)?.getTime() || 0;
        return bTime - aTime;
      });
  }, [tasks, selectedMonth, selectedDay]);

  const groupedNotes = useMemo(() => groupNotesByDay(filteredTasks), [filteredTasks]);

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

  const handleOpenCalendar = () => {
    const input = calendarInputRef.current;

    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
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

  const applyTextSize = (value) => {
    if (!quillRef.current) return;

    const quill = quillRef.current;
    const range = getEditorRange();

    quill.focus();

    if (range) {
      quill.setSelection(range);
      selectionRef.current = range;
    }

    quill.format("size", value || false);
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

  const handleNewNote = () => {
    resetForm();
    clearDirty();
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
                  {filteredTasks.length ? (
                    <span className={style.listCount}>{filteredTasks.length}</span>
                  ) : null}
                </h2>
              </div>
              <button type="button" className={style.secondaryButton} onClick={handleNewNote}>
                <FiPlus />
                Nueva nota
              </button>
            </div>

            <div className={style.noteCalendarFilter}>
              <div
                className={style.noteCalendarButton}
                role="button"
                tabIndex={0}
                onClick={handleOpenCalendar}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenCalendar();
                  }
                }}
              >
                <span>
                  <FiCalendar />
                  Calendario
                </span>
                <strong>{selectedDay || formatMonthLabel(selectedMonth)}</strong>
                <FiChevronDown className={style.noteCalendarChevron} />
                <input
                  ref={calendarInputRef}
                  type="date"
                  tabIndex={-1}
                  value={selectedDay}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedDay(value);
                    if (value) {
                      setSelectedMonth(value.slice(0, 7));
                    }
                  }}
                />
              </div>

              <button
                type="button"
                className={style.monthViewButton}
                onClick={() => setSelectedDay("")}
              >
                Ver mes completo
              </button>
            </div>

            {loading ? (
              <p className={style.emptyState}>Cargando notas...</p>
            ) : filteredTasks.length === 0 ? (
              <p className={style.emptyState}>No hay notas para ese filtro.</p>
            ) : (
              <div className={style.groupList}>
                {groupedNotes.map((group) => (
                  <section key={group.key} className={style.noteDayGroup}>
                    <div className={style.groupHeader}>
                      <span>{group.label}</span>
                    </div>

                    <div className={style.noteDayGrid}>
                      {group.notes.map((task) => {
                        const preview = stripHtml(task.contenido || "");
                        const completed = isTaskCompletedOnDate(task, task.fecha);
                        const noteDateLabel = `${formatShortDate(task.fecha)} · ${getNoteCardTime(task)}`;

                        return (
                          <article
                            key={task._id}
                            role="button"
                            tabIndex={0}
                            className={`${style.taskRow} ${style[task.color] || style.color1} ${
                              completed ? style.taskRowCompleted : ""
                            }`}
                            onClick={() => handleEdit(task)}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return;

                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleEdit(task);
                              }
                            }}
                          >
                            <div className={style.taskRowCopy}>
                              <span className={style.noteDate}>{noteDateLabel}</span>
                              <h3>{task.meta}</h3>
                              <p>{preview || "Sin contenido. Podés abrir la nota y escribir el detalle."}</p>
                            </div>

                            <div className={style.taskRowActions}>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleEdit(task);
                                }}
                              >
                                <FiEdit3 />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDelete(task._id);
                                }}
                              >
                                <FiTrash2 />
                                Eliminar
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
        </section>

        <div
          className={`${style.panelBackdrop} ${isEditorOpen ? style.panelBackdropVisible : ""}`}
          onClick={handleCloseEditor}
          aria-hidden="true"
        />

        <section className={`${style.editorCard} ${isEditorOpen ? style.editorCardOpen : ""}`}>
            <div className={style.editorHeader}>
              <div>
                <p className={style.cardKicker}>Editor</p>
                <h2>{form.id ? form.meta || "Editar nota" : "Nueva nota"}</h2>
              </div>
              <div className={style.editorActions}>
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

            <label className={style.field}>
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
                <div className={style.textSizeGrid} aria-label="Tamaño de texto">
                  {[
                    { label: "S", value: "small", title: "Texto chico" },
                    { label: "M", value: "", title: "Texto normal" },
                    { label: "L", value: "large", title: "Texto grande" },
                  ].map((size) => (
                    <button
                      key={size.label}
                      type="button"
                      className={`${style.textSizeButton} ${
                        activeFormats.size === size.value ? style.textSizeButtonActive : ""
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyTextSize(size.value)}
                      aria-label={size.title}
                      title={size.title}
                    >
                      {size.label}
                    </button>
                  ))}
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

              <label className={`${style.field} ${style.editorField}`}>
                <div className={`${style.editorShell} ${style.notePaper} ${style[form.color] || style.color1}`}>
                  <div ref={editorRef} className={style.editor} />
                </div>
              </label>
              </div>
            </div>

            {error ? <p className={style.errorText}>{error}</p> : null}
            {message ? <p className={style.successText}>{message}</p> : null}

          </form>
        </section>
      </div>
    </section>
  );
}

export default TaskStudioPage;
