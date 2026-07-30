import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useWorkspace } from "../workspace/WorkspaceContext";

// Avatar circular chico: foto si hay, si no un ícono según el tipo de perfil.
// borderColor override (ej: el del nav va negro en vez de verde).
function ProfileAvatar({ photo, kind, size, colors, active, borderColor }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: borderColor || (active ? colors.greenBright : colors.cardBorder),
        backgroundColor: colors.greenSoft,
      }}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Ionicons
          name={kind === "business" ? "briefcase" : "person"}
          size={size * 0.5}
          color={active ? colors.greenDark : colors.muted}
        />
      )}
    </View>
  );
}

export default function ProfileSwitcher() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { workspace, profiles, activeProfile, switchWorkspace, addProfile } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim() || adding) return;
    setAdding(true);
    try {
      await addProfile(newName.trim());
      setNewName("");
      setOpen(false);
    } catch {
      Alert.alert("Error", "No se pudo crear el perfil.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} hitSlop={10}>
        <ProfileAvatar
          photo={activeProfile?.photo}
          kind={activeProfile?.kind}
          size={30}
          colors={colors}
          active
          borderColor="#000"
        />
        <Ionicons name="chevron-down" size={13} color={colors.muted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <Text style={styles.title}>Perfiles</Text>

            {profiles.map((p) => {
              const active = p.id === workspace;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => {
                    switchWorkspace(p.id);
                    setOpen(false);
                  }}
                >
                  <ProfileAvatar photo={p.photo} kind={p.kind} size={34} colors={colors} active={active} />
                  <Text style={[styles.rowText, active && { color: colors.greenDark }]}>{p.name}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.greenDark} /> : null}
                </TouchableOpacity>
              );
            })}

            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Nuevo perfil (negocio)"
                placeholderTextColor={colors.muted}
                onSubmitEditing={handleAdd}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addBtn, (!newName.trim() || adding) && { opacity: 0.5 }]}
                onPress={handleAdd}
                disabled={!newName.trim() || adding}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="add" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    trigger: { flexDirection: "row", alignItems: "center", gap: 1 },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      maxWidth: 150,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    pillText: { color: colors.text, fontWeight: "800", fontSize: 12.5, flexShrink: 1 },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-start",
      paddingTop: 90,
      paddingHorizontal: 20,
    },
    sheet: {
      backgroundColor: colors.bg,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 14,
      gap: 6,
    },
    title: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    rowActive: { backgroundColor: colors.greenSoft },
    rowText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
    addRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
    addInput: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
    },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.greenBright,
      alignItems: "center",
      justifyContent: "center",
    },
  });
