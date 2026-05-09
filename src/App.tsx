import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { Info, Settings } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { AppHeader } from "./components/AppHeader";
import { ConfigPanel } from "./components/ConfigPanel";
import { DeviceStrip } from "./components/DeviceStrip";
import { NoticeList } from "./components/NoticeList";
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

type AppView = "home" | "settings";

export default function App() {
  const bridge = useDs5Bridge();
  const theme = useTheme();
  const { t } = useTranslation();
  const [view, setView] = useState<AppView>("home");
  const isBusy = bridge.operation !== null;
  // 进度条完成后切换回主页（仅在模式切换场景下触发）
  const handleProgressComplete = useCallback(() => {
    if (bridge.shouldReturnHomeRef.current) {
      setView("home");
      bridge.clearReturnHome();
    }
  }, [bridge.clearReturnHome, bridge.shouldReturnHomeRef]);

  useEffect(() => {
    if (!bridge.client && view === "settings" && !bridge.shouldReturnHomeRef.current) {
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

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: "app-toast",
          duration: 4200,
          style: {
            background: "var(--card)",
            color: "var(--card-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 16px 42px rgba(16, 24, 40, 0.12)",
          },
          error: {
            iconTheme: {
              primary: "var(--destructive)",
              secondary: "var(--card)",
            },
          },
        }}
      />
      <main className={`app-shell ${view === "settings" ? "settings-mode" : ""}`}>
        <AppHeader
          theme={theme.theme}
          onThemeChange={theme.setTheme}
          statusText={view === "settings" && bridge.client ? bridge.statusText : undefined}
          issues={bridge.issues.map((issue) => t(`validation.${issue.field}`))}
          needsUsbReconnect={bridge.needsUsbReconnect}
          showBackButton={view === "settings"}
          onBack={() => setView("home")}
          showDeviceActions={view === "settings" && Boolean(bridge.client)}
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
                client={bridge.client}
                batteryText={bridge.batteryText}
                deviceSerialNumber={bridge.deviceSerialNumber}
                deviceLabel={bridge.deviceLabel}
                isBusy={isBusy}
                supported={bridge.supported}
                onConnect={bridge.connect}
                onConnectAuthorized={bridge.connectAuthorized}
                onOpenSettings={() => setView("settings")}
              />
            </div>
          </>
        ) : (
          <SidebarProvider className="settings-page" style={{ "--sidebar-width": "248px" } as CSSProperties}>
            <Sidebar className="settings-sidebar" collapsible="icon" aria-label={t("settings.navigation")}>
              <SidebarContent className="settings-sidebar-content">
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {[
                        { icon: Settings, label: t("settings.nav.settings"), active: true },
                        { icon: Info, label: t("settings.nav.about") },
                      ].map((item) => (
                        <SidebarMenuItem key={item.label}>
                          <SidebarMenuButton type="button" isActive={item.active} tooltip={item.label}>
                            <item.icon />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
              <SidebarTrigger className="settings-sidebar-trigger" />
            </Sidebar>

            <SidebarInset className="settings-detail">
              <ConfigPanel bridge={bridge} onProgressComplete={handleProgressComplete} />
            </SidebarInset>
          </SidebarProvider>
        )}

      </main>
    </>
  );
}
