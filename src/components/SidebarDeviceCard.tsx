import { useState } from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { Battery, BatteryFull, ChevronRight, CircleAlert, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

interface SidebarDeviceCardProps {
  authorizedDevices: HIDDevice[];
  authorizedDeviceBatteryText: Record<string, string>;
  authorizedDeviceFirmwareVersion: Record<string, string>;
  authorizedDeviceSignalStrength: Record<string, string>;
  connectedDevice: HIDDevice | null;
  deviceLabel: string;
  batteryText: string;
  firmwareVersion: string;
  signalStrength: string;
  onSelectDevice: (device: HIDDevice) => Promise<void> | void;
}

export function SidebarDeviceCard({
  authorizedDevices,
  authorizedDeviceBatteryText,
  authorizedDeviceFirmwareVersion,
  authorizedDeviceSignalStrength,
  connectedDevice,
  deviceLabel,
  batteryText,
  firmwareVersion,
  signalStrength,
  onSelectDevice,
}: SidebarDeviceCardProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [deviceName] = deviceLabel.split(" · ");
  const connectedDeviceKey = connectedDevice ? deviceKey(connectedDevice) : null;
  const visibleDevices = connectedDevice && !authorizedDevices.some((device) => deviceKey(device) === connectedDeviceKey)
    ? [connectedDevice, ...authorizedDevices]
    : authorizedDevices;
  const popoverDevices = visibleDevices.map((device) => {
    const key = deviceKey(device);
    const active = key === connectedDeviceKey;

    return {
      key,
      label: active ? deviceName : deviceLabelFromDevice(device).split(" · ")[0],
      batteryText: active ? batteryText : authorizedDeviceBatteryText[key] ?? "--",
      firmwareVersion: active ? firmwareVersion : authorizedDeviceFirmwareVersion[key] ?? "--",
      signalStrength: active ? signalStrength : authorizedDeviceSignalStrength[key] ?? "--",
      active,
      device: active ? null : device,
    };
  });
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "right-start",
    middleware: [offset({ mainAxis: 24, crossAxis: 0 }), flip(), shift({ padding: 10 })],
    whileElementsMounted: autoUpdate,
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  return (
    <>
      <button ref={refs.setReference} type="button" className="settings-device-card-trigger" {...getReferenceProps()}>
        <span className="settings-device-card-icon" aria-hidden="true">
          <img src="/svg/ps5-controller-gamepad-seeklogo.svg" alt="" draggable={false} />
        </span>
        <span className="settings-device-card-copy">
          <strong>{deviceName}</strong>
        </span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>

      <FloatingPortal>
        {isOpen && (
          <Card ref={refs.setFloating} className="settings-device-popover" style={floatingStyles} {...getFloatingProps()}>
            <CardContent className="settings-device-popover-content">
              <div className="settings-device-popover-head">
                <strong>{t("device.selectDevice")}</strong>
                <span>{t("device.authorizedList")}</span>
              </div>
              <div className="settings-device-popover-list">
                {popoverDevices.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`settings-device-popover-item ${item.active ? "is-active" : ""}`}
                    onClick={() => {
                      if (item.device) {
                        void onSelectDevice(item.device);
                      }
                      setIsOpen(false);
                    }}
                  >
                    <span className="settings-device-popover-preview" aria-hidden="true">
                      <img src="/svg/ps5-controller-gamepad-seeklogo.svg" alt="" draggable={false} />
                    </span>
                    <span className="settings-device-popover-info">
                      <strong>{item.label}</strong>
                      <span className="settings-device-popover-row">
                        <CircleAlert size={15} aria-hidden="true" />
                        <span>{t("device.firmwareVersion", { version: item.firmwareVersion })}</span>
                      </span>
                      <span className="settings-device-popover-row">
                        <Radio size={15} aria-hidden="true" />
                        <span>{t("device.signalStrength", { signal: item.signalStrength })}</span>
                      </span>
                      <span className="settings-device-popover-row">
                        <BatteryFull size={15} aria-hidden="true" />
                        <span>{t("device.battery", { battery: item.batteryText })}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </FloatingPortal>
    </>
  );
}

function deviceKey(device: HIDDevice): string {
  return `${device.vendorId}:${device.productId}:${device.productName}`;
}

function deviceLabelFromDevice(device: HIDDevice): string {
  const productId = device.productId.toString(16).padStart(4, "0").toUpperCase();
  return `${device.productName || "DS5 Bridge"} · ${device.vendorId.toString(16).padStart(4, "0").toUpperCase()}:${productId}`;
}
