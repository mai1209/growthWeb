import "react-datepicker/dist/react-datepicker.css";
import style from "../style/LeftsideNotas.module.css";
import { useState, useEffect } from "react";

import DatePicker from "react-datepicker";
import { taskService } from "../api";
import { getIsoDate } from "../utils/finance";

//const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

const initialFormData = {
  meta: "",
  fecha: new Date(),
  horario: "12:00",
  urgencia: "importante",
  color: "color1",
  esRecurrente: false,
  diasRepeticion: [],
};

function LeftSideNotas({
  onUpdate = () => {},
  taskToEdit,
  setIsNotesOpen,
  refreshKey,
  embeddedMobile = false,
}) {
  const [isOpen, setIsOpen] = useState(!embeddedMobile);
  const isDesktop =
    typeof window === "undefined"
      ? true
      : !window.matchMedia("(max-width: 1000px)").matches;
  const [taskSummary, setTaskSummary] = useState({
    pending: 0,
    completed: 0,
    total: 0,
  });

  // ✅ Avisar al layout si está abierto/cerrado
  useEffect(() => {
    if (setIsNotesOpen) setIsNotesOpen(isOpen);

    return () => {
      if (setIsNotesOpen) setIsNotesOpen(false);
    };
  }, [isOpen, setIsNotesOpen]);

  useEffect(() => {
    if (embeddedMobile) {
      setIsOpen(true);
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 1000px)");

    const handleResize = (e) => {
      setIsOpen(!e.matches); // desktop abierto, mobile cerrado
    };

    handleResize(mediaQuery);
    mediaQuery.addEventListener("change", handleResize);

    return () => {
      mediaQuery.removeEventListener("change", handleResize);
    };
  }, [embeddedMobile]);

  const toggleContainer = () => {
    if (embeddedMobile) return;
    setIsOpen((prev) => !prev);
  };

  const [formData, setFormData] = useState(initialFormData);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (taskToEdit) {
      const fechaUTC = new Date(taskToEdit.fecha);
      fechaUTC.setMinutes(fechaUTC.getMinutes() + fechaUTC.getTimezoneOffset());

      setFormData({
        ...taskToEdit,
        fecha: fechaUTC,
        diasRepeticion: taskToEdit.diasRepeticion || [],
      });

      setIsOpen(true);
    } else {
      setFormData(initialFormData);
    }
  }, [taskToEdit]);

  useEffect(() => {
    let isMounted = true;

    const fetchTaskSummary = async () => {
      const storedToken =
        localStorage.getItem("token") || sessionStorage.getItem("token");

      if (!storedToken) return;

      try {
        const today = getIsoDate(new Date());
        const response = await taskService.getByDate(today);

        if (!isMounted || !Array.isArray(response.data)) return;

        const pending = response.data.filter((task) => !task.completada).length;
        const completed = response.data.length - pending;

        setTaskSummary({
          pending,
          completed,
          total: response.data.length,
        });
      } catch (error) {
        if (isMounted) {
          setTaskSummary({ pending: 0, completed: 0, total: 0 });
        }
      }
    };

    fetchTaskSummary();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleDateChange = (date) => {
    setFormData((prevData) => ({ ...prevData, fecha: date }));
  };

  const handleColorSelect = (colorName) => {
    setFormData((prevData) => ({ ...prevData, color: colorName }));
  };

  const toggleDia = (dia) => {
    setFormData((prev) => ({
      ...prev,
      diasRepeticion: prev.diasRepeticion.includes(dia)
        ? prev.diasRepeticion.filter((d) => d !== dia)
        : [...prev.diasRepeticion, dia],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!formData.meta) {
      setError("Por favor, escribe el nombre de la meta.");
      setLoading(false);
      return;
    }

    try {
      const fechaLocal = new Date(formData.fecha);
      fechaLocal.setMinutes(
        fechaLocal.getMinutes() - fechaLocal.getTimezoneOffset(),
      );
      const fechaFormateada = fechaLocal.toISOString().slice(0, 10);

      const dataToSend = {
        ...formData,
        fecha: fechaFormateada,
      };

      if (taskToEdit) {
        //Editar tarea existente
        await taskService.update(taskToEdit._id, dataToSend);
        setSuccess("¡Tarea actualizada con éxito!");
      } else {
        // Crear tarea nueva
        await taskService.create(dataToSend);

        setSuccess("¡Hábito/Tarea añadido con éxito!");
      }

      onUpdate();

      setTimeout(() => {
        if (!taskToEdit) setFormData(initialFormData);
        if (!isDesktop && !embeddedMobile) setIsOpen(false);
        setSuccess("");
      }, 900);
    } catch (err) {
      setError(err.response?.data?.message || "Hubo un error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!taskToEdit;

  return (
    <div
      className={`${style.container} ${
        isOpen ? style.containerOpenn : ""
      } ${isEditing ? style.editingStyle : ""} ${
        embeddedMobile ? style.embeddedMobile : ""
      }`}
    >
      {!embeddedMobile && (
        <div className={style.containerOpen}>
          <button
            type="button"
            className={`${style.containerOpenClose} ${isOpen ? style.open : ""}`}
            onClick={toggleContainer}
            aria-label={isOpen ? "Cerrar panel de notas" : "Abrir panel de notas"}
          >
            <span className={style.close}>
              {isDesktop
                ? "Crear un hábito +"
                : isOpen
                  ? "✕"
                  : "Crear un hábito +"}
            </span>
          </button>
        </div>
      )}

      {isOpen && (
        <>
          <div className={style.containerInfo}>
            <p className={style.kicker}>Notas y habitos</p>
            <p className={style.titleKeep}>
              {isEditing ? "Editar habito" : "Crea un habito"}
            </p>
            <p className={style.subtitleHeader}>
              Organiza tareas, recordatorios y repeticiones con el mismo look del
              panel principal.
            </p>
          </div>

          <section className={style.summaryCard}>
            <div className={style.summaryHeader}>
              <h3>Resumen de hoy</h3>
              <p>Tareas y habitos del dia actual.</p>
            </div>

            <div className={style.notesCard}>
              <div>
                <span>Pendientes</span>
                <strong>{taskSummary.pending}</strong>
              </div>
              <div>
                <span>Completadas</span>
                <strong>{taskSummary.completed}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{taskSummary.total}</strong>
              </div>
            </div>
          </section>

          {error && <p className={style.feedbackError}>{error}</p>}
          {success && <p className={style.feedbackSuccess}>{success}</p>}

          <div className={style.containerForm}>
            <form className={style.form} onSubmit={handleSubmit}>
              <input
                name="meta"
                type="text"
                placeholder="Escriba su meta"
                value={formData.meta}
                onChange={handleChange}
                className={style.datePicker}
              />

              <DatePicker
                selected={formData.fecha}
                onChange={handleDateChange}
                dateFormat="dd-MM-yyyy"
                className={style.datePicker}
              />

              <input
                name="horario"
                type="time"
                value={formData.horario}
                onChange={handleChange}
                className={style.datePicker}
              />

              <select
                name="urgencia"
                value={formData.urgencia}
                onChange={handleChange}
                className={style.select}
              >
                <option value="importante">Importante</option>
                <option value="urgente">Urgente</option>
                <option value="no importante">No Importante</option>
                <option value="obligaciones">Obligaciones</option>
              </select>

              <div>
                <p className={style.subtitle}>
                  Seleccione un color para su tarea
                </p>
                <div className={style.containerColors}>
                  {["color1", "color2", "color3", "color4"].map(
                    (color, index) => (
                      <button
                        key={color}
                        type="button"
                        className={`${
                          style[
                            `circle${["One", "Two", "Three", "Four"][index]}`
                          ]
                        } ${formData.color === color ? style.selected : ""}`}
                        onClick={() => handleColorSelect(color)}
                        aria-label={`Seleccionar color ${index + 1}`}
                      />
                    ),
                  )}
                </div>
              </div>

              <div className={style.containerKeep}>
                <p className={style.keep}>Repetir habito</p>
                <input
                  name="esRecurrente"
                  type="checkbox"
                  checked={formData.esRecurrente}
                  onChange={handleChange}
                  className={style.repetir}
                />
              </div>

              <div className={style.containerDias}>
                {formData.esRecurrente && (
                  <div className={style.diasContainer}>
                    {["D", "L", "M", "MI", "J", "V", "S"].map((dia) => (
                      <label key={dia} className={style.diaItem}>
                        <input
                          type="checkbox"
                          checked={formData.diasRepeticion.includes(dia)}
                          onChange={() => toggleDia(dia)}
                        />
                        <span>{dia.toUpperCase()}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className={style.containerEditCancel}>
                <button className={style.btn} type="submit" disabled={loading}>
                  <p>
                    {loading
                      ? "Guardando..."
                      : isEditing
                        ? "Guardar cambios"
                        : "Añade un habito"}
                  </p>
                </button>

                {isEditing && (
                  <button
                    type="button"
                    className={style.btn}
                    onClick={onUpdate}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default LeftSideNotas;
