import { useEffect, useState } from "react";

import { isAuthenticated } from "~/api/auth";

export type AuthState = {
  /** False until the first client render, so callers can hold off on work. */
  ready: boolean;
  authenticated: boolean;
};

/**
 * Credentials live in localStorage, which is unavailable while `react-router
 * build` prerenders `/` for SPA mode. Reading them only after mount keeps the
 * prerendered HTML and the first client render identical.
 */
export const useIsAuthenticated = (): AuthState => {
  const [state, setState] = useState<AuthState>({
    ready: false,
    authenticated: false,
  });

  useEffect(() => {
    setState({ ready: true, authenticated: isAuthenticated() });
  }, []);

  return state;
};