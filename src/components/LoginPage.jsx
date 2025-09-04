// LoginPage.js (COMPLETO Y CONECTADO)

import { useState } from "react";
import axios from "axios";
import style from "../style/Login.module.css";

function LoginPage({ onClose, onAuthSuccess }) {
  // 1. Estados para los inputs de login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // 2. Función que se ejecuta al enviar el formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post("http://localhost:3000/api/auth/login", {
        email,
        password,
      });

      // 3. Si el login es exitoso, llamamos a onAuthSuccess
      onAuthSuccess(res.data.token);
      // No es necesario llamar a onClose(), App.js se encarga de cerrar el modal

    } catch (err) {
      setError(err.response?.data?.error || "Error al iniciar sesión");
    }
  };

  return (
    <div className={style.container}>
      <div className={style.back}>
        <p className={style.title}>Iniciar sesión</p>
        <div className={style.containerForm}>
          {/* 4. Conectamos el formulario al handleSubmit */}
          <form onSubmit={handleSubmit}>
            <div className={style.containerInput}>
              <label htmlFor="email">Email:</label>
              {/* 5. Conectamos los inputs a sus estados */}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className={style.containerInput}>
              <label htmlFor="password">Contraseña:</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className={style.containerRegister}>
              <button type="submit" className={style.btn}>Iniciar sesión</button>
              {error && <p style={{ color: 'red' }}>{error}</p>}
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