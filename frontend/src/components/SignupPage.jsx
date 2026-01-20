import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import style from "../style/Login.module.css";
import { FiEye, FiEyeOff } from "react-icons/fi";

function SignupPage({ onAuthSuccess }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== repeatPassword) {
      return setError("Las contraseñas no coinciden");
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/signup`, {
        username,
        email,
        password,
      });

      onAuthSuccess(res.data.token);

      // ✅ al registrarse, lo mandás a la app
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Error al registrarse");
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
            <p className={style.title}>Registrate para comenzar</p>

            <div className={style.containerInput}>
              <label>Usuario:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className={style.containerInput}>
              <label>Email:</label>
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

            <div className={style.containerInput}>
              <label>Repetir contraseña</label>

              <div className={style.passwordWrapper}>
                <input
                  type={showRepeatPassword ? "text" : "password"}
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
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

            <div className={style.containerRegister}>
              <button
                type="submit"
                className={loading ? style.btnLoading : style.btn}
                disabled={loading}
              >
                {loading ? <div className={style.spinner}></div> : "Registrate"}
              </button>

              {error && <p style={{ color: "red" }}>{error}</p>}

              {/* ✅ navegación real */}
              <p className={style.link} onClick={() => navigate("/login")}>
                Ya tengo una cuenta
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
