import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import style from "../style/SharedExpenses.module.css";
import { sharedGroupsService } from "../api";
import { CURRENCY_OPTIONS, formatMoney, formatSignedMoney } from "../utils/finance";

const SPLIT_OPTIONS = [
  { value: "equal", label: "Todos iguales" },
  { value: "percentage", label: "Por porcentaje" },
  { value: "amount", label: "Por monto base" },
];
const PAYMENT_METHOD_OPTIONS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
];

const PANEL_SEQUENCE = ["group", "expenses"];

const todayInput = () => new Date().toISOString().slice(0, 10);
const slugifyName = (value = "") =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "invitado";
const createGuestAlias = (name = "") =>
  `guest+${slugifyName(name)}-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}@growth.local`;

const createEmptyGroupForm = (currency = "ARS") => ({
  name: "",
  currency,
  participants: [],
  participantMode: "linked",
  participantNameInput: "",
  participantEmailInput: "",
  splitMode: "equal",
  splitValues: {},
});

const createEmptyExpenseForm = () => ({
  description: "",
  amount: "",
  paidByEmail: "",
  date: todayInput(),
  notes: "",
  participantEmails: [],
});

const createEmptyMemberForm = () => ({
  mode: "linked",
  name: "",
  email: "",
  historyMode: "future",
});

const createEmptyDebtForm = () => ({
  description: "",
  amount: "",
  debtorEmail: "",
  creditorEmail: "",
  date: todayInput(),
  notes: "",
});

const createEmptyDebtSettlementForm = () => ({
  paymentMethod: "efectivo",
  date: todayInput(),
  notes: "",
});

const normalizeEmail = (value = "") => value.trim().toLowerCase();
const normalizeName = (value = "") => value.trim();
const toDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};
const getParticipantDisplayName = (participant = {}) =>
  participant.username ||
  (!participant.isGuest && participant.email ? participant.email.split("@")[0] : "") ||
  "Participante";
const getParticipantSecondaryText = (participant = {}) =>
  participant.isGuest ? "Invitado sin cuenta" : participant.email || "Sin correo";
const getEligibleParticipantEmails = (group, date) =>
  (group?.participants || [])
    .filter((participant) => {
      if (!participant?.joinedAt) return true;
      return toDateKey(participant.joinedAt) <= toDateKey(date);
    })
    .map((participant) => participant.email);

const buildSettlements = (participants = []) => {
  const creditors = participants
    .filter((participant) => participant.balance > 0.01)
    .map((participant) => ({
      email: participant.email,
      username: participant.username,
      amount: Number(participant.balance),
    }));

  const debtors = participants
    .filter((participant) => participant.balance < -0.01)
    .map((participant) => ({
      email: participant.email,
      username: participant.username,
      amount: Number(Math.abs(participant.balance)),
    }));

  const settlements = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.amount, debtor.amount);

    settlements.push({
      fromEmail: debtor.email,
      fromName: debtor.username,
      toEmail: creditor.email,
      toName: creditor.username,
      amount: Number(amount.toFixed(2)),
    });

    creditor.amount = Number((creditor.amount - amount).toFixed(2));
    debtor.amount = Number((debtor.amount - amount).toFixed(2));

    if (creditor.amount <= 0.01) creditorIndex += 1;
    if (debtor.amount <= 0.01) debtorIndex += 1;
  }

  return settlements;
};

const mapGroupToForm = (group) => {
  const splitValues = (group.splitConfig || []).reduce((acc, item) => {
    acc[item.participantEmail] =
      group.splitMode === "percentage" ? item.percentage ?? "" : item.amount ?? "";
    return acc;
  }, {});

  return {
    name: group.name || "",
    currency: group.currency || "ARS",
    participants: group.participants || [],
    participantMode: "linked",
    participantNameInput: "",
    participantEmailInput: "",
    splitMode: group.splitMode || "equal",
    splitValues,
  };
};

