import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiExternalLink,
  FiMapPin,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiHeart,
  FiKey,
  FiLink,
  FiLoader,
  FiLock,
  FiMail,
  FiMoon,
  FiPhone,
  FiPlus,
  FiRefreshCcw,
  FiSave,
  FiSun,
  FiTrash2,
  FiUpload,
  FiUser,
  FiX,
} from "react-icons/fi";
import { authService, googleService, fiscalService } from "../api";
import PhotoCropper from "./PhotoCropper";
import ApoyarPage from "./ApoyarPage";
import style from "../style/Settings.module.css";

const TAB_META = {
  password: {
    title: "Cambiar contraseña",
    text: "Actualiza tu clave desde la sesión iniciada.",
    icon: FiLock,
  },
  integraciones: {
    title: "Integraciones",
    text: "Conectá servicios externos como Google Calendar.",
    icon: FiLink,
  },
  facturacion: {
    title: "Facturación (ARCA)",
    text: "Emití facturas de los ingresos de este perfil.",
    icon: FiFileText,
  },
  tema: {
    title: "Tema",
    text: "Elegí el modo claro u oscuro de la app.",
    icon: FiMoon,
  },
  apoyar: {
    title: "Apoyar Growth",
    text: "Growth es gratis. Si te suma, un aporte ayuda a mantenerla.",
    icon: FiHeart,
  },
};

const getInitials = (profile) => {
  const source = profile.fullName || profile.username || profile.email || "U";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

// Lee un archivo de imagen local y devuelve un data URL redimensionado (manteniendo
// proporción) para no guardar imágenes gigantes en la base. Sale como JPEG.
const fileToDataUrl = (file, maxW, maxH) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Archivo de imagen inválido"));
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width, maxH / img.height);
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

