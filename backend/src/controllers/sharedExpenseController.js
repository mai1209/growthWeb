import mongoose from "mongoose";
import { randomUUID } from "crypto";
import SharedGroup from "../models/sharedGroupModel.js";
import SharedExpense from "../models/sharedExpenseModel.js";
import SharedDebt from "../models/sharedDebtModel.js";
import IngresoEgresoModel from "../models/ingresoEgresoModel.js";
import User from "../models/userModel.js";

const normalizeEmail = (value = "") => value.trim().toLowerCase();
const normalizeName = (value = "") => value.trim();
const normalizeCurrency = (value) => (value === "USD" ? "USD" : "ARS");
const normalizeMovementMethod = (value) =>
  value === "transferencia" ? "transferencia" : "efectivo";
const normalizeSplitMode = (value) =>
  ["equal", "percentage", "amount"].includes(value) ? value : "equal";
const toCents = (amount) => Math.round((Number(amount) || 0) * 100);
const fromCents = (cents) => Number((cents / 100).toFixed(2));
const isGuestAlias = (value = "") => normalizeEmail(value).endsWith("@growth.local");
const slugifyName = (value = "") =>
  normalizeName(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "invitado";
const createGuestAlias = (name = "") =>
  `guest+${slugifyName(name)}-${randomUUID().slice(0, 8)}@growth.local`;
const toDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
};
const normalizeCalendarDate = (value) => {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  }

  if (typeof value === "string") {
    const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (matched) {
      const [, year, month, day] = matched;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    }
  }

  const rawDate = new Date(value);

  if (Number.isNaN(rawDate.getTime())) {
    return new Date();
  }

  return new Date(
    Date.UTC(
      rawDate.getUTCFullYear(),
      rawDate.getUTCMonth(),
      rawDate.getUTCDate(),
      12
    )
  );
};
const getParticipantJoinedAt = (participant, fallbackDate = new Date()) =>
  participant?.joinedAt ? new Date(participant.joinedAt) : new Date(fallbackDate);
const isParticipantActiveForDate = (participant, date) =>
  toDateKey(getParticipantJoinedAt(participant, date)) <= toDateKey(date);

const getAccessQuery = (user) => ({
  archived: false,
  $or: [
    { owner: user._id },
    { "participants.user": user._id },
    { "participants.email": normalizeEmail(user.email) },
  ],
});

