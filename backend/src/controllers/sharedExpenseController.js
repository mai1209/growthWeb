import mongoose from "mongoose";
import SharedGroup from "../models/sharedGroupModel.js";
import SharedExpense from "../models/sharedExpenseModel.js";
import User from "../models/userModel.js";

const normalizeEmail = (value = "") => value.trim().toLowerCase();
const normalizeCurrency = (value) => (value === "USD" ? "USD" : "ARS");
const normalizeSplitMode = (value) =>
  ["equal", "percentage", "amount"].includes(value) ? value : "equal";

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

const buildParticipantIdentity = (user) => ({
  user: user._id,
  email: normalizeEmail(user.email),
  username: user.username || normalizeEmail(user.email).split("@")[0],
  isOwner: true,
});

const buildParticipants = async (rawParticipants = [], ownerUser) => {
  const ownerParticipant = buildParticipantIdentity(ownerUser);
  const emails = new Set([ownerParticipant.email]);

  rawParticipants.forEach((participant) => {
    const email = normalizeEmail(
      typeof participant === "string" ? participant : participant?.email || ""
    );

    if (email) {
      emails.add(email);
    }
  });

  const participantEmails = [...emails];
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

    const matchedUser = usersByEmail.get(email);

    return {
      user: matchedUser?._id || null,
      email,
      username: matchedUser?.username || email.split("@")[0],
      isOwner: false,
    };
  });
};

const ensureHistoricalParticipants = async (groupId, participants = []) => {
  const expenses = await SharedExpense.find({ group: groupId }).select(
    "paidByEmail paidByUser"
  );
  const participantEmails = new Set(participants.map((item) => item.email));
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

      return {
        user: matchedUser?._id || null,
        email,
        username: matchedUser?.username || email.split("@")[0],
        isOwner: false,
      };
    }),
  ];
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
  const splitConfigByEmail = new Map(
    (group.splitConfig || []).map((item) => [normalizeEmail(item.participantEmail), item])
  );

  const totalWeight =
    group.splitMode === "amount"
      ? participants.reduce((acc, participant) => {
          const item = splitConfigByEmail.get(participant.email);
          return acc + Math.max(0, Number(item?.amount) || 0);
        }, 0)
      : 0;

  const participantSummaries = participants.map((participant) => {
    const splitItem = splitConfigByEmail.get(participant.email);
    const paid = spentByEmail[participant.email] || 0;
    let target = 0;
    let targetPercentage = 0;

    if (group.splitMode === "percentage") {
      targetPercentage = Math.max(0, Number(splitItem?.percentage) || 0);
      target = totalSpent * (targetPercentage / 100);
    } else if (group.splitMode === "amount") {
      const weight = Math.max(0, Number(splitItem?.amount) || 0);
      targetPercentage = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
      target = totalWeight > 0 ? totalSpent * (weight / totalWeight) : 0;
    } else {
      targetPercentage = participants.length ? 100 / participants.length : 0;
      target = participants.length ? totalSpent / participants.length : 0;
    }

    return {
      email: participant.email,
      username: participant.username || participant.email.split("@")[0],
      isOwner: Boolean(participant.isOwner),
      paid: Number(paid.toFixed(2)),
      target: Number(target.toFixed(2)),
      balance: Number((paid - target).toFixed(2)),
      spentPercentage:
        totalSpent > 0 ? Number(((paid / totalSpent) * 100).toFixed(2)) : 0,
      targetPercentage: Number(targetPercentage.toFixed(2)),
    };
  });

  return {
    currency: group.currency,
    splitMode: group.splitMode,
    totalSpent: Number(totalSpent.toFixed(2)),
    participants: participantSummaries,
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

    const expenses = await SharedExpense.find({ group: group._id }).sort({
      date: -1,
      createdAt: -1,
    });

    res.status(200).json({
      group: serializeGroup(group),
      expenses,
      summary: buildSummary(group, expenses),
    });
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
    const initialParticipants = await buildParticipants(req.body.participants || [], req.user);
    const participants = await ensureHistoricalParticipants(group._id, initialParticipants);
    const splitMode = normalizeSplitMode(req.body.splitMode);
    const splitConfig = buildSplitConfig(splitMode, participants, req.body.splitConfig || []);

    group.name = name || group.name;
    group.currency = normalizeCurrency(req.body.currency || group.currency);
    group.participants = participants;
    group.splitMode = splitMode;
    group.splitConfig = splitConfig;

    const updatedGroup = await group.save();
    const expenses = await SharedExpense.find({ group: updatedGroup._id }).sort({
      date: -1,
      createdAt: -1,
    });

    res.status(200).json({
      group: serializeGroup(updatedGroup),
      expenses,
      summary: buildSummary(updatedGroup, expenses),
    });
  } catch (error) {
    console.error("Error al actualizar grupo compartido:", error);
    res.status(500).json({ error: "Error al actualizar grupo compartido" });
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

    const expense = await SharedExpense.create({
      group: group._id,
      createdBy: req.user._id,
      paidByUser: participant.user || null,
      paidByEmail,
      description,
      amount,
      currency: group.currency,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      notes: req.body.notes?.trim() || "",
    });

    const expenses = await SharedExpense.find({ group: group._id }).sort({
      date: -1,
      createdAt: -1,
    });

    res.status(201).json({
      expense,
      group: serializeGroup(group),
      expenses,
      summary: buildSummary(group, expenses),
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

    const expenses = await SharedExpense.find({ group: group._id }).sort({
      date: -1,
      createdAt: -1,
    });

    res.status(200).json({
      group: serializeGroup(group),
      expenses,
      summary: buildSummary(group, expenses),
    });
  } catch (error) {
    console.error("Error al eliminar gasto compartido:", error);
    res.status(500).json({ error: "Error al eliminar gasto compartido" });
  }
};
