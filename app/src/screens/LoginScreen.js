import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme";

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await authService.login({ email: email.trim(), password });
      const token = res.data?.token;
      if (!token) throw new Error("Sin token");
      await login(token);
    } catch (err) {
      const data = err.response?.data;
      const message =
        (typeof data?.error === "string" && data.error) ||
        "No se pudo iniciar sesión";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.brand}>GROWTH</Text>
        <Text style={styles.title}>Iniciar sesión</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="tu@email.com"
          placeholderTextColor="#9aa4b2"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#9aa4b2"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 6 },
  brand: {
    color: colors.green,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: "800", marginBottom: 16 },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.expense, marginTop: 12 },
  button: {
    marginTop: 22,
    backgroundColor: colors.greenBright,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0e2a12", fontSize: 16, fontWeight: "800" },
});