const serializeGroup = (group) => ({
  _id: group._id,
  name: group.name,
  currency: group.currency,
  splitMode: group.splitMode,
  owner: group.owner,
  participants: group.participants,
  splitConfig: group.splitConfig,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

const serializeExpense = (expense, group) => {
  const participantsByEmail = new Map(
    (group?.participants || []).map((participant) => [normalizeEmail(participant.email), participant])
  );
  const participant = participantsByEmail.get(normalizeEmail(expense.paidByEmail));
  const participantEmails = normalizeExpenseParticipants(
    group,
    expense.date || expense.createdAt || new Date(),
    expense.participantEmails || []
  );
  const shares = buildExpenseShares(group, expense);

  return {
    _id: expense._id,
    group: expense.group,
    createdBy: expense.createdBy,
    paidByUser: expense.paidByUser,
    paidByEmail: expense.paidByEmail,
    paidByName:
      participant?.username ||
      expense.paidByEmail?.split("@")[0] ||
      "Participante",
    participantEmails,
    shares: participantEmails.map((email) => ({
      email,
      username:
        participantsByEmail.get(email)?.username ||
        email.split("@")[0] ||
        "Participante",
      amount: shares.get(email) || 0,
    })),
    amount: expense.amount,
    currency: expense.currency,
    description: expense.description,
    date: expense.date,
    notes: expense.notes,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
};

const serializeDebt = (debt, group) => {
  const participantsByEmail = new Map(
    (group?.participants || []).map((participant) => [normalizeEmail(participant.email), participant])
  );
  const debtor = participantsByEmail.get(normalizeEmail(debt.debtorEmail));
  const creditor = participantsByEmail.get(normalizeEmail(debt.creditorEmail));
  const settledBy = participantsByEmail.get(normalizeEmail(debt.settledByEmail));

  return {
    _id: debt._id,
    group: debt.group,
    createdBy: debt.createdBy,
    debtorEmail: debt.debtorEmail,
    debtorName: debtor?.username || debt.debtorEmail?.split("@")[0] || "Participante",
    creditorEmail: debt.creditorEmail,
    creditorName: creditor?.username || debt.creditorEmail?.split("@")[0] || "Participante",
    description: debt.description,
    amount: debt.amount,
    currency: debt.currency,
    date: debt.date,
    notes: debt.notes,
    status: debt.status,
    paymentMethod: debt.paymentMethod || null,
    settledAt: debt.settledAt,
    settledByEmail: debt.settledByEmail || "",
    settledByName:
      settledBy?.username ||
      debt.settledByEmail?.split("@")[0] ||
      "",
    movementId: debt.movementId || null,
    createdAt: debt.createdAt,
    updatedAt: debt.updatedAt,
  };
};

const buildParticipantIdentity = (user) => ({
  user: user._id,
  email: normalizeEmail(user.email),
  username: user.username || normalizeEmail(user.email).split("@")[0],
  isGuest: false,
  joinedAt: new Date(),
  isOwner: true,
});

const buildParticipants = async (rawParticipants = [], ownerUser, currentParticipants = []) => {
  const currentByEmail = new Map(
    currentParticipants.map((participant) => [normalizeEmail(participant.email), participant])
  );
  const currentOwner = currentByEmail.get(normalizeEmail(ownerUser.email));
  const ownerParticipant = {
    ...buildParticipantIdentity(ownerUser),
    joinedAt: currentOwner?.joinedAt || new Date(),
  };
  const participantsByEmail = new Map([[ownerParticipant.email, ownerParticipant]]);

  rawParticipants.forEach((participant) => {
    const rawEmail = normalizeEmail(
      typeof participant === "string" ? participant : participant?.email || ""
    );
    const rawName =
      typeof participant === "string"
        ? ""
        : normalizeName(participant?.username || participant?.name || "");

    const email =
      rawEmail ||
      (rawName ? createGuestAlias(rawName) : "");

    if (email) {
      const currentParticipant = currentByEmail.get(email);
      const nextName =
        rawName ||
        currentParticipant?.username ||
        (email === ownerParticipant.email ? ownerParticipant.username : "");

      participantsByEmail.set(email, {
        user: currentParticipant?.user || null,
        email,
        username: nextName,
        isGuest:
          email !== ownerParticipant.email &&
          (Boolean(participant?.isGuest) || currentParticipant?.isGuest || isGuestAlias(email)),
        joinedAt: currentParticipant?.joinedAt || new Date(),
        isOwner: email === ownerParticipant.email,
      });
    }
  });

  const participantEmails = [...participantsByEmail.keys()];
  const users = await User.find({ email: { $in: participantEmails } }).select(
    "_id email username"
  );
  const usersByEmail = new Map(
    users.map((user) => [normalizeEmail(user.email), user])
  );

  return participantEmails.map((email) => {
    if (email === ownerParticipant.email) {
      return ownerParticipant;
    }

    const requestedParticipant = participantsByEmail.get(email) || {};
    const currentParticipant = currentByEmail.get(email);
    const matchedUser = usersByEmail.get(email);

    return {
      user: matchedUser?._id || requestedParticipant.user || currentParticipant?.user || null,
      email,
      username:
        requestedParticipant.username ||
        currentParticipant?.username ||
        matchedUser?.username ||
        email.split("@")[0],
      isGuest:
        !matchedUser &&
        (requestedParticipant.isGuest || currentParticipant?.isGuest || isGuestAlias(email)),
      joinedAt: requestedParticipant.joinedAt || currentParticipant?.joinedAt || new Date(),
      isOwner: false,
    };
  });
};

const ensureHistoricalParticipants = async (group, participants = []) => {
  const groupId = group?._id || group;
  const expenses = await SharedExpense.find({ group: groupId }).select(
    "paidByEmail paidByUser"
  );
  const participantEmails = new Set(participants.map((item) => item.email));
  const historicalByEmail = new Map(
    (group?.participants || []).map((participant) => [normalizeEmail(participant.email), participant])
  );
  const missingEmails = [...new Set(expenses.map((expense) => normalizeEmail(expense.paidByEmail)))]
    .filter(Boolean)
    .filter((email) => !participantEmails.has(email));

  if (!missingEmails.length) {
    return participants;
  }

  const users = await User.find({ email: { $in: missingEmails } }).select(
    "_id email username"
  );
  const usersByEmail = new Map(
    users.map((user) => [normalizeEmail(user.email), user])
  );

  return [
    ...participants,
    ...missingEmails.map((email) => {
      const matchedUser = usersByEmail.get(email);
      const historicalParticipant = historicalByEmail.get(email);

      return {
        user: matchedUser?._id || historicalParticipant?.user || null,
        email,
        username:
          historicalParticipant?.username ||
          matchedUser?.username ||
          email.split("@")[0],
        isGuest:
          historicalParticipant?.isGuest || (!matchedUser && isGuestAlias(email)),
        joinedAt: historicalParticipant?.joinedAt || new Date(),
        isOwner: false,
      };
    }),
  ];
};

const buildParticipantFromInput = async (rawParticipant = {}, group, ownerUser, historyMode = "future") => {
  const mode = rawParticipant.mode === "guest" ? "guest" : "linked";
  const email = normalizeEmail(rawParticipant.email || "");
  const name = normalizeName(rawParticipant.username || rawParticipant.name || "");

  if (mode === "linked" && !email) {
    throw new Error("Para vincular una cuenta tenés que cargar el email.");
  }

  if (mode === "guest" && !name) {
    throw new Error("Para agregar un invitado tenés que cargar un nombre.");
  }

  const participantEmail = mode === "guest" ? createGuestAlias(name) : email;
  const existingParticipant = (group.participants || []).find(
    (participant) => participant.email === participantEmail
  );

  if (existingParticipant) {
    throw new Error("Ese miembro ya forma parte del grupo.");
  }

  const matchedUser =
    mode === "linked" ? await User.findOne({ email: participantEmail }).select("_id email username") : null;
  const joinedAt =
    historyMode === "all" ? new Date(group.createdAt || new Date()) : new Date();

  return {
    user: matchedUser?._id || null,
    email: participantEmail,
    username: name || matchedUser?.username || participantEmail.split("@")[0],
    isGuest: mode === "guest" || (!matchedUser && isGuestAlias(participantEmail)),
    joinedAt,
    isOwner: false,
  };
};

const buildSplitConfig = (splitMode, participants, rawSplitConfig = []) => {
  const normalizedMode = normalizeSplitMode(splitMode);
  const configByEmail = new Map(
    rawSplitConfig.map((item) => [
      normalizeEmail(item?.participantEmail || item?.email || ""),
      item,
    ])
  );

  if (normalizedMode === "equal") {
    const equalPercentage = participants.length ? 100 / participants.length : 0;

    return participants.map((participant) => ({
      participantEmail: participant.email,
      percentage: Number(equalPercentage.toFixed(2)),
      amount: null,
    }));
  }

  if (normalizedMode === "percentage") {
    const rawValues = participants.map((participant) => {
      const matched = configByEmail.get(participant.email);
      return {
        participantEmail: participant.email,
        percentage: Math.max(0, Number(matched?.percentage) || 0),
        amount: null,
      };
    });

    const totalPercentage = rawValues.reduce(
      (acc, item) => acc + (Number(item.percentage) || 0),
      0
    );

    if (totalPercentage <= 0) {
      const equalPercentage = participants.length ? 100 / participants.length : 0;
      return rawValues.map((item) => ({
        ...item,
        percentage: Number(equalPercentage.toFixed(2)),
      }));
    }

    return rawValues.map((item) => ({
      ...item,
      percentage: Number(((item.percentage / totalPercentage) * 100).toFixed(2)),
    }));
  }

  const rawAmounts = participants.map((participant) => {
    const matched = configByEmail.get(participant.email);
    return {
      participantEmail: participant.email,
      percentage: null,
      amount: Math.max(0, Number(matched?.amount) || 0),
    };
  });

  const totalAmount = rawAmounts.reduce(
    (acc, item) => acc + (Number(item.amount) || 0),
    0
  );

  if (totalAmount <= 0) {
    return rawAmounts.map((item) => ({
      ...item,
      amount: 1,
    }));
  }

  return rawAmounts;
};

const getEligibleParticipantEmails = (group, expenseDate) =>
  (group.participants || [])
    .filter((participant) => isParticipantActiveForDate(participant, expenseDate))
    .map((participant) => normalizeEmail(participant.email));

const normalizeExpenseParticipants = (group, expenseDate, rawParticipantEmails = []) => {
  const eligibleParticipants = getEligibleParticipantEmails(group, expenseDate);
  const eligibleSet = new Set(eligibleParticipants);
  const requested = rawParticipantEmails
    .map((email) => normalizeEmail(email))
    .filter((email) => eligibleSet.has(email));

  return requested.length ? [...new Set(requested)] : eligibleParticipants;
};

const allocateCentsByWeight = (participantEmails = [], totalAmount = 0, rawWeights = []) => {
  const totalCents = toCents(totalAmount);

  if (!participantEmails.length || totalCents <= 0) {
    return new Map();
  }

  const weights = rawWeights.map((weight) => Math.max(0, Number(weight) || 0));
  const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
  const effectiveWeights =
    totalWeight > 0 ? weights : participantEmails.map(() => 1);
  const effectiveTotalWeight = effectiveWeights.reduce((acc, weight) => acc + weight, 0);

  const exactShares = effectiveWeights.map((weight) =>
    (totalCents * weight) / effectiveTotalWeight
  );
  const floorShares = exactShares.map(Math.floor);
  let remainingCents =
    totalCents - floorShares.reduce((acc, cents) => acc + cents, 0);

  exactShares
    .map((share, index) => ({
      index,
      remainder: share - floorShares[index],
    }))
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ index }) => {
      if (remainingCents <= 0) return;
      floorShares[index] += 1;
      remainingCents -= 1;
    });

  return new Map(
    participantEmails.map((email, index) => [email, fromCents(floorShares[index])])
  );
};

