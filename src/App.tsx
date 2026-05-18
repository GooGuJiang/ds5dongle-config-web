import { useEffect, useRef, useState, useCallback } from "react";
import { Info } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import toast, { Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  APP_METADATA,
  APP_TOAST_OPTIONS,
  SETTINGS_SIDEBAR_AUTO_COLLAPSE_QUERY,
  SETTINGS_NAV_ITEMS,
  SETTINGS_SIDEBAR_PROVIDER_STYLE,
  type AppView,
} from "./appConfig";
import { AppHeader } from "./components/AppHeader";
import { ConfigPanel } from "./components/ConfigPanel";
import { DeviceStrip } from "./components/DeviceStrip";
import { FirmwareUpdateDialog } from "./components/FirmwareUpdateDialog";
import { NoticeList } from "./components/NoticeList";
import { PwaUpdateDialog } from "./components/PwaUpdateDialog";
import { SidebarDeviceCard } from "./components/SidebarDeviceCard";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";
import { useDs5Bridge } from "./hooks/useDs5Bridge";
import { useTheme } from "./hooks/useTheme";
import { checkFirmwareUpdate, shouldCheckFirmwareUpdate, type FirmwareUpdateCheckResult } from "./lib/firmwareRelease";
import { checkPwaUpdate, type PwaUpdateCheckResult } from "./lib/pwaRelease";
import { applyPwaUpdate } from "./pwa";

