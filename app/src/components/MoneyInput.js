import React from "react";
import { TextInput } from "react-native";

// Agrupa la parte entera con puntos de miles (sin depender de Intl, que en
// algunos runtimes de RN viene limitado).
const groupThousands = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Valor crudo ("1234.56") -> texto visible estilo AR ("1.234,56").
const formatDisplay = (val) => {
  if (val === "" || val === null || val === undefined) return "";
  const s = String(val);
  const [intPart, decPart] = s.split(".");
  const grouped = groupThousands((intPart || "").replace(/\D/g, ""));
  if (decPart !== undefined) return `${grouped},${decPart}`;
  if (s.endsWith(".")) return `${grouped},`;
  return grouped;
};

// TextInput de dinero: muestra con separador de miles (.) y decimal (,), y
// entrega por onChangeText el valor limpio ("1234.56") para la lógica.
export default function MoneyInput({ value, onChangeText, ...rest }) {
  const handleChange = (text) => {
    // Quita los puntos de miles y pasa la coma decimal a punto (formato JS).
    const clean = text.replace(/\./g, "").replace(/,/g, ".");
    if (/^\d*\.?\d*$/.test(clean)) onChangeText(clean);
  };

  return (
    <TextInput
      keyboardType="decimal-pad"
      {...rest}
      value={formatDisplay(value)}
      onChangeText={handleChange}
    />
  );
}
