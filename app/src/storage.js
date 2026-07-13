import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "token";
const WORKSPACE_KEY = "activeWorkspace";

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (token) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

export const getWorkspace = async () => {
  const ws = await SecureStore.getItemAsync(WORKSPACE_KEY);
  return /^business(?::[a-f\d]{24})?$/i.test(ws || "") ? ws : "personal";
};

export const setWorkspace = (ws) =>
  SecureStore.setItemAsync(WORKSPACE_KEY, ws || "personal");

// Carpetas de notas creadas por el usuario (persisten aunque estén vacías).
const CUSTOM_FOLDERS_KEY = "customNoteFolders";

export const getCustomFolders = async () => {
  try {
    const raw = await SecureStore.getItemAsync(CUSTOM_FOLDERS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
};

export const setCustomFolders = (arr) =>
  SecureStore.setItemAsync(
    CUSTOM_FOLDERS_KEY,
    JSON.stringify(Array.isArray(arr) ? arr.filter(Boolean) : [])
  );
