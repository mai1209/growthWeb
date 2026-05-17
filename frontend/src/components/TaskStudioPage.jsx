import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiBold,
  FiCalendar,
  FiClock,
  FiEdit3,
  FiItalic,
  FiList,
  FiPlus,
  FiTrash2,
  FiUnderline,
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

function TaskStudioPage() {
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
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    list: false,
  });

  useEffect(() => {
    let isMounted = true;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const response = await taskService.getAll({ tipo: "note" });
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
  }, []);

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
      setActiveFormats({
        bold: Boolean(formats.bold),
        italic: Boolean(formats.italic),
        underline: Boolean(formats.underline),
        list: formats.list === "bullet",
      });
    };

    const handleSelectionChange = (range) => {
      if (!range) return;

      selectionRef.current = range;
      const formats = quill.getFormat(range);
      setActiveFormats({
        bold: Boolean(formats.bold),
        italic: Boolean(formats.italic),
        underline: Boolean(formats.underline),
        list: formats.list === "bullet",
      });
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

  const groupedTasks = useMemo(() => {
    const grouped = filteredTasks.reduce((accumulator, task) => {
      const key = getDateInputValue(new Date(task.fecha));
      if (!accumulator.has(key)) {
        accumulator.set(key, []);
      }
      accumulator.get(key).push(task);
      return accumulator;
    }, new Map());

    return [...grouped.entries()].map(([key, values]) => ({
      key,
      title: formatGroupTitle(key),
      tasks: values,
    }));
  }, [filteredTasks]);

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

  const resetForm = () => {
    setForm(initialFormState);
    setMessage("");
    setActiveFormats({
      bold: false,
      italic: false,
      underline: false,
      list: false,
    });
    selectionRef.current = null;
    if (quillRef.current) {
      quillRef.current.setText("");
      quillRef.current.setSelection(0, 0);
    }
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm("¿Eliminar nota?")) return;

    try {
      await taskService.delete(taskId);
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
      if (form.id === taskId) {
        resetForm();
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
      </header>

      <div className={style.layout}>
        <aside className={style.listColumn}>
          <section className={style.listCard}>
            <div className={style.editorHeader}>
              <div>
                <p className={style.cardKicker}>Listado</p>
                <h2>Notas cargadas</h2>
              </div>
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
            ) : groupedTasks.length === 0 ? (
              <p className={style.emptyState}>No hay notas para ese filtro.</p>
            ) : (
              <div className={style.groupList}>
                {groupedTasks.map((group) => (
                  <section key={group.key} className={style.group}>
                    <div className={style.groupHeader}>
                      <span>{group.title}</span>
                    </div>

                    <div className={style.groupRows}>
                      {group.tasks.map((task) => {
                        const preview = stripHtml(task.contenido || "");
                        const completed = isTaskCompletedOnDate(task, task.fecha);

                        return (
                          <article
                            key={task._id}
                            className={`${style.taskRow} ${style[task.color] || style.color1} ${
                              completed ? style.taskRowCompleted : ""
                            }`}
                          >
                            <div className={style.taskRowCopy}>
                              <h3>{task.meta}</h3>
                              <p>
                                {preview || "Sin contenido. Podés abrir la nota y escribir el detalle."}
                              </p>
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
                  </section>
                ))}
              </div>
            )}
          </section>
        </aside>

        <section className={style.editorCard}>
            <div className={style.editorHeader}>
              <div>
                <p className={style.cardKicker}>Editor</p>
                <h2>{form.id ? "Editar nota" : "Nueva nota"}</h2>
              </div>
              {form.id ? (
                <button type="button" className={style.secondaryButton} onClick={resetForm}>
                  Limpiar edición
                </button>
              ) : null}
            </div>

          <form className={style.form} onSubmit={handleSubmit}>
            <label className={style.field}>
              <span>Título</span>
              <input
                type="text"
                value={form.meta}
                onChange={(event) => handleFieldChange("meta", event.target.value)}
                placeholder="Ej: Ideas para promociones de junio"
                className={style.input}
              />
            </label>

            <div className={style.editorToolbar}>
              <button
                type="button"
                className={`${style.toolbarButton} ${activeFormats.bold ? style.toolbarButtonActive : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyInlineFormat("bold")}
                aria-label="Negrita"
              >
                <FiBold />
              </button>
              <button
                type="button"
                className={`${style.toolbarButton} ${activeFormats.italic ? style.toolbarButtonActive : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyInlineFormat("italic")}
                aria-label="Itálica"
              >
                <FiItalic />
              </button>
              <button
                type="button"
                className={`${style.toolbarButton} ${activeFormats.underline ? style.toolbarButtonActive : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyInlineFormat("underline")}
                aria-label="Subrayado"
              >
                <FiUnderline />
              </button>
              <button
                type="button"
                className={`${style.toolbarButton} ${activeFormats.list ? style.toolbarButtonActive : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={toggleBulletList}
                aria-label="Lista"
              >
                <FiList />
              </button>
            </div>

            <label className={style.field}>
              <span>Contenido</span>
              <div className={style.editorShell}>
                <div ref={editorRef} className={style.editor} />
              </div>
            </label>

            <div className={style.formGrid}>
              <label className={style.field}>
                <span>
                  <FiCalendar /> Fecha
                </span>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(event) => handleFieldChange("fecha", event.target.value)}
                  className={style.input}
                />
              </label>

              <label className={style.field}>
                <span>
                  <FiClock /> Horario
                </span>
                <input
                  type="time"
                  value={form.horario}
                  onChange={(event) => handleFieldChange("horario", event.target.value)}
                  className={style.input}
                />
              </label>
            </div>

            <div className={style.field}>
              <span>Color de fondo</span>
              <div className={style.colorGrid}>
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`${style.colorOption} ${style[color.value]} ${
                      form.color === color.value ? style.colorOptionActive : ""
                    }`}
                    onClick={() => handleFieldChange("color", color.value)}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
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
