import { useEffect } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
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
import CompartidosScreen from "./src/screens/CompartidosScreen";
import NotasScreen from "./src/screens/NotasScreen";
import PomodoroScreen from "./src/screens/PomodoroScreen";
import AjustesScreen from "./src/screens/AjustesScreen";

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
      <Text style={styles.brand}>GROWTH</Text>
      <View style={styles.topActions}>
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

const TAB_ICONS = {
  Home: "home",
  Tareas: "checkbox",
  Metricas: "stats-chart",
  Compartidos: "people",
  Notas: "document-text",
  Pomodoro: "timer",
};

function MainTabs() {
  const { colors } = useTheme();
  const { workspace } = useWorkspace();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar />
      <Tab.Navigator
        key={workspace}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.greenDark,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarIcon: ({ color, size, focused }) => {
            const base = TAB_ICONS[route.name] || "ellipse";
            return (
              <Ionicons
                name={focused ? base : `${base}-outline`}
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Tareas" component={TareasScreen} />
        <Tab.Screen name="Metricas" component={MetricasScreen} options={{ tabBarLabel: "Métricas" }} />
        <Tab.Screen name="Compartidos" component={CompartidosScreen} />
        <Tab.Screen name="Notas" component={NotasScreen} />
        <Tab.Screen name="Pomodoro" component={PomodoroScreen} />
        {/* Filtros queda accesible desde el resumen del Home, sin botón en la barra */}
        <Tab.Screen
          name="Filtros"
          component={FiltrosScreen}
          options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
        />
      </Tab.Navigator>
    </View>
  );
}

function Routes() {
  const { token, ready } = useAuth();
  const { colors } = useTheme();

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Ajustes" component={AjustesScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
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
    brand: { color: colors.green, fontSize: 18, fontWeight: "900", letterSpacing: 1.5 },
  });