const buildExpenseShares = (group, expense) => {
  const splitConfigByEmail = new Map(
    (group.splitConfig || []).map((item) => [normalizeEmail(item.participantEmail), item])
  );
  const participantEmails = normalizeExpenseParticipants(
    group,
    expense.date || expense.createdAt || new Date(),
    expense.participantEmails || []
  );
  const totalAmount = Number(expense.amount) || 0;

  if (!participantEmails.length || totalAmount <= 0) {
    return new Map();
  }

  if (group.splitMode === "equal") {
    return allocateCentsByWeight(
      participantEmails,
      totalAmount,
      participantEmails.map(() => 1)
    );
  }

  const weightedValues = participantEmails.map((email) => {
    const item = splitConfigByEmail.get(email);
    const value =
      group.splitMode === "percentage"
        ? Math.max(0, Number(item?.percentage) || 0)
        : Math.max(0, Number(item?.amount) || 0);

    return { email, value };
  });

  return allocateCentsByWeight(
    participantEmails,
    totalAmount,
    weightedValues.map((item) => item.value)
  );
};

const buildSummary = (group, expenses = []) => {
  const participants = group.participants || [];
  const totalSpent = expenses.reduce(
    (acc, expense) => acc + (Number(expense.amount) || 0),
    0
  );
  const spentByEmail = expenses.reduce((acc, expense) => {
    const email = normalizeEmail(expense.paidByEmail);
    acc[email] = (acc[email] || 0) + (Number(expense.amount) || 0);
    return acc;
  }, {});
  const targetByEmail = {};
  const expenseCountsByEmail = {};

  expenses.forEach((expense) => {
    const shares = buildExpenseShares(group, expense);

    shares.forEach((share, email) => {
      targetByEmail[email] = (targetByEmail[email] || 0) + share;
      expenseCountsByEmail[email] = (expenseCountsByEmail[email] || 0) + 1;
    });
  });

  const participantSummaries = participants.map((participant) => {
    const paid = spentByEmail[participant.email] || 0;
    const target = targetByEmail[participant.email] || 0;
    const targetPercentage = totalSpent > 0 ? (target / totalSpent) * 100 : 0;

    return {
      email: participant.email,
      username: participant.username || participant.email.split("@")[0],
      isGuest: Boolean(participant.isGuest),
      isOwner: Boolean(participant.isOwner),
      joinedAt: participant.joinedAt,
      paid: Number(paid.toFixed(2)),
      target: Number(target.toFixed(2)),
      balance: Number((paid - target).toFixed(2)),
      spentPercentage:
        totalSpent > 0 ? Number(((paid / totalSpent) * 100).toFixed(2)) : 0,
      targetPercentage: Number(targetPercentage.toFixed(2)),
      expenseCount: expenseCountsByEmail[participant.email] || 0,
    };
  });

  return {
    currency: group.currency,
    splitMode: group.splitMode,
    totalSpent: Number(totalSpent.toFixed(2)),
    participants: participantSummaries,
  };
};

