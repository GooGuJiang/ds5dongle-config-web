import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, RefreshCw, RotateCcw } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Tooltip } from "react-tooltip";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import type { ThemeMode } from "@/hooks/useTheme";

const headerMotionTransition = {
  type: "tween" as const,
  duration: 0.18,
  ease: "circOut" as const,
};

const headerFadeTransition = {
  type: "tween" as const,
  duration: 0.12,
  ease: "easeOut" as const,
};

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
  const [displayStatusText, setDisplayStatusText] = useState(statusText);
  const [displayIssues, setDisplayIssues] = useState(issues);
  const [displayNeedsUsbReconnect, setDisplayNeedsUsbReconnect] = useState(needsUsbReconnect);
  const [displayShowDeviceActions, setDisplayShowDeviceActions] = useState(showDeviceActions);
  const showControlSpacer = showBackButton && !showControlBar;

  useEffect(() => {
    setTooltipPortalRoot(tooltipPortalRef.current);
  }, []);

  useEffect(() => {
    if (showControlBar) {
      setDisplayStatusText(statusText);
      setDisplayIssues(issues);
      setDisplayNeedsUsbReconnect(needsUsbReconnect);
      setDisplayShowDeviceActions(showDeviceActions);
      return;
    }
  }, [issues, needsUsbReconnect, showControlBar, showDeviceActions, statusText]);

  return (
    <header className="app-header">
      <LayoutGroup>
      <motion.div className="brand-lockup" layout transition={headerMotionTransition}>
        <AnimatePresence initial={false}>
          {showBackButton && (
            <motion.div
              key="header-back-button"
              layout
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 38, opacity: 1, x: 0, scale: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={headerMotionTransition}
              className="header-back-motion-slot"
            >
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
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div className="brand-main" layout transition={headerMotionTransition}>
          <img className="app-icon" src="/pwa-icon.svg" alt="" aria-hidden="true" />
          <h1>{t("app.title")}</h1>
        </motion.div>
      </motion.div>
      <motion.div className="header-actions" layout transition={headerMotionTransition}>
        <motion.div layout transition={headerMotionTransition} className="header-action-slot">
          <LanguageSwitcher />
        </motion.div>
        <motion.div layout transition={headerMotionTransition} className="header-action-slot">
          <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
        </motion.div>
        <AnimatePresence initial={false} mode="popLayout">
          {(showControlBar || showControlSpacer) && (
            <motion.div
              key={showControlBar ? "header-device-control-bar" : "header-device-control-spacer"}
              className={`header-device-control-motion-slot ${showControlSpacer ? "is-spacer" : ""}`}
              layout
              initial={{ maxWidth: 0, opacity: 0 }}
              animate={{ maxWidth: showControlSpacer ? 0 : 720, opacity: showControlSpacer ? 0 : 1 }}
              exit={{ maxWidth: 0, opacity: 0 }}
              transition={headerMotionTransition}
            >
              {showControlBar && (
                <motion.div
                  className="header-device-control-bar"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={headerFadeTransition}
                >
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
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      </LayoutGroup>
      <div ref={tooltipPortalRef} />
      <Tooltip id="header-device-actions-tooltip" place="bottom" positionStrategy="fixed" portalRoot={tooltipPortalRoot} />
    </header>
  );
}
