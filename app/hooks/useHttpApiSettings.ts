import { useCallback, useEffect, useRef } from "react";

import type { GreenApiCredentials } from "~/api/client";
import { setHttpApiSettings } from "~/api/notifications";
import { readSessionFlag, writeSessionFlag } from "~/lib/storage";

/**
 * SetSettings is limited to 1 request/second and mutates the instance, so the
 * session flag keeps a route remount from repeating it, while the cooldown keeps
 * a conflict from retrying faster than the instance can apply the change.
 */
const SETTINGS_SESSION_KEY = "greenApi.httpApiSettingsReady";
const SETTINGS_COOLDOWN_MS = 60_000;

/**
 * Points the instance at HTTP API polling, which is only legal with an empty
 * `webhookUrl`. Pass `retry` once the poller reports a webhook conflict, which
 * re-applies the fix past the session flag — someone may have set one in the
 * cabinet mid-session.
 */
export const useHttpApiSettings = (
  credentials: GreenApiCredentials | null,
  retry = false
): void => {
  const lastAttemptAtRef = useRef(0);

  const apply = useCallback(async () => {
    if (!credentials) return;
    if (!retry && readSessionFlag(SETTINGS_SESSION_KEY)) return;

    const now = Date.now();
    if (now - lastAttemptAtRef.current < SETTINGS_COOLDOWN_MS) return;
    lastAttemptAtRef.current = now;

    try {
      await setHttpApiSettings(credentials);
      writeSessionFlag(SETTINGS_SESSION_KEY);
    } catch {
      // Leaving the flag unset lets a later conflict retry.
    }
  }, [credentials, retry]);

  useEffect(() => {
    void apply();
  }, [apply]);
};
