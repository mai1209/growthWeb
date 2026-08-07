import { createHash, randomBytes } from "crypto";
import User from "../models/userModel.js";
import Task from "../models/taskModel.js";
import IngresoEgreso from "../models/ingresoEgresoModel.js";
import SharedGroup from "../models/sharedGroupModel.js";
import SharedExpense from "../models/sharedExpenseModel.js";
import SharedDebt from "../models/sharedDebtModel.js";
import Afirmacion from "../models/afirmacionModel.js";
import Category from "../models/categoryModel.js";
import FiscalConfig from "../models/fiscalConfigModel.js";
import Gym from "../models/gymModel.js";
import JournalConfig from "../models/journalConfigModel.js";
import Journal from "../models/journalModel.js";
import Meta from "../models/metaModel.js";
import Project from "../models/projectModel.js";
import Salud from "../models/saludModel.js";
import TimeEntry from "../models/timeEntryModel.js";
import { generateToken } from "../utils/jwt.js";

const RESET_TOKEN_MINUTES = 60;

const normalizeEmail = (value = "") => value.trim().toLowerCase();

// Nombre de usuario estilo @handle: minúsculas, números y guion bajo, 3-20.
// Único entre usuarios (lo usamos para @menciones en la futura comunidad).
const HANDLE_REGEX = /^[a-z0-9_]{3,20}$/;
const normalizeHandle = (value = "") => String(value || "").trim().toLowerCase();
const isValidHandle = (value = "") => HANDLE_REGEX.test(value);

// La foto/portada puede venir como URL http(s) o como data URL (base64) cuando
// se sube un archivo local. Limitamos el tamaño para no inflar el documento.
const MAX_IMAGE_DATA_URL = 4_500_000; // ~4.5MB de string base64
const isValidImageRef = (value = "") =>
  /^https?:\/\/.+/i.test(value) ||
  /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value);

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
    bannerUrl: String(business.bannerUrl || "").trim(),
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
    bannerUrl: user.bannerUrl || "",
    bio: user.bio || "",
    createdAt: user.createdAt || null,
    businessProfile: {
      name: firstBusiness.name || "",
      industry: firstBusiness.industry || "",
      logoUrl: firstBusiness.logoUrl || "",
      bannerUrl: firstBusiness.bannerUrl || "",
      phone: firstBusiness.phone || "",
      address: firstBusiness.address || "",
    },
    businessProfiles,
  };
};

export const signup = async (req, res) => {
  try {
    const username = normalizeHandle(req.body.username);
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }

    if (!isValidHandle(username)) {
      return res.status(400).json({
        error: "El usuario debe tener entre 3 y 20 caracteres: minúsculas, números o guion bajo.",
      });
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

// GET /api/auth/username-available?u=handle
// Valida formato y disponibilidad (excluyendo al propio usuario) para el chequeo
// en vivo del formulario de perfil.
export const checkUsername = async (req, res) => {
  try {
    const handle = normalizeHandle(req.query.u);

    if (!handle) {
      return res.status(200).json({ available: false, reason: "empty" });
    }
    if (!isValidHandle(handle)) {
      return res.status(200).json({ available: false, reason: "invalid" });
    }

    const me = await User.findById(req.userId).select("username");
    if (me && me.username === handle) {
      // Es el mismo que ya tenés: cuenta como disponible.
      return res.status(200).json({ available: true, reason: "self" });
    }

    const taken = await User.findOne({ username: handle }).select("_id");
    return res.status(200).json({ available: !taken, reason: taken ? "taken" : "ok" });
  } catch (err) {
    console.error("Check username error:", err);
    return res.status(500).json({ error: "No se pudo verificar el usuario" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Username (@handle): sólo si viene y cambia. Único entre usuarios.
    if (req.body.username !== undefined) {
      const nextHandle = normalizeHandle(req.body.username);
      if (nextHandle !== user.username) {
        if (!isValidHandle(nextHandle)) {
          return res.status(400).json({
            error:
              "El usuario debe tener entre 3 y 20 caracteres: minúsculas, números o guion bajo.",
          });
        }
        const taken = await User.findOne({
          username: nextHandle,
          _id: { $ne: user._id },
        }).select("_id");
        if (taken) {
          return res.status(400).json({ error: "Ese nombre de usuario ya está en uso." });
        }
        user.username = nextHandle;
      }
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

    if (profilePhotoUrl && !isValidImageRef(profilePhotoUrl)) {
      return res.status(400).json({ error: "La foto de perfil no es válida" });
    }
    if (profilePhotoUrl.length > MAX_IMAGE_DATA_URL) {
      return res.status(400).json({ error: "La foto de perfil es demasiado grande" });
    }
    // Banner y bio: sólo se tocan si vienen en el body, así un update parcial
    // (ej: crear un negocio) no los pisa con vacío.
    if (req.body.bannerUrl !== undefined) {
      const bannerUrl = String(req.body.bannerUrl || "").trim();
      if (bannerUrl && !isValidImageRef(bannerUrl)) {
        return res.status(400).json({ error: "La portada no es válida" });
      }
      if (bannerUrl.length > MAX_IMAGE_DATA_URL) {
        return res.status(400).json({ error: "La portada es demasiado grande" });
      }
      user.bannerUrl = bannerUrl;
    }
    if (req.body.bio !== undefined) {
      user.bio = String(req.body.bio || "").replace(/\s+$/g, "").slice(0, 160);
    }
    const invalidLogo = businessProfiles.some(
      (business) => business.logoUrl && !isValidImageRef(business.logoUrl)
    );
    if (invalidLogo) {
      return res.status(400).json({ error: "El logo de un negocio no es válido" });
    }
    const invalidBanner = businessProfiles.some(
      (business) => business.bannerUrl && !isValidImageRef(business.bannerUrl)
    );
    if (invalidBanner) {
      return res.status(400).json({ error: "La portada de un negocio no es válida" });
    }
    const imageTooBig = businessProfiles.some(
      (business) =>
        (business.logoUrl && business.logoUrl.length > MAX_IMAGE_DATA_URL) ||
        (business.bannerUrl && business.bannerUrl.length > MAX_IMAGE_DATA_URL)
    );
    if (imageTooBig) {
      return res.status(400).json({ error: "Una imagen de negocio es demasiado grande" });
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

    // Datos personales del usuario (todas las secciones de la app).
    await Task.deleteMany({ user: userId });
    await IngresoEgreso.deleteMany({ usuario: userId });
    await Category.deleteMany({ usuario: userId });
    await TimeEntry.deleteMany({ usuario: userId });
    await Project.deleteMany({ usuario: userId });
    await Meta.deleteMany({ usuario: userId });
    await FiscalConfig.deleteMany({ usuario: userId });
    await Salud.deleteMany({ usuario: userId });
    await Gym.deleteMany({ usuario: userId });
    await Journal.deleteMany({ usuario: userId });
    await JournalConfig.deleteMany({ usuario: userId });
    await Afirmacion.deleteMany({ usuario: userId });

    // Finalmente, la cuenta
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: "Cuenta eliminada correctamente" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "No se pudo eliminar la cuenta" });
  }
};
