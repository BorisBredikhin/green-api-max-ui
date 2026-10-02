import type { GreenApiCredentials } from "./client";
import {
  isNonEmptyString,
  isRecord,
  readJson,
  removeItem,
  writeJson,
} from "~/lib/storage";

/**
 * Credentials live under a single key rather than one key per field, so a read
 * can never observe a half-written set and the stored shape is self-describing.
 */
const KEY_CREDENTIALS = "greenApi.credentials";

const isCredentials = (value: unknown): value is GreenApiCredentials =>
  isRecord(value) &&
  isNonEmptyString(value.idInstance) &&
  isNonEmptyString(value.apiTokenInstance) &&
  isNonEmptyString(value.baseUrl);

export const saveCredentials = (credentials: GreenApiCredentials): void =>
  writeJson(KEY_CREDENTIALS, credentials);

export const loadCredentials = (): GreenApiCredentials | null =>
  readJson(KEY_CREDENTIALS, (value) =>
    isCredentials(value) ? value : null
  );

export const clearCredentials = (): void => removeItem(KEY_CREDENTIALS);

export const isAuthenticated = (): boolean => loadCredentials() !== null;