const buildGroupDetailResponse = async (group) => {
  const [expenses, debts] = await Promise.all([
    SharedExpense.find({ group: group._id }).sort({
      date: -1,
      createdAt: -1,
    }),
    SharedDebt.find({ group: group._id }).sort({
      status: 1,
      date: -1,
      createdAt: -1,
    }),
  ]);

  return {
    group: serializeGroup(group),
    expenses: expenses.map((expense) => serializeExpense(expense, group)),
    debts: debts.map((debt) => serializeDebt(debt, group)),
    summary: buildSummary(group, expenses),
  };
};

const getSharedGroupOrFail = async (groupId, user) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return null;
  }

  return SharedGroup.findOne({
    _id: new mongoose.Types.ObjectId(groupId),
    ...getAccessQuery(user),
  });
};

export const getSharedGroups = async (req, res) => {
  try {
    const groups = await SharedGroup.find(getAccessQuery(req.user)).sort({
      updatedAt: -1,
      createdAt: -1,
    });

    res.status(200).json(groups.map(serializeGroup));
  } catch (error) {
    console.error("Error al obtener grupos compartidos:", error);
    res.status(500).json({ error: "Error al obtener grupos compartidos" });
  }
};

export const createSharedGroup = async (req, res) => {
  try {
    const name = req.body.name?.trim();

    if (!name) {
      return res.status(400).json({ error: "El nombre del grupo es obligatorio" });
    }

    const participants = await buildParticipants(req.body.participants || [], req.user);
    const splitMode = normalizeSplitMode(req.body.splitMode);
    const splitConfig = buildSplitConfig(splitMode, participants, req.body.splitConfig || []);

    const newGroup = await SharedGroup.create({
      name,
      currency: normalizeCurrency(req.body.currency),
      owner: req.user._id,
      participants,
      splitMode,
      splitConfig,
    });

    res.status(201).json(serializeGroup(newGroup));
  } catch (error) {
    console.error("Error al crear grupo compartido:", error);
    res.status(500).json({ error: "Error al crear grupo compartido" });
  }
};

