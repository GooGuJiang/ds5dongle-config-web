import { Gauge, Gamepad2, SlidersHorizontal, Volume2, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UseDs5BridgeResult } from "../hooks/useDs5Bridge";
import { fieldIssue, ControllerMode, PollingRateMode } from "../protocol/config";
import { ControllerModeControl } from "./config/ControllerModeControl";
import { FloatControl } from "./config/FloatControl";
import { IntegerControl } from "./config/IntegerControl";
import { PollingRateControl } from "./config/PollingRateControl";
import { ToggleControl } from "./config/ToggleControl";
import { SwitchProgressDialog } from "./config/SwitchProgressDialog";

/** 进度条动画持续时间（毫秒），可修改此值调整等待时间 */
export const PROGRESS_ANIMATION_DURATION_MS = 5000;

interface ConfigPanelProps {
  bridge: UseDs5BridgeResult;
  /** 进度条对话框完全关闭后回调（用于通知 App 切换主页） */
  onProgressComplete?: () => void;
}

export function ConfigPanel({ bridge, onProgressComplete }: ConfigPanelProps) {
  const { t } = useTranslation();
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progressTitle, setProgressTitle] = useState("");
  const [progressDescription, setProgressDescription] = useState("");
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<number | null>(null);
  const prevOperationRef = useRef<string | null>(null);
  const onProgressCompleteRef = useRef(onProgressComplete);
  onProgressCompleteRef.current = onProgressComplete;

  // 清理定时器
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current !== null) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // 监听操作状态，当操作从非null变为null时（操作真正完成）关闭对话框
  useEffect(() => {
    const prevOperation = prevOperationRef.current;
    prevOperationRef.current = bridge.operation;

    if (bridge.operation === null && showProgressDialog && prevOperation !== null) {
      // 操作完成，平滑地将进度条从当前值增加到100%
      if (progressIntervalRef.current !== null) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // 获取当前进度值
      setProgress((currentProgress) => {
        // 计算从当前进度到100%需要的时间（让动画更平滑）
        const remainingProgress = 100 - currentProgress;
        const animationDuration = Math.max(300, remainingProgress * 10); // 至少300ms，根据剩余进度调整
        const steps = Math.max(10, Math.floor(remainingProgress / 2)); // 至少10步
        const stepSize = remainingProgress / steps;
        const stepInterval = animationDuration / steps;
        
        let step = 0;
        progressIntervalRef.current = window.setInterval(() => {
          step++;
          if (step >= steps) {
            if (progressIntervalRef.current !== null) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            setProgress(100);
            // 等待一段时间后关闭对话框，让用户看到完成状态
            setTimeout(() => {
              setShowProgressDialog(false);
              setProgress(0);
              // 等待 dialog 关闭动画完成（duration-200）后再回调
              setTimeout(() => {
                onProgressCompleteRef.current?.();
              }, 250);
            }, 800);
          } else {
            setProgress((prev) => Math.min(100, prev + stepSize));
          }
        }, stepInterval);
        
        return currentProgress; // 保持当前值，由定时器更新
      });
    }
  }, [bridge.operation, showProgressDialog]);

  // 启动进度条动画
  const startProgressAnimation = () => {
    if (progressIntervalRef.current !== null) {
      clearInterval(progressIntervalRef.current);
    }
    // 每50ms更新一次，总时长由 PROGRESS_ANIMATION_DURATION_MS 控制
    const totalSteps = PROGRESS_ANIMATION_DURATION_MS / 50;
    const stepIncrement = 90 / totalSteps;
    progressIntervalRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          if (progressIntervalRef.current !== null) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          return 90;
        }
        return prev + stepIncrement;
      });
    }, 50);
  };

  // 处理回报率切换
  const handlePollingRateChange = (value: PollingRateMode) => {
    const isChanged = bridge.draft.pollingRateMode !== value;
    bridge.setDraftField("pollingRateMode", value);
    
    if (isChanged && bridge.isConnected) {
      setShowProgressDialog(true);
      setProgress(0);
      setProgressTitle(t("config.switchingPollingRate"));
      setProgressDescription(t("config.switchingPollingRateDescription"));
      startProgressAnimation();
    }
  };

  // 处理模式切换
  const handleControllerModeChange = (value: ControllerMode) => {
    const isChanged = bridge.draft.controllerMode !== value;
    bridge.setDraftField("controllerMode", value);
    
    if (isChanged && bridge.isConnected) {
      setShowProgressDialog(true);
      setProgress(0);
      setProgressTitle(t("config.switchingControllerMode"));
      setProgressDescription(t("config.switchingControllerModeDescription"));
      startProgressAnimation();
    }
  };

  return (
    <>
      <Card className="panel config-panel">
        <CardHeader className="p-0">
          <CardTitle className="panel-title">
            <SlidersHorizontal size={18} />
            <h2>{t("config.title")}</h2>
          </CardTitle>
        </CardHeader>

        <CardContent className="config-sections p-0">
          <section className="config-section config-section-featured">
            <div className="config-section-heading">
              <span className="config-section-icon">
                <Volume2 size={17} />
              </span>
              <div>
                <h3>{t("config.sections.feedback")}</h3>
                <p>{t("config.sections.feedbackDescription")}</p>
              </div>
            </div>
            <div className="control-stack">
              <FloatControl
                label={t("config.hapticsGain")}
                value={bridge.draft.hapticsGain}
                min={1}
                max={2}
                step={0.05}
                issue={fieldIssue(bridge.issues, "hapticsGain")}
                onChange={(value) => bridge.setDraftField("hapticsGain", value)}
              />
              <FloatControl
                label={`${t("config.speakerVolume")} (%)`}
                value={bridge.draft.speakerVolume}
                min={-100}
                max={0}
                step={0.01}
                displayMin={0}
                displayMax={100}
                displayStep={1}
                valueToDisplay={speakerVolumeToPercent}
                displayToValue={percentToSpeakerVolume}
                fractionDigits={0}
                issue={fieldIssue(bridge.issues, "speakerVolume")}
                onChange={(value) => bridge.setDraftField("speakerVolume", value)}
              />
              <IntegerControl
                label={t("config.hapticsBufferLength")}
                value={bridge.draft.hapticsBufferLength}
                min={16}
                max={128}
                issue={fieldIssue(bridge.issues, "hapticsBufferLength")}
                onChange={(value) => bridge.setDraftField("hapticsBufferLength", value)}
              />
            </div>
          </section>

          <section className="config-section">
            <div className="config-section-heading">
              <span className="config-section-icon">
                <Zap size={17} />
              </span>
              <div>
                <h3>{t("config.sections.power")}</h3>
                <p>{t("config.sections.powerDescription")}</p>
              </div>
            </div>
            <div className="control-stack compact-stack">
              <IntegerControl
                label={`${t("config.inactiveTime")} (${t("config.inactiveTimeUnit")})`}
                value={bridge.draft.inactiveTime}
                min={5}
                max={60}
                issue={fieldIssue(bridge.issues, "inactiveTime")}
                onChange={(value) => bridge.setDraftField("inactiveTime", value)}
              />
              <ToggleControl
                label={t("config.disableInactiveDisconnect")}
                value={bridge.draft.disableInactiveDisconnect}
                onChange={(value) => bridge.setDraftField("disableInactiveDisconnect", value)}
              />
              <ToggleControl
                label={t("config.disablePicoLed")}
                value={bridge.draft.disablePicoLed}
                onChange={(value) => bridge.setDraftField("disablePicoLed", value)}
              />
            </div>
          </section>

          <section className="config-section">
            <div className="config-section-heading">
              <span className="config-section-icon">
                <Gauge size={17} />
              </span>
              <div>
                <h3>{t("config.sections.performance")}</h3>
                <p>{t("config.sections.performanceDescription")}</p>
              </div>
            </div>
            <div className="control-stack compact-stack">
              <PollingRateControl
                value={bridge.draft.pollingRateMode}
                onChange={handlePollingRateChange}
              />
            </div>
          </section>

          <section className="config-section">
            <div className="config-section-heading">
              <span className="config-section-icon">
                <Gamepad2 size={17} />
              </span>
              <div>
                <h3>{t("config.sections.compatibility")}</h3>
                <p>{t("config.sections.compatibilityDescription")}</p>
              </div>
            </div>
            <div className="control-stack compact-stack">
              <ControllerModeControl
                value={bridge.draft.controllerMode}
                onChange={handleControllerModeChange}
              />
            </div>
          </section>
        </CardContent>
      </Card>
      <SwitchProgressDialog
        open={showProgressDialog}
        title={progressTitle}
        description={progressDescription}
        progress={progress}
      />
    </>
  );
}

function speakerVolumeToPercent(value: number): number {
  if (value <= -100) {
    return 0;
  }

  return Math.min(100, Math.max(0, 100 * 10 ** (value / 20)));
}

function percentToSpeakerVolume(value: number): number {
  if (value <= 0) {
    return -100;
  }

  return Math.min(0, Math.max(-100, 20 * Math.log10(value / 100)));
}