export default function App() {
  const bridge = useDs5Bridge();
  const theme = useTheme();
  const { t } = useTranslation();
  const [view, setView] = useState<AppView>("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [firmwareUpdateResult, setFirmwareUpdateResult] = useState<FirmwareUpdateCheckResult | null>(null);
  const [firmwareUpdateDialogOpen, setFirmwareUpdateDialogOpen] = useState(false);
  const [pwaUpdateResult, setPwaUpdateResult] = useState<PwaUpdateCheckResult | null>(null);
  const [pwaUpdateDialogOpen, setPwaUpdateDialogOpen] = useState(false);
  const [pwaUpdating, setPwaUpdating] = useState(false);
  const [deviceSwitching, setDeviceSwitching] = useState(false);
  const deviceSwitchingTimerRef = useRef<number | null>(null);
  const dismissedFirmwareUpdateKeyRef = useRef(readDismissedUpdateKey(FIRMWARE_UPDATE_DISMISSED_KEY));
  const dismissedPwaUpdateKeyRef = useRef(readDismissedUpdateKey(PWA_UPDATE_DISMISSED_KEY));
  const isBusy = bridge.operation !== null;
  // 进度条完成后切换回主页（仅在模式切换场景下触发）
  const handleProgressComplete = useCallback(() => {
    if (bridge.shouldReturnHomeRef.current) {
      setView("home");
      bridge.clearReturnHome();
    }
  }, [bridge.clearReturnHome, bridge.shouldReturnHomeRef]);

  useEffect(() => {
    if (!bridge.client && (view === "settings" || view === "about") && !bridge.shouldReturnHomeRef.current) {
      setView("home");
    }
  }, [bridge.client, bridge.shouldReturnHome, view]);

  useEffect(() => {
    if (!bridge.error) {
      return;
    }

    toast.error(bridge.error, { id: "bridge-error" });
    bridge.clearError();
  }, [bridge.error, bridge.clearError]);

  useEffect(() => {
    if ((view !== "settings" && view !== "about") || !bridge.client || !shouldCheckFirmwareUpdate(bridge.firmwareVersion)) {
      return;
    }

    const abortController = new AbortController();

    void checkFirmwareUpdate(bridge.firmwareVersion, abortController.signal)
      .then((result) => {
        if (!result?.updateAvailable || abortController.signal.aborted) {
          return;
        }

        const updateKey = firmwareUpdatePromptKey(result);

        setFirmwareUpdateResult(result);

        if (dismissedFirmwareUpdateKeyRef.current !== updateKey) {
          setFirmwareUpdateDialogOpen(true);
        }
      })
      .catch((error) => {
        if (!abortController.signal.aborted) {
          console.error("Firmware update check failed", error);
        }
      });

    return () => abortController.abort();
  }, [bridge.client, bridge.firmwareVersion, view]);

  useEffect(() => {
    const abortController = new AbortController();

    void checkPwaUpdate(abortController.signal)
      .then((result) => {
        if (!result?.updateAvailable || abortController.signal.aborted) {
          return;
        }

        const updateKey = pwaUpdatePromptKey(result);

        setPwaUpdateResult(result);

        if (dismissedPwaUpdateKeyRef.current !== updateKey) {
          setPwaUpdateDialogOpen(true);
        }
      })
      .catch((error) => {
        if (!abortController.signal.aborted) {
          console.error("PWA update check failed", error);
        }
      });

    return () => abortController.abort();
  }, []);

  const handleFirmwareUpdateDialogOpenChange = useCallback((open: boolean) => {
    setFirmwareUpdateDialogOpen(open);

    if (!open && firmwareUpdateResult?.updateAvailable) {
      dismissedFirmwareUpdateKeyRef.current = firmwareUpdatePromptKey(firmwareUpdateResult);
      writeDismissedUpdateKey(FIRMWARE_UPDATE_DISMISSED_KEY, dismissedFirmwareUpdateKeyRef.current);
    }
  }, [firmwareUpdateResult]);

  const handleOpenFirmwareUpdateDialog = useCallback(() => {
    if (firmwareUpdateResult?.updateAvailable) {
      setFirmwareUpdateDialogOpen(true);
    }
  }, [firmwareUpdateResult]);

  const handleOpenPwaUpdateDialog = useCallback(() => {
    if (pwaUpdateResult?.updateAvailable) {
      setPwaUpdateDialogOpen(true);
    }
  }, [pwaUpdateResult]);

  const handlePwaUpdateDialogOpenChange = useCallback((open: boolean) => {
    setPwaUpdateDialogOpen(open);

    if (!open && pwaUpdateResult?.updateAvailable) {
      dismissedPwaUpdateKeyRef.current = pwaUpdatePromptKey(pwaUpdateResult);
      writeDismissedUpdateKey(PWA_UPDATE_DISMISSED_KEY, dismissedPwaUpdateKeyRef.current);
    }
  }, [pwaUpdateResult]);

  const handlePwaUpdate = useCallback(() => {
    setPwaUpdating(true);
    void applyPwaUpdate().finally(() => setPwaUpdating(false));
  }, []);

  const handleSelectDevice = useCallback(async (device: HIDDevice) => {
    const shouldAnimateSwitch = bridge.client?.device !== device;

    if (!shouldAnimateSwitch) {
      await bridge.connectAuthorized(device);
      return;
    }

    if (deviceSwitchingTimerRef.current !== null) {
      window.clearTimeout(deviceSwitchingTimerRef.current);
      deviceSwitchingTimerRef.current = null;
    }

    setDeviceSwitching(true);

    try {
      await Promise.all([
        bridge.connectAuthorized(device),
        wait(180),
      ]);
    } finally {
      deviceSwitchingTimerRef.current = window.setTimeout(() => {
        setDeviceSwitching(false);
        deviceSwitchingTimerRef.current = null;
      }, 180);
    }
  }, [bridge.client, bridge.connectAuthorized]);

  useEffect(() => () => {
    if (deviceSwitchingTimerRef.current !== null) {
      window.clearTimeout(deviceSwitchingTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(SETTINGS_SIDEBAR_AUTO_COLLAPSE_QUERY);
    const syncSidebarState = () => setSidebarOpen(!mediaQuery.matches);

    syncSidebarState();
    mediaQuery.addEventListener("change", syncSidebarState);

    return () => mediaQuery.removeEventListener("change", syncSidebarState);
  }, []);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={APP_TOAST_OPTIONS}
      />
      <FirmwareUpdateDialog
        open={firmwareUpdateDialogOpen}
        result={firmwareUpdateResult}
        onOpenChange={handleFirmwareUpdateDialogOpenChange}
      />
      <PwaUpdateDialog
        open={pwaUpdateDialogOpen}
        result={pwaUpdateResult}
        updating={pwaUpdating}
        onOpenChange={handlePwaUpdateDialogOpenChange}
        onUpdate={handlePwaUpdate}
      />
        <main className={`app-shell ${view === "settings" || view === "about" ? "settings-mode" : ""} ${deviceSwitching ? "is-device-switching" : ""}`}>
        <AppHeader
          theme={theme.theme}
          onThemeChange={theme.setTheme}
          pwaUpdateAvailable={Boolean(pwaUpdateResult?.updateAvailable)}
          pwaUpdateVersion={pwaUpdateResult?.latestRelease.tagName}
          onPwaUpdateClick={handleOpenPwaUpdateDialog}
          statusText={(view === "settings" || view === "about") && bridge.client ? bridge.statusText : undefined}
          issues={bridge.issues.map((issue) => t(`validation.${issue.field}`))}
          needsUsbReconnect={bridge.needsUsbReconnect}
          showBackButton={view === "settings" || view === "about"}
          onBack={() => setView("home")}
          showDeviceActions={(view === "settings" || view === "about") && Boolean(bridge.client)}
          canUseDeviceActions={Boolean(bridge.client)}
          canResetToDefaults={!bridge.isDefaultConfig}
          isBusy={isBusy}
          onReadConfig={bridge.readConfig}
          onResetToDefaults={bridge.resetToDefaults}
        />
        {view === "home" ? (
          <>
            <NoticeList supported={bridge.supported} />
            <div className="device-stage-wrap">
              <DeviceStrip
                authorizedDevices={bridge.authorizedDevices}
                authorizedDeviceSerialNumber={bridge.authorizedDeviceSerialNumber}
                authorizedDeviceBatteryText={bridge.authorizedDeviceBatteryText}
                authorizedDeviceFirmwareVersion={bridge.authorizedDeviceFirmwareVersion}
                authorizedDeviceSignalStrength={bridge.authorizedDeviceSignalStrength}
                client={bridge.client}
                batteryText={bridge.batteryText}
                firmwareVersion={bridge.firmwareVersion}
                signalStrength={bridge.signalStrength}
                deviceSerialNumber={bridge.deviceSerialNumber}
                deviceLabel={bridge.deviceLabel}
                isBusy={isBusy}
                supported={bridge.supported}
                onConnect={bridge.connect}
                onConnectAuthorized={handleSelectDevice}
                onOpenSettings={() => setView("settings")}
              />
            </div>
            <span className="app-version-watermark" aria-label={`${t("about.version")} v${APP_METADATA.version}`}>
              v{APP_METADATA.version}
            </span>
          </>
        ) : (
          <SidebarProvider className="settings-page" style={SETTINGS_SIDEBAR_PROVIDER_STYLE} open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <Sidebar className="settings-sidebar" collapsible="icon" aria-label={t("settings.navigation")}>
              <SidebarContent className="settings-sidebar-content">
                <SidebarDeviceCard
                  authorizedDevices={bridge.authorizedDevices}
                  authorizedDeviceBatteryText={bridge.authorizedDeviceBatteryText}
                  authorizedDeviceFirmwareVersion={bridge.authorizedDeviceFirmwareVersion}
                  authorizedDeviceSignalStrength={bridge.authorizedDeviceSignalStrength}
                  connectedDevice={bridge.client?.device ?? null}
                  deviceLabel={bridge.deviceLabel}
                  batteryText={bridge.batteryText}
                  firmwareVersion={bridge.firmwareVersion}
                  signalStrength={bridge.signalStrength}
                  firmwareUpdateAvailable={Boolean(firmwareUpdateResult?.updateAvailable)}
                  firmwareUpdateVersion={firmwareUpdateResult?.latestRelease.tagName}
                  onFirmwareUpdateClick={handleOpenFirmwareUpdateDialog}
                  onSelectDevice={handleSelectDevice}
                />
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {SETTINGS_NAV_ITEMS.map((item) => {
                        const label = t(item.labelKey);

                        return (
                        <SidebarMenuItem key={item.labelKey}>
                          <SidebarMenuButton type="button" isActive={view === item.view} tooltip={label} onClick={() => setView(item.view)}>
                            <item.icon />
                            <span>{label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
              <SidebarTrigger className="settings-sidebar-trigger" />
            </Sidebar>

            <SidebarInset className="settings-detail">
              <div key={view} className="settings-view-transition">
                {view === "settings" ? (
                  <ConfigPanel bridge={bridge} onProgressComplete={handleProgressComplete} />
                ) : (
                  <section className="panel about-panel" aria-labelledby="about-title">
                  <div className="panel-title about-panel-title">
                    <Info size={18} />
                    <h2 id="about-title">{t("about.title")}</h2>
                  </div>

                  <div className="about-info-grid">
                    <a className="config-section about-github-card" href={APP_METADATA.githubUrl} target="_blank" rel="noreferrer">
                      <FaGithub aria-hidden="true" />
                      <span>
                        <span className="about-info-label">{t("about.github")}</span>
                        <strong>{APP_METADATA.githubUrl}</strong>
                      </span>
                    </a>
                  </div>
                  </section>
                )}
              </div>
            </SidebarInset>
          </SidebarProvider>
        )}

      </main>
    </>
  );
}

const FIRMWARE_UPDATE_DISMISSED_KEY = "firmware-update-dismissed-key";
const PWA_UPDATE_DISMISSED_KEY = "pwa-update-dismissed-key";

function firmwareUpdatePromptKey(result: FirmwareUpdateCheckResult): string {
  return `${result.currentVersion}->${result.latestRelease.tagName}`;
}

function pwaUpdatePromptKey(result: PwaUpdateCheckResult): string {
  return `${result.currentVersion}->${result.latestRelease.tagName}`;
}

function readDismissedUpdateKey(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeDismissedUpdateKey(storageKey: string, updateKey: string): void {
  try {
    localStorage.setItem(storageKey, updateKey);
  } catch {
    // Ignore storage failures; the in-memory ref still prevents repeated prompts in this session.
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