export const getSharedGroupDetail = async (req, res) => {
  try {
    const group = await getSharedGroupOrFail(req.params.id, req.user);

    if (!group) {
      return res.status(404).json({ error: "Grupo compartido no encontrado" });
    }

    res.status(200).json(await buildGroupDetailResponse(group));
  } catch (error) {
    console.error("Error al obtener detalle del grupo compartido:", error);
    res.status(500).json({ error: "Error al obtener detalle del grupo compartido" });
  }
};

export const updateSharedGroup = async (req, res) => {
  try {
    const group = await getSharedGroupOrFail(req.params.id, req.user);

    if (!group) {
      return res.status(404).json({ error: "Grupo compartido no encontrado" });
    }

    if (group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Solo el creador puede editar el grupo" });
    }

    const name = req.body.name?.trim();
    const initialParticipants = await buildParticipants(
      req.body.participants || [],
      req.user,
      group.participants || []
    );
    const participants = await ensureHistoricalParticipants(group, initialParticipants);
    const splitMode = normalizeSplitMode(req.body.splitMode);
    const splitConfig = buildSplitConfig(splitMode, participants, req.body.splitConfig || []);

    group.name = name || group.name;
    group.currency = normalizeCurrency(req.body.currency || group.currency);
    group.participants = participants;
    group.splitMode = splitMode;
    group.splitConfig = splitConfig;

    const updatedGroup = await group.save();
    res.status(200).json(await buildGroupDetailResponse(updatedGroup));
  } catch (error) {
    console.error("Error al actualizar grupo compartido:", error);
    res.status(500).json({ error: "Error al actualizar grupo compartido" });
  }
};

