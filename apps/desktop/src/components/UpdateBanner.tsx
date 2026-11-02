import { useRegisterSW } from "virtual:pwa-register/react";
import { useT } from "../data/preferences.tsx";
import { isTauri } from "../data/runtime.ts";

/** How often an open tab asks the server for a newer service worker. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * "New version available" banner for the web build. The service worker
 * downloads a new release in the background and waits; the brewer picks
 * when to reload, so an update never interrupts a brew session or an
 * editor draft. Not rendered in the Tauri app, which has no service worker.
 */
export function UpdateBanner() {
  if (isTauri()) return null;
  return <ServiceWorkerUpdate />;
}

/** Inner component so the hook only runs outside Tauri. */
function ServiceWorkerUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Long-lived tabs (brew mode by the kettle) only check for updates on
      // navigation; poll so they still hear about a release. Offline checks
      // reject, which is fine.
      setInterval(() => {
        registration.update().catch(() => {});
      }, UPDATE_CHECK_MS);
    },
  });

  if (!needRefresh) return null;
  return (
    <UpdatePrompt
      onReload={() => void updateServiceWorker(true)}
      onDismiss={() => setNeedRefresh(false)}
    />
  );
}

export function UpdatePrompt({
  onReload,
  onDismiss,
}: {
  onReload: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="update-banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 rounded-xl bg-surface-raised border border-border shadow-lg p-4 flex items-center gap-3"
    >
      <p className="text-body-sm text-text flex-1">{t("update.ready")}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="px-3 py-2 rounded-lg text-body-sm font-medium text-text-muted hover:text-text transition-colors min-h-[40px]"
      >
        {t("update.later")}
      </button>
      <button
        type="button"
        onClick={onReload}
        className="px-4 py-2 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity min-h-[40px]"
      >
        {t("update.reload")}
      </button>
    </div>
  );
}
