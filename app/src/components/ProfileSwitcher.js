import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useWorkspace } from "../workspace/WorkspaceContext";

export default function ProfileSwitcher() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { workspace, profiles, switchWorkspace, addProfile } = useWorkspace();
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
      <TouchableOpacity onPress={() => setOpen(true)} hitSlop={10}>
        <Ionicons name="person-outline" size={23} color={colors.muted} />
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
                  <Ionicons
                    name={p.id === "personal" ? "person-outline" : "briefcase-outline"}
                    size={18}
                    color={active ? colors.greenDark : colors.muted}
                  />
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
