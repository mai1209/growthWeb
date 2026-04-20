import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff, FiMoon, FiSun } from "react-icons/fi";
import { authService } from "../api";
import style from "../style/Login.module.css";

function ResetPasswordPage({ theme = "dark", onThemeToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialEmail = params.get("email") || "";
  const resetToken = params.get("token") || "";

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!resetToken) {
      setError("Falta el token de recuperación.");
      return;
    }

    if (password !== repeatPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const response = await authService.resetPassword({
        email,
        token: resetToken,
        password,
      });

      setMessage(response.data.message || "Contraseña actualizada.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={style.container}>
      <div className={style.back}>
        <div className={style.authTopbar}>
          <button
            type="button"
            className={style.themeButton}
            onClick={onThemeToggle}
            aria-label={theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
          >
            <FiSun className={style.themeIcon} />
            <span className={style.themeSwitchTrack}>
              <span className={style.themeSwitchThumb} />
            </span>
            <FiMoon className={style.themeIcon} />
          </button>
        </div>

        <div className={style.containerForm}>
          <img src="./imgInicio.webp" alt="imgInicio" />

          <form onSubmit={handleSubmit}>
            <p className={style.title}>Crear nueva contraseña</p>

            <div className={style.containerInput}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className={style.containerInput}>
              <label>Nueva contraseña</label>
              <div className={style.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <span className={style.eye} onClick={() => setShowPassword((prev) => !prev)}>
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </span>
              </div>
            </div>

            <div className={style.containerInput}>
              <label>Repetir contraseña</label>
              <div className={style.passwordWrapper}>
                <input
                  type={showRepeatPassword ? "text" : "password"}
                  value={repeatPassword}
                  onChange={(event) => setRepeatPassword(event.target.value)}
                  required
                />
                <span
                  className={style.eye}
                  onClick={() => setShowRepeatPassword((prev) => !prev)}
                >
                  {showRepeatPassword ? <FiEyeOff /> : <FiEye />}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className={loading ? style.btnLoading : style.btn}
              disabled={loading}
            >
              {loading ? <div className={style.spinner} /> : "Guardar nueva contraseña"}
            </button>

            {error ? <p className={style.errorText}>{error}</p> : null}
            {message ? <p className={style.successText}>{message}</p> : null}

            <p className={style.link} onClick={() => navigate("/login")}>
              Volver al login
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