function SharedExpenses() {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupDetail, setGroupDetail] = useState(null);
  const [groupForm, setGroupForm] = useState(createEmptyGroupForm());
  const [expenseForm, setExpenseForm] = useState(createEmptyExpenseForm());
  const [activePanel, setActivePanel] = useState("group");
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [showDebtPanel, setShowDebtPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingDebt, setSavingDebt] = useState(false);
  const [settlingDebtId, setSettlingDebtId] = useState("");
  const [savingDebtSettlement, setSavingDebtSettlement] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [memberForm, setMemberForm] = useState(createEmptyMemberForm());
  const [debtForm, setDebtForm] = useState(createEmptyDebtForm());
  const [debtSettlementForm, setDebtSettlementForm] = useState(createEmptyDebtSettlementForm());
  const selectedGroupIdRef = useRef("");
  const expenseSectionRef = useRef(null);
  const [pendingExpenseFocus, setPendingExpenseFocus] = useState(false);

  const isCreating = !selectedGroupId;
  const participants = groupForm.participants || [];
  const selectedCurrencyMeta = useMemo(
    () =>
      CURRENCY_OPTIONS.find((option) => option.value === groupForm.currency) ||
      CURRENCY_OPTIONS[0],
    [groupForm.currency]
  );
  const settlements = useMemo(
    () => buildSettlements(groupDetail?.summary?.participants || []),
    [groupDetail]
  );
  const expenseEligibleParticipants = useMemo(() => {
    if (!groupDetail?.group) return [];

    const eligibleEmails = new Set(
      getEligibleParticipantEmails(groupDetail.group, expenseForm.date || todayInput())
    );

    return (groupDetail.group.participants || []).filter((participant) =>
      eligibleEmails.has(participant.email)
    );
  }, [expenseForm.date, groupDetail]);
  const debtEligibleParticipants = useMemo(() => {
    if (!groupDetail?.group) return [];

    const eligibleEmails = new Set(
      getEligibleParticipantEmails(groupDetail.group, debtForm.date || todayInput())
    );

    return (groupDetail.group.participants || []).filter((participant) =>
      eligibleEmails.has(participant.email)
    );
  }, [debtForm.date, groupDetail]);
  const applyGroupDetailData = useCallback((detail) => {
    const eligibleParticipantEmails = getEligibleParticipantEmails(
      detail.group,
      todayInput()
    );
    const eligibleDebtParticipants = getEligibleParticipantEmails(
      detail.group,
      todayInput()
    );

    setGroupDetail(detail);
    setGroupForm(mapGroupToForm(detail.group));
    setExpenseForm({
      ...createEmptyExpenseForm(),
      paidByEmail: eligibleParticipantEmails[0] || "",
      participantEmails: eligibleParticipantEmails,
    });
    setDebtForm({
      ...createEmptyDebtForm(),
      debtorEmail: eligibleDebtParticipants[0] || "",
      creditorEmail: eligibleDebtParticipants[1] || eligibleDebtParticipants[0] || "",
    });
  }, []);

  useEffect(() => {
    selectedGroupIdRef.current = selectedGroupId;
  }, [selectedGroupId]);

  const fetchGroups = useCallback(async (preferredGroupId) => {
    setLoading(true);

    try {
      const response = await sharedGroupsService.getAll();
      const nextGroups = response.data || [];

      setGroups(nextGroups);

      const nextSelectedId =
        preferredGroupId !== undefined
          ? preferredGroupId
          : selectedGroupIdRef.current || nextGroups[0]?._id || "";

      if (nextSelectedId) {
        setSelectedGroupId(nextSelectedId);
      } else {
        setSelectedGroupId("");
        setGroupDetail(null);
        setGroupForm(createEmptyGroupForm());
        setExpenseForm(createEmptyExpenseForm());
        setDebtForm(createEmptyDebtForm());
      }
    } catch (err) {
      setError("No se pudieron cargar los grupos compartidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroupDetail = useCallback(async (groupId) => {
    if (!groupId) {
      setGroupDetail(null);
      return;
    }

    setDetailLoading(true);

    try {
      const response = await sharedGroupsService.getById(groupId);
      const detail = response.data;
      applyGroupDetailData(detail);
      setError("");
    } catch (err) {
      setError("No se pudo cargar el detalle del grupo.");
    } finally {
      setDetailLoading(false);
    }
  }, [applyGroupDetailData]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (!selectedGroupId) return;
    fetchGroupDetail(selectedGroupId);
  }, [fetchGroupDetail, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) {
      setActivePanel("group");
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (activePanel !== "expenses") {
      setShowMemberPanel(false);
      setShowDebtPanel(false);
    }
  }, [activePanel]);

  useEffect(() => {
    if (!pendingExpenseFocus || !groupDetail || !selectedGroupId) return;

    expenseSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setPendingExpenseFocus(false);
  }, [groupDetail, pendingExpenseFocus, selectedGroupId]);

  const handleStartNewGroup = () => {
    setSelectedGroupId("");
    setGroupDetail(null);
    setGroupForm(createEmptyGroupForm(groupForm.currency));
    setExpenseForm(createEmptyExpenseForm());
    selectedGroupIdRef.current = "";
    setActivePanel("group");
    setShowMemberPanel(false);
    setShowDebtPanel(false);
    setMemberForm(createEmptyMemberForm());
    setDebtForm(createEmptyDebtForm());
    setDebtSettlementForm(createEmptyDebtSettlementForm());
    setSettlingDebtId("");
    setPendingExpenseFocus(false);
    setError("");
    setSuccess("");
  };

  const handleSelectGroup = (groupId) => {
    setSelectedGroupId(groupId);
    setActivePanel("expenses");
    setShowMemberPanel(false);
    setShowDebtPanel(false);
    setSettlingDebtId("");
    setError("");
    setSuccess("");
  };

  const handleAddParticipant = () => {
    const isGuestMode = groupForm.participantMode === "guest";
    const name = normalizeName(groupForm.participantNameInput);
    const email = normalizeEmail(groupForm.participantEmailInput);

    if (isGuestMode && !name) {
      setError("Para un invitado sin cuenta tenés que cargar un nombre.");
      return;
    }

    if (!isGuestMode && !email) {
      setError("Para vincular una cuenta tenés que cargar el email.");
      return;
    }

    if (participants.some((participant) => participant.email === email)) {
      setError("Ese email ya está cargado en el grupo.");
      return;
    }

    const participantEmail = isGuestMode ? createGuestAlias(name) : email;

    setGroupForm((prev) => ({
      ...prev,
      participants: [
        ...prev.participants,
        {
          email: participantEmail,
          username: name || email.split("@")[0],
          user: null,
          isGuest: isGuestMode,
          isOwner: false,
        },
      ],
      participantMode: "linked",
      participantNameInput: "",
      participantEmailInput: "",
      splitValues: {
        ...prev.splitValues,
        [participantEmail]: prev.splitMode === "amount" ? 1 : "",
      },
    }));
    setError("");
  };

  const handleRemoveParticipant = (email) => {
    setGroupForm((prev) => {
      const nextSplitValues = { ...prev.splitValues };
      delete nextSplitValues[email];

      return {
        ...prev,
        participants: prev.participants.filter((participant) => participant.email !== email),
        splitValues: nextSplitValues,
      };
    });

    setExpenseForm((prev) => ({
      ...prev,
      paidByEmail: prev.paidByEmail === email ? "" : prev.paidByEmail,
    }));
  };

  const handleSplitModeChange = (value) => {
    setGroupForm((prev) => ({
      ...prev,
      splitMode: value,
      splitValues:
        value === "amount"
          ? Object.fromEntries(
              prev.participants.map((participant) => [
                participant.email,
                Number(prev.splitValues[participant.email]) || 1,
              ])
            )
          : Object.fromEntries(
              prev.participants.map((participant) => [
                participant.email,
                prev.splitValues[participant.email] || "",
              ])
            ),
    }));
  };

  const buildGroupPayload = () => ({
    name: groupForm.name.trim(),
    currency: groupForm.currency,
    participants: groupForm.participants.map((participant) => ({
      email: participant.email,
      username: participant.username,
      isGuest: participant.isGuest,
    })),
    splitMode: groupForm.splitMode,
    splitConfig: groupForm.participants.map((participant) => ({
      participantEmail: participant.email,
      percentage:
        groupForm.splitMode === "percentage"
          ? Number(groupForm.splitValues[participant.email]) || 0
          : null,
      amount:
        groupForm.splitMode === "amount"
          ? Number(groupForm.splitValues[participant.email]) || 0
          : null,
    })),
  });

  const handleSaveGroup = async (event) => {
    event.preventDefault();
    setSavingGroup(true);
    setError("");
    setSuccess("");

    if (!groupForm.name.trim()) {
      setError("El nombre del grupo es obligatorio.");
      setSavingGroup(false);
      return;
    }

    if (!groupForm.participants.length) {
      setError("Agrega al menos un participante por nombre o email.");
      setSavingGroup(false);
      return;
    }

    try {
      const payload = buildGroupPayload();

      if (isCreating) {
        const response = await sharedGroupsService.create(payload);
        const createdGroup = response.data;
        setPendingExpenseFocus(true);
        setActivePanel("expenses");
        await fetchGroups(createdGroup._id);
        setSuccess("Grupo compartido creado.");
      } else {
        const response = await sharedGroupsService.update(selectedGroupId, payload);
        applyGroupDetailData(response.data);
        await fetchGroups(selectedGroupId);
        setSuccess("Grupo actualizado.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el grupo.");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleAddMemberToGroup = async (event) => {
    event.preventDefault();

    if (!selectedGroupId) return;

    setSavingMember(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        mode: memberForm.mode,
        name: memberForm.name.trim(),
        email: memberForm.email.trim(),
        historyMode: memberForm.historyMode,
      };

      const response = await sharedGroupsService.addMember(selectedGroupId, payload);
      applyGroupDetailData(response.data);
      setMemberForm(createEmptyMemberForm());
      setShowMemberPanel(false);
      setSuccess(
        payload.historyMode === "all"
          ? "Miembro agregado y aplicado al historial."
          : "Miembro agregado para los gastos nuevos."
      );
      await fetchGroups(selectedGroupId);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo sumar el miembro.");
    } finally {
      setSavingMember(false);
    }
  };

  const handleExpenseChange = (field, value) => {
    if (field === "date" && groupDetail?.group) {
      const eligibleParticipantEmails = getEligibleParticipantEmails(groupDetail.group, value);

      setExpenseForm((prev) => ({
        ...prev,
        date: value,
        paidByEmail: eligibleParticipantEmails.includes(prev.paidByEmail)
          ? prev.paidByEmail
          : eligibleParticipantEmails[0] || "",
        participantEmails: prev.participantEmails.filter((email) =>
          eligibleParticipantEmails.includes(email)
        ).length
          ? prev.participantEmails.filter((email) => eligibleParticipantEmails.includes(email))
          : eligibleParticipantEmails,
      }));
      return;
    }

    setExpenseForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggleExpenseParticipant = (email) => {
    setExpenseForm((prev) => {
      const exists = prev.participantEmails.includes(email);

      return {
        ...prev,
        participantEmails: exists
          ? prev.participantEmails.filter((item) => item !== email)
          : [...prev.participantEmails, email],
      };
    });
  };

  const handleDebtChange = (field, value) => {
    if (field === "date" && groupDetail?.group) {
      const eligibleEmails = getEligibleParticipantEmails(groupDetail.group, value);
      const nextDebtorEmail = eligibleEmails.includes(debtForm.debtorEmail)
        ? debtForm.debtorEmail
        : eligibleEmails[0] || "";
      const nextCreditorEmail =
        eligibleEmails.includes(debtForm.creditorEmail) &&
        debtForm.creditorEmail !== nextDebtorEmail
          ? debtForm.creditorEmail
          : eligibleEmails.find((email) => email !== nextDebtorEmail) || "";

      setDebtForm((prev) => ({
        ...prev,
        date: value,
        debtorEmail: nextDebtorEmail,
        creditorEmail: nextCreditorEmail,
      }));
      return;
    }

    if (field === "debtorEmail") {
      setDebtForm((prev) => ({
        ...prev,
        debtorEmail: value,
        creditorEmail: prev.creditorEmail === value ? "" : prev.creditorEmail,
      }));
      return;
    }

    setDebtForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDebt = async (event) => {
    event.preventDefault();

    if (!selectedGroupId) return;

    setSavingDebt(true);
    setError("");
    setSuccess("");

    try {
      const response = await sharedGroupsService.createDebt(selectedGroupId, {
        description: debtForm.description.trim(),
        amount: Number(debtForm.amount),
        debtorEmail: debtForm.debtorEmail,
        creditorEmail: debtForm.creditorEmail,
        date: debtForm.date,
        notes: debtForm.notes.trim(),
      });

      applyGroupDetailData(response.data);
      setShowDebtPanel(false);
      setSuccess("Deuda cargada en el grupo.");
      await fetchGroups(selectedGroupId);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cargar la deuda.");
    } finally {
      setSavingDebt(false);
    }
  };

  const handleStartDebtSettlement = (debtId) => {
    setSettlingDebtId((current) => (current === debtId ? "" : debtId));
    setDebtSettlementForm(createEmptyDebtSettlementForm());
    setError("");
    setSuccess("");
  };

  const handleSettleDebt = async (event, debtId) => {
    event.preventDefault();

    if (!selectedGroupId) return;

    setSavingDebtSettlement(true);
    setError("");
    setSuccess("");

    try {
      const response = await sharedGroupsService.settleDebt(selectedGroupId, debtId, {
        paymentMethod: debtSettlementForm.paymentMethod,
        date: debtSettlementForm.date,
        notes: debtSettlementForm.notes.trim(),
      });

      applyGroupDetailData(response.data);
      setSettlingDebtId("");
      setDebtSettlementForm(createEmptyDebtSettlementForm());
      setSuccess("Deuda marcada como pagada y registrada como egreso.");
      await fetchGroups(selectedGroupId);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cerrar la deuda.");
    } finally {
      setSavingDebtSettlement(false);
    }
  };

  const handleSaveExpense = async (event) => {
    event.preventDefault();
    if (!selectedGroupId) return;

    setSavingExpense(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        description: expenseForm.description.trim(),
        amount: Number(expenseForm.amount),
        paidByEmail: expenseForm.paidByEmail,
        date: expenseForm.date,
        notes: expenseForm.notes.trim(),
        participantEmails: expenseForm.participantEmails,
      };

      const response = await sharedGroupsService.createExpense(selectedGroupId, payload);
      applyGroupDetailData({
        group: response.data.group,
        expenses: response.data.expenses,
        summary: response.data.summary,
      });
      setSuccess("Gasto compartido agregado.");
      await fetchGroups(selectedGroupId);
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el gasto.");
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!selectedGroupId) return;
    if (!window.confirm("¿Eliminar gasto compartido?")) return;

    try {
      const response = await sharedGroupsService.deleteExpense(selectedGroupId, expenseId);
      applyGroupDetailData(response.data);
      setSuccess("Gasto eliminado.");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo eliminar el gasto.");
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm("¿Eliminar este grupo compartido?")) return;

    setError("");
    setSuccess("");

    try {
      await sharedGroupsService.delete(groupId);

      if (selectedGroupIdRef.current === groupId) {
        selectedGroupIdRef.current = "";
        setSelectedGroupId("");
        setGroupDetail(null);
        setGroupForm(createEmptyGroupForm(groupForm.currency));
        setExpenseForm(createEmptyExpenseForm());
        setDebtForm(createEmptyDebtForm());
        setShowDebtPanel(false);
        setSettlingDebtId("");
        setActivePanel("group");
      }

      await fetchGroups();
      setSuccess("Grupo eliminado.");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo eliminar el grupo.");
    }
  };

  const handleGoToExpenseForm = () => {
    expenseSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const canOpenExpenses = Boolean(selectedGroupId && groupDetail);
  const activePanelIndex = PANEL_SEQUENCE.indexOf(activePanel);

  const panelTitle =
    activePanel === "group"
      ? isCreating
        ? "Arma un grupo nuevo"
        : groupDetail?.group?.name || "Configurar grupo"
      : groupDetail?.group?.name || "Gastos del grupo";

  const panelKicker =
    activePanel === "group"
      ? isCreating
        ? "Crear grupo"
        : "Configuración del grupo"
      : "Gastos del grupo";

  return (
    <section className={style.container}>
      <div className={style.hero}>
        <div>
          <p className={style.kicker}>Gastos compartidos</p>
          <p className={style.heroText}>
            Vincula participantes por email, carga quién pagó cada gasto y deja que
            el sistema calcule cuánto corresponde a cada uno.
          </p>
        </div>

        <button type="button" className={style.newGroupButton} onClick={handleStartNewGroup}>
          Nuevo grupo
        </button>
      </div>

      {error ? <p className={style.feedbackError}>{error}</p> : null}
      {success ? <p className={style.feedbackSuccess}>{success}</p> : null}

      <div className={style.layout}>
        <aside className={`${style.sidebar} ${style.groupShelf}`}>
          <div className={style.sidebarHeaderRow}>
            <div className={style.sidebarHeader}>
              <p className={style.sidebarKicker}>Panel</p>
              <h2>Grupos creados</h2>
            </div>

            <button
              type="button"
              className={style.secondaryButton}
              onClick={handleStartNewGroup}
            >
              Nuevo
            </button>
          </div>

          <p className={style.sidebarText}>
            Crea grupos separados para viajes, noches, socios o períodos distintos.
          </p>

          <div className={style.groupList}>
            {loading ? (
              <p className={style.emptyMessage}>Cargando grupos...</p>
            ) : groups.length === 0 ? (
              <p className={style.emptyMessage}>
                Todavía no hay grupos. Crea uno para empezar a compartir gastos.
              </p>
            ) : (
              groups.map((group) => (
                <article
                  key={group._id}
                  className={`${style.groupCard} ${
                    selectedGroupId === group._id ? style.groupCardActive : ""
                  }`}
                >
                  <button
                    type="button"
                    className={style.groupCardButton}
                    onClick={() => handleSelectGroup(group._id)}
                  >
                    <strong>{group.name}</strong>
                    <span>
                      {group.participants?.length || 0} participantes · {group.currency}
                    </span>
                  </button>

                  <div className={style.groupCardActions}>
                    <button
                      type="button"
                      className={style.secondaryButton}
                      onClick={() => handleSelectGroup(group._id)}
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      className={style.deleteInlineButton}
                      onClick={() => handleDeleteGroup(group._id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </aside>

        <section className={`${style.panel} ${style.workspacePanel}`}>
          <div className={style.panelHeader}>
            <div>
              <p className={style.panelKicker}>{panelKicker}</p>
              <h2>{panelTitle}</h2>
            </div>

            <div className={style.panelHeaderActions}>
              {!isCreating ? (
                <span className={style.panelTag}>{selectedCurrencyMeta.codeLabel}</span>
              ) : null}

              {!isCreating && activePanel === "expenses" ? (
                <button
                  type="button"
                  className={style.secondaryButton}
                  onClick={() => {
                    setShowMemberPanel((prev) => !prev);
                    setShowDebtPanel(false);
                  }}
                >
                  {showMemberPanel ? "Cerrar alta" : "Sumar miembro"}
                </button>
              ) : null}

              {!isCreating && activePanel === "expenses" ? (
                <button
                  type="button"
                  className={style.secondaryButton}
                  onClick={() => {
                    setShowDebtPanel((prev) => !prev);
                    setShowMemberPanel(false);
                    setSettlingDebtId("");
                  }}
                >
                  {showDebtPanel ? "Cerrar deuda" : "Cargar deuda"}
                </button>
              ) : null}

              {activePanel === "expenses" && selectedGroupId && groupDetail ? (
                <button
                  type="button"
                  className={style.jumpButton}
                  onClick={handleGoToExpenseForm}
                >
                  Ir a cargar gasto
                </button>
              ) : null}

              {detailLoading ? <span className={style.panelTag}>Cargando</span> : null}
            </div>
          </div>

               <div className={style.panelFooterNav}>
            <button
              type="button"
              className={style.navArrow}
              onClick={() => setActivePanel("group")}
              disabled={activePanelIndex <= 0}
            >
              ← Configuración
            </button>

            <p className={style.panelFooterMeta}>
              Panel {activePanelIndex + 1} de {PANEL_SEQUENCE.length}
            </p>

            <button
              type="button"
              className={style.navArrow}
              onClick={() => setActivePanel("expenses")}
              disabled={!canOpenExpenses || activePanelIndex >= PANEL_SEQUENCE.length - 1}
            >
              Gastos →
            </button>
          </div>

          <div className={style.panelBody}>
            {activePanel === "group" ? (
              !isCreating && detailLoading && !groupDetail ? (
                <div className={style.emptyState}>
                  <h3>Cargando grupo</h3>
                  <p>Esperando la configuración del grupo seleccionado.</p>
                </div>
              ) : (
                <form className={style.groupForm} onSubmit={handleSaveGroup}>
                  <div className={style.formGrid}>
                    <label className={style.field}>
                      <span>Nombre del grupo</span>
                      <input
                        type="text"
                        value={groupForm.name}
                        onChange={(event) =>
                          setGroupForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        className={style.input}
                        placeholder="Ej: depto, viaje, socios"
                      />
                    </label>

                    <label className={style.field}>
                      <span>Moneda</span>
                      <select
                        value={groupForm.currency}
                        onChange={(event) =>
                          setGroupForm((prev) => ({ ...prev, currency: event.target.value }))
                        }
                        className={style.select}
                      >
                        {CURRENCY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.codeLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className={style.configColumns}>
                    <div className={style.participantBox}>
                      <div className={style.cardSectionHead}>
                        <span className={style.sectionLabel}>Participantes del grupo</span>
                        <p className={style.sectionText}>
                          Vincula por email a quienes ya usan la app. Si alguien no tiene
                          cuenta, podés cargarlo como invitado solo con nombre.
                        </p>
                      </div>

                      <div className={style.splitModes}>
                        <button
                          type="button"
                          className={`${style.modeButton} ${
                            groupForm.participantMode === "linked"
                              ? style.modeButtonActive
                              : ""
                          }`}
                          onClick={() =>
                            setGroupForm((prev) => ({ ...prev, participantMode: "linked" }))
                          }
                        >
                          Con cuenta
                        </button>
                        <button
                          type="button"
                          className={`${style.modeButton} ${
                            groupForm.participantMode === "guest"
                              ? style.modeButtonActive
                              : ""
                          }`}
                          onClick={() =>
                            setGroupForm((prev) => ({ ...prev, participantMode: "guest" }))
                          }
                        >
                          Invitado
                        </button>
                      </div>

                      <div className={style.addParticipantRow}>
                        <input
                          type="text"
                          value={groupForm.participantNameInput}
                          onChange={(event) =>
                            setGroupForm((prev) => ({
                              ...prev,
                              participantNameInput: event.target.value,
                            }))
                          }
                          className={style.input}
                          placeholder={
                            groupForm.participantMode === "guest"
                              ? "Nombre o apodo del invitado"
                              : "Nombre opcional para mostrar"
                          }
                        />
                        <input
                          type="email"
                          value={groupForm.participantEmailInput}
                          onChange={(event) =>
                            setGroupForm((prev) => ({
                              ...prev,
                              participantEmailInput: event.target.value,
                            }))
                          }
                          className={style.input}
                          placeholder={
                            groupForm.participantMode === "guest"
                              ? "No hace falta email para invitados"
                              : "correo@ejemplo.com"
                          }
                          disabled={groupForm.participantMode === "guest"}
                        />
                        <button
                          type="button"
                          className={style.secondaryButton}
                          onClick={handleAddParticipant}
                        >
                          Agregar
                        </button>
                      </div>

                      <div className={style.participantList}>
                        {participants.length === 0 ? (
                          <p className={style.emptyInline}>No hay participantes cargados.</p>
                        ) : (
                          participants.map((participant) => (
                            <div key={participant.email} className={style.participantRow}>
                              <div>
                                <strong>{getParticipantDisplayName(participant)}</strong>
                                <span>{getParticipantSecondaryText(participant)}</span>
                              </div>
                              {participant.isOwner ? (
                                <span className={style.ownerBadge}>Creador</span>
                              ) : (
                                <button
                                  type="button"
                                  className={style.deleteInlineButton}
                                  onClick={() => handleRemoveParticipant(participant.email)}
                                >
                                  Quitar
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className={style.splitBox}>
                      <div className={style.cardSectionHead}>
                        <span className={style.sectionLabel}>Reparto del total</span>
                    
                      </div>

                      <div className={style.splitModes}>
                        {SPLIT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`${style.modeButton} ${
                              groupForm.splitMode === option.value
                                ? style.modeButtonActive
                                : ""
                            }`}
                            onClick={() => handleSplitModeChange(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      {groupForm.splitMode !== "equal" ? (
                        <div className={style.allocations}>
                          {participants.map((participant) => (
                            <label key={participant.email} className={style.allocationRow}>
                              <span>
                                {getParticipantDisplayName(participant)}
                                <small>{getParticipantSecondaryText(participant)}</small>
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className={style.input}
                                value={groupForm.splitValues[participant.email] ?? ""}
                                onChange={(event) =>
                                  setGroupForm((prev) => ({
                                    ...prev,
                                    splitValues: {
                                      ...prev.splitValues,
                                      [participant.email]: event.target.value,
                                    },
                                  }))
                                }
                                placeholder={
                                  groupForm.splitMode === "percentage"
                                    ? "0 - 100"
                                    : "Monto base"
                                }
                              />
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className={style.equalNotice}>
                          El total se divide automáticamente en partes iguales.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={style.formActions}>
                    <button
                      type="submit"
                      className={style.primaryButton}
                      disabled={savingGroup}
                    >
                      {savingGroup
                        ? "Guardando..."
                        : isCreating
                          ? "Crear grupo compartido"
                          : "Guardar configuración"}
                    </button>
                  </div>
                </form>
              )
            ) : !selectedGroupId ? (
              <div className={style.emptyState}>
                <h3>Crea o selecciona un grupo</h3>
                <p>
                  Cuando tengas un grupo activo podrás cargar gastos, ver cuánto puso
                  cada uno y cerrar cuentas.
                </p>
              </div>
            ) : detailLoading || !groupDetail ? (
              <div className={style.emptyState}>
                <h3>Cargando grupo</h3>
                <p>Esperando el detalle del panel compartido.</p>
              </div>
            ) : (
              <>
                {showMemberPanel ? (
                  <form className={style.memberPanel} onSubmit={handleAddMemberToGroup}>
                    <div className={style.cardSectionHead}>
                      <span className={style.sectionLabel}>Sumar miembro</span>
                      <p className={style.sectionText}>
                        Podés vincular una cuenta por email o agregar un invitado sin cuenta.
                      </p>
                    </div>

                    <div className={style.splitModes}>
                      <button
                        type="button"
                        className={`${style.modeButton} ${
                          memberForm.mode === "linked" ? style.modeButtonActive : ""
                        }`}
                        onClick={() =>
                          setMemberForm((prev) => ({ ...prev, mode: "linked" }))
                        }
                      >
                        Con cuenta
                      </button>
                      <button
                        type="button"
                        className={`${style.modeButton} ${
                          memberForm.mode === "guest" ? style.modeButtonActive : ""
                        }`}
                        onClick={() =>
                          setMemberForm((prev) => ({ ...prev, mode: "guest" }))
                        }
                      >
                        Invitado
                      </button>
                    </div>

                    <div className={style.formGridWide}>
                      <label className={style.field}>
                        <span>Nombre</span>
                        <input
                          type="text"
                          className={style.input}
                          value={memberForm.name}
                          onChange={(event) =>
                            setMemberForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                          placeholder={
                            memberForm.mode === "guest"
                              ? "Nombre del invitado"
                              : "Alias opcional"
                          }
                        />
                      </label>

                      <label className={style.field}>
                        <span>Email</span>
                        <input
                          type="email"
                          className={style.input}
                          value={memberForm.email}
                          onChange={(event) =>
                            setMemberForm((prev) => ({ ...prev, email: event.target.value }))
                          }
                          placeholder={
                            memberForm.mode === "guest"
                              ? "No hace falta email"
                              : "correo@ejemplo.com"
                          }
                          disabled={memberForm.mode === "guest"}
                        />
                      </label>
                    </div>

                    <div className={style.memberHistoryRow}>
                      <span className={style.sectionLabel}>Alcance del reparto</span>
                      <div className={style.splitModes}>
                        <button
                          type="button"
                          className={`${style.modeButton} ${
                            memberForm.historyMode === "future"
                              ? style.modeButtonActive
                              : ""
                          }`}
                          onClick={() =>
                            setMemberForm((prev) => ({ ...prev, historyMode: "future" }))
                          }
                        >
                          Desde ahora
                        </button>
                        <button
                          type="button"
                          className={`${style.modeButton} ${
                            memberForm.historyMode === "all" ? style.modeButtonActive : ""
                          }`}
                          onClick={() =>
                            setMemberForm((prev) => ({ ...prev, historyMode: "all" }))
                          }
                        >
                          Recalcular historial
                        </button>
                      </div>
                    </div>

                    <div className={style.formActions}>
                      <button
                        type="submit"
                        className={style.primaryButton}
                        disabled={savingMember}
                      >
                        {savingMember ? "Guardando..." : "Agregar miembro"}
                      </button>
                    </div>
                  </form>
                ) : null}

                {showDebtPanel ? (
                  <form className={style.debtPanel} onSubmit={handleSaveDebt}>
                    <div className={style.cardSectionHead}>
                      <span className={style.sectionLabel}>Cargar deuda</span>
                      <p className={style.sectionText}>
                        Registrá quién le debe a quién dentro del grupo y después marcala
                        como pagada para generar el egreso real.
                      </p>
                    </div>

                    <div className={style.formGridWide}>
                      <label className={style.field}>
                        <span>Motivo</span>
                        <input
                          type="text"
                          className={style.input}
                          value={debtForm.description}
                          onChange={(event) =>
                            handleDebtChange("description", event.target.value)
                          }
                          placeholder="Ej: adelanto, pago prestado, salida"
                        />
                      </label>

                      <label className={style.field}>
                        <span>Monto</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={style.input}
                          value={debtForm.amount}
                          onChange={(event) => handleDebtChange("amount", event.target.value)}
                          placeholder={`Monto en ${groupDetail.group.currency}`}
                        />
                      </label>
                    </div>

                    <div className={style.formGridTriple}>
                      <label className={style.field}>
                        <span>Debe</span>
                        <select
                          className={style.select}
                          value={debtForm.debtorEmail}
                          onChange={(event) =>
                            handleDebtChange("debtorEmail", event.target.value)
                          }
                        >
                          <option value="">Seleccionar</option>
                          {debtEligibleParticipants.map((participant) => (
                            <option key={participant.email} value={participant.email}>
                              {getParticipantDisplayName(participant)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={style.field}>
                        <span>A quién</span>
                        <select
                          className={style.select}
                          value={debtForm.creditorEmail}
                          onChange={(event) =>
                            handleDebtChange("creditorEmail", event.target.value)
                          }
                        >
                          <option value="">Seleccionar</option>
                          {debtEligibleParticipants
                            .filter((participant) => participant.email !== debtForm.debtorEmail)
                            .map((participant) => (
                              <option key={participant.email} value={participant.email}>
                                {getParticipantDisplayName(participant)}
                              </option>
                            ))}
                        </select>
                      </label>

                      <label className={style.field}>
                        <span>Fecha</span>
                        <input
                          type="date"
                          className={style.input}
                          value={debtForm.date}
                          onChange={(event) => handleDebtChange("date", event.target.value)}
                        />
                      </label>
                    </div>

                    <label className={style.field}>
                      <span>Notas</span>
                      <textarea
                        className={style.textarea}
                        value={debtForm.notes}
                        onChange={(event) => handleDebtChange("notes", event.target.value)}
                        placeholder="Detalle opcional de la deuda"
                      />
                    </label>

                    <div className={style.formActions}>
                      <button
                        type="submit"
                        className={style.primaryButton}
                        disabled={savingDebt}
                      >
                        {savingDebt ? "Guardando..." : "Guardar deuda"}
                      </button>
                    </div>
                  </form>
                ) : null}

                <div ref={expenseSectionRef} className={style.expenseAnchor}>
                  <div className={style.expenseIntro}>
                    <span className={style.sectionLabel}>Flujo del grupo</span>
                    <p className={style.sectionText}>
                      Cualquier usuario vinculado a un email del grupo puede entrar
                      y cargar gastos en este mismo espacio compartido.
                    </p>
                  </div>
                </div>

                <form className={style.expenseForm} onSubmit={handleSaveExpense}>
                  <div className={style.formGridWide}>
                    <label className={style.field}>
                      <span>Descripción</span>
                      <input
                        type="text"
                        className={style.input}
                        value={expenseForm.description}
                        onChange={(event) =>
                          handleExpenseChange("description", event.target.value)
                        }
                        placeholder="Ej: alquiler, comida, combustible"
                      />
                    </label>

                    <label className={style.field}>
                      <span>Monto</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={style.input}
                        value={expenseForm.amount}
                        onChange={(event) => handleExpenseChange("amount", event.target.value)}
                        placeholder={`Monto en ${groupDetail.group.currency}`}
                      />
                    </label>
                  </div>

                  <div className={style.formGridWide}>
                    <label className={style.field}>
                      <span>Pago realizado por</span>
                      <select
                        className={style.select}
                        value={expenseForm.paidByEmail}
                        onChange={(event) =>
                          handleExpenseChange("paidByEmail", event.target.value)
                        }
                      >
                        <option value="">Seleccionar participante</option>
                        {expenseEligibleParticipants.map((participant) => (
                          <option key={participant.email} value={participant.email}>
                            {getParticipantDisplayName(participant)}
                            {participant.isGuest ? " · invitado" : ` · ${participant.email}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={style.field}>
                      <span>Fecha</span>
                      <input
                        type="date"
                        className={style.input}
                        value={expenseForm.date}
                        onChange={(event) => handleExpenseChange("date", event.target.value)}
                      />
                    </label>
                  </div>

                  <label className={style.field}>
                    <span>Notas</span>
                    <textarea
                      className={style.textarea}
                      value={expenseForm.notes}
                      onChange={(event) => handleExpenseChange("notes", event.target.value)}
                      placeholder="Detalle opcional del gasto"
                    />
                  </label>

                  <div className={style.memberPicker}>
                    <div className={style.cardSectionHead}>
                      <span className={style.sectionLabel}>Quiénes participan en este gasto</span>
                      <p className={style.sectionText}>
                        Elegí los miembros que comparten este gasto. Los que se sumaron después
                        solo aparecen si ya estaban activos en la fecha elegida.
                      </p>
                    </div>

                    <div className={style.memberChipGrid}>
                      {expenseEligibleParticipants.map((participant) => {
                        const isActive = expenseForm.participantEmails.includes(
                          participant.email
                        );

                        return (
                          <button
                            key={participant.email}
                            type="button"
                            className={`${style.memberChip} ${
                              isActive ? style.memberChipActive : ""
                            }`}
                            onClick={() => handleToggleExpenseParticipant(participant.email)}
                          >
                            <strong>{getParticipantDisplayName(participant)}</strong>
                            <span>{getParticipantSecondaryText(participant)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={style.formActions}>
                    <button
                      type="submit"
                      className={style.primaryButton}
                      disabled={savingExpense}
                    >
                      {savingExpense ? "Guardando..." : "Cargar gasto compartido"}
                    </button>
                  </div>
                </form>

                <div className={style.summaryGrid}>
                  <article className={`${style.summaryCard} ${style.totalCard}`}>
                    <span>Total del grupo</span>
                    <strong>
                      {formatMoney(
                        groupDetail.summary?.totalSpent || 0,
                        groupDetail.group.currency
                      )}
                    </strong>
                    <p>
                      Reparto actual:{" "}
                      {
                        SPLIT_OPTIONS.find(
                          (item) => item.value === groupDetail.group.splitMode
                        )?.label
                      }
                    </p>
                  </article>

                  {(groupDetail.summary?.participants || []).map((participant) => (
                    <article key={participant.email} className={style.summaryCard}>
                      <div className={style.summaryTop}>
                        <div>
                          <span>
                            {getParticipantDisplayName(participant)}
                            {participant.isOwner ? " · creador " : " "}
                          </span>
                          <strong>
                            {participant.isGuest ? "Invitado sin cuenta" : participant.email}
                          </strong>
                        </div>
                        <p className={style.balanceText}>
                          {formatSignedMoney(
                            Math.abs(participant.balance),
                            groupDetail.group.currency,
                            participant.balance >= 0
                          )}
                        </p>
                      </div>

                      <div className={style.summaryMeta}>
                        {participant.joinedAt &&
                        new Date(participant.joinedAt).getTime() >
                          new Date(groupDetail.group.createdAt).getTime() ? (
                          <p>
                            Se sumó el{" "}
                            {new Date(participant.joinedAt).toLocaleDateString("es-AR")}
                          </p>
                        ) : null}
                        <p>Participa en {participant.expenseCount || 0} gastos</p>
                        <p>
                          Pago real:{" "}
                          {formatMoney(participant.paid, groupDetail.group.currency)}
                        </p>
                        <p>
                          Le corresponde:{" "}
                          {formatMoney(participant.target, groupDetail.group.currency)}
                        </p>
                        <p>
                          Participación del gasto: {participant.spentPercentage.toFixed(2)}%
                        </p>
                      </div>

                      <div className={style.progressTrack}>
                        <span
                          className={style.progressFill}
                          style={{
                            width: `${Math.min(participant.spentPercentage, 100)}%`,
                          }}
                        />
                      </div>
                    </article>
                  ))}
                </div>

                <div className={style.settlementPanel}>
                  <div className={style.settlementHeader}>
                    <span className={style.sectionLabel}>Liquidación final</span>
                    <p className={style.sectionText}>
                      Si quisieran cerrar cuentas ahora, estas son las transferencias sugeridas.
                    </p>
                  </div>

                  {settlements.length === 0 ? (
                    <div className={style.emptyInlineBlock}>
                      <h3>No hay deudas cruzadas</h3>
                      <p>El grupo está equilibrado o aún no tiene gastos suficientes.</p>
                    </div>
                  ) : (
                    <div className={style.settlementList}>
                      {settlements.map((settlement, index) => (
                        <article
                          key={`${settlement.fromEmail}-${settlement.toEmail}-${index}`}
                          className={style.settlementRow}
                        >
                          <div>
                            <strong>{settlement.fromName}</strong>
                            <p className={style.settlementMeta}>
                              le debe a {settlement.toName}
                            </p>
                          </div>
                          <strong className={style.settlementAmount}>
                            {formatMoney(settlement.amount, groupDetail.group.currency)}
                          </strong>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className={style.debtListPanel}>
                  <div className={style.settlementHeader}>
                    <span className={style.sectionLabel}>Deudas cargadas</span>
                    <p className={style.sectionText}>
                      Las deudas abiertas se pueden cerrar con `Ya pagué` y eso genera un
                      egreso real en la caja del usuario que confirma el pago.
                    </p>
                  </div>

                  {(groupDetail.debts || []).length === 0 ? (
                    <div className={style.emptyInlineBlock}>
                      <h3>No hay deudas cargadas</h3>
                      <p>Si alguien quedó debiendo algo, podés registrarlo desde este panel.</p>
                    </div>
                  ) : (
                    <div className={style.debtList}>
                      {groupDetail.debts.map((debt) => (
                        <article
                          key={debt._id}
                          className={`${style.debtRow} ${
                            debt.status === "paid" ? style.debtRowPaid : ""
                          }`}
                        >
                          <div>
                            <p className={style.expenseTitle}>{debt.description}</p>
                            <p className={style.expenseMeta}>
                              {debt.debtorName} le debe a {debt.creditorName} ·{" "}
                              {new Date(debt.date).toLocaleDateString("es-AR")}
                            </p>
                            <p className={style.expenseNotes}>{debt.notes || "Sin notas"}</p>
                            {debt.status === "paid" ? (
                              <p className={style.debtMeta}>
                                Pagada el{" "}
                                {debt.settledAt
                                  ? new Date(debt.settledAt).toLocaleDateString("es-AR")
                                  : "-"}{" "}
                                por {debt.settledByName || debt.settledByEmail || "un miembro"} ·{" "}
                                {debt.paymentMethod || "sin medio"}
                              </p>
                            ) : null}
                          </div>

                          <div className={style.expenseSide}>
                            <strong>
                              {formatMoney(debt.amount, debt.currency)}
                            </strong>
                            <span
                              className={`${style.debtStatus} ${
                                debt.status === "paid" ? style.debtStatusPaid : ""
                              }`}
                            >
                              {debt.status === "paid" ? "Pagada" : "Pendiente"}
                            </span>
                            {debt.status === "open" ? (
                              <button
                                type="button"
                                className={style.secondaryButton}
                                onClick={() => handleStartDebtSettlement(debt._id)}
                              >
                                {settlingDebtId === debt._id ? "Cancelar" : "Ya pagué"}
                              </button>
                            ) : null}
                          </div>

                          {settlingDebtId === debt._id ? (
                            <form
                              className={style.debtSettlementForm}
                              onSubmit={(event) => handleSettleDebt(event, debt._id)}
                            >
                              <div className={style.formGridTriple}>
                                <label className={style.field}>
                                  <span>Cómo lo pagaste</span>
                                  <select
                                    className={style.select}
                                    value={debtSettlementForm.paymentMethod}
                                    onChange={(event) =>
                                      setDebtSettlementForm((prev) => ({
                                        ...prev,
                                        paymentMethod: event.target.value,
                                      }))
                                    }
                                  >
                                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label className={style.field}>
                                  <span>Fecha</span>
                                  <input
                                    type="date"
                                    className={style.input}
                                    value={debtSettlementForm.date}
                                    onChange={(event) =>
                                      setDebtSettlementForm((prev) => ({
                                        ...prev,
                                        date: event.target.value,
                                      }))
                                    }
                                  />
                                </label>

                                <label className={style.field}>
                                  <span>Detalle</span>
                                  <input
                                    type="text"
                                    className={style.input}
                                    value={debtSettlementForm.notes}
                                    onChange={(event) =>
                                      setDebtSettlementForm((prev) => ({
                                        ...prev,
                                        notes: event.target.value,
                                      }))
                                    }
                                    placeholder="Opcional"
                                  />
                                </label>
                              </div>

                              <div className={style.formActions}>
                                <button
                                  type="submit"
                                  className={style.primaryButton}
                                  disabled={savingDebtSettlement}
                                >
                                  {savingDebtSettlement ? "Guardando..." : "Confirmar pago"}
                                </button>
                              </div>
                            </form>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className={style.expenseList}>
                  {(groupDetail.expenses || []).length === 0 ? (
                    <div className={style.emptyInlineBlock}>
                      <h3>Aún no hay gastos</h3>
                      <p>El primer gasto que cargues ya entra al reparto automáticamente.</p>
                    </div>
                  ) : (
                    groupDetail.expenses.map((expense) => (
                      <article key={expense._id} className={style.expenseRow}>
                        <div>
                          <p className={style.expenseTitle}>{expense.description}</p>
                          <p className={style.expenseMeta}>
                            Pago: {expense.paidByName || expense.paidByEmail} ·{" "}
                            {new Date(expense.date).toLocaleDateString("es-AR")}
                          </p>
                          <p className={style.expenseMeta}>
                            Participan: {expense.participantEmails?.length || 0} miembros
                          </p>
                          <p className={style.expenseNotes}>{expense.notes || "Sin notas"}</p>
                        </div>

                        <div className={style.expenseSide}>
                          <strong>
                            {formatMoney(expense.amount, groupDetail.group.currency)}
                          </strong>
                          <button
                            type="button"
                            className={style.deleteInlineButton}
                            onClick={() => handleDeleteExpense(expense._id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className={style.panelFooterNav}>
            <button
              type="button"
              className={style.navArrow}
              onClick={() => setActivePanel("group")}
              disabled={activePanelIndex <= 0}
            >
              ← Configuración
            </button>

            <p className={style.panelFooterMeta}>
              Panel {activePanelIndex + 1} de {PANEL_SEQUENCE.length}
            </p>

            <button
              type="button"
              className={style.navArrow}
              onClick={() => setActivePanel("expenses")}
              disabled={!canOpenExpenses || activePanelIndex >= PANEL_SEQUENCE.length - 1}
            >
              Gastos →
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

export default SharedExpenses;
