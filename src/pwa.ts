import toast from "react-hot-toast";
import { registerSW } from "virtual:pwa-register";
import i18n from "./i18n";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

function t(key: string) {
  return i18n.t(key);
}

const updateServiceWorker = registerSW({
  immediate: true,
  onOfflineReady() {
    toast.success(t("pwa.offlineReady"), { id: "pwa-offline-ready" });
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }

    window.addEventListener("online", () => {
      void registration.update();
    });

    window.setInterval(() => {
      if (navigator.onLine) {
        void registration.update();
      }
    }, UPDATE_CHECK_INTERVAL);
  },
  onNeedRefresh() {
    toast.success(t("pwa.cacheRefresh"), { id: "pwa-cache-refresh" });
    // 调用 updateServiceWorker(true) 触发 skipWaiting
    void updateServiceWorker(true);
    // 添加一次性 controllerchange 监听器来刷新页面
    const onControllerChange = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  },
  onRegisterError(error) {
    console.error("PWA service worker registration failed", error);
  },
});
