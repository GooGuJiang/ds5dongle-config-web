import { type KeyboardEvent } from "react";
import { BatteryMedium, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DeviceStripProps {
  authorizedDevices: HIDDevice[];
  authorizedDeviceBatteryText: Record<string, string>;
  client: unknown | null;
  batteryText: string;
  deviceLabel: string;
  isBusy: boolean;
  supported: boolean;
  onConnect: () => void;
  onConnectAuthorized: (device: HIDDevice) => Promise<void> | void;
  onOpenSettings: () => void;
}

export function DeviceStrip({
  authorizedDevices,
  authorizedDeviceBatteryText,
  client,
  batteryText,
  deviceLabel,
  isBusy,
  supported,
  onConnect,
  onConnectAuthorized,
  onOpenSettings,
}: DeviceStripProps) {
  const { t } = useTranslation();
  const connectedDevice = client
    ? [{ key: deviceLabel, label: deviceLabel, batteryText, connected: true, device: null }]
    : [];
  const pairedDevices = client
    ? connectedDevice
    : authorizedDevices.map((device) => ({
        key: `${device.vendorId}:${device.productId}:${device.productName}`,
        label: deviceLabelFromDevice(device),
        batteryText: authorizedDeviceBatteryText[deviceKey(device)] ?? "--",
        connected: false,
        device,
      }));
  const hasPairedDevice = pairedDevices.length > 0;

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
      <div className="device-card-grid">
        {hasPairedDevice ? (
          pairedDevices.map((item) => {
            const [deviceName, deviceId] = item.label.split(" · ");
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
                      <img src="/svg/ps5-controller-gamepad-seeklogo.svg" alt="" aria-hidden="true" draggable={false} />
                    </div>
                  </div>
                  <div className="device-info-panel">
                    <div>
                      <strong>
                        <span>{deviceName}</span>
                      </strong>
                      {!item.connected && <p>{t("device.selectToConnect")}</p>}
                    </div>
                    {deviceId && <div className="device-id-badge">{deviceId}</div>}
                    <div className="device-status-icons" aria-hidden="true">
                      <span className="device-battery">
                        <BatteryMedium size={19} />
                        {item.batteryText}
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
    </section>
  );
}

function deviceLabelFromDevice(device: HIDDevice): string {
  const productId = device.productId.toString(16).padStart(4, "0").toUpperCase();
  return `${device.productName || "DS5 Bridge"} · ${device.vendorId.toString(16).padStart(4, "0").toUpperCase()}:${productId}`;
}

function deviceKey(device: HIDDevice): string {
  return `${device.vendorId}:${device.productId}:${device.productName}`;
}
