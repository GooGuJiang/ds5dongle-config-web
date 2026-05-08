import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ConfigBody,
  ConfigDecodeError,
  DEFAULT_CONFIG,
  ConfigValidationIssue,
  configsEqual,
  normalizeConfig,
  validateConfig,
} from "../protocol/config";
import {
  Ds5BridgeHidClient,
  NO_DEVICE_SELECTED_ERROR,
  WEBHID_UNAVAILABLE_ERROR,
  getDeviceLabel,
  webHidAvailable,
} from "../protocol/ds5BridgeHid";

type Operation = "connecting" | "reading" | "applying" | "saving" | "reconnecting" | null;
type SaveState = "idle" | "dirty" | "applied" | "saved";
type UsbEffectiveConfig = Pick<ConfigBody, "pollingRateMode" | "controllerMode">;

export interface UseDs5BridgeResult {
  supported: boolean;
  client: Ds5BridgeHidClient | null;
  deviceLabel: string;
  batteryText: string;
  authorizedDeviceBatteryText: Record<string, string>;
  authorizedDevices: HIDDevice[];
  config: ConfigBody | null;
  draft: ConfigBody;
  issues: ConfigValidationIssue[];
  saveState: SaveState;
  operation: Operation;
  error: string | null;
  statusText: string;
  shouldReturnHome: boolean;
  isConnected: boolean;
  isDirty: boolean;
  isDefaultConfig: boolean;
  needsUsbReconnect: boolean;
  setDraftField: <Key extends keyof ConfigBody>(field: Key, value: ConfigBody[Key]) => void;
  refreshAuthorizedDevices: () => Promise<void>;
  connect: () => Promise<void>;
  connectAuthorized: (device: HIDDevice) => Promise<void>;
  readConfig: () => Promise<void>;
  saveToFlash: () => Promise<void>;
  reconnectUsb: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  clearReturnHome: () => void;
  clearError: () => void;
}

