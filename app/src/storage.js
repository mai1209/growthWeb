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
