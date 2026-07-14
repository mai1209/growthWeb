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
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme";

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { login } = useAuth();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setPassword("");
    setRepeatPassword("");
  };

  const handleSubmit = async () => {
    setError("");

    if (isRegister && password !== repeatPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const res = isRegister
        ? await authService.signup({ username: username.trim(), email: email.trim(), password })
        : await authService.login({ email: email.trim(), password, rememberMe });
      const token = res.data?.token;
      if (!token) throw new Error("Sin token");
      await login(token);
    } catch (err) {
      const data = err.response?.data;
      const message =
        (typeof data?.error === "string" && data.error) ||
        (typeof data?.message === "string" && data.message) ||
        (isRegister ? "No se pudo crear la cuenta" : "No se pudo iniciar sesión");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      setError("Ingresá tu email para recuperar la contraseña");
      return;
    }
    try {
      await authService.forgotPassword({ email: email.trim() });
      Alert.alert(
        "Revisá tu correo",
        "Si el email está registrado, te enviamos un enlace para restablecer la contraseña."
      );
    } catch {
      Alert.alert(
        "Revisá tu correo",
        "Si el email está registrado, te enviamos un enlace para restablecer la contraseña."
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandRow}>
            <Image
              source={require("../../assets/growth-logo.png")}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brand}>GROWTH</Text>
          </View>

          <Text style={styles.title}>
            {isRegister ? "Registrate para comenzar" : "Iniciar sesión"}
          </Text>

          {isRegister ? (
            <>
              <Text style={styles.label}>Usuario</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="Tu nombre"
                placeholderTextColor={colors.muted}
              />
            </>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="tu@email.com"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity
              style={styles.eye}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={10}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>

          {isRegister ? (
            <>
              <Text style={styles.label}>Repetir contraseña</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={repeatPassword}
                  onChangeText={setRepeatPassword}
                  secureTextEntry={!showRepeat}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                />
                <TouchableOpacity
                  style={styles.eye}
                  onPress={() => setShowRepeat((v) => !v)}
                  hitSlop={10}
                >
                  <Ionicons
                    name={showRepeat ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {!isRegister ? (
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                {rememberMe ? <Ionicons name="checkmark" size={14} color="#0e2a12" /> : null}
              </View>
              <Text style={styles.rememberText}>Recordarme por 30 días</Text>
            </TouchableOpacity>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0e2a12" />
            ) : (
              <Text style={styles.buttonText}>
                {isRegister ? "Registrate" : "Iniciar sesión"}
              </Text>
            )}
          </TouchableOpacity>

          {!isRegister ? (
            <TouchableOpacity onPress={handleForgot}>
              <Text style={styles.link}>Olvidé mi contraseña</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity onPress={() => switchMode(isRegister ? "login" : "register")}>
            <Text style={styles.link}>
              {isRegister ? "Ya tengo una cuenta" : "¿No tenés cuenta? Registrate"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 4 },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    brandLogo: { width: 30, height: 30 },
    brand: { color: colors.green, fontSize: 22, fontWeight: "900", letterSpacing: 2 },
    title: { color: colors.text, fontSize: 26, fontWeight: "800", marginBottom: 12 },
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
    passwordWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      borderRadius: 12,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 16,
    },
    eye: { paddingHorizontal: 14, paddingVertical: 12 },
    rememberRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
    },
    checkboxOn: { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
    rememberText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
    error: { color: colors.red, marginTop: 12 },
    button: {
      marginTop: 22,
      backgroundColor: colors.greenBright,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#0e2a12", fontSize: 16, fontWeight: "800" },
    link: {
      color: colors.green,
      fontSize: 14,
      fontWeight: "700",
      marginTop: 16,
      textAlign: "center",
    },
  });