export function useDs5Bridge(): UseDs5BridgeResult {
  const { t } = useTranslation();
  const supported = webHidAvailable();
  const [client, setClient] = useState<Ds5BridgeHidClient | null>(null);
  const [authorizedDevices, setAuthorizedDevices] = useState<HIDDevice[]>([]);
  const [config, setConfig] = useState<ConfigBody | null>(null);
  const [draft, setDraft] = useState<ConfigBody>(DEFAULT_CONFIG);
  const [operation, setOperation] = useState<Operation>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsUsbReconnect, setNeedsUsbReconnect] = useState(false);
  const [shouldReturnHome, setShouldReturnHome] = useState(false);
  const [batteryText, setBatteryText] = useState("--");
  const [authorizedDeviceBatteryText, setAuthorizedDeviceBatteryText] = useState<Record<string, string>>({});
  const [settledStatusText, setSettledStatusText] = useState(t("status.ready"));
  const clientRef = useRef<Ds5BridgeHidClient | null>(null);
  const configRef = useRef<ConfigBody | null>(null);
  const draftRef = useRef<ConfigBody>(DEFAULT_CONFIG);
  const usbEffectiveConfigRef = useRef<UsbEffectiveConfig | null>(null);
  const applyingRef = useRef(false);
  const applyQueuedRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const savedStatusTimerRef = useRef<number | null>(null);
  const expectedUsbDisconnectRef = useRef(false);
  const requireManualSelectionRef = useRef(false);

  const issues = useMemo(() => validateConfig(draft), [draft]);
  const isConnected = Boolean(client?.device.opened);
  const isDirty = !configsEqual(config, draft);
  const isDefaultConfig = configsEqual(draft, DEFAULT_CONFIG);
  const deviceLabel = getDeviceLabel(client?.device ?? null);

  const statusText = useMemo(() => {
    if (!supported) {
      return t("status.webHidUnavailable");
    }
    if (operation) {
      return operationLabel(operation, t);
    }
    if (!client) {
      return t("status.ready");
    }
    if (saveState === "applied") {
      return t("status.applied");
    }
    if (saveState === "saved") {
      return t("status.saved");
    }
    return t("status.connected");
  }, [client, operation, saveState, supported, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledStatusText(statusText), 120);
    return () => window.clearTimeout(timer);
  }, [statusText]);

  const refreshAuthorizedDevices = useCallback(async () => {
    if (!supported) {
      setAuthorizedDevices([]);
      return;
    }

    if (requireManualSelectionRef.current) {
      setAuthorizedDevices([]);
      return;
    }

    setAuthorizedDevices(await Ds5BridgeHidClient.authorizedDevices());
  }, [supported]);

  const scanAuthorizedDeviceBattery = useCallback(async (devices: HIDDevice[]) => {
    const entries = await Promise.all(
      devices.map(async (device) => {
        if (clientRef.current?.device === device) {
          return [deviceKey(device), batteryText] as const;
        }

        const nextClient = new Ds5BridgeHidClient(device);
        try {
          await nextClient.open();
          const nextBatteryText = await listenForBatteryText(device, 900);
          await nextClient.close();
          return [deviceKey(device), nextBatteryText ?? "--"] as const;
        } catch {
          return [deviceKey(device), "--"] as const;
        }
      }),
    );

    setAuthorizedDeviceBatteryText(Object.fromEntries(entries));
  }, [batteryText]);

  const readConfigWithClient = useCallback(async (nextClient: Ds5BridgeHidClient, syncUsbEffectiveConfig = false) => {
    setOperation("reading");
    try {
      const nextConfig = normalizeConfig(await nextClient.readConfig());
      configRef.current = nextConfig;
      draftRef.current = nextConfig;
      if (syncUsbEffectiveConfig) {
        usbEffectiveConfigRef.current = pickUsbEffectiveConfig(nextConfig);
        setNeedsUsbReconnect(false);
      }
      setConfig(nextConfig);
      setDraft(nextConfig);
      setSaveState("idle");
      setError(null);
    } finally {
      setOperation(null);
    }
  }, []);

  const clearConnectedDevice = useCallback(() => {
    clientRef.current = null;
    configRef.current = null;
    draftRef.current = DEFAULT_CONFIG;
    usbEffectiveConfigRef.current = null;
    setClient(null);
    setConfig(null);
    setDraft(DEFAULT_CONFIG);
    setNeedsUsbReconnect(false);
    setSaveState("idle");
    setBatteryText("--");
  }, []);

  const attachClient = useCallback(
    async (nextClient: Ds5BridgeHidClient) => {
      setOperation("connecting");
      try {
        await nextClient.open();
        clientRef.current = nextClient;
        setClient(nextClient);
        setError(null);
      } finally {
        setOperation(null);
      }
      await readConfigWithClient(nextClient, true);
    },
    [readConfigWithClient],
  );

  const connect = useCallback(async () => {
    try {
      requireManualSelectionRef.current = false;
      await attachClient(await Ds5BridgeHidClient.requestDevice());
      await refreshAuthorizedDevices();
    } catch (cause) {
      if (isNoDeviceSelectedError(cause)) {
        setOperation(null);
        return;
      }

      setError(errorMessage(cause, t));
      setOperation(null);
    }
  }, [attachClient, refreshAuthorizedDevices, t]);

  const connectAuthorized = useCallback(
    async (device: HIDDevice) => {
      try {
        await attachClient(new Ds5BridgeHidClient(device));
      } catch (cause) {
        setError(errorMessage(cause, t));
        setOperation(null);
      }
    },
    [attachClient, t],
  );

  const readConfig = useCallback(async () => {
    if (!client) {
      return;
    }

    try {
      await readConfigWithClient(client);
    } catch (cause) {
      setError(errorMessage(cause, t));
      setOperation(null);
    }
  }, [client, readConfigWithClient, t]);

  const applyLatestDraft = useCallback(async (): Promise<boolean> => {
    if (applyingRef.current) {
      applyQueuedRef.current = true;
      return false;
    }

    applyingRef.current = true;
    setOperation("applying");
    try {
      while (true) {
        applyQueuedRef.current = false;

        const nextClient = clientRef.current;
        if (!nextClient) {
          break;
        }

        const nextDraft = normalizeConfig(draftRef.current);
        if (validateConfig(nextDraft).length > 0 || configsEqual(configRef.current, nextDraft)) {
          break;
        }

        await nextClient.applyConfig(nextDraft);
        configRef.current = nextDraft;
        setConfig(nextDraft);
        const currentUsbEffectiveConfig = usbEffectiveConfigRef.current;
        const pollingRateChanged = currentUsbEffectiveConfig?.pollingRateMode !== nextDraft.pollingRateMode;
        const needsReconnect = usbEffectiveConfigChanged(currentUsbEffectiveConfig, nextDraft);
        setSaveState("applied");
        setError(null);

        if (pollingRateChanged) {
          expectedUsbDisconnectRef.current = true;
          requireManualSelectionRef.current = true;
          setShouldReturnHome(true);
          try {
            await nextClient.reconnectUsb();
          } catch {
            // The device can close immediately after the reconnect command is sent.
            // This is expected for polling-rate changes, so keep the UI quiet and
            // require the user to select the device again manually.
          }
          clearConnectedDevice();
          setAuthorizedDevices([]);
          break;
        } else if (needsReconnect) {
          setNeedsUsbReconnect(true);
        } else {
          setNeedsUsbReconnect(false);
        }

        if (configsEqual(draftRef.current, nextDraft)) {
          draftRef.current = nextDraft;
          setDraft(nextDraft);
        }

        if (!applyQueuedRef.current && configsEqual(configRef.current, draftRef.current)) {
          break;
        }
      }
    } catch (cause) {
      setError(errorMessage(cause, t));
      return false;
    } finally {
      applyingRef.current = false;
      setOperation(null);
    }

    return true;
  }, [clearConnectedDevice, t]);

  const saveToFlash = useCallback(async () => {
    const nextClient = clientRef.current;
    if (!nextClient || !configsEqual(configRef.current, draftRef.current)) {
      return;
    }

    setOperation("saving");
    try {
      await nextClient.saveToFlash();
      setSaveState("saved");
      if (savedStatusTimerRef.current !== null) {
        window.clearTimeout(savedStatusTimerRef.current);
      }
      savedStatusTimerRef.current = window.setTimeout(() => {
        setSaveState("idle");
        savedStatusTimerRef.current = null;
      }, 900);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setOperation(null);
    }
  }, [t]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(async () => {
      autoSaveTimerRef.current = null;
      const applied = await applyLatestDraft();
      if (applied && configsEqual(configRef.current, draftRef.current)) {
        await saveToFlash();
      }
    }, 180);
  }, [applyLatestDraft, saveToFlash]);

  const reconnectUsb = useCallback(async () => {
    if (!client) {
      return;
    }

    setOperation("reconnecting");
    try {
      await client.reconnectUsb();
      usbEffectiveConfigRef.current = pickUsbEffectiveConfig(configRef.current ?? draftRef.current);
      setNeedsUsbReconnect(false);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setOperation(null);
    }
  }, [client, t]);

  const setDraftField = useCallback(
    <Key extends keyof ConfigBody>(field: Key, value: ConfigBody[Key]) => {
      const nextDraft = { ...draftRef.current, [field]: value };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      setSaveState("dirty");
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  const resetToDefaults = useCallback(async () => {
    const nextClient = clientRef.current;
    if (!nextClient) {
      return;
    }

    draftRef.current = DEFAULT_CONFIG;
    setDraft(DEFAULT_CONFIG);
    setSaveState("dirty");

    const applied = await applyLatestDraft();
    if (!applied || !configsEqual(configRef.current, DEFAULT_CONFIG)) {
      return;
    }

    setOperation("saving");
    try {
      await nextClient.saveToFlash();
      setSaveState("saved");
      if (savedStatusTimerRef.current !== null) {
        window.clearTimeout(savedStatusTimerRef.current);
      }
      savedStatusTimerRef.current = window.setTimeout(() => {
        setSaveState("idle");
        savedStatusTimerRef.current = null;
      }, 900);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setOperation(null);
    }
  }, [applyLatestDraft, t]);

  useEffect(() => {
    void refreshAuthorizedDevices();
  }, [refreshAuthorizedDevices]);

  useEffect(() => {
    if (authorizedDevices.length === 0) {
      setAuthorizedDeviceBatteryText({});
      return;
    }

    void scanAuthorizedDeviceBattery(authorizedDevices);
  }, [authorizedDevices, scanAuthorizedDeviceBattery]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      if (savedStatusTimerRef.current !== null) {
        window.clearTimeout(savedStatusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!navigator.hid) {
      return;
    }

    const handleDisconnect = (event: HIDConnectionEvent) => {
      if (client?.device === event.device) {
        clearConnectedDevice();
        if (expectedUsbDisconnectRef.current) {
          expectedUsbDisconnectRef.current = false;
          setError(null);
        } else {
          setError(t("errors.disconnected"));
        }
      }
      void refreshAuthorizedDevices();
    };

    const handleConnect = () => {
      void refreshAuthorizedDevices();
    };

    navigator.hid.addEventListener("disconnect", handleDisconnect);
    navigator.hid.addEventListener("connect", handleConnect);

    return () => {
      navigator.hid?.removeEventListener("disconnect", handleDisconnect);
      navigator.hid?.removeEventListener("connect", handleConnect);
    };
  }, [clearConnectedDevice, client, refreshAuthorizedDevices, t]);

  useEffect(() => {
    const device = client?.device;
    if (!device) {
      setBatteryText("--");
      return;
    }

    const handleInputReport = (event: HIDInputReportEvent) => {
      if (event.device !== device) {
        return;
      }

      const nextBatteryText = parseDualSenseBatteryText(event.data, event.reportId);
      if (nextBatteryText) {
        setBatteryText(nextBatteryText);
      }
    };

    device.addEventListener("inputreport", handleInputReport);

    return () => {
      device.removeEventListener("inputreport", handleInputReport);
    };
  }, [client]);

  return {
    supported,
    client,
    deviceLabel,
    batteryText,
    authorizedDeviceBatteryText,
    authorizedDevices,
    config,
    draft,
    issues,
    saveState,
    operation,
    error,
    statusText: settledStatusText,
    shouldReturnHome,
    isConnected,
    isDirty,
    isDefaultConfig,
    needsUsbReconnect,
    setDraftField,
    refreshAuthorizedDevices,
    connect,
    connectAuthorized,
    readConfig,
    saveToFlash,
    reconnectUsb,
    resetToDefaults,
    clearReturnHome: () => setShouldReturnHome(false),
    clearError: () => setError(null),
  };
}

function deviceKey(device: HIDDevice): string {
  return `${device.vendorId}:${device.productId}:${device.productName}`;
}

function listenForBatteryText(device: HIDDevice, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      device.removeEventListener("inputreport", handleInputReport);
      resolve(null);
    }, timeoutMs);

    const handleInputReport = (event: HIDInputReportEvent) => {
      if (event.device !== device) {
        return;
      }

      const nextBatteryText = parseDualSenseBatteryText(event.data, event.reportId);
      if (!nextBatteryText) {
        return;
      }

      window.clearTimeout(timeout);
      device.removeEventListener("inputreport", handleInputReport);
      resolve(nextBatteryText);
    };

    device.addEventListener("inputreport", handleInputReport);
  });
}

