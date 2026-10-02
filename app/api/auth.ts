const KEY_ID = "greenApi.idInstance";
const KEY_TOKEN = "greenApi.apiTokenInstance";
const KEY_BASE_URL = "greenApi.baseUrl";

export type StoredCredentials = {
  idInstance: string;
  apiTokenInstance: string;
  baseUrl: string;
};

export function saveCredentials(creds: StoredCredentials): void {
  localStorage.setItem(KEY_ID, creds.idInstance);
  localStorage.setItem(KEY_TOKEN, creds.apiTokenInstance);
  localStorage.setItem(KEY_BASE_URL, creds.baseUrl);
};

export function loadCredentials(): StoredCredentials | null {
  if (typeof window === "undefined") return null;
  const idInstance = localStorage.getItem(KEY_ID);
  const apiTokenInstance = localStorage.getItem(KEY_TOKEN);
  const baseUrl = localStorage.getItem(KEY_BASE_URL);
  if (!idInstance || !apiTokenInstance || !baseUrl) return null;
  return { idInstance, apiTokenInstance, baseUrl };
};

export function clearCredentials(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_ID);
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_BASE_URL);
};

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  const idInstance = localStorage.getItem(KEY_ID);
  const apiTokenInstance = localStorage.getItem(KEY_TOKEN);
  const baseUrl = localStorage.getItem(KEY_BASE_URL);
  return Boolean(idInstance && apiTokenInstance && baseUrl);
};
