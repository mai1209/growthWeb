import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { authService } from "../api";
import { getWorkspace, setWorkspace as storeWorkspace } from "../storage";
import { useAuth } from "../auth/AuthContext";

const WorkspaceContext = createContext(null);

// Arma la lista de perfiles (Personal + negocios) con los ids que usa el backend.
export const buildProfiles = (profile) => {
  const businesses =
    Array.isArray(profile?.businessProfiles) && profile.businessProfiles.length
      ? profile.businessProfiles
      : profile?.businessProfile?.name
      ? [{ ...profile.businessProfile, _id: "legacy" }]
      : [];

  const options = [{ id: "personal", name: "Personal" }];
  businesses.forEach((b, i) => {
    const id = i === 0 || b._id === "legacy" ? "business" : `business:${b._id}`;
    options.push({ id, name: b.name || `Negocio ${i + 1}` });
  });
  return options;
};

export const WorkspaceProvider = ({ children }) => {
  const { token } = useAuth();
  const [workspace, setWorkspaceState] = useState("personal");
  const [profiles, setProfiles] = useState([{ id: "personal", name: "Personal" }]);

  useEffect(() => {
    getWorkspace()
      .then((ws) => setWorkspaceState(ws || "personal"))
      .catch(() => {});
  }, []);

  const refreshProfiles = useCallback(async () => {
    try {
      const res = await authService.getProfile();
      setProfiles(buildProfiles(res.data));
      return res.data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (token) refreshProfiles();
  }, [token, refreshProfiles]);

  const switchWorkspace = useCallback(async (ws) => {
    await storeWorkspace(ws);
    setWorkspaceState(ws);
  }, []);

  const addProfile = useCallback(
    async (name) => {
      const clean = String(name || "").trim();
      if (!clean) return;
      const profile = await authService
        .getProfile()
        .then((r) => r.data)
        .catch(() => null);
      const existing =
        Array.isArray(profile?.businessProfiles) && profile.businessProfiles.length
          ? profile.businessProfiles
          : profile?.businessProfile?.name
          ? [profile.businessProfile]
          : [];
      await authService.updateProfile({
        fullName: profile?.fullName || "",
        phone: profile?.phone || "",
        profilePhotoUrl: profile?.profilePhotoUrl || "",
        businessProfiles: [...existing, { name: clean }],
      });
      const updated = await refreshProfiles();
      const opts = buildProfiles(updated);
      const last = opts[opts.length - 1];
      if (last) await switchWorkspace(last.id);
    },
    [refreshProfiles, switchWorkspace]
  );

  const activeProfile = profiles.find((p) => p.id === workspace) || profiles[0];

  return (
    <WorkspaceContext.Provider
      value={{ workspace, profiles, activeProfile, switchWorkspace, addProfile, refreshProfiles }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => useContext(WorkspaceContext);
