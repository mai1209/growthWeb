import { useState } from "react";
import axios from "axios";
import style from "../style/Login.module.css";

function LoginPage({ onClose, onAuthSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });
      onAuthSuccess(res.data.token);
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
          <img src="./imgInicio.png" alt="imgInicio" />

          <form onSubmit={handleSubmit}>
            <p className={style.title}>Iniciar sesión</p>

            <div className={style.containerInput}>
              <label htmlFor="email">Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className={style.containerInput}>
              <label htmlFor="password">Contraseña:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className={style.containerRegister}>
              <button
                type="submit"
                className={loading ? style.btnLoading : style.btn}
                disabled={loading}
              >
                {loading ? (
                  <div className={style.spinner}></div>
                ) : (
                  "Iniciar sesión"
                )}
              </button>

              {error && <p style={{ color: "red" }}>{error}</p>}

              <div className={style.containerLogOut} onClick={onClose}>
                <p>Volver a Registro</p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
