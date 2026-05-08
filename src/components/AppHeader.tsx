import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, RefreshCw, RotateCcw } from "lucide-react";
import { Tooltip } from "react-tooltip";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import type { ThemeMode } from "@/hooks/useTheme";

interface AppHeaderProps {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  statusText?: string;
  issues?: string[];
  needsUsbReconnect?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  showDeviceActions?: boolean;
  canUseDeviceActions?: boolean;
  canResetToDefaults?: boolean;
  isBusy?: boolean;
  onReadConfig?: () => void;
  onResetToDefaults?: () => void;
}

export function AppHeader({
  theme,
  onThemeChange,
  statusText,
  issues = [],
  needsUsbReconnect = false,
  showBackButton = false,
  onBack,
  showDeviceActions = false,
  canUseDeviceActions = false,
  canResetToDefaults = false,
  isBusy = false,
  onReadConfig,
  onResetToDefaults,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const tooltipPortalRef = useRef<HTMLDivElement | null>(null);
  const [tooltipPortalRoot, setTooltipPortalRoot] = useState<HTMLDivElement | null>(null);
  const showControlBar = Boolean(statusText || showDeviceActions);
  const [renderControlBar, setRenderControlBar] = useState(showControlBar);
  const [displayStatusText, setDisplayStatusText] = useState(statusText);
  const [displayIssues, setDisplayIssues] = useState(issues);
  const [displayNeedsUsbReconnect, setDisplayNeedsUsbReconnect] = useState(needsUsbReconnect);
  const [displayShowDeviceActions, setDisplayShowDeviceActions] = useState(showDeviceActions);

  useEffect(() => {
    setTooltipPortalRoot(tooltipPortalRef.current);
  }, []);

  useEffect(() => {
    if (showControlBar) {
      setDisplayStatusText(statusText);
      setDisplayIssues(issues);
      setDisplayNeedsUsbReconnect(needsUsbReconnect);
      setDisplayShowDeviceActions(showDeviceActions);
      setRenderControlBar(true);
      return;
    }

    const timer = window.setTimeout(() => setRenderControlBar(false), 180);
    return () => window.clearTimeout(timer);
  }, [issues, needsUsbReconnect, showControlBar, showDeviceActions, statusText]);

  return (
    <header className="app-header">
      <div className="brand-lockup">
        {showBackButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="header-back-button"
            onClick={onBack}
            aria-label={t("settings.backToHome")}
            title={t("settings.backToHome")}
          >
            <ArrowLeft size={18} />
          </Button>
        )}
        <div className="brand-main">
          <img className="app-icon" src="/pwa-icon.svg" alt="" aria-hidden="true" />
          <h1>{t("app.title")}</h1>
        </div>
      </div>
      <div className="header-actions">
        <LanguageSwitcher />
        <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
        {renderControlBar && (
          <div className={`header-device-control-bar ${showControlBar ? "is-entering" : "is-exiting"}`}>
            {displayStatusText && (
              <div className="header-status" role="status" aria-live="polite">
                <span className="header-status-label">{t("actions.state")}</span>
                <strong>{displayStatusText}</strong>
                {displayIssues.length > 0 && <span className="header-status-error">{displayIssues.join(" / ")}</span>}
                {displayNeedsUsbReconnect && <span className="header-status-warning">{t("actions.reconnectRequired")}</span>}
              </div>
            )}
            {displayShowDeviceActions && (
              <div className="header-device-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="header-device-action-button"
                  onClick={onReadConfig}
                  disabled={!canUseDeviceActions || isBusy}
                  aria-label={t("actions.read")}
                  data-tooltip-id="header-device-actions-tooltip"
                  data-tooltip-content={t("actions.readTitle")}
                  data-tooltip-place="bottom"
                >
                  <RefreshCw size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="header-device-action-button"
                  onClick={onResetToDefaults}
                  disabled={!canUseDeviceActions || isBusy || !canResetToDefaults}
                  aria-label={t("actions.reset")}
                  data-tooltip-id="header-device-actions-tooltip"
                  data-tooltip-content={t("actions.resetTitle")}
                  data-tooltip-place="bottom"
                >
                  <RotateCcw size={16} />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      <div ref={tooltipPortalRef} />
      <Tooltip id="header-device-actions-tooltip" place="bottom" positionStrategy="fixed" portalRoot={tooltipPortalRoot} />
    </header>
  );
}
