// Letra Menda en TODA la app (la misma del Home de finanzas), sin tocar cada
// pantalla: se intercepta la creación de elementos de React y todo <Text> /
// <TextInput> pasa por un envoltorio que le pone la familia según su peso.
//   · fontWeight >= 600 o "bold"  → Menda-Bold
//   · el resto                    → Menda-Medium (Menda solo trae esos dos pesos)
// No se toca lo que ya trae su propia fontFamily (íconos de @expo/vector-icons,
// pantallas que ya usaban Menda a mano).
// Se importa PRIMERO en index.js. Queda apagado hasta que App.js confirma que
// las fuentes cargaron (setMendaEnabled); si fallan, la app sigue con la del sistema.
import React, { createContext, useContext } from "react";
import { StyleSheet, Text, TextInput } from "react-native";

let enabled = false;
export const setMendaEnabled = (value) => {
  enabled = Boolean(value);
};

export const MENDA_FONTS = {
  "Menda-Bold": require("../assets/fonts/Menda-Bold.ttf"),
  "Menda-Medium": require("../assets/fonts/Menda-Medium.ttf"),
};

const createElementOriginal = React.createElement;

const esNegrita = (peso) => peso === "bold" || Number(peso) >= 600;
// fontWeight va a undefined: con la familia exacta ya alcanza, y en Android
// dejarlo en "bold" engrosaría la letra dos veces (negrita falsa).
const estiloMenda = (peso) => ({
  fontFamily: esNegrita(peso) ? "Menda-Bold" : "Menda-Medium",
  fontWeight: undefined,
});

// null = no estoy dentro de otro <Text>; "menda" = el padre ya tiene Menda;
// "propia" = el padre trae su propia familia (no meterse).
const TextoPadre = createContext(null);

function MendaText(props) {
  const padre = useContext(TextoPadre);
  if (!enabled) return createElementOriginal(Text, props);

  const flat = StyleSheet.flatten(props.style) || {};
  let extra = null;
  let paraHijos = "menda";
  if (flat.fontFamily) {
    paraHijos = "propia";
  } else if (padre === "propia") {
    paraHijos = "propia";
  } else if (padre === null || flat.fontWeight != null) {
    // Un <Text> anidado sin peso propio hereda la familia del de afuera.
    extra = estiloMenda(flat.fontWeight);
  }

  const elemento = createElementOriginal(
    Text,
    extra ? { ...props, style: [props.style, extra] } : props
  );
  return padre === paraHijos
    ? elemento
    : createElementOriginal(TextoPadre.Provider, { value: paraHijos }, elemento);
}

function MendaTextInput(props) {
  if (!enabled) return createElementOriginal(TextInput, props);
  const flat = StyleSheet.flatten(props.style) || {};
  if (flat.fontFamily) return createElementOriginal(TextInput, props);
  return createElementOriginal(TextInput, {
    ...props,
    style: [props.style, estiloMenda(flat.fontWeight)],
  });
}

const cambiar = (type) =>
  type === Text ? MendaText : type === TextInput ? MendaTextInput : type;

const envolver = (fn) =>
  function creadorConMenda(type, ...resto) {
    return fn.call(this, cambiar(type), ...resto);
  };

try {
  React.createElement = envolver(createElementOriginal);
  const runtime = require("react/jsx-runtime");
  runtime.jsx = envolver(runtime.jsx);
  runtime.jsxs = envolver(runtime.jsxs);
  if (__DEV__) {
    const devRuntime = require("react/jsx-dev-runtime");
    if (devRuntime.jsxDEV) devRuntime.jsxDEV = envolver(devRuntime.jsxDEV);
  }
} catch (e) {
  // Si no se puede interceptar, la app queda con la letra del sistema.
}
