import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

const THEME_KEY = "themePreference";

// Paleta del tema CLARO (tomada de las variables de la web, index.css)
export const lightColors = {
  bg: "#eef3eb",
  card: "#ffffff",
  cardSoft: "#f6f9f3",
  cardBorder: "rgba(22, 41, 31, 0.12)",
  text: "#16241d",
  muted: "#5e7065",
  green: "#3d8c44",
  greenDark: "#2f6f35",
  greenSoft: "rgba(61, 140, 68, 0.12)",
  greenBorder: "rgba(61, 140, 68, 0.28)",
  greenBright: "#3bcb23",
  greenBright2: "#5dc72d",
  red: "#ba5f50",
  redSoft: "rgba(186, 95, 80, 0.14)",
};

// Paleta del tema OSCURO
export const darkColors = {
  bg: "#10150f",
  card: "#1a211a",
  cardSoft: "#161c16",
  cardBorder: "rgba(255, 255, 255, 0.12)",
  text: "#e7efe4",
  muted: "#9bab9d",
  green: "#6abf71",
  greenDark: "#8fd896",
  greenSoft: "rgba(106, 191, 113, 0.16)",
  greenBorder: "rgba(106, 191, 113, 0.34)",
  greenBright: "#3bcb23",
  greenBright2: "#5dc72d",
  red: "#e58a78",
  redSoft: "rgba(229, 138, 120, 0.18)",
};

// Acentos por tipo de tarjeta (vivos, funcionan en ambos temas)
export const statAccents = {
  movimientos: "#5b8ad6",
  resultado: "#d6a92e",
  ingreso: "#35b53a",
  egreso: "#e0703f",
  ahorro: "#2bb888",
  deuda: "#d6a92e",
};

// Compatibilidad: por defecto exporta la paleta clara
export const colors = lightColors;

const ThemeContext = createContext({
  colors: lightColors,
  isDark: false,
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then((stored) => {
      if (stored === "dark" || stored === "light") setThemeState(stored);
    });
  }, []);

  const setTheme = (next) => {
    setThemeState(next);
    SecureStore.setItemAsync(THEME_KEY, next).catch(() => {});
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const isDark = theme === "dark";
  const value = {
    colors: isDark ? darkColors : lightColors,
    isDark,
    theme,
    toggleTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
