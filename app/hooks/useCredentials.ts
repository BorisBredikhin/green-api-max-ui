import { useEffect, useState } from "react";

import { loadCredentials } from "~/api/auth";
import type { GreenApiCredentials } from "~/api/client";

export type Session = {
  /** False until the first client render, so callers can hold off on work. */
  ready: boolean;
  /** Null while nobody is signed in. */
  credentials: GreenApiCredentials | null;
};

/**
 * Credentials live in localStorage, which is unavailable while `react-router
 * build` prerenders `/` for SPA mode. Reading them only after mount keeps the
 * prerendered HTML and the first client render identical.
 */
export const useCredentials = (): Session => {
  const [session, setSession] = useState<Session>({
    ready: false,
    credentials: null,
  });

  useEffect(() => {
    setSession({ ready: true, credentials: loadCredentials() });
  }, []);

  return session;
};
