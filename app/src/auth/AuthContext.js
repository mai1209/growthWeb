import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { getToken, setToken as storeToken, clearToken } from "../storage";
import { setUnauthorizedHandler } from "../api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getToken()
      .then((stored) => setTokenState(stored || null))
      .catch(() => setTokenState(null))
      .finally(() => setReady(true));
    // Si la API detecta 401, cerramos sesión
    setUnauthorizedHandler(() => setTokenState(null));
  }, []);

  const login = useCallback(async (newToken) => {
    await storeToken(newToken);
    setTokenState(newToken);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setTokenState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
