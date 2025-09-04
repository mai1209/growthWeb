import React from 'react';

function InputMonto({ value, onChange, placeholder, className }) {

  const formatValue = (val) => {
    if (!val) return '';

    // Divide el número en parte entera y decimal
    const [integerPart, decimalPart] = val.split('.');
    
    // Formatea la parte entera con puntos de miles
    const formattedInteger = new Intl.NumberFormat('es-AR').format(integerPart);

    // Si hay parte decimal, la une con una coma
    if (decimalPart !== undefined) {
      return `${formattedInteger},${decimalPart}`;
    }
    
    // Si el usuario acaba de escribir la coma
    if (val.endsWith('.')) {
      return `${formattedInteger},`;
    }

    return formattedInteger;
  };

  const handleChange = (e) => {
    const userInput = e.target.value;

    // 1. Limpiar el input para procesarlo internamente
    // Quita los puntos de miles para no confundir
    let cleanValue = userInput.replace(/\./g, '');
    // Reemplaza la coma decimal por un punto (el formato numérico estándar en JS)
    cleanValue = cleanValue.replace(/,/g, '.');
    
    // 2. Validar que sea un número válido con decimales
    // Esta expresión regular permite números enteros o decimales
    const isValid = /^\d*\.?\d*$/.test(cleanValue);

    if (isValid) {
      // Llama a la función del padre con el valor limpio (ej: "1234.56")
      onChange(cleanValue);
    }
  };

  return (
    <input
      name="monto"
      className={className}
      type="text"
      inputMode="decimal"
      placeholder={placeholder || "Ingresar monto"}
      required
      value={formatValue(value)} // Mostramos el valor formateado
      onChange={handleChange}
    />
  );
}

export default InputMonto;