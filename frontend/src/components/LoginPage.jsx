import { useState } from "react";
import { useNavigate } from "react-router-dom";
//import axios from "axios";
import style from "../style/Login.module.css";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { authService } from "../api";

function LoginPage({ onAuthSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false); // ✅ nuevo
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();


const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    // 1. Llamamos al servicio (pasamos el objeto que espera la API)
    const res = await authService.login({
      email,
      password,
      rememberMe,
    });

    const newToken = res.data.token;

    // 2. Limpiamos rastro anterior
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");

    // 3. Guardamos según la preferencia del usuario
    if (rememberMe) {
      localStorage.setItem("token", newToken);
    } else {
      sessionStorage.setItem("token", newToken);
    }

    // 4. Éxito: avisamos a App y navegamos
    onAuthSuccess(newToken);
    navigate("/");
    
  } catch (err) {
    console.error("Login error:", err);
    // Usamos el mensaje que viene del backend o uno genérico
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
