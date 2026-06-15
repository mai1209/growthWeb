import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiEye,
  FiEyeOff,
  FiKey,
  FiLink,
  FiLock,
  FiPlus,
  FiRefreshCcw,
  FiSave,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { authService, googleService } from "../api";
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
  integraciones: {
    title: "Integraciones",
    text: "Conectá servicios externos como Google Calendar.",
    icon: FiLink,
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

  const [profile, setProfile] = useState({
    username: "",
    email: "",
    fullName: "",
    phone: "",
    profilePhotoUrl: "",
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
  const [openPersonal, setOpenPersonal] = useState(true);
  const [openBusiness, setOpenBusiness] = useState(() => new Set());
  const [google, setGoogle] = useState({
    connected: false,
    email: "",
    connectedAt: null,
  });
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleSyncing, setGoogleSyncing] = useState(false);

  const profileInitials = useMemo(() => getInitials(profile), [profile]);
  const businessProfiles = profile.businessProfiles?.length
    ? profile.businessProfiles
    : profile.businessProfile?.name
      ? [profile.businessProfile]
      : [];

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
    setSearchParams({ tab });
    setError("");
    setMessage("");
    setResetUrl("");
  };

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleBusinessListChange = (index, field, value) => {
    setProfile((prev) => ({
      ...prev,
      businessProfiles: (prev.businessProfiles || []).map((business, businessIndex) =>
        businessIndex === index ? { ...business, [field]: value } : business
      ),
    }));
  };

  const handleAddBusiness = () => {
    const newIndex = businessProfiles.length;
    setProfile((prev) => ({
      ...prev,
      businessProfiles: [
        ...(prev.businessProfiles?.length
          ? prev.businessProfiles
          : prev.businessProfile?.name
            ? [prev.businessProfile]
            : []),
        {
          name: "",
          industry: "",
          logoUrl: "",
          phone: "",
          address: "",
        },
      ],
    }));
    setOpenBusiness((prev) => new Set(prev).add(newIndex));
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
        fullName: profile.fullName,
        phone: profile.phone,
        profilePhotoUrl: profile.profilePhotoUrl,
        businessProfile: profile.businessProfile,
        businessProfiles: profile.businessProfiles,
      });

      setProfile(response.data.profile);
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

  return (
    <section className={style.container}>
 
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
          {/* ===== Perfil personal ===== */}
          <div className={`${style.accordion} ${openPersonal ? style.accordionOpen : ""}`}>
            <div className={style.accordionHead}>
              <button
                type="button"
                className={style.accordionToggle}
                onClick={() => setOpenPersonal((prev) => !prev)}
                aria-expanded={openPersonal}
              >
                <span className={style.accordionAvatar}>
                  {profile.profilePhotoUrl ? (
                    <img src={profile.profilePhotoUrl} alt="Foto de perfil" />
                  ) : (
                    <span>{profileInitials}</span>
                  )}
                </span>
                <span className={style.accordionInfo}>
                  <span className={style.accordionLabel}>Perfil personal</span>
                  <strong className={style.accordionName}>
                    {profile.fullName || profile.username || "Tu perfil"}
                  </strong>
                  <small className={style.accordionSub}>
                    {profile.email || "Email de ingreso"}
                  </small>
                </span>
                <FiChevronDown className={style.accordionChevron} />
              </button>
            </div>

            <div className={style.accordionBody}>
              <div className={style.accordionBodyInner}>
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
              </div>
            </div>
          </div>

          {/* ===== Negocios ===== */}
          <div className={style.businessHeader}>
            <div>
              <p className={style.kicker}>Negocios</p>
              <h2>Perfiles de negocio</h2>
              <p>Agregá los negocios que quieras separar del espacio personal.</p>
            </div>
            <button
              type="button"
              className={style.secondaryButton}
              onClick={handleAddBusiness}
              disabled={profileLoading}
            >
              <FiPlus />
              Agregar negocio
            </button>
          </div>

          {businessProfiles.length ? (
            <div className={style.businessList}>
              {businessProfiles.map((business, index) => {
                const isOpen = openBusiness.has(index);

                return (
                  <div
                    key={business._id || index}
                    className={`${style.accordion} ${isOpen ? style.accordionOpen : ""}`}
                  >
                    <div className={style.accordionHead}>
                      <button
                        type="button"
                        className={style.accordionToggle}
                        onClick={() => toggleBusiness(index)}
                        aria-expanded={isOpen}
                      >
                        <span className={style.accordionAvatar}>
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
                        <FiChevronDown className={style.accordionChevron} />
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

                    <div className={style.accordionBody}>
                      <div className={style.accordionBodyInner}>
                        <div className={style.formGrid}>
                          <label className={style.field}>
                            <span>Nombre del negocio</span>
                            <input
                              type="text"
                              value={business.name || ""}
                              onChange={(event) => handleBusinessListChange(index, "name", event.target.value)}
                              placeholder="Ej: Growth Studio"
                              disabled={profileLoading}
                            />
                          </label>

                          <label className={style.field}>
                            <span>Rubro</span>
                            <input
                              type="text"
                              value={business.industry || ""}
                              onChange={(event) => handleBusinessListChange(index, "industry", event.target.value)}
                              placeholder="Ej: Indumentaria, servicios, comercio"
                              disabled={profileLoading}
                            />
                          </label>

                          <label className={style.field}>
                            <span>Teléfono del negocio</span>
                            <input
                              type="tel"
                              value={business.phone || ""}
                              onChange={(event) => handleBusinessListChange(index, "phone", event.target.value)}
                              placeholder="+54 9 ..."
                              disabled={profileLoading}
                            />
                          </label>

                          <label className={style.field}>
                            <span>Logo URL</span>
                            <input
                              type="url"
                              value={business.logoUrl || ""}
                              onChange={(event) => handleBusinessListChange(index, "logoUrl", event.target.value)}
                              placeholder="https://..."
                              disabled={profileLoading}
                            />
                          </label>

                          <label className={style.field}>
                            <span>Dirección</span>
                            <input
                              type="text"
                              value={business.address || ""}
                              onChange={(event) => handleBusinessListChange(index, "address", event.target.value)}
                              placeholder="Local, oficina o ciudad"
                              disabled={profileLoading}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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

      {error ? <p className={style.error}>{error}</p> : null}
      {message ? <p className={style.success}>{message}</p> : null}
    </section>
  );
}

export default SettingsPage;
