import { useState } from "react";
import { FiEye, FiEyeOff, FiLock } from "react-icons/fi";
import { authService } from "../api";
import style from "../style/Settings.module.css";

function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== repeatPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const response = await authService.changePassword({
        currentPassword,
        newPassword,
      });

      setMessage(response.data.message || "Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={style.container}>
      <div className={style.header}>
        <div>
          <p className={style.kicker}>Ajustes</p>
          <h1>Cambiar contraseña</h1>
        </div>
        <div className={style.headerIcon}>
          <FiLock />
        </div>
      </div>

      <form className={style.card} onSubmit={handleSubmit}>
        <label className={style.field}>
          <span>Contraseña actual</span>
          <div className={style.passwordField}>
            <input
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className={style.eyeButton}
              onClick={() => setShowCurrentPassword((prev) => !prev)}
            >
              {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </label>

        <label className={style.field}>
          <span>Nueva contraseña</span>
          <div className={style.passwordField}>
            <input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className={style.eyeButton}
              onClick={() => setShowNewPassword((prev) => !prev)}
            >
              {showNewPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </label>

        <label className={style.field}>
          <span>Repetir nueva contraseña</span>
          <div className={style.passwordField}>
            <input
              type={showRepeatPassword ? "text" : "password"}
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className={style.eyeButton}
              onClick={() => setShowRepeatPassword((prev) => !prev)}
            >
              {showRepeatPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </label>

        <button type="submit" className={style.saveButton} disabled={loading}>
          {loading ? "Guardando..." : "Guardar nueva contraseña"}
        </button>

        {error ? <p className={style.error}>{error}</p> : null}
        {message ? <p className={style.success}>{message}</p> : null}
      </form>
    </section>
  );
}

export default SettingsPage;
