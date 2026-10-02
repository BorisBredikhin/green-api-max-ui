/**
 * Browser storage, guarded for SSR and for a blocked storage partition.
 *
 * `react-router build` prerenders routes where `window` does not exist, and
 * private mode or a disabled-cookies iframe throws on access. Every helper
 * below answers with a fallback in both cases rather than propagating, because
 * a missing preference or cache entry must never break the messenger.
 */

const attempt = <T>(fallback: T, operation: () => T): T => {
  try {
    return operation();
  } catch {
    return fallback;
  }
};

const isBrowser = (): boolean => typeof window !== "undefined";

export const readItem = (key: string): string | null =>
  isBrowser() ? attempt(null, () => window.localStorage.getItem(key)) : null;

export const writeItem = (key: string, value: string): void => {
  if (!isBrowser()) return;
  attempt(undefined, () => window.localStorage.setItem(key, value));
};

export const removeItem = (key: string): void => {
  if (!isBrowser()) return;
  attempt(undefined, () => window.localStorage.removeItem(key));
};

/**
 * Reads a JSON value, handing `parse` the decoded payload. A corrupt or
 * unrecognisable entry reads as `null` so a caller can rebuild it from scratch.
 */
export const readJson = <T>(
  key: string,
  parse: (value: unknown) => T | null
): T | null => {
  const raw = readItem(key);
  if (raw === null) return null;

  return attempt(null, () => parse(JSON.parse(raw)));
};

export const writeJson = (key: string, value: unknown): void =>
  writeItem(key, JSON.stringify(value));

/**
 * Session flags mark instance-level work that must not repeat while the tab
 * lives. They are deliberately per-session: a reload is the moment to re-assert
 * them against the instance.
 */
export const readSessionFlag = (key: string): boolean =>
  isBrowser() ? attempt(false, () => window.sessionStorage.getItem(key) === "1") : false;

export const writeSessionFlag = (key: string): void => {
  if (!isBrowser()) return;
  attempt(undefined, () => window.sessionStorage.setItem(key, "1"));
};

/**
 * Narrowing helpers for the `unknown` that `JSON.parse` hands back. Stored
 * entries outlive the code that wrote them, so every read validates before it
 * is trusted.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value !== "";
