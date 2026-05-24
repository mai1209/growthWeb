import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlignCenter,
  FiAlignLeft,
  FiAlignRight,
  FiBold,
  FiCalendar,
  FiClock,
  FiCode,
  FiEdit3,
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

const formatGroupTitle = (value) =>
  new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const stripHtml = (value = "") =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const initialFormState = {
  id: null,
  meta: "",
  contenido: "",
  fecha: getDateInputValue(new Date()),
  horario: "12:00",
  color: "color1",
};

function TaskStudioPage({ activeWorkspace = "personal" }) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const selectionRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getMonthInputValue(new Date()));
  const [selectedDay, setSelectedDay] = useState("");
  const [form, setForm] = useState(initialFormState);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    align: "",
    bold: false,
    blockquote: false,
    codeBlock: false,
    color: "",
    header: false,
    italic: false,
    orderedList: false,
    strike: false,
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
    strike: Boolean(formats.strike),
    underline: Boolean(formats.underline),
    bulletList: formats.list === "bullet",
  });

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

    const handleTextChange = () => {
      const html = quill.root.innerHTML === "<p><br></p>" ? "" : quill.root.innerHTML;
      setForm((prev) => (prev.contenido === html ? prev : { ...prev, contenido: html }));

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

        const taskDate = new Date(task.fecha);
        const matchesMonth =
          taskDate.getFullYear() === monthStart.getFullYear() &&
          taskDate.getMonth() === monthStart.getMonth();

        if (!matchesMonth) return false;

        if (!selectedDay) return true;

        return getDateInputValue(taskDate) === selectedDay;
      })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [tasks, selectedMonth, selectedDay]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const getEditorRange = () => {
    if (!quillRef.current) return null;

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

  const resetForm = () => {
    setForm(initialFormState);
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
    setError("");
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    resetForm();
  };

  const handleEdit = (task) => {
    setForm({
      id: task._id,
      meta: task.meta || "",
      contenido: task.contenido || "",
      fecha: task.fecha ? String(task.fecha).slice(0, 10) : getDateInputValue(new Date()),
      horario: task.horario || "12:00",
      color: task.color || "color1",
    });
    setMessage("");
    setError("");
    setIsEditorOpen(true);
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm("¿Eliminar nota?")) return;

    try {
      await taskService.delete(taskId);
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
      if (form.id === taskId) {
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
      contenido: form.contenido,
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
      resetForm();
      setIsEditorOpen(false);
    } catch (submitError) {
      setError(submitError.response?.data?.message || "No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={style.page}>
      <header className={style.header}>
        <div>
          <p className={style.kicker}>Ruta de notas</p>
          <h1>Escribí, ordená y filtrá tus notas en una sola pantalla.</h1>
          
        </div>
        <button type="button" className={style.newNoteButton} onClick={handleNewNote}>
          <FiPlus />
          Nueva nota
        </button>
      </header>

      <div className={style.layout}>
        <section className={style.listCard}>
            <div className={style.editorHeader}>
              <div>
                <p className={style.cardKicker}>Listado</p>
                <h2>Notas cargadas</h2>
              </div>
              <button type="button" className={style.secondaryButton} onClick={handleNewNote}>
                <FiPlus />
                Nueva nota
              </button>
            </div>

            <div className={style.filterBar}>
              <label className={style.field}>
                <span>Mes</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => {
                    setSelectedMonth(event.target.value);
                    if (selectedDay && !event.target.value.startsWith(selectedDay.slice(0, 7))) {
                      setSelectedDay("");
                    }
                  }}
                  className={style.input}
                />
              </label>

              <label className={style.field}>
                <span>Día dentro del mes</span>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(event) => setSelectedDay(event.target.value)}
                  min={`${selectedMonth}-01`}
                  max={`${selectedMonth}-31`}
                  className={style.input}
                />
              </label>
            </div>

            {loading ? (
              <p className={style.emptyState}>Cargando notas...</p>
            ) : filteredTasks.length === 0 ? (
              <p className={style.emptyState}>No hay notas para ese filtro.</p>
            ) : (
              <div className={style.groupList}>
                {filteredTasks.map((task) => {
                  const preview = stripHtml(task.contenido || "");
                  const completed = isTaskCompletedOnDate(task, task.fecha);
                  const taskDate = task.fecha ? new Date(task.fecha) : null;

                  return (
                    <article
                      key={task._id}
                      className={`${style.taskRow} ${style[task.color] || style.color1} ${
                        completed ? style.taskRowCompleted : ""
                      }`}
                    >
                      <div className={style.taskRowCopy}>
                        <span className={style.noteDate}>
                          {taskDate ? formatGroupTitle(getDateInputValue(taskDate)) : "Sin fecha"}
                        </span>
                        <h3>{task.meta}</h3>
                        <p>{preview || "Sin contenido. Podés abrir la nota y escribir el detalle."}</p>
                        <div className={style.taskMetaRow}>
                          <span>{String(task.fecha).slice(0, 10)}</span>
                          <span>{task.horario || "--:--"}</span>
                        </div>
                      </div>

                      <div className={style.taskRowActions}>
                        <button type="button" onClick={() => handleEdit(task)}>
                          <FiEdit3 />
                          Editar
                        </button>
                        <button type="button" onClick={() => handleDelete(task._id)}>
                          <FiTrash2 />
                          Eliminar
                        </button>
                      </div>
                    </article>
                  );
                })}
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
                <h2>{form.id ? "Editar nota" : "Nueva nota"}</h2>
              </div>
              <div className={style.editorActions}>
                {form.id ? (
                  <button type="button" className={style.secondaryButton} onClick={resetForm}>
                    Limpiar edición
                  </button>
                ) : null}
                <button type="button" className={style.iconButton} onClick={handleCloseEditor} aria-label="Cerrar panel">
                  <FiX />
                </button>
              </div>
            </div>

          <form className={style.form} onSubmit={handleSubmit}>
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

            {error ? <p className={style.errorText}>{error}</p> : null}
            {message ? <p className={style.successText}>{message}</p> : null}

            <button type="submit" className={style.saveButton} disabled={saving}>
              <FiPlus />
              {saving ? "Guardando..." : form.id ? "Actualizar nota" : "Guardar nota"}
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}

export default TaskStudioPage;