export const addSharedGroupMember = async (req, res) => {
  try {
    const group = await getSharedGroupOrFail(req.params.id, req.user);

    if (!group) {
      return res.status(404).json({ error: "Grupo compartido no encontrado" });
    }

    if (group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Solo el creador puede sumar miembros" });
    }

    const historyMode = req.body.historyMode === "all" ? "all" : "future";
    const member = await buildParticipantFromInput(req.body, group, req.user, historyMode);

    group.participants = [...(group.participants || []), member];
    group.splitConfig = buildSplitConfig(group.splitMode, group.participants, group.splitConfig || []);

    const updatedGroup = await group.save();
    res.status(200).json(await buildGroupDetailResponse(updatedGroup));
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Error al sumar miembro al grupo:", error);
    res.status(500).json({ error: "Error al sumar miembro al grupo" });
  }
};

export const createSharedDebt = async (req, res) => {
  try {
    const group = await getSharedGroupOrFail(req.params.id, req.user);

    if (!group) {
      return res.status(404).json({ error: "Grupo compartido no encontrado" });
    }

    const description = req.body.description?.trim();
    const amount = Number(req.body.amount);
    const debtorEmail = normalizeEmail(req.body.debtorEmail || "");
    const creditorEmail = normalizeEmail(req.body.creditorEmail || "");
    const debtDate = normalizeCalendarDate(req.body.date);

    if (!description) {
      return res.status(400).json({ error: "La descripción de la deuda es obligatoria" });
    }

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "El monto de la deuda debe ser mayor a cero" });
    }

    if (!debtorEmail || !creditorEmail) {
      return res.status(400).json({ error: "Tenés que indicar deudor y acreedor" });
    }

    if (debtorEmail === creditorEmail) {
      return res.status(400).json({ error: "La deuda tiene que ser entre dos miembros distintos" });
    }

    const debtor = (group.participants || []).find((participant) => participant.email === debtorEmail);
    const creditor = (group.participants || []).find(
      (participant) => participant.email === creditorEmail
    );

    if (!debtor || !creditor) {
      return res.status(400).json({ error: "La deuda solo puede cargarse entre miembros del grupo" });
    }

    if (!isParticipantActiveForDate(debtor, debtDate) || !isParticipantActiveForDate(creditor, debtDate)) {
      return res.status(400).json({ error: "Ambos miembros tienen que estar activos en esa fecha" });
    }

    await SharedDebt.create({
      group: group._id,
      createdBy: req.user._id,
      debtorEmail,
      creditorEmail,
      description,
      amount,
      currency: group.currency,
      date: debtDate,
      notes: req.body.notes?.trim() || "",
    });

    res.status(201).json(await buildGroupDetailResponse(group));
  } catch (error) {
    console.error("Error al crear deuda compartida:", error);
    res.status(500).json({ error: "Error al crear deuda compartida" });
  }
};

export const settleSharedDebt = async (req, res) => {
  try {
    const group = await getSharedGroupOrFail(req.params.id, req.user);

    if (!group) {
      return res.status(404).json({ error: "Grupo compartido no encontrado" });
    }

    const debt = await SharedDebt.findOne({
      _id: req.params.debtId,
      group: group._id,
    });

    if (!debt) {
      return res.status(404).json({ error: "Deuda compartida no encontrada" });
    }

    if (debt.status === "paid") {
      return res.status(400).json({ error: "Esa deuda ya está marcada como pagada" });
    }

    const canSettle =
      group.owner.toString() === req.user._id.toString() ||
      normalizeEmail(req.user.email) === normalizeEmail(debt.debtorEmail);

    if (!canSettle) {
      return res.status(403).json({ error: "Solo el deudor o el creador pueden marcarla como pagada" });
    }

    const paymentMethod = normalizeMovementMethod(req.body.paymentMethod || req.body.medio);
    const settledAt = normalizeCalendarDate(req.body.date);
    const debtor = (group.participants || []).find(
      (participant) => participant.email === normalizeEmail(debt.debtorEmail)
    );
    const creditor = (group.participants || []).find(
      (participant) => participant.email === normalizeEmail(debt.creditorEmail)
    );

    const movimiento = await IngresoEgresoModel.create({
      tipo: "egreso",
      monto: debt.amount,
      moneda: debt.currency,
      categoria: "Deuda compartida",
      fecha: settledAt,
      detalle:
        req.body.notes?.trim() ||
        `Pago de deuda a ${creditor?.username || debt.creditorEmail} en ${group.name}: ${debt.description}`,
      medio: paymentMethod,
      esRecurrente: false,
      frecuencia: null,
      usuario: req.userId,
    });

    debt.status = "paid";
    debt.paymentMethod = paymentMethod;
    debt.settledAt = settledAt;
    debt.settledByUser = req.user._id;
    debt.settledByEmail = normalizeEmail(req.user.email);
    debt.movementId = movimiento._id;
    debt.notes = debt.notes || req.body.notes?.trim() || "";

    await debt.save();

    res.status(200).json(await buildGroupDetailResponse(group));
  } catch (error) {
    console.error("Error al marcar deuda como pagada:", error);
    res.status(500).json({ error: "Error al marcar deuda como pagada" });
  }
};

