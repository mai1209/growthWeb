import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import style from "../style/Login.module.css";
import { FiEye, FiEyeOff } from "react-icons/fi";

function LoginPage({ onAuthSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false); // ✅ nuevo
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
        rememberMe, // ✅ se manda al backend
      });

      // ✅ Guardar token según el checkbox
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("token", res.data.token);

      // (opcional) por si tenías token viejo guardado en el otro storage:
      (rememberMe ? sessionStorage : localStorage).removeItem("token");

      onAuthSuccess(res.data.token);

      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={style.container}>
      <div className={style.back}>
        <div className={style.containerForm}>
          <img src="./imgInicio.webp" alt="imgInicio" />

          <form onSubmit={handleSubmit}>
            <p className={style.title}>Iniciar sesión</p>

            <div className={style.containerInput}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={style.containerInput}>
              <label>Contraseña</label>

              <div className={style.passwordWrapper}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <span
                  className={style.eye}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </span>
              </div>
            </div>

         

            <button
              type="submit"
              className={loading ? style.btnLoading : style.btn}
              disabled={loading}
            >
              {loading ? <div className={style.spinner} /> : "Iniciar sesión"}
            </button>

            {error && <p style={{ color: "red" }}>{error}</p>}

            <p className={style.link} onClick={() => navigate("/register")}>
              ¿No tenés cuenta? Registrate
            </p>
               {/* ✅ CHECKBOX */}
            <label className={style.rememberRow}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Recordarme por 30 días</span>
            </label>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
