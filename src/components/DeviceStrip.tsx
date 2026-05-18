import { type KeyboardEvent } from "react";
import { CircleAlert, Plus, Radio } from "lucide-react";
import {
  MdBattery0Bar,
  MdBattery1Bar,
  MdBattery2Bar,
  MdBattery3Bar,
  MdBattery4Bar,
  MdBattery5Bar,
  MdBattery6Bar,
  MdBatteryFull,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import { Tooltip } from "react-tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDeviceKey, getDeviceLabel } from "@/protocol/ds5BridgeHid";

interface DeviceStripProps {
  authorizedDevices: HIDDevice[];
  authorizedDeviceSerialNumber: Record<string, string>;
  authorizedDeviceBatteryText: Record<string, string>;
  authorizedDeviceFirmwareVersion: Record<string, string>;
  authorizedDeviceSignalStrength: Record<string, string>;
  client: { device: HIDDevice } | null;
  batteryText: string;
  firmwareVersion: string;
  signalStrength: string;
  deviceSerialNumber: string;
  deviceLabel: string;
  isBusy: boolean;
  supported: boolean;
  onConnect: () => void;
  onConnectAuthorized: (device: HIDDevice) => Promise<void> | void;
  onOpenSettings: () => void;
}

export function DeviceStrip({
  authorizedDevices,
  authorizedDeviceSerialNumber,
  authorizedDeviceBatteryText,
  authorizedDeviceFirmwareVersion,
  authorizedDeviceSignalStrength,
  client,
  batteryText,
  firmwareVersion,
  signalStrength,
  deviceSerialNumber,
  deviceLabel,
  isBusy,
  supported,
  onConnect,
  onConnectAuthorized,
  onOpenSettings,
}: DeviceStripProps) {
  const { t } = useTranslation();
  const connectedDeviceKey = client ? getDeviceKey(client.device) : null;
  const connectedDevice = client
    ? [{ key: connectedDeviceKey ?? deviceLabel, label: deviceLabel, batteryText, firmwareVersion, signalStrength, serialNumber: deviceSerialNumber, connected: true, device: null }]
    : [];
  const authorizedDeviceCards = authorizedDevices
    .filter((device) => getDeviceKey(device) !== connectedDeviceKey)
    .map((device) => ({
      key: getDeviceKey(device),
      label: getDeviceLabel(device),
      batteryText: authorizedDeviceBatteryText[getDeviceKey(device)] ?? "--",
      firmwareVersion: authorizedDeviceFirmwareVersion[getDeviceKey(device)] ?? "--",
      signalStrength: authorizedDeviceSignalStrength[getDeviceKey(device)] ?? "--",
      serialNumber: authorizedDeviceSerialNumber[getDeviceKey(device)] ?? "--",
      connected: false,
      device,
    }));
  const pairedDevices = [...connectedDevice, ...authorizedDeviceCards];
  const hasPairedDevice = pairedDevices.length > 0;
  const hasMultiplePairedDevices = pairedDevices.length > 1;

  const openSettingsFromCard = () => {
    if (client) {
      onOpenSettings();
    }
  };

  const openSettingsFromKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!client || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    onOpenSettings();
  };

  const openAuthorizedDevice = async (device: HIDDevice) => {
    if (!supported || isBusy) {
      return;
    }

    await onConnectAuthorized(device);
    onOpenSettings();
  };

  const openAuthorizedDeviceFromKeyboard = (event: KeyboardEvent<HTMLDivElement>, device: HIDDevice) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    void openAuthorizedDevice(device);
  };

  return (
    <section className="device-stage" aria-label={t("device.label")}>
      <div className={`device-card-grid ${hasMultiplePairedDevices ? "has-multiple-devices" : ""}`}>
        {hasPairedDevice ? (
          pairedDevices.map((item) => {
            const [deviceName] = item.label.split(" · ");
            const isEdge = deviceName.includes("Edge");
            const controllerImage = isEdge
              ? { src: "/images/ps5-controller-edge.webp", width: 1240, height: 916 }
              : { src: "/svg/ps5-controller-gamepad-seeklogo.svg", width: undefined, height: undefined };
            return (
              <Card
                key={item.key}
                className={`device-strip-card connected is-clickable`}
                role="button"
                tabIndex={0}
                onClick={item.connected ? openSettingsFromCard : () => item.device && void openAuthorizedDevice(item.device)}
                onKeyDown={
                  item.connected
                    ? openSettingsFromKeyboard
                    : (event) => item.device && openAuthorizedDeviceFromKeyboard(event, item.device)
                }
              >
                <CardContent className="device-strip">
                  <div className="device-preview" aria-hidden="true">
                    <div className="device-hero connected-device-hero">
                      <img src={controllerImage.src} alt="" aria-hidden="true" draggable={false} width={controllerImage.width} height={controllerImage.height} />
                    </div>
                  </div>
                  <div className="device-info-panel">
                    <div>
                      <strong>
                        <span>{deviceName}</span>
                      </strong>
                      {!item.connected && <p>{t("device.selectToConnect")}</p>}
                    </div>
                    <div className="device-status-icons">
                      <span
                        className="device-meta-icon"
                        data-tooltip-id="device-info-tooltip"
                        data-tooltip-content={t("device.firmwareVersion", { version: item.firmwareVersion })}
                        data-tooltip-place="top"
                      >
                        <CircleAlert size={18} />
                      </span>
                      <span
                        className="device-meta-icon"
                        data-tooltip-id="device-info-tooltip"
                        data-tooltip-content={t("device.signalStrength", { signal: item.signalStrength })}
                        data-tooltip-place="top"
                      >
                        <Radio size={18} />
                      </span>
                      <span
                        className="device-battery"
                        data-battery-level={batteryLevelState(item.batteryText)}
                      >
                        <BatteryIcon batteryText={item.batteryText} />
                        <span>{item.batteryText}</span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="device-strip-card empty unpaired">
            <CardContent className="device-strip">
              <div className="device-preview" aria-hidden="true">
                <button
                  type="button"
                  className="device-add-hotspot"
                  onClick={onConnect}
                  disabled={!supported || isBusy}
                  title={t("device.connectTitle")}
                  aria-label={t("device.add")}
                >
                  <Plus size={42} strokeWidth={1.8} />
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      {hasPairedDevice && (
        <div className="device-actions">
          <Button type="button" onClick={onConnect} disabled={!supported || isBusy} title={t("device.connectTitle")}>
            <Plus size={17} />
            {t("device.add")}
          </Button>
        </div>
      )}
      {!supported && <p className="device-hint">{t("notice.webHidUnsupported")}</p>}
      <Tooltip id="device-info-tooltip" place="top" positionStrategy="fixed" />
    </section>
  );
}

function BatteryIcon({ batteryText }: { batteryText: string }) {
  const level = batteryLevelFromText(batteryText);
  const iconProps = { size: 22, className: "device-battery-icon", focusable: false } as const;

  if (level === null) {
    return <MdBattery0Bar {...iconProps} />;
  }

  if (level >= 95) {
    return <MdBatteryFull {...iconProps} />;
  }

  if (level >= 82) {
    return <MdBattery6Bar {...iconProps} />;
  }

  if (level >= 68) {
    return <MdBattery5Bar {...iconProps} />;
  }

  if (level >= 54) {
    return <MdBattery4Bar {...iconProps} />;
  }

  if (level >= 40) {
    return <MdBattery3Bar {...iconProps} />;
  }

  if (level >= 26) {
    return <MdBattery2Bar {...iconProps} />;
  }

  if (level >= 12) {
    return <MdBattery1Bar {...iconProps} />;
  }

  return <MdBattery0Bar {...iconProps} />;
}

function batteryLevelFromText(text: string): number | null {
  const value = Number.parseInt(text, 10);

  if (Number.isNaN(value)) {
    return null;
  }

  return Math.min(Math.max(value, 0), 100);
}

function batteryLevelState(text: string): "unknown" | "low" | "medium" | "high" {
  const level = batteryLevelFromText(text);

  if (level === null) {
    return "unknown";
  }

  if (level <= 20) {
    return "low";
  }

  if (level <= 60) {
    return "medium";
  }

  return "high";
}
