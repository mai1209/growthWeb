import { useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { WorkspaceProvider, useWorkspace } from "./src/workspace/WorkspaceContext";
import ProfileSwitcher from "./src/components/ProfileSwitcher";
import { ThemeProvider, useTheme } from "./src/theme";
import ErrorBoundary from "./src/components/ErrorBoundary";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import TareasScreen from "./src/screens/TareasScreen";
import FiltrosScreen from "./src/screens/FiltrosScreen";
import MetricasScreen from "./src/screens/MetricasScreen";
import MetasScreen from "./src/screens/MetasScreen";
import CompartidosScreen from "./src/screens/CompartidosScreen";
import NotasScreen from "./src/screens/NotasScreen";
import PomodoroScreen from "./src/screens/PomodoroScreen";
import SaludScreen from "./src/screens/SaludScreen";
import AjustesScreen from "./src/screens/AjustesScreen";
import PerfilScreen from "./src/screens/PerfilScreen";
import ComunidadScreen from "./src/screens/ComunidadScreen";
import UpdateModal from "./src/components/UpdateModal";
import RadialTabBar from "./src/components/RadialTabBar";
import { appService } from "./src/api";
import { APP_VERSION, COMUNIDAD_HABILITADA } from "./src/config";
import * as SecureStore from "expo-secure-store";

const UPDATE_SEEN_KEY = "update_aviso_visto_v"; // guarda la última versión ya avisada

// Compara versiones "1.0.11" vs "1.0.12": true si `a` es más vieja que `b`.
const isOlderVersion = (a, b) => {
  const pa = String(a || "").split(".").map((n) => Number(n) || 0);
  const pb = String(b || "").split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Evita que el splash se oculte solo; lo ocultamos cuando la app montó
SplashScreen.preventAutoHideAsync().catch(() => {});

function TopBar() {
  const { colors, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <Image
        source={require("./assets/growth-logo.png")}
        style={styles.brandLogo}
        resizeMode="contain"
      />
      <View style={styles.topActions}>
        {COMUNIDAD_HABILITADA ? (
          <TouchableOpacity onPress={() => navigation.navigate("Comunidad")} hitSlop={10}>
            <Ionicons name="globe-outline" size={23} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={toggleTheme} hitSlop={10}>
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={23}
            color={colors.muted}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Ajustes")} hitSlop={10}>
          <Ionicons name="settings-outline" size={23} color={colors.muted} />
        </TouchableOpacity>
        <ProfileSwitcher />
      </View>
    </View>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  const { workspace } = useWorkspace();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar />
      <Tab.Navigator
        key={workspace}
        tabBar={(props) => <RadialTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Metricas" component={MetricasScreen} />
        <Tab.Screen name="Tareas" component={TareasScreen} />
        <Tab.Screen name="Metas" component={MetasScreen} />
        <Tab.Screen name="Compartidos" component={CompartidosScreen} />
        <Tab.Screen name="Notas" component={NotasScreen} />
        <Tab.Screen name="Pomodoro" component={PomodoroScreen} />
        <Tab.Screen name="Salud" component={SaludScreen} />
        <Tab.Screen name="Filtros" component={FiltrosScreen} />
      </Tab.Navigator>
    </View>
  );
}

function Routes() {
  const { token, ready } = useAuth();
  const { colors } = useTheme();
  const [updateInfo, setUpdateInfo] = useState(null);

  // Al abrir (logueado), chequea si hay una versión más nueva y avisa UNA sola vez
  // por versión: si ya cerraste el aviso de esa versión, no vuelve a aparecer.
  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    appService
      .version()
      .then(async (res) => {
        if (!alive || !res.data) return;
        const latest = res.data.latest;
        // Guard: sin versiones válidas no avisamos (evita mostrarlo por datos vacíos).
        if (!APP_VERSION || !latest) return;
        if (!isOlderVersion(APP_VERSION, latest)) return;
        const visto = await SecureStore.getItemAsync(UPDATE_SEEN_KEY).catch(() => null);
        if (visto === latest) return; // ya avisamos esta versión
        if (!alive) return;
        // Marcamos como visto APENAS se muestra: así aparece una sola vez por
        // versión aunque el usuario cierre la app sin tocar el botón.
        SecureStore.setItemAsync(UPDATE_SEEN_KEY, latest).catch(() => {});
        setUpdateInfo(res.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);

  // Marca la versión como avisada y cierra (no vuelve a aparecer para esta versión).
  const cerrarUpdate = () => {
    if (updateInfo?.latest) {
      SecureStore.setItemAsync(UPDATE_SEEN_KEY, updateInfo.latest).catch(() => {});
    }
    setUpdateInfo(null);
  };

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Ajustes" component={AjustesScreen} />
            <Stack.Screen name="Perfil" component={PerfilScreen} />
            <Stack.Screen name="Comunidad" component={ComunidadScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>

      <UpdateModal visible={Boolean(updateInfo)} info={updateInfo} onClose={cerrarUpdate} />
    </>
  );
}

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.cardBorder,
      primary: colors.greenDark,
    },
  };
  return (
    <NavigationContainer theme={navTheme}>
      <Routes />
      <StatusBar style={isDark ? "light" : "dark"} />
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    // Oculta el splash apenas la app montó (clave: si no, queda pegado)
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <ThemedApp />
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});

const makeStyles = (colors) =>
  StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: colors.bg,
    },
    topActions: { flexDirection: "row", alignItems: "center", gap: 18 },
    brandLogo: { width: 40, height: 40 },
  });
