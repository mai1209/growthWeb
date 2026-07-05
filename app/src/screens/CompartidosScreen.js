import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { sharedGroupsService } from "../api";
import { useTheme } from "../theme";
import { formatMoney } from "../utils/finance";
import { buildSettlements } from "../utils/shared";
import CreateGroupModal from "../components/CreateGroupModal";
import AddExpenseModal from "../components/AddExpenseModal";
import AddDebtModal from "../components/AddDebtModal";
import AddMemberModal from "../components/AddMemberModal";
import SettleDebtModal from "../components/SettleDebtModal";

const fmtDate = (value) => (value ? String(value).slice(0, 10) : "");
const signedMoney = (amount, currency) => {
  const n = Number(amount) || 0;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(n), currency)}`;
};

const TABS = [
  { key: "balances", label: "Balances" },
  { key: "gastos", label: "Gastos" },
  { key: "deudas", label: "Deudas" },
];

export default function CompartidosScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState("balances");

  const [showCreate, setShowCreate] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [showDebt, setShowDebt] = useState(false);
  const [showMember, setShowMember] = useState(false);
  const [settleDebt, setSettleDebt] = useState(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await sharedGroupsService.getAll();
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const res = await sharedGroupsService.getById(id);
      setDetail(res.data);
    } catch {
      Alert.alert("Error", "No se pudo cargar el grupo.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const openGroup = (id) => {
    setSelectedId(id);
    setTab("balances");
    setDetail(null);
    fetchDetail(id);
  };

  const back = () => {
    setSelectedId(null);
    setDetail(null);
  };

  const refreshDetail = () => fetchDetail(selectedId);

  const deleteGroup = (group) => {
    Alert.alert("Eliminar grupo", `¿Borrar "${group.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await sharedGroupsService.delete(group._id);
            back();
            fetchGroups();
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  };

  const deleteExpense = (expenseId) => {
    Alert.alert("Eliminar gasto", "¿Borrar este gasto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await sharedGroupsService.deleteExpense(selectedId, expenseId);
            refreshDetail();
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  };

  // ===== Detalle de grupo =====
  if (selectedId) {
    const group = detail?.group;
    const summary = detail?.summary;
    const currency = group?.currency || "ARS";
    const participants = group?.participants || [];
    const sumParts = summary?.participants || [];
    const expenses = detail?.expenses || [];
    const debts = detail?.debts || [];
    const settlements = buildSettlements(sumParts);

    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={back} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
            <Text style={styles.backText}>Grupos</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 18 }}>
            <TouchableOpacity onPress={() => setShowMember(true)} hitSlop={10}>
              <Ionicons name="person-add-outline" size={20} color={colors.greenDark} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => group && deleteGroup(group)} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={colors.red} />
            </TouchableOpacity>
          </View>
        </View>

        {detailLoading && !detail ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
        ) : (
          <>
            <Text style={styles.groupName}>{group?.name}</Text>
            <Text style={styles.groupMeta}>
              {participants.length} participantes · {currency}
            </Text>

            {/* Tabs */}
            <View style={styles.tabBar}>
              {TABS.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tab, tab === t.key && styles.tabActive]}
                  onPress={() => setTab(t.key)}
                >
                  <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 100 }}
              refreshControl={
                <RefreshControl refreshing={false} onRefresh={refreshDetail} tintColor={colors.green} />
              }
            >
              {/* ---- BALANCES ---- */}
              {tab === "balances" && (
                <>
                  <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Total del grupo</Text>
                    <Text style={styles.totalAmount}>
                      {formatMoney(summary?.totalSpent || 0, currency)}
                    </Text>
                  </View>

                  {sumParts.map((p) => (
                    <View key={p.email} style={styles.partCard}>
                      <View style={styles.partTop}>
                        <Text style={styles.partName}>
                          {p.username}
                          {p.isOwner ? " · creador" : ""}
                        </Text>
                        <Text
                          style={[
                            styles.partBalance,
                            { color: p.balance >= 0 ? colors.greenDark : colors.red },
                          ]}
                        >
                          {signedMoney(p.balance, currency)}
                        </Text>
                      </View>
                      <Text style={styles.partMeta}>
                        Pagó {formatMoney(p.paid, currency)} · le toca {formatMoney(p.target, currency)}
                      </Text>
                      <Text style={styles.partMeta}>
                        Participa en {p.expenseCount} gastos · {p.spentPercentage}% del total
                      </Text>
                      <View style={styles.track}>
                        <View
                          style={[
                            styles.trackFill,
                            { width: `${Math.min(100, Math.max(0, p.spentPercentage))}%` },
                          ]}
                        />
                      </View>
                    </View>
                  ))}

                  <Text style={styles.sectionTitle}>Liquidación final</Text>
                  {settlements.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>El grupo está equilibrado. ✅</Text>
                    </View>
                  ) : (
                    settlements.map((s, i) => (
                      <View key={i} style={styles.balanceRow}>
                        <Text style={styles.balanceText}>
                          <Text style={{ fontWeight: "800" }}>{s.fromName}</Text> le debe a{" "}
                          <Text style={{ fontWeight: "800" }}>{s.toName}</Text>
                        </Text>
                        <Text style={styles.balanceAmount}>{formatMoney(s.amount, currency)}</Text>
                      </View>
                    ))
                  )}
                </>
              )}

              {/* ---- GASTOS ---- */}
              {tab === "gastos" && (
                <>
                  {expenses.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>Todavía no hay gastos.</Text>
                    </View>
                  ) : (
                    expenses.map((e) => (
                      <TouchableOpacity
                        key={e._id}
                        style={styles.expenseCard}
                        activeOpacity={0.7}
                        onPress={() => setEditExpense(e)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.expenseTitle}>{e.description}</Text>
                          <Text style={styles.expenseMeta}>
                            Pagó {e.paidByName}
                            {e.date ? ` · ${fmtDate(e.date)}` : ""}
                          </Text>
                          <Text style={styles.expenseMeta}>
                            Participan {e.participantEmails?.length || 0} miembros
                          </Text>
                          <Text style={styles.editHint}>Tocá para editar</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 10 }}>
                          <Text style={styles.expenseAmount}>{formatMoney(e.amount, currency)}</Text>
                          <View style={{ flexDirection: "row", gap: 14 }}>
                            <TouchableOpacity onPress={() => setEditExpense(e)} hitSlop={8}>
                              <Ionicons name="create-outline" size={19} color={colors.greenDark} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteExpense(e._id)} hitSlop={8}>
                              <Ionicons name="trash-outline" size={19} color={colors.red} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </>
              )}

              {/* ---- DEUDAS ---- */}
              {tab === "deudas" && (
                <>
                  {debts.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyText}>No hay deudas cargadas.</Text>
                    </View>
                  ) : (
                    debts.map((d) => (
                      <View
                        key={d._id}
                        style={[styles.debtCard, d.status === "paid" && { opacity: 0.6 }]}
                      >
                        <View style={styles.debtTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.debtTitle}>{d.description}</Text>
                            <Text style={styles.debtMeta}>
                              {d.debtorName} le debe a {d.creditorName}
                              {d.date ? ` · ${fmtDate(d.date)}` : ""}
                            </Text>
                            {d.status === "paid" ? (
                              <Text style={styles.debtMeta}>
                                Pagada el {fmtDate(d.settledAt)}
                                {d.settledByName ? ` por ${d.settledByName}` : ""}
                                {d.paymentMethod ? ` · ${d.paymentMethod}` : ""}
                              </Text>
                            ) : Number(d.paidAmount) > 0 ? (
                              <Text style={styles.debtPartial}>
                                Pagado {formatMoney(d.paidAmount, currency)} · resta{" "}
                                {formatMoney(d.remaining ?? d.amount - d.paidAmount, currency)}
                              </Text>
                            ) : null}
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Text style={styles.debtAmount}>{formatMoney(d.amount, currency)}</Text>
                            <View
                              style={[
                                styles.statusBadge,
                                d.status === "paid" ? styles.badgePaid : styles.badgeOpen,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusText,
                                  { color: d.status === "paid" ? colors.greenDark : "#9a6a16" },
                                ]}
                              >
                                {d.status === "paid"
                                  ? "Pagada"
                                  : Number(d.paidAmount) > 0
                                  ? "Parcial"
                                  : "Pendiente"}
                              </Text>
                            </View>
                          </View>
                        </View>
                        {d.status !== "paid" && (
                          <TouchableOpacity
                            style={styles.payBtn}
                            onPress={() => setSettleDebt(d)}
                          >
                            <Ionicons name="checkmark-circle-outline" size={18} color={colors.greenDark} />
                            <Text style={styles.payText}>Ya pagué</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}
                  <TouchableOpacity style={styles.addDebtBtn} onPress={() => setShowDebt(true)}>
                    <Ionicons name="add" size={18} color={colors.greenDark} />
                    <Text style={styles.addDebtText}>Cargar deuda</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            {/* FAB cambia según tab */}
            {tab === "gastos" && (
              <TouchableOpacity style={styles.fab} onPress={() => setShowExpense(true)}>
                <Ionicons name="add" size={28} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}

        <AddExpenseModal
          visible={showExpense || !!editExpense}
          groupId={selectedId}
          participants={participants}
          editExpense={editExpense}
          onClose={() => {
            setShowExpense(false);
            setEditExpense(null);
          }}
          onSaved={refreshDetail}
        />
        <AddDebtModal
          visible={showDebt}
          groupId={selectedId}
          participants={participants}
          onClose={() => setShowDebt(false)}
          onSaved={refreshDetail}
        />
        <AddMemberModal
          visible={showMember}
          groupId={selectedId}
          onClose={() => setShowMember(false)}
          onSaved={refreshDetail}
        />
        <SettleDebtModal
          visible={!!settleDebt}
          groupId={selectedId}
          debt={settleDebt}
          onClose={() => setSettleDebt(null)}
          onSaved={refreshDetail}
        />
      </SafeAreaView>
    );
  }

  // ===== Lista de grupos =====
  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Grupos compartidos</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={fetchGroups} tintColor={colors.green} />
          }
        >
          {groups.length === 0 ? (
            <Text style={styles.empty}>Todavía no tenés grupos. Creá uno para empezar.</Text>
          ) : (
            groups.map((g) => (
              <TouchableOpacity key={g._id} style={styles.groupCard} onPress={() => openGroup(g._id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupCardName}>{g.name}</Text>
                  <Text style={styles.groupCardMeta}>
                    {g.participants?.length || 0} participantes · {g.currency}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <CreateGroupModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchGroups}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  listTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.greenBright,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  newBtnText: { color: "#fff", fontWeight: "800" },
  empty: { color: colors.muted, textAlign: "center", marginTop: 30 },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  groupCardName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  groupCardMeta: { color: colors.muted, fontSize: 13, marginTop: 3 },

  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { color: colors.text, fontWeight: "700", fontSize: 15 },
  groupName: { color: colors.text, fontSize: 24, fontWeight: "900", paddingHorizontal: 16 },
  groupMeta: { color: colors.muted, fontSize: 13, marginTop: 3, paddingHorizontal: 16 },

  tabBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  tabActive: { backgroundColor: colors.segActive, borderColor: colors.segActive },
  tabText: { color: colors.muted, fontWeight: "700" },
  tabTextActive: { color: colors.segActiveText, fontWeight: "800" },

  totalCard: {
    backgroundColor: colors.greenSoft,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  totalLabel: { color: colors.greenDark, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  totalAmount: { color: colors.text, fontSize: 26, fontWeight: "900", marginTop: 6 },

  partCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  partTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  partName: { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 },
  partBalance: { fontSize: 15, fontWeight: "800" },
  partMeta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  track: { height: 6, backgroundColor: "#d7e0d6", borderRadius: 3, marginTop: 10, overflow: "hidden" },
  trackFill: { height: "100%", backgroundColor: colors.greenBright, borderRadius: 3 },

  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 22,
    marginBottom: 10,
  },
  emptyBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 16,
  },
  emptyText: { color: colors.muted },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  balanceText: { color: colors.text, flex: 1, fontSize: 14 },
  balanceAmount: { color: colors.greenDark, fontWeight: "800", fontSize: 15 },

  expenseCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  expenseTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  expenseMeta: { color: colors.muted, fontSize: 13, marginTop: 3 },
  editHint: { color: colors.greenDark, fontSize: 12, fontWeight: "700", marginTop: 6 },
  expenseAmount: { color: colors.text, fontWeight: "800", fontSize: 15 },

  debtCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  debtTop: { flexDirection: "row", gap: 12 },
  debtTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  debtMeta: { color: colors.muted, fontSize: 13, marginTop: 3 },
  debtPartial: { color: colors.greenDark, fontSize: 13, fontWeight: "700", marginTop: 3 },
  debtAmount: { color: colors.text, fontWeight: "800", fontSize: 15 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  badgePaid: { backgroundColor: colors.greenSoft },
  badgeOpen: { backgroundColor: "rgba(214,169,46,0.18)" },
  statusText: { fontSize: 11, fontWeight: "800" },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    backgroundColor: colors.greenSoft,
  },
  payText: { color: colors.greenDark, fontWeight: "800" },
  addDebtBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    backgroundColor: colors.greenSoft,
  },
  addDebtText: { color: colors.greenDark, fontWeight: "800" },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.greenBright,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
