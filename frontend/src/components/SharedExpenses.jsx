import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import style from "../style/SharedExpenses.module.css";
import { sharedGroupsService } from "../api";
import { CURRENCY_OPTIONS, formatMoney, formatSignedMoney } from "../utils/finance";

const SPLIT_OPTIONS = [
  { value: "equal", label: "Todos iguales" },
  { value: "percentage", label: "Por porcentaje" },
  { value: "amount", label: "Por monto base" },
];

const PANEL_SEQUENCE = ["group", "expenses"];

const todayInput = () => new Date().toISOString().slice(0, 10);

const createEmptyGroupForm = (currency = "ARS") => ({
  name: "",
  currency,
  participants: [],
  emailInput: "",
  splitMode: "equal",
  splitValues: {},
});

const createEmptyExpenseForm = () => ({
  description: "",
  amount: "",
  paidByEmail: "",
  date: todayInput(),
  notes: "",
});

const normalizeEmail = (value = "") => value.trim().toLowerCase();

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
    emailInput: "",
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
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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

      setGroupDetail(detail);
      setGroupForm(mapGroupToForm(detail.group));
      setExpenseForm((prev) => ({
        ...createEmptyExpenseForm(),
        paidByEmail:
          detail.group?.participants?.[0]?.email || prev.paidByEmail || "",
      }));
      setError("");
    } catch (err) {
      setError("No se pudo cargar el detalle del grupo.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

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
    setPendingExpenseFocus(false);
    setError("");
    setSuccess("");
  };

  const handleSelectGroup = (groupId) => {
    setSelectedGroupId(groupId);
    setActivePanel("expenses");
    setError("");
    setSuccess("");
  };

  const handleAddParticipant = () => {
    const email = normalizeEmail(groupForm.emailInput);

    if (!email) return;

    if (participants.some((participant) => participant.email === email)) {
      setError("Ese email ya está cargado en el grupo.");
      return;
    }

    setGroupForm((prev) => ({
      ...prev,
      participants: [
        ...prev.participants,
        {
          email,
          username: email.split("@")[0],
          user: null,
          isOwner: false,
        },
      ],
      emailInput: "",
      splitValues: {
        ...prev.splitValues,
        [email]: prev.splitMode === "amount" ? 1 : "",
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
      setError("Agrega al menos un participante por email.");
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
        setGroupDetail(response.data);
        setGroupForm(mapGroupToForm(response.data.group));
        await fetchGroups(selectedGroupId);
        setSuccess("Grupo actualizado.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el grupo.");
    } finally {
      setSavingGroup(false);
    }
  };

  const handleExpenseChange = (field, value) => {
    setExpenseForm((prev) => ({ ...prev, [field]: value }));
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
      };

      const response = await sharedGroupsService.createExpense(selectedGroupId, payload);
      setGroupDetail({
        group: response.data.group,
        expenses: response.data.expenses,
        summary: response.data.summary,
      });
      setGroupForm(mapGroupToForm(response.data.group));
      setExpenseForm({
        ...createEmptyExpenseForm(),
        paidByEmail: payload.paidByEmail,
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
      setGroupDetail(response.data);
      setGroupForm(mapGroupToForm(response.data.group));
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
          <h1>Controla cuentas entre amigos, socios o equipos con reparto automático.</h1>
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
                        <span className={style.sectionLabel}>Participantes por email</span>
                        <p className={style.sectionText}>
                          Si el usuario ya existe, queda vinculado automáticamente.
                        </p>
                      </div>

                      <div className={style.addParticipantRow}>
                        <input
                          type="email"
                          value={groupForm.emailInput}
                          onChange={(event) =>
                            setGroupForm((prev) => ({
                              ...prev,
                              emailInput: event.target.value,
                            }))
                          }
                          className={style.input}
                          placeholder="correo@ejemplo.com"
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
                                <strong>
                                  {participant.username || participant.email.split("@")[0]}
                                </strong>
                                <span>{participant.email}</span>
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
                        <p className={style.sectionText}>
                          El sistema calcula cuánto le corresponde a cada persona.
                        </p>
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
                                {participant.username || participant.email.split("@")[0]}
                                <small>{participant.email}</small>
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
                        {groupDetail.group.participants.map((participant) => (
                          <option key={participant.email} value={participant.email}>
                            {participant.username || participant.email.split("@")[0]} ·{" "}
                            {participant.email}
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
                            {participant.username}
                            {participant.isOwner ? " · creador" : ""}
                          </span>
                          <strong>{participant.email}</strong>
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
                            Pago: {expense.paidByEmail} ·{" "}
                            {new Date(expense.date).toLocaleDateString("es-AR")}
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