function SettingsPage({ theme, onThemeToggle, mode, currentWorkspace }) {
  const [searchParams, setSearchParams] = useSearchParams();
  // En /perfil mostramos sólo el panel de perfil; en /ajustes ya no hay perfil.
  const perfilOnly = mode === "perfil";
  const activeTab = perfilOnly
    ? "perfil"
    : TAB_META[searchParams.get("tab")]
    ? searchParams.get("tab")
    : "tema";

  const [profile, setProfile] = useState({
    username: "",
    email: "",
    fullName: "",
    phone: "",
    profilePhotoUrl: "",
    bannerUrl: "",
    bio: "",
    createdAt: null,
    businessProfile: {
      name: "",
      industry: "",
      logoUrl: "",
      phone: "",
      address: "",
    },
    businessProfiles: [],
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [openBusiness, setOpenBusiness] = useState(() => new Set());
  // Vista del tab Perfil: "personal" (tarjeta estilo red social) o "negocios".
  const [perfilView, setPerfilView] = useState("personal");
  // Negocio abierto (pantalla interna de ese perfil de empresa) o null = lista.
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  // Edición del negocio abierto (popup como el personal).
  const [editingBusiness, setEditingBusiness] = useState(false);
  // Edición del perfil personal (se despliega el formulario bajo la tarjeta).
  const [editingProfile, setEditingProfile] = useState(false);
  // Chequeo en vivo de disponibilidad del @usuario.
  const [usernameCheck, setUsernameCheck] = useState({ status: "idle" });
  // Imagen elegida a la espera de ajustarse (recorte). cropTarget indica si es la
  // foto de perfil ("photo") o la portada ("banner").
  const [cropSrc, setCropSrc] = useState(null);
  const [cropTarget, setCropTarget] = useState("photo");
  const [google, setGoogle] = useState({
    connected: false,
    email: "",
    connectedAt: null,
  });
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [fiscal, setFiscal] = useState({
    activo: false,
    cuit: "",
    razonSocial: "",
    condicionIVA: "monotributo",
    puntoVenta: 1,
    modo: "manual",
    arcaAutorizado: false,
  });
  const [fiscalLoading, setFiscalLoading] = useState(true);
  const [fiscalSaving, setFiscalSaving] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [savingNewProfile, setSavingNewProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: "",
    industry: "",
    phone: "",
    logoUrl: "",
    address: "",
  });

  // Carga la config de facturación del perfil activo
  useEffect(() => {
    let alive = true;
    (async () => {
      setFiscalLoading(true);
      try {
        const res = await fiscalService.get();
        if (alive && res.data) setFiscal(res.data);
      } catch {
        // sin config aún: quedan los defaults
      } finally {
        if (alive) setFiscalLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleFiscalChange = (field, value) =>
    setFiscal((prev) => ({ ...prev, [field]: value }));

  const handleFiscalSave = async () => {
    setFiscalSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fiscalService.update(fiscal);
      if (res.data) setFiscal(res.data);
      setMessage("Configuración de facturación guardada.");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la facturación.");
    } finally {
      setFiscalSaving(false);
    }
  };

  const profileInitials = useMemo(() => getInitials(profile), [profile]);
  const businessProfiles = profile.businessProfiles?.length
    ? profile.businessProfiles
    : profile.businessProfile?.name
      ? [profile.businessProfile]
      : [];

  // Perfil (workspace) activo, para resaltarlo con borde brillante.
  const activeWorkspace = (() => {
    const ws = String(localStorage.getItem("activeWorkspace") || "").trim();
    return /^business(?::[a-f\d]{24})?$/i.test(ws) ? ws : "personal";
  })();
  const businessWorkspaceId = (business, index) =>
    index === 0 || business._id === "legacy" ? "business" : `business:${business._id}`;

  // En /perfil mostramos el perfil del workspace activo: si entraste a un
  // negocio (desde el menú de perfil), se abre ese negocio; si es personal,
  // la tarjeta personal.
  const ws = currentWorkspace || activeWorkspace;
  useEffect(() => {
    if (!perfilOnly) return;
    if (ws === "personal") {
      setPerfilView("personal");
      setSelectedBusiness(null);
      return;
    }
    const idx = businessProfiles.findIndex((b, i) => businessWorkspaceId(b, i) === ws);
    if (idx >= 0) {
      setPerfilView("negocios");
      setSelectedBusiness(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilOnly, ws, businessProfiles.length]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setProfileLoading(true);
      setError("");

      try {
        const response = await authService.getProfile();
        if (isMounted) {
          setProfile(response.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || "No se pudo cargar el perfil");
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  // Carga el estado de conexión con Google Calendar
  useEffect(() => {
    let isMounted = true;

    const loadGoogleStatus = async () => {
      setGoogleLoading(true);
      try {
        const response = await googleService.getStatus();
        if (isMounted) {
          setGoogle({
            connected: Boolean(response.data?.connected),
            email: response.data?.email || "",
            connectedAt: response.data?.connectedAt || null,
          });
        }
      } catch (err) {
        // Si falla el estado no rompemos la página de Ajustes
        if (isMounted) {
          setGoogle({ connected: false, email: "", connectedAt: null });
        }
      } finally {
        if (isMounted) {
          setGoogleLoading(false);
        }
      }
    };

    loadGoogleStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  // Lee el resultado del redirect de Google (?google=connected|cancelled|error)
  useEffect(() => {
    const googleResult = searchParams.get("google");
    if (!googleResult) return;

    if (googleResult === "connected") {
      setMessage("Google Calendar se conectó correctamente.");
      googleService
        .getStatus()
        .then((response) =>
          setGoogle({
            connected: Boolean(response.data?.connected),
            email: response.data?.email || "",
            connectedAt: response.data?.connectedAt || null,
          })
        )
        .catch(() => {});
    } else if (googleResult === "cancelled") {
      setError("Cancelaste la conexión con Google.");
    } else if (googleResult === "error") {
      setError("No se pudo conectar con Google. Intentá de nuevo.");
    }

    // Limpia el parámetro de la URL para que el mensaje no quede pegado
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("google");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleConnectGoogle = async () => {
    setError("");
    setMessage("");
    setGoogleBusy(true);
    try {
      const response = await googleService.getAuthUrl();
      const url = response.data?.url;
      if (!url) {
        throw new Error("No se recibió la URL de Google");
      }
      // Redirige al consentimiento de Google
      window.location.href = url;
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "No se pudo iniciar la conexión con Google."
      );
      setGoogleBusy(false);
    }
  };

  const handleSyncGoogle = async () => {
    setError("");
    setMessage("");
    setGoogleSyncing(true);
    try {
      const response = await googleService.sync();
      const { created = 0, updated = 0 } = response.data || {};
      setMessage(
        `Sincronización lista: ${created} nueva${created === 1 ? "" : "s"} y ${updated} actualizada${updated === 1 ? "" : "s"} desde Google Calendar.`
      );
    } catch (err) {
      setError(
        err.response?.data?.error || "No se pudo sincronizar con Google."
      );
    } finally {
      setGoogleSyncing(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm("¿Desconectar Google Calendar?")) return;

    setError("");
    setMessage("");
    setGoogleBusy(true);
    try {
      await googleService.disconnect();
      setGoogle({ connected: false, email: "", connectedAt: null });
      setMessage("Google Calendar se desconectó.");
    } catch (err) {
      setError(
        err.response?.data?.error || "No se pudo desconectar Google."
      );
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleTabChange = (tab) => {
    // Integraciones todavía no está disponible: por ahora avisamos y no entramos.
    if (tab === "integraciones") {
      window.alert("Próximamente");
      return;
    }
    setSearchParams({ tab });
    setError("");
    setMessage("");
    setResetUrl("");
  };

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  // El @usuario sólo admite minúsculas, números y guion bajo (máx. 20).
  const handleUsernameChange = (value) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    setProfile((prev) => ({ ...prev, username: clean }));
  };

  // Foto de perfil: primero se abre el ajustador (mover + zoom) y recién al
  // confirmar se guarda recortada.
  const handlePickPhoto = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Elegí un archivo de imagen.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file, 1200, 1200);
      setCropTarget("photo");
      setCropSrc(dataUrl);
    } catch {
      setError("No se pudo procesar la imagen.");
    }
  };

  // Portada: también se ajusta (mover + zoom), pero con recorte 3:1.
  const handlePickBanner = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Elegí un archivo de imagen.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file, 1600, 1600);
      setCropTarget("banner");
      setCropSrc(dataUrl);
    } catch {
      setError("No se pudo procesar la imagen.");
    }
  };

  // Sube una imagen desde los archivos (Finder). La convertimos a data URL
  // redimensionada y la guardamos en el campo correspondiente.
  const handleImageFile = async (field, file, maxW, maxH) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Elegí un archivo de imagen.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file, maxW, maxH);
      setProfile((prev) => ({ ...prev, [field]: dataUrl }));
    } catch {
      setError("No se pudo procesar la imagen.");
    }
  };

  // Chequeo en vivo de disponibilidad del @usuario (con debounce), sólo mientras
  // se está editando. El backend responde "self" si es tu usuario actual.
  useEffect(() => {
    if (!editingProfile) return undefined;
    const handle = (profile.username || "").trim().toLowerCase();
    if (!handle) {
      setUsernameCheck({ status: "idle" });
      return undefined;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      setUsernameCheck({ status: "invalid" });
      return undefined;
    }
    setUsernameCheck({ status: "checking" });
    const timer = setTimeout(async () => {
      try {
        const res = await authService.checkUsername(handle);
        if (res.data?.available) {
          setUsernameCheck({ status: res.data.reason === "self" ? "self" : "ok" });
        } else {
          setUsernameCheck({ status: res.data?.reason === "invalid" ? "invalid" : "taken" });
        }
      } catch {
        setUsernameCheck({ status: "idle" });
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [profile.username, editingProfile]);

  // Los avisos son toasts flotantes: se van solos (el éxito antes que el error).
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => setMessage(""), 3200);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const handleBusinessListChange = (index, field, value) => {
    setProfile((prev) => ({
      ...prev,
      businessProfiles: (prev.businessProfiles || []).map((business, businessIndex) =>
        businessIndex === index ? { ...business, [field]: value } : business
      ),
    }));
  };

  // Sube el logo o la portada de un negocio desde los archivos (Finder).
  const handleBusinessImageFile = async (index, field, file, maxW, maxH) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Elegí un archivo de imagen.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file, maxW, maxH);
      handleBusinessListChange(index, field, dataUrl);
    } catch {
      setError("No se pudo procesar la imagen.");
    }
  };

  const handleNewProfileChange = (field, value) =>
    setNewProfile((prev) => ({ ...prev, [field]: value }));

  const handleCreateProfile = async () => {
    const name = newProfile.name.trim();
    if (!name) {
      setError("Poné un nombre al perfil.");
      return;
    }
    setSavingNewProfile(true);
    setError("");
    setMessage("");
    try {
      const nextBusinesses = [...businessProfiles, { ...newProfile, name }];
      const res = await authService.updateProfile({
        fullName: profile.fullName || "",
        phone: profile.phone || "",
        profilePhotoUrl: profile.profilePhotoUrl || "",
        businessProfiles: nextBusinesses,
      });
      setProfile((prev) => ({
        ...prev,
        businessProfiles: res.data?.businessProfiles || nextBusinesses,
      }));
      setNewProfile({ name: "", industry: "", phone: "", logoUrl: "", address: "" });
      setShowNewProfile(false);
      setMessage("Perfil creado.");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear el perfil.");
    } finally {
      setSavingNewProfile(false);
    }
  };

  const toggleBusiness = (index) => {
    setOpenBusiness((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleRemoveBusiness = (index) => {
    const target = businessProfiles[index];
    const hasData =
      target &&
      (target.name || target.industry || target.logoUrl || target.phone || target.address);

    if (hasData && !window.confirm("¿Eliminar este negocio? Se quitará al guardar los cambios.")) {
      return;
    }

    setProfile((prev) => {
      const base = prev.businessProfiles?.length
        ? prev.businessProfiles
        : prev.businessProfile?.name
          ? [prev.businessProfile]
          : [];

      return { ...prev, businessProfiles: base.filter((_, i) => i !== index) };
    });

    setOpenBusiness((prev) => {
      const next = new Set();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setProfileSaving(true);

    try {
      const response = await authService.updateProfile({
        username: profile.username,
        fullName: profile.fullName,
        phone: profile.phone,
        profilePhotoUrl: profile.profilePhotoUrl,
        bannerUrl: profile.bannerUrl,
        bio: profile.bio,
        businessProfile: profile.businessProfile,
        businessProfiles: profile.businessProfiles,
      });

      setProfile(response.data.profile);
      setEditingProfile(false);
      setEditingBusiness(false);
      setUsernameCheck({ status: "idle" });
      window.dispatchEvent(
        new CustomEvent("growth-profile-updated", {
          detail: response.data.profile,
        })
      );
      setMessage(response.data.message || "Perfil actualizado correctamente");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el perfil");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== repeatPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }

    setLoadingPassword(true);

    try {
      const response = await authService.changePassword({
        currentPassword,
        newPassword,
      });

      setMessage(response.data.message || "Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo cambiar la contraseña");
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleRecoverPassword = async () => {
    setError("");
    setMessage("");
    setResetUrl("");
    setRecovering(true);

    try {
      const response = await authService.forgotPassword({ email: profile.email });
      setMessage(response.data.message || "Enlace de recuperación generado");
      setResetUrl(response.data.resetUrl || "");
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo generar la recuperación");
    } finally {
      setRecovering(false);
    }
  };

  // "Se unió {mes año}" a partir de la fecha de creación de la cuenta.
  const joinedLabel = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("es-AR", {
        month: "long",
        year: "numeric",
      })
    : "hace poco";

  // Estado visual del chequeo del @usuario.
  const USERNAME_UI = {
    checking: { icon: <FiLoader className={style.handleSpin} />, hint: "Verificando disponibilidad…", cls: "" },
    ok: { icon: <FiCheck />, hint: "¡Disponible!", cls: style.handleOk },
    self: { icon: <FiCheck />, hint: "Es tu usuario actual.", cls: style.handleOk },
    taken: { icon: <FiAlertCircle />, hint: "Ese usuario ya está en uso.", cls: style.handleBad },
    invalid: {
      icon: <FiAlertCircle />,
      hint: "3 a 20 caracteres: minúsculas, números o guion bajo.",
      cls: style.handleBad,
    },
    idle: { icon: null, hint: "Tu @usuario único. Servirá para la comunidad.", cls: "" },
  };
  const usernameUi = USERNAME_UI[usernameCheck.status] || USERNAME_UI.idle;

  // Toggle Personal / Ver perfiles (se reutiliza flotando sobre la portada en la
  // vista personal, o en el encabezado normal en la vista negocios).
  const viewToggle = (
    <div className={style.viewToggle}>
      <button
        type="button"
        className={`${style.viewToggleBtn} ${perfilView === "personal" ? style.viewToggleActive : ""}`}
        onClick={() => setPerfilView("personal")}
      >
        <FiUser />
        Personal
      </button>
      <button
        type="button"
        className={`${style.viewToggleBtn} ${perfilView === "negocios" ? style.viewToggleActive : ""}`}
        onClick={() => setPerfilView("negocios")}
      >
        <FiBriefcase />
        Ver perfiles{businessProfiles.length ? ` (${businessProfiles.length})` : ""}
      </button>
    </div>
  );

  return (
    <section className={style.container}>
 
      {!perfilOnly && (
        <div className={style.mobileTabs}>
          {Object.entries(TAB_META).map(([key, tab]) => {
            const Icon = tab.icon;

            return (
              <button
                key={key}
                type="button"
                className={`${style.mobileTab} ${activeTab === key ? style.mobileTabActive : ""}`}
                onClick={() => handleTabChange(key)}
              >
                <Icon />
                {tab.title}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === "perfil" ? (
        <div className={`${style.card} ${perfilView === "personal" ? style.cardProfile : ""}`}>
          {/* En negocios va el encabezado normal; en personal el título + toggle
              flotan sobre la portada. */}
          {perfilView !== "personal" ? (
            <div className={style.businessHeader}>
              <div>
                <p className={style.kicker}>Cuenta</p>
                <h2>Perfil</h2>
              </div>
              {viewToggle}
            </div>
          ) : null}

          {perfilView === "personal" ? (
            <>
              {/* ===== Tarjeta de perfil estilo red social ===== */}
              <div className={style.profileCard}>
                <div
                  className={style.profileBanner}
                  style={
                    profile.bannerUrl
                      ? { backgroundImage: `url("${profile.bannerUrl}")` }
                      : undefined
                  }
                >
                  {/* Título "Ajustes / Perfil" + toggle flotando sobre la portada */}
                  <div className={style.profileBannerHead}>
                    <div className={style.profileBannerTitle}>
                      <p className={style.kicker}>Cuenta</p>
                      <h2>Perfil</h2>
                    </div>
                    {viewToggle}
                  </div>
                </div>
                <div className={style.profileTopRow}>
                  <span className={style.profileAvatar}>
                    {profile.profilePhotoUrl ? (
                      <img src={profile.profilePhotoUrl} alt="Foto de perfil" />
                    ) : (
                      <span>{profileInitials}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className={style.editProfileBtn}
                    onClick={() => setEditingProfile((prev) => !prev)}
                  >
                    {editingProfile ? "Cerrar edición" : "Editar perfil"}
                  </button>
                </div>

                <div className={style.profileIdentity}>
                  <strong className={style.profileName}>
                    {profile.fullName || profile.username || "Tu perfil"}
                  </strong>
                  <span className={style.profileHandle}>@{profile.username || "usuario"}</span>
                  {profile.bio ? (
                    <p className={style.profileBio}>{profile.bio}</p>
                  ) : (
                    <p className={style.profileBioEmpty}>
                      Todavía no escribiste una bio. Contá algo sobre vos.
                    </p>
                  )}
                  <div className={style.profileMeta}>
                    <span>
                      <FiCalendar />
                      Se unió {joinedLabel}
                    </span>
                    {profile.email ? (
                      <span>
                        <FiMail />
                        {profile.email}
                      </span>
                    ) : null}
                    {profile.phone ? (
                      <span>
                        <FiPhone />
                        {profile.phone}
                      </span>
                    ) : null}
                  </div>
                  <div className={style.profileStats}>
                    <span>
                      <strong>{businessProfiles.length}</strong> negocios
                    </span>
                    <span>
                      <strong>0</strong> seguidores
                    </span>
                    <span>
                      <strong>0</strong> siguiendo
                    </span>
                  </div>
                </div>
              </div>

              {/* ===== Formulario de edición (se despliega) ===== */}
              {editingProfile ? (
                <div
                  className={style.modalOverlay}
                  onClick={() => setEditingProfile(false)}
                  role="presentation"
                >
                  <form
                    className={`${style.modalCard} ${style.editModalCard}`}
                    onClick={(event) => event.stopPropagation()}
                    onSubmit={handleProfileSubmit}
                  >
                    {/* Encabezado estilo Twitter: cerrar · título · guardar */}
                    <div className={style.editModalHead}>
                      <button
                        type="button"
                        className={style.modalClose}
                        onClick={() => setEditingProfile(false)}
                        aria-label="Cerrar"
                      >
                        <FiX />
                      </button>
                      <h3>Editar perfil</h3>
                      <button
                        type="submit"
                        className={style.editModalSave}
                        disabled={
                          profileSaving ||
                          usernameCheck.status === "taken" ||
                          usernameCheck.status === "invalid" ||
                          usernameCheck.status === "checking"
                        }
                      >
                        {profileSaving ? "Guardando..." : "Guardar"}
                      </button>
                    </div>

                    <div className={style.editModalBody}>
                      <label className={style.field}>
                        <span>Nombre de usuario</span>
                        <div className={`${style.handleField} ${usernameUi.cls}`}>
                          <span className={style.handleAt}>@</span>
                          <input
                            type="text"
                            value={profile.username || ""}
                            onChange={(event) => handleUsernameChange(event.target.value)}
                            placeholder="tu_usuario"
                            disabled={profileLoading}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                          />
                          {usernameUi.icon ? (
                            <span className={style.handleStatus}>{usernameUi.icon}</span>
                          ) : null}
                        </div>
                        <small className={style.handleHint}>{usernameUi.hint}</small>
                      </label>

                      <div className={style.formGrid}>
                        <label className={style.field}>
                          <span>Nombre completo</span>
                          <input
                            type="text"
                            value={profile.fullName}
                            onChange={(event) =>
                              handleProfileChange("fullName", event.target.value)
                            }
                            placeholder="Nombre para mostrar"
                            disabled={profileLoading}
                          />
                        </label>

                        <label className={style.field}>
                          <span>Email de ingreso</span>
                          <input type="email" value={profile.email} disabled />
                        </label>

                        <label className={style.field}>
                          <span>Teléfono</span>
                          <input
                            type="tel"
                            value={profile.phone}
                            onChange={(event) =>
                              handleProfileChange("phone", event.target.value)
                            }
                            placeholder="+54 9 ..."
                            disabled={profileLoading}
                          />
                        </label>

                      </div>

                      {/* Foto de perfil: se sube desde los archivos (Finder) */}
                      <label className={style.field}>
                        <span>Foto de perfil</span>
                        <div className={style.uploadRow}>
                          <span className={style.uploadAvatar}>
                            {profile.profilePhotoUrl ? (
                              <img src={profile.profilePhotoUrl} alt="Foto de perfil" />
                            ) : (
                              <FiUser />
                            )}
                          </span>
                          <div className={style.uploadActions}>
                            <label className={style.uploadBtn}>
                              <FiUpload />
                              Subir foto
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                  handlePickPhoto(event.target.files?.[0]);
                                  event.target.value = "";
                                }}
                                hidden
                              />
                            </label>
                            {profile.profilePhotoUrl ? (
                              <button
                                type="button"
                                className={style.uploadRemove}
                                onClick={() => handleProfileChange("profilePhotoUrl", "")}
                              >
                                Quitar
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </label>

                      {/* Portada / banner: también desde los archivos */}
                      <label className={style.field}>
                        <span>Portada</span>
                        <div
                          className={style.uploadBanner}
                          style={
                            profile.bannerUrl
                              ? { backgroundImage: `url("${profile.bannerUrl}")` }
                              : undefined
                          }
                        >
                          <label className={style.uploadBtn}>
                            <FiUpload />
                            Subir portada
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                handlePickBanner(event.target.files?.[0]);
                                event.target.value = "";
                              }}
                              hidden
                            />
                          </label>
                          {profile.bannerUrl ? (
                            <button
                              type="button"
                              className={style.uploadRemove}
                              onClick={() => handleProfileChange("bannerUrl", "")}
                            >
                              Quitar
                            </button>
                          ) : null}
                        </div>
                      </label>

                      <label className={style.field}>
                        <span>Bio</span>
                        <textarea
                          className={style.bioInput}
                          value={profile.bio || ""}
                          onChange={(event) =>
                            handleProfileChange("bio", event.target.value.slice(0, 160))
                          }
                          placeholder="Contá algo sobre vos (máx. 160 caracteres)"
                          rows={3}
                          disabled={profileLoading}
                        />
                        <small className={style.bioCounter}>
                          {(profile.bio || "").length}/160
                        </small>
                      </label>
                    </div>
                  </form>
                </div>
              ) : null}
            </>
          ) : selectedBusiness !== null && businessProfiles[selectedBusiness] ? (
            /* ===== Pantalla interna del negocio (estilo perfil personal) ===== */
            <div className={style.businessDetail}>
              <button
                type="button"
                className={style.detailBack}
                onClick={() => {
                  setSelectedBusiness(null);
                  setEditingBusiness(false);
                }}
              >
                <FiArrowLeft />
                Volver a negocios
              </button>

              {(() => {
                const biz = businessProfiles[selectedBusiness] || {};
                return (
                  <div className={style.profileCard}>
                    <div
                      className={style.profileBanner}
                      style={
                        biz.bannerUrl
                          ? { backgroundImage: `url("${biz.bannerUrl}")` }
                          : undefined
                      }
                    />
                    <div className={style.profileTopRow}>
                      <span className={style.profileAvatar}>
                        {biz.logoUrl ? (
                          <img src={biz.logoUrl} alt="Logo del negocio" />
                        ) : (
                          <FiBriefcase />
                        )}
                      </span>
                      <button
                        type="button"
                        className={style.editProfileBtn}
                        onClick={() => setEditingBusiness(true)}
                      >
                        Editar perfil
                      </button>
                    </div>
                    <div className={style.profileIdentity}>
                      <strong className={style.profileName}>
                        {biz.name || "Nuevo negocio"}
                      </strong>
                      <span className={style.profileHandle}>
                        {biz.industry || "Sin rubro definido"}
                      </span>
                      <div className={style.profileMeta}>
                        {biz.phone ? (
                          <span>
                            <FiPhone />
                            {biz.phone}
                          </span>
                        ) : null}
                        {biz.address ? (
                          <span>
                            <FiMapPin />
                            {biz.address}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Popup de edición del negocio (mismo formato que el personal) */}
              {editingBusiness ? (
                <div
                  className={style.modalOverlay}
                  onClick={() => setEditingBusiness(false)}
                  role="presentation"
                >
                  <form
                    className={`${style.modalCard} ${style.editModalCard}`}
                    onClick={(event) => event.stopPropagation()}
                    onSubmit={handleProfileSubmit}
                  >
                    <div className={style.editModalHead}>
                      <button
                        type="button"
                        className={style.modalClose}
                        onClick={() => setEditingBusiness(false)}
                        aria-label="Cerrar"
                      >
                        <FiX />
                      </button>
                      <h3>Editar negocio</h3>
                      <button
                        type="submit"
                        className={style.editModalSave}
                        disabled={profileSaving}
                      >
                        {profileSaving ? "Guardando..." : "Guardar"}
                      </button>
                    </div>

                    <div className={style.editModalBody}>
                      <div className={style.formGrid}>
                        <label className={style.field}>
                          <span>Nombre del negocio</span>
                          <input
                            type="text"
                            value={businessProfiles[selectedBusiness]?.name || ""}
                            onChange={(event) =>
                              handleBusinessListChange(selectedBusiness, "name", event.target.value)
                            }
                            placeholder="Ej: Growth Studio"
                            disabled={profileLoading}
                          />
                        </label>
                        <label className={style.field}>
                          <span>Rubro</span>
                          <input
                            type="text"
                            value={businessProfiles[selectedBusiness]?.industry || ""}
                            onChange={(event) =>
                              handleBusinessListChange(
                                selectedBusiness,
                                "industry",
                                event.target.value
                              )
                            }
                            placeholder="Ej: servicios, comercio"
                            disabled={profileLoading}
                          />
                        </label>
                        <label className={style.field}>
                          <span>Teléfono</span>
                          <input
                            type="tel"
                            value={businessProfiles[selectedBusiness]?.phone || ""}
                            onChange={(event) =>
                              handleBusinessListChange(selectedBusiness, "phone", event.target.value)
                            }
                            placeholder="+54 9 ..."
                            disabled={profileLoading}
                          />
                        </label>
                        <label className={style.field}>
                          <span>Dirección</span>
                          <input
                            type="text"
                            value={businessProfiles[selectedBusiness]?.address || ""}
                            onChange={(event) =>
                              handleBusinessListChange(
                                selectedBusiness,
                                "address",
                                event.target.value
                              )
                            }
                            placeholder="Local, oficina o ciudad"
                            disabled={profileLoading}
                          />
                        </label>
                      </div>

                      <label className={style.field}>
                        <span>Logo del negocio</span>
                        <div className={style.uploadRow}>
                          <span className={style.uploadAvatar}>
                            {businessProfiles[selectedBusiness]?.logoUrl ? (
                              <img
                                src={businessProfiles[selectedBusiness].logoUrl}
                                alt="Logo del negocio"
                              />
                            ) : (
                              <FiBriefcase />
                            )}
                          </span>
                          <div className={style.uploadActions}>
                            <label className={style.uploadBtn}>
                              <FiUpload />
                              Subir logo
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) =>
                                  handleBusinessImageFile(
                                    selectedBusiness,
                                    "logoUrl",
                                    event.target.files?.[0],
                                    512,
                                    512
                                  )
                                }
                                hidden
                              />
                            </label>
                            {businessProfiles[selectedBusiness]?.logoUrl ? (
                              <button
                                type="button"
                                className={style.uploadRemove}
                                onClick={() =>
                                  handleBusinessListChange(selectedBusiness, "logoUrl", "")
                                }
                              >
                                Quitar
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </label>

                      <label className={style.field}>
                        <span>Portada</span>
                        <div
                          className={style.uploadBanner}
                          style={
                            businessProfiles[selectedBusiness]?.bannerUrl
                              ? {
                                  backgroundImage: `url("${businessProfiles[selectedBusiness].bannerUrl}")`,
                                }
                              : undefined
                          }
                        >
                          <label className={style.uploadBtn}>
                            <FiUpload />
                            Subir portada
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                handleBusinessImageFile(
                                  selectedBusiness,
                                  "bannerUrl",
                                  event.target.files?.[0],
                                  1280,
                                  480
                                )
                              }
                              hidden
                            />
                          </label>
                          {businessProfiles[selectedBusiness]?.bannerUrl ? (
                            <button
                              type="button"
                              className={style.uploadRemove}
                              onClick={() =>
                                handleBusinessListChange(selectedBusiness, "bannerUrl", "")
                              }
                            >
                              Quitar
                            </button>
                          ) : null}
                        </div>
                      </label>
                    </div>
                  </form>
                </div>
              ) : null}
            </div>
          ) : (
            <form className={style.businessForm} onSubmit={handleProfileSubmit}>
              {/* ===== Barra: crear perfil ===== */}
              <div className={style.businessBar}>
                <p className={style.kicker}>Tus negocios</p>
                <button
                  type="button"
                  className={style.secondaryButton}
                  onClick={() => {
                    setNewProfile({ name: "", industry: "", phone: "", logoUrl: "", address: "" });
                    setShowNewProfile(true);
                  }}
                  disabled={profileLoading}
                >
                  <FiPlus />
                  Crear perfil
                </button>
              </div>

              {businessProfiles.length ? (
                <div className={style.businessList}>
                  {businessProfiles.map((business, index) => (
                    <div key={business._id || index} className={style.businessRow}>
                      <button
                        type="button"
                        className={style.businessRowMain}
                        onClick={() => {
                          setSelectedBusiness(index);
                          setEditingBusiness(false);
                        }}
                      >
                        <span className={style.businessRowAvatar}>
                          {business.logoUrl ? (
                            <img src={business.logoUrl} alt="Logo del negocio" />
                          ) : (
                            <FiBriefcase />
                          )}
                        </span>
                        <span className={style.accordionInfo}>
                          <span className={style.accordionLabel}>Negocio {index + 1}</span>
                          <strong className={style.accordionName}>
                            {business.name || "Nuevo negocio"}
                          </strong>
                          <small className={style.accordionSub}>
                            {business.industry || "Sin rubro definido"}
                          </small>
                        </span>
                        <FiChevronRight className={style.businessRowArrow} />
                      </button>
                      <button
                        type="button"
                        className={style.accordionDelete}
                        onClick={() => handleRemoveBusiness(index)}
                        aria-label="Eliminar negocio"
                        title="Eliminar negocio"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={style.emptyBusiness}>
                  <FiBriefcase />
                  <p>Todavía no agregaste negocios.</p>
                </div>
              )}

              <button type="submit" className={style.saveButton} disabled={profileSaving}>
                <FiSave />
                {profileSaving ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {activeTab === "password" ? (
        <form className={style.card} onSubmit={handlePasswordSubmit}>
          <label className={style.field}>
            <span>Contraseña actual</span>
            <div className={style.passwordField}>
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className={style.eyeButton}
                onClick={() => setShowCurrentPassword((prev) => !prev)}
              >
                {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          <label className={style.field}>
            <span>Nueva contraseña</span>
            <div className={style.passwordField}>
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className={style.eyeButton}
                onClick={() => setShowNewPassword((prev) => !prev)}
              >
                {showNewPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          <label className={style.field}>
            <span>Repetir nueva contraseña</span>
            <div className={style.passwordField}>
              <input
                type={showRepeatPassword ? "text" : "password"}
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className={style.eyeButton}
                onClick={() => setShowRepeatPassword((prev) => !prev)}
              >
                {showRepeatPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </label>

          <button type="submit" className={style.saveButton} disabled={loadingPassword}>
            <FiKey />
            {loadingPassword ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
        </form>
      ) : null}

      {activeTab === "recuperar" ? (
        <section className={style.card}>
          <div className={style.recoveryBox}>
            <FiRefreshCcw />
            <div>
              <h2>Recuperación de contraseña</h2>
              <p>
                Se generará un enlace para el email de ingreso{" "}
                <strong>{profile.email || "tu cuenta"}</strong>. Cuando haya servicio de
                email, este mismo flujo puede enviarlo automáticamente.
              </p>
            </div>
          </div>

          <button
            type="button"
            className={style.saveButton}
            onClick={handleRecoverPassword}
            disabled={recovering || !profile.email}
          >
            <FiRefreshCcw />
            {recovering ? "Generando..." : "Generar enlace de recuperación"}
          </button>

          {resetUrl ? (
            <div className={style.resetLinkBox}>
              <span>Enlace generado</span>
              <a href={resetUrl}>{resetUrl}</a>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "integraciones" ? (
        <section className={style.card}>
          <div className={style.googleBox}>
            <div className={style.googleInfo}>
              <FiCalendar />
              <div>
                <h2>Google Calendar</h2>
                {googleLoading ? (
                  <p>Cargando estado de la conexión...</p>
                ) : google.connected ? (
                  <p className={style.googleConnected}>
                    <FiCheckCircle /> Conectado
                    {google.email ? ` como ${google.email}` : ""}
                  </p>
                ) : (
                  <p>
                    Conectá tu cuenta de Google para sincronizar tus notas y
                    eventos entre Growth y Google Calendar.
                  </p>
                )}
              </div>
            </div>

            {!googleLoading ? (
              <div className={style.googleActions}>
                {google.connected ? (
                  <>
                    <button
                      type="button"
                      className={style.saveButton}
                      onClick={handleSyncGoogle}
                      disabled={googleSyncing}
                    >
                      <FiRefreshCcw />
                      {googleSyncing ? "Sincronizando..." : "Sincronizar"}
                    </button>

                    <button
                      type="button"
                      className={style.ghostButton}
                      onClick={handleDisconnectGoogle}
                      disabled={googleBusy}
                    >
                      <FiTrash2 />
                      {googleBusy ? "Desconectando..." : "Desconectar"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={style.saveButton}
                    onClick={handleConnectGoogle}
                    disabled={googleBusy}
                  >
                    <FiLink />
                    {googleBusy ? "Conectando..." : "Conectar Google Calendar"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "facturacion" ? (
        <div
          className={style.modalOverlay}
          onClick={() => setSearchParams({ tab: "perfil" })}
          role="presentation"
        >
          <div
            className={style.modalCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Facturación (ARCA)"
          >
            <div className={style.modalHead}>
              <h3>Facturación (ARCA)</h3>
              <button
                type="button"
                className={style.modalClose}
                onClick={() => setSearchParams({ tab: "perfil" })}
                aria-label="Cerrar"
              >
                <FiX />
              </button>
            </div>

            <div className={style.comingSoon}>
              <span className={style.comingSoonBadge}>Próximamente</span>
              <p>
                La facturación electrónica con ARCA está en camino. Muy pronto vas a
                poder emitir tickets y facturas de tus ingresos desde acá.
              </p>
            </div>

            <div className={style.modalActions}>
              <button
                type="button"
                className={style.saveButton}
                onClick={() => setSearchParams({ tab: "perfil" })}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "tema" ? (
        <section className={style.card}>
          <div className={style.businessHeader}>
            <div>
              <p className={style.kicker}>Ajustes</p>
              <h2>Tema</h2>
            </div>
          </div>
          <p className={style.themeIntro}>Elegí cómo se ve la app.</p>
          <div className={style.themeOptions}>
            <button
              type="button"
              className={`${style.themeOption} ${theme === "light" ? style.themeOptionActive : ""}`}
              onClick={() => { if (theme !== "light") onThemeToggle?.(); }}
            >
              <FiSun />
              <span>Claro</span>
            </button>
            <button
              type="button"
              className={`${style.themeOption} ${theme === "dark" ? style.themeOptionActive : ""}`}
              onClick={() => { if (theme !== "dark") onThemeToggle?.(); }}
            >
              <FiMoon />
              <span>Oscuro</span>
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === "apoyar" ? <ApoyarPage embedded /> : null}

      {false ? (
        <section className={style.card}>
          <div className={style.googleBox}>
            <div className={style.googleInfo}>
              <FiFileText />
              <div>
                <h2>Facturación electrónica (ARCA)</h2>
                <p>
                  Emití facturas de los ingresos de <strong>este perfil</strong>. La
                  configuración es por perfil (el activo).
                </p>
              </div>
            </div>
          </div>

          {fiscalLoading ? (
            <p>Cargando configuración...</p>
          ) : (
            <div className={style.fiscalBody}>
              <label className={style.fiscalToggle}>
                <input
                  type="checkbox"
                  checked={fiscal.activo}
                  onChange={(event) => handleFiscalChange("activo", event.target.checked)}
                />
                <span>Activar facturación en este perfil</span>
              </label>

              {fiscal.activo ? (
                <>
                  <div className={style.formGrid}>
                    <label className={style.field}>
                      <span>CUIT</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={fiscal.cuit}
                        onChange={(event) => handleFiscalChange("cuit", event.target.value)}
                        placeholder="11 dígitos"
                        maxLength={13}
                      />
                    </label>

                    <label className={style.field}>
                      <span>Razón social</span>
                      <input
                        type="text"
                        value={fiscal.razonSocial}
                        onChange={(event) => handleFiscalChange("razonSocial", event.target.value)}
                        placeholder="Nombre o razón social"
                      />
                    </label>

                    <label className={style.field}>
                      <span>Condición frente al IVA</span>
                      <select
                        value={fiscal.condicionIVA}
                        onChange={(event) => handleFiscalChange("condicionIVA", event.target.value)}
                      >
                        <option value="monotributo">Monotributo</option>
                        <option value="responsable_inscripto">Responsable Inscripto</option>
                        <option value="exento">Exento</option>
                      </select>
                    </label>

                    <label className={style.field}>
                      <span>Punto de venta</span>
                      <input
                        type="number"
                        min="1"
                        value={fiscal.puntoVenta}
                        onChange={(event) =>
                          handleFiscalChange("puntoVenta", Number(event.target.value))
                        }
                      />
                    </label>

                    <label className={style.field}>
                      <span>Modo de emisión</span>
                      <select
                        value={fiscal.modo}
                        onChange={(event) => handleFiscalChange("modo", event.target.value)}
                      >
                        <option value="manual">Manual (botón en cada ingreso)</option>
                        <option value="automatico">Automático (en cada ingreso)</option>
                      </select>
                    </label>
                  </div>

                  {/* Estado de la autorización en ARCA (paso único con Clave Fiscal) */}
                  <div className={style.arcaBox}>
                    {fiscal.arcaAutorizado ? (
                      <p className={style.arcaOk}>
                        <FiCheckCircle /> Autorizado en ARCA
                      </p>
                    ) : (
                      <>
                        <p className={style.arcaHint}>
                          Falta autorizar a Growth en ARCA: un paso único con tu Clave Fiscal
                          (Administrador de Relaciones → Facturación Electrónica). El asistente
                          guiado llega en la próxima etapa.
                        </p>
                        <div className={style.arcaActions}>
                          <a
                            className={style.ghostButton}
                            href="https://auth.afip.gob.ar/contribuyente_/login.xhtml"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FiExternalLink /> Abrir ARCA
                          </a>
                          <button
                            type="button"
                            className={style.ghostButton}
                            onClick={() => handleFiscalChange("arcaAutorizado", true)}
                          >
                            <FiCheckCircle /> Ya lo autoricé
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : null}

              <button
                type="button"
                className={style.saveButton}
                onClick={handleFiscalSave}
                disabled={fiscalSaving}
              >
                <FiSave />
                {fiscalSaving ? "Guardando..." : "Guardar facturación"}
              </button>
            </div>
          )}
        </section>
      ) : null}

      {message || error ? (
        <div className={style.toastWrap} role="status" aria-live="polite">
          {message ? (
            <div className={`${style.toast} ${style.toastSuccess}`}>
              <FiCheckCircle />
              <span>{message}</span>
              <button
                type="button"
                className={style.toastClose}
                onClick={() => setMessage("")}
                aria-label="Cerrar aviso"
              >
                <FiX />
              </button>
            </div>
          ) : null}
          {error ? (
            <div className={`${style.toast} ${style.toastError}`}>
              <FiAlertCircle />
              <span>{error}</span>
              <button
                type="button"
                className={style.toastClose}
                onClick={() => setError("")}
                aria-label="Cerrar aviso"
              >
                <FiX />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {cropSrc ? (
        <PhotoCropper
          src={cropSrc}
          title={cropTarget === "banner" ? "Ajustá tu portada" : "Ajustá tu foto"}
          round={cropTarget !== "banner"}
          viewportW={cropTarget === "banner" ? 288 : 260}
          viewportH={cropTarget === "banner" ? 96 : 260}
          outputW={cropTarget === "banner" ? 1200 : 512}
          outputH={cropTarget === "banner" ? 400 : 512}
          onCancel={() => setCropSrc(null)}
          onSave={(dataUrl) => {
            handleProfileChange(cropTarget === "banner" ? "bannerUrl" : "profilePhotoUrl", dataUrl);
            setCropSrc(null);
          }}
        />
      ) : null}

      {showNewProfile ? (
        <div
          className={style.modalOverlay}
          onClick={() => setShowNewProfile(false)}
          role="presentation"
        >
          <div
            className={style.modalCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Nuevo perfil"
          >
            <div className={style.modalHead}>
              <h3>Nuevo perfil</h3>
              <button
                type="button"
                className={style.modalClose}
                onClick={() => setShowNewProfile(false)}
                aria-label="Cerrar"
              >
                <FiX />
              </button>
            </div>

            <div className={style.formGrid}>
              <label className={style.field}>
                <span>Nombre del negocio</span>
                <input
                  type="text"
                  value={newProfile.name}
                  onChange={(event) => handleNewProfileChange("name", event.target.value)}
                  placeholder="Ej: Growth Studio"
                  autoFocus
                />
              </label>
              <label className={style.field}>
                <span>Rubro</span>
                <input
                  type="text"
                  value={newProfile.industry}
                  onChange={(event) => handleNewProfileChange("industry", event.target.value)}
                  placeholder="Ej: servicios, comercio"
                />
              </label>
              <label className={style.field}>
                <span>Teléfono del negocio</span>
                <input
                  type="tel"
                  value={newProfile.phone}
                  onChange={(event) => handleNewProfileChange("phone", event.target.value)}
                  placeholder="+54 9 ..."
                />
              </label>
              <label className={style.field}>
                <span>Logo URL</span>
                <input
                  type="url"
                  value={newProfile.logoUrl}
                  onChange={(event) => handleNewProfileChange("logoUrl", event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <label className={style.field}>
                <span>Dirección</span>
                <input
                  type="text"
                  value={newProfile.address}
                  onChange={(event) => handleNewProfileChange("address", event.target.value)}
                  placeholder="Local, oficina o ciudad"
                />
              </label>
            </div>

            <div className={style.modalActions}>
              <button
                type="button"
                className={style.ghostButton}
                onClick={() => setShowNewProfile(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={style.saveButton}
                onClick={handleCreateProfile}
                disabled={savingNewProfile || !newProfile.name.trim()}
              >
                <FiSave />
                {savingNewProfile ? "Creando..." : "Crear perfil"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default SettingsPage;