function parseDualSenseBatteryText(data: DataView, reportId: number): string | null {
  const status0Offset = reportId === 0x31 ? 53 : 52;
  if (data.byteLength <= status0Offset) {
    return null;
  }

  const status0 = data.getUint8(status0Offset);
  const chargeStatus = (status0 & 0xf0) >> 4;
  let level = status0 & 0x0f;

  if (chargeStatus === 2) {
    level = 10;
  }

  if (level >= 10) {
    return "100%";
  }

  if (level >= 0) {
    return `${Math.min(level * 10 + 5, 100)}%`;
  }

  return null;
}

function operationLabel(operation: Exclude<Operation, null>, t: (key: string) => string): string {
  switch (operation) {
    case "connecting":
      return t("status.connecting");
    case "reading":
      return t("status.reading");
    case "applying":
      return t("status.applying");
    case "saving":
      return t("status.saving");
    case "reconnecting":
      return t("status.reconnecting");
  }
}

function pickUsbEffectiveConfig(config: ConfigBody): UsbEffectiveConfig {
  return {
    pollingRateMode: config.pollingRateMode,
    controllerMode: config.controllerMode,
  };
}

function usbEffectiveConfigChanged(current: UsbEffectiveConfig | null, next: ConfigBody): boolean {
  if (!current) {
    return false;
  }

  return current.pollingRateMode !== next.pollingRateMode || current.controllerMode !== next.controllerMode;
}

function errorMessage(cause: unknown, t: (key: string, values?: Record<string, unknown>) => string): string {
  if (cause instanceof ConfigDecodeError) {
    if (cause.code === "invalidConfig") {
      const fields = Array.isArray(cause.values.issues) ? cause.values.issues : [];
      const issues = fields.map((field) => t(`validation.${String(field)}`)).join("; ");

      return t("errors.invalidConfig", { issues });
    }

    return t("errors.invalidBytes", cause.values);
  }

  if (cause instanceof Error) {
    if (cause.message === NO_DEVICE_SELECTED_ERROR) {
      return t("errors.noDeviceSelected");
    }

    if (cause.message === WEBHID_UNAVAILABLE_ERROR) {
      return t("errors.webHidUnavailable");
    }

    return cause.message;
  }

  return t("errors.unexpectedWebHid");
}

function isNoDeviceSelectedError(cause: unknown): boolean {
  return cause instanceof Error && cause.message === NO_DEVICE_SELECTED_ERROR;
}
