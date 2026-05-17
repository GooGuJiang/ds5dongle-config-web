import toast from "react-hot-toast";
import { registerSW } from "virtual:pwa-register";
import i18n from "./i18n";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;
const RELOAD_LOCK_KEY = "pwa-reloading";

function t(key: string) {
  return i18n.t(key);
}

function isBrowser() {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

function reloadOnce() {
  if (sessionStorage.getItem(RELOAD_LOCK_KEY) === "true") {
    return;
  }

  sessionStorage.setItem(RELOAD_LOCK_KEY, "true");
  window.location.reload();
}

// 页面重新加载完成后释放锁，避免之后的新版本无法再次刷新
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    sessionStorage.removeItem(RELOAD_LOCK_KEY);
  });
}

let hasControllerChangeListener = false;
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;
let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;

function setupControllerChangeReload() {
  if (!isBrowser() || hasControllerChangeListener) {
    return;
  }

  hasControllerChangeListener = true;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadOnce();
  });
}

setupControllerChangeReload();

updateServiceWorker = registerSW({
  immediate: true,

  onOfflineReady() {
    toast.success(t("pwa.offlineReady"), {
      id: "pwa-offline-ready",
    });
  },

  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    serviceWorkerRegistration = registration;

    const checkForUpdate = () => {
      if (navigator.onLine) {
        void registration.update();
      }
    };

    window.addEventListener("online", checkForUpdate);

    window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
  },

  async onNeedRefresh() {
    toast(t("pwa.cacheRefresh"), { id: "pwa-cache-refresh" });
  },

  onRegisterError(error) {
    console.error("PWA service worker registration failed", error);
  },
});

export async function applyPwaUpdate(): Promise<void> {
  toast.loading(t("pwa.cacheRefresh"), {
    id: "pwa-cache-refresh",
  });

  try {
    await serviceWorkerRegistration?.update();
    await updateServiceWorker?.(true);

    window.setTimeout(() => {
      reloadOnce();
    }, 1500);
  } catch (error) {
    console.error("PWA update failed", error);

    toast.error(t("pwa.updateFailed"), {
      id: "pwa-cache-refresh",
    });

    throw error;
  }
}