export const deleteSharedGroup = async (req, res) => {
  try {
    const group = await getSharedGroupOrFail(req.params.id, req.user);

    if (!group) {
      return res.status(404).json({ error: "Grupo compartido no encontrado" });
    }

    if (group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Solo el creador puede eliminar el grupo" });
    }

    group.archived = true;
    await group.save();

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar grupo compartido:", error);
    res.status(500).json({ error: "Error al eliminar grupo compartido" });
  }
};

export const createSharedExpense = async (req, res) => {
  try {
    const group = await getSharedGroupOrFail(req.params.id, req.user);

    if (!group) {
      return res.status(404).json({ error: "Grupo compartido no encontrado" });
    }

    const description = req.body.description?.trim();
    const amount = Number(req.body.amount);
    const paidByEmail = normalizeEmail(req.body.paidByEmail || "");
    const expenseDate = normalizeCalendarDate(req.body.date);
    const participant = group.participants.find(
      (item) => item.email === paidByEmail
    );

    if (!description) {
      return res.status(400).json({ error: "La descripcion es obligatoria" });
    }

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "El monto debe ser mayor a cero" });
    }

    if (!participant) {
      return res.status(400).json({ error: "El pagador debe pertenecer al grupo" });
    }

    if (!isParticipantActiveForDate(participant, expenseDate)) {
      return res.status(400).json({ error: "Ese pagador todavía no estaba activo en esa fecha" });
    }

    const participantEmails = normalizeExpenseParticipants(
      group,
      expenseDate,
      req.body.participantEmails || []
    );

    if (!participantEmails.length) {
      return res.status(400).json({ error: "Selecciona al menos un miembro para repartir el gasto" });
    }

    const expense = await SharedExpense.create({
      group: group._id,
      createdBy: req.user._id,
      paidByUser: participant.user || null,
      paidByEmail,
      participantEmails,
      description,
      amount,
      currency: group.currency,
      date: expenseDate,
      notes: req.body.notes?.trim() || "",
    });

    res.status(201).json({
      expense: serializeExpense(expense, group),
      ...(await buildGroupDetailResponse(group)),
    });
  } catch (error) {
    console.error("Error al crear gasto compartido:", error);
    res.status(500).json({ error: "Error al crear gasto compartido" });
  }
};

export const deleteSharedExpense = async (req, res) => {
  try {
    const group = await getSharedGroupOrFail(req.params.id, req.user);

    if (!group) {
      return res.status(404).json({ error: "Grupo compartido no encontrado" });
    }

    const expense = await SharedExpense.findOne({
      _id: req.params.expenseId,
      group: group._id,
    });

    if (!expense) {
      return res.status(404).json({ error: "Gasto compartido no encontrado" });
    }

    if (
      expense.createdBy.toString() !== req.user._id.toString() &&
      group.owner.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: "No autorizado para eliminar este gasto" });
    }

    await SharedExpense.findByIdAndDelete(expense._id);

    res.status(200).json(await buildGroupDetailResponse(group));
  } catch (error) {
    console.error("Error al eliminar gasto compartido:", error);
    res.status(500).json({ error: "Error al eliminar gasto compartido" });
  }
};
