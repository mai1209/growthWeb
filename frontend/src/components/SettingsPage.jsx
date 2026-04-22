import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiEye,
  FiEyeOff,
  FiKey,
  FiLock,
  FiRefreshCcw,
  FiSave,
  FiUser,
} from "react-icons/fi";
import { authService } from "../api";
import style from "../style/Settings.module.css";

const TAB_META = {
  perfil: {
    title: "Perfil de cuenta",
    text: "Guarda los datos básicos que identifican tu cuenta en Growth.",
    icon: FiUser,
  },
  password: {
    title: "Cambiar contraseña",
    text: "Actualiza tu clave desde la sesión iniciada.",
    icon: FiLock,
  },
  recuperar: {
    title: "Recuperar contraseña",
    text: "Genera un enlace para restablecer la contraseña desde fuera del login.",
    icon: FiRefreshCcw,
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

function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TAB_META[searchParams.get("tab")] ? searchParams.get("tab") : "perfil";
  const ActiveIcon = TAB_META[activeTab].icon;

  const [profile, setProfile] = useState({
    username: "",
    email: "",
    fullName: "",
    phone: "",
    profilePhotoUrl: "",
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

  const profileInitials = useMemo(() => getInitials(profile), [profile]);

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

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
    setError("");
    setMessage("");
    setResetUrl("");
  };

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setProfileSaving(true);

    try {
      const response = await authService.updateProfile({
        fullName: profile.fullName,
        phone: profile.phone,
        profilePhotoUrl: profile.profilePhotoUrl,
      });

      setProfile(response.data.profile);
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

  return (
    <section className={style.container}>
      <div className={style.header}>
        <div>
          <p className={style.kicker}>Ajustes</p>
          <h1>{TAB_META[activeTab].title}</h1>
          <p>{TAB_META[activeTab].text}</p>
        </div>
        <div className={style.headerIcon}>
          <ActiveIcon />
        </div>
      </div>

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

      {activeTab === "perfil" ? (
        <form className={style.card} onSubmit={handleProfileSubmit}>
          <div className={style.profileHero}>
            <div className={style.avatar}>
              {profile.profilePhotoUrl ? (
                <img src={profile.profilePhotoUrl} alt="Foto de perfil" />
              ) : (
                <span>{profileInitials}</span>
              )}
            </div>
            <div>
              <p className={style.kicker}>Perfil</p>
              <h2>{profile.fullName || profile.username || "Tu perfil"}</h2>
              <p>{profile.email || "Email de ingreso"}</p>
            </div>
          </div>

          <div className={style.formGrid}>
            <label className={style.field}>
              <span>Nombre completo</span>
              <input
                type="text"
                value={profile.fullName}
                onChange={(event) => handleProfileChange("fullName", event.target.value)}
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
                onChange={(event) => handleProfileChange("phone", event.target.value)}
                placeholder="+54 9 ..."
                disabled={profileLoading}
              />
            </label>

            <label className={style.field}>
              <span>Foto de perfil URL</span>
              <input
                type="url"
                value={profile.profilePhotoUrl}
                onChange={(event) => handleProfileChange("profilePhotoUrl", event.target.value)}
                placeholder="https://..."
                disabled={profileLoading}
              />
            </label>
          </div>

          <button type="submit" className={style.saveButton} disabled={profileSaving}>
            <FiSave />
            {profileSaving ? "Guardando..." : "Guardar perfil"}
          </button>
        </form>
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

      {error ? <p className={style.error}>{error}</p> : null}
      {message ? <p className={style.success}>{message}</p> : null}
    </section>
  );
}

export default SettingsPage;
