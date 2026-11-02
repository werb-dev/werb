import { useState } from "react";
import type { useRegisterSW as UseRegisterSW } from "virtual:pwa-register/react";

/** Test stand-in for vite-plugin-pwa's virtual module: no service worker. */
export const useRegisterSW: typeof UseRegisterSW = () => ({
  needRefresh: useState(false),
  offlineReady: useState(false),
  updateServiceWorker: async () => {},
});
