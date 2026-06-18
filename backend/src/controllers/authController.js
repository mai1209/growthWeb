import { createHash, randomBytes } from "crypto";
import User from "../models/userModel.js";
import Task from "../models/taskModel.js";
import IngresoEgreso from "../models/ingresoEgresoModel.js";
import SharedGroup from "../models/sharedGroupModel.js";
import SharedExpense from "../models/sharedExpenseModel.js";
import SharedDebt from "../models/sharedDebtModel.js";
import { generateToken } from "../utils/jwt.js";

const RESET_TOKEN_MINUTES = 60;

const normalizeEmail = (value = "") => value.trim().toLowerCase();

const buildAppUrl = () => {
  const explicit =
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3001";
};

const createResetTokenPair = () => {
  const plainToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(plainToken).digest("hex");

  return { plainToken, hashedToken };
};

const isStrongEnoughPassword = (value = "") => typeof value === "string" && value.length >= 6;

const normalizeBusinessProfile = (business = {}) => {
  const id = String(business._id || "").trim();
  const normalized = {
    name: String(business.name || "").trim(),
    industry: String(business.industry || "").trim(),
    logoUrl: String(business.logoUrl || "").trim(),
    phone: String(business.phone || "").trim(),
    address: String(business.address || "").trim(),
  };

  if (/^[a-f\d]{24}$/i.test(id)) {
    normalized._id = id;
  }

  return normalized;
};

const getBusinessProfiles = (user) => {
  const profiles = Array.isArray(user.businessProfiles)
    ? user.businessProfiles.map(normalizeBusinessProfile)
    : [];
  const legacyBusiness = normalizeBusinessProfile(user.businessProfile || {});

  if (!profiles.length && legacyBusiness.name) {
    return [{ ...legacyBusiness, _id: "legacy" }];
  }

  return profiles;
};

const serializeProfile = (user) => {
  const businessProfiles = getBusinessProfiles(user);
  const firstBusiness = businessProfiles[0] || normalizeBusinessProfile(user.businessProfile || {});

  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    fullName: user.fullName || user.username || "",
    phone: user.phone || "",
    profilePhotoUrl: user.profilePhotoUrl || "",
    businessProfile: {
      name: firstBusiness.name || "",
      industry: firstBusiness.industry || "",
      logoUrl: firstBusiness.logoUrl || "",
      phone: firstBusiness.phone || "",
      address: firstBusiness.address || "",
    },
    businessProfiles,
  };
};

export const signup = async (req, res) => {
  try {
    const username = req.body.username?.trim();
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ error: "El usuario o email ya existe" });
    }

    const user = await User.create({ username, email, password });
    const token = generateToken(user);

    res.status(201).json({
      message: "Usuario creado correctamente",
      userId: user._id,
      token,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    if (!user.password || typeof user.password !== "string") {
      console.error("Login warning: user without valid password hash", {
        userId: user._id,
        email,
      });
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const expiresIn = rememberMe ? "30d" : "1d";
    const token = generateToken(user, expiresIn);

    res.json({
      message: "Login exitoso",
      userId: user._id,
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ error: "Ingresá tu email para recuperar la contraseña" });
    }

    const user = await User.findOne({ email }).select("+resetPasswordToken +resetPasswordExpiresAt");

    if (!user) {
      return res.status(200).json({
        message:
          "Si el email existe, ya quedó listo el enlace de recuperación.",
      });
    }

    const { plainToken, hashedToken } = createResetTokenPair();
    const resetUrl = `${buildAppUrl()}/reset-password?token=${plainToken}&email=${encodeURIComponent(email)}`;

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
    await user.save();

    res.status(200).json({
      message: "Enlace de recuperación generado correctamente.",
      resetUrl,
      expiresInMinutes: RESET_TOKEN_MINUTES,
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "No se pudo iniciar la recuperación de contraseña" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const token = req.body.token?.trim();
    const password = req.body.password;

    if (!email || !token || !password) {
      return res.status(400).json({ error: "Email, token y nueva contraseña son obligatorios" });
    }

    if (!isStrongEnoughPassword(password)) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      email,
      resetPasswordToken: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    }).select("+password +resetPasswordToken +resetPasswordExpiresAt");

    if (!user) {
      return res.status(400).json({ error: "El enlace de recuperación es inválido o venció" });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    res.status(200).json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "No se pudo restablecer la contraseña" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Completá la contraseña actual y la nueva" });
    }

    if (!isStrongEnoughPassword(newPassword)) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
    }

    const user = await User.findById(req.userId).select(
      "+password +resetPasswordToken +resetPasswordExpiresAt"
    );

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: "La contraseña actual no es correcta" });
    }

    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    res.status(200).json({ message: "Contraseña cambiada correctamente" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "No se pudo cambiar la contraseña" });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.status(200).json(serializeProfile(user));
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "No se pudo cargar el perfil" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const fullName = String(req.body.fullName || "").trim();
    const phone = String(req.body.phone || "").trim();
    const profilePhotoUrl = String(req.body.profilePhotoUrl || "").trim();
    const rawBusinessProfiles = Array.isArray(req.body.businessProfiles)
      ? req.body.businessProfiles
      : req.body.businessProfile
        ? [req.body.businessProfile]
        : [];
    const businessProfiles = rawBusinessProfiles
      .map(normalizeBusinessProfile)
      .filter((business) =>
        business.name || business.industry || business.logoUrl || business.phone || business.address
      );

    if (profilePhotoUrl && !/^https?:\/\/.+/i.test(profilePhotoUrl)) {
      return res.status(400).json({ error: "La foto de perfil debe ser una URL válida" });
    }
    const invalidLogo = businessProfiles.some(
      (business) => business.logoUrl && !/^https?:\/\/.+/i.test(business.logoUrl)
    );
    if (invalidLogo) {
      return res.status(400).json({ error: "Los logos de negocio deben ser URLs válidas" });
    }

    user.fullName = fullName;
    user.phone = phone;
    user.profilePhotoUrl = profilePhotoUrl;
    user.businessProfiles = businessProfiles;
    user.businessProfile = businessProfiles[0] || {
      name: "",
      industry: "",
      logoUrl: "",
      phone: "",
      address: "",
    };

    await user.save();

    res.status(200).json({
      message: "Perfil actualizado correctamente",
      profile: serializeProfile(user),
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "No se pudo actualizar el perfil" });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Grupos compartidos que creó el usuario (con sus gastos y deudas)
    const ownedGroups = await SharedGroup.find({ owner: userId }).select("_id");
    const groupIds = ownedGroups.map((group) => group._id);

    if (groupIds.length > 0) {
      await SharedExpense.deleteMany({ group: { $in: groupIds } });
      await SharedDebt.deleteMany({ group: { $in: groupIds } });
      await SharedGroup.deleteMany({ _id: { $in: groupIds } });
    }

    // Datos personales del usuario
    await Task.deleteMany({ user: userId });
    await IngresoEgreso.deleteMany({ usuario: userId });

    // Finalmente, la cuenta
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: "Cuenta eliminada correctamente" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "No se pudo eliminar la cuenta" });
  }
};
