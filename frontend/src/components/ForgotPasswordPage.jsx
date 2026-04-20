import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMoon, FiSun } from "react-icons/fi";
import { authService } from "../api";
import style from "../style/Login.module.css";

function ForgotPasswordPage({ theme = "dark", onThemeToggle }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setResetUrl("");
    setLoading(true);

    try {
      const response = await authService.forgotPassword({ email });
      setMessage(response.data.message || "Revisá el enlace de recuperación.");
      setResetUrl(response.data.resetUrl || "");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo iniciar la recuperación");
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
            <p className={style.title}>Recuperar contraseña</p>

            <div className={style.containerInput}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className={loading ? style.btnLoading : style.btn}
              disabled={loading}
            >
              {loading ? <div className={style.spinner} /> : "Generar enlace"}
            </button>

            {error ? <p className={style.errorText}>{error}</p> : null}
            {message ? <p className={style.successText}>{message}</p> : null}

            {resetUrl ? (
              <div className={style.helperBlock}>
                <p className={style.helperText}>Abrí este enlace para crear una contraseña nueva:</p>
                <button
                  type="button"
                  className={style.linkButton}
                  onClick={() => navigate(`/reset-password?${resetUrl.split("?")[1] || ""}`)}
                >
                  Ir al reseteo
                </button>
                <p className={style.helperUrl}>{resetUrl}</p>
              </div>
            ) : null}

            <p className={style.link} onClick={() => navigate("/login")}>
              Volver al login
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
