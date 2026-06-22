import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Evita la "pantalla blanca": si algo crashea al renderizar, muestra un mensaje
export default class ErrorBoundary extends React.Component {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Error inesperado" };
  }

  componentDidCatch(error, info) {
    // Log básico (visible en los logs del dispositivo)
    console.log("App crash:", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Growth Manager</Text>
          <Text style={styles.text}>
            Ocurrió un problema al abrir la app. Cerrala y volvé a abrirla.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#10150f",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  title: { color: "#3bcb23", fontSize: 22, fontWeight: "900", marginBottom: 12 },
  text: { color: "#e7efe4", fontSize: 15, textAlign: "center", lineHeight: 22 },
});
