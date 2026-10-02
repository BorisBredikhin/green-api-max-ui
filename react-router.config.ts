import type { Config } from "@react-router/dev/config";

export default {
  // SPA mode: `react-router build` prerenders `/` into `build/client/index.html`
  // and emits no server bundle, so `start` serves the static output instead.
  ssr: false,
} satisfies Config;
