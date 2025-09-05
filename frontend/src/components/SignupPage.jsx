// SignupPage.js (COMPLETO Y CONECTADO)

import { useState } from "react";
import axios from "axios";
import style from "../style/Login.module.css";

function SignupPage({ onSwitchToLogin, onAuthSuccess }) {
  // 1. Estados para guardar los datos de cada input
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  // 2. Función que se ejecuta al enviar el formulario
  const handleSubmit = async (e) => {
    e.preventDefault(); // Evita que la página se recargue
    setError('');

    if (password !== repeatPassword) {
      return setError("Las contraseñas no coinciden");
    }

    try {
      const res = await axios.post( `${API_URL}/api/auth/signup`,{
        username, // Asegúrate que tu backend maneje 'username'
        email,
        password,
      });

      // 3. Si el backend responde con éxito, llamamos a onAuthSuccess
      onAuthSuccess(res.data.token);

    } catch (err) {
      setError(err.response?.data?.error || "Error al registrarse");
    }
  };

  return (
    <div className={style.container}>
      <div className={style.back}>
        <p className={style.title}>Registrate para comenzar</p>
        <div className={style.containerForm}>
          {/* 4. Conectamos el formulario al handleSubmit */}
          <form onSubmit={handleSubmit}>
            <div className={style.containerInput}>
              <label htmlFor="name">Usuario:</label>
              {/* 5. Conectamos cada input a su estado */}
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className={style.containerInput}>
              <label htmlFor="email">Email:</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className={style.containerInput}>
              <label htmlFor="password">Contraseña:</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className={style.containerInput}>
              <label htmlFor="password">Repetir Contraseña:</label>
              <input type="password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} required />
            </div>
            <div className={style.containerRegister}>
              <button type="submit" className={style.btn}>Registrate</button>
              {error && <p style={{ color: 'red' }}>{error}</p>}
              <div className={style.containerLogOut} onClick={onSwitchToLogin}>
                <p>Ya tengo una cuenta</p>
                <img className={style.logOutImg} src="./logOut.png" alt="logout" />
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;