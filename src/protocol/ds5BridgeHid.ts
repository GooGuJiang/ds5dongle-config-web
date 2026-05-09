import {
  ConfigBody,
  FEATURE_REPORT_PAYLOAD_SIZE,
  decodeConfigBody,
  encodeConfigBody,
} from "./config";

export const SONY_VENDOR_ID = 0x054c;
export const SUPPORTED_PRODUCT_IDS = [0x0ce6, 0x0df2] as const;
export const NO_DEVICE_SELECTED_ERROR = "noDeviceSelected";
export const WEBHID_UNAVAILABLE_ERROR = "webHidUnavailable";

const REPORT_SET_CONFIG = 0xf6;
const REPORT_GET_CONFIG = 0xf7;
const REPORT_COMMAND = 0x80;
const REPORT_RESULT = 0x81;
const CMD_UPDATE_CONFIG = 0x01;
const CMD_SAVE_TO_FLASH = 0x02;
const CMD_RECONNECT_USB = 0x03;
const DEVICE_SYSTEM = 0x01;
const ACTION_READ_SERIAL_NUMBER = 0x13;
const SERIAL_NUMBER_SIZE = 32;
const FEATURE_REPORT_DEFAULT_PAYLOAD_SIZE = FEATURE_REPORT_PAYLOAD_SIZE;
const FEATURE_REPORT_CHECKSUM_SIZE = 4;
const FEATURE_REPORT_CHECKSUM_PREFIX = 0x53;

export class Ds5BridgeHidClient {
  constructor(public readonly device: HIDDevice) {}

  static isSupportedDevice(device: HIDDevice): boolean {
    return device.vendorId === SONY_VENDOR_ID && SUPPORTED_PRODUCT_IDS.includes(device.productId as 0x0ce6 | 0x0df2);
  }

  static async requestDevice(): Promise<Ds5BridgeHidClient> {
    const hid = getHid();
    const devices = await hid.requestDevice({
      filters: SUPPORTED_PRODUCT_IDS.map((productId) => ({
        vendorId: SONY_VENDOR_ID,
        productId,
      })),
    });

    const device = devices.find(Ds5BridgeHidClient.isSupportedDevice);
    if (!device) {
      throw new Error(NO_DEVICE_SELECTED_ERROR);
    }

    return new Ds5BridgeHidClient(device);
  }

  static async authorizedDevices(): Promise<HIDDevice[]> {
    const devices = await getHid().getDevices();
    return devices.filter(Ds5BridgeHidClient.isSupportedDevice);
  }

  async open(): Promise<void> {
    if (!this.device.opened) {
      await this.device.open();
    }
  }

  async close(): Promise<void> {
    if (this.device.opened) {
      await this.device.close();
    }
  }

  async readConfig(): Promise<ConfigBody> {
    await this.open();
    const report = await this.device.receiveFeatureReport(REPORT_GET_CONFIG);
    return decodeConfigBody(report);
  }

  async applyConfig(config: ConfigBody): Promise<void> {
    await this.open();
    const body = encodeConfigBody(config);
    const report = commandReport(CMD_UPDATE_CONFIG);
    report.set(body, 1);
    await this.device.sendFeatureReport(REPORT_SET_CONFIG, report);
  }

  async saveToFlash(): Promise<void> {
    await this.open();
    await this.device.sendFeatureReport(REPORT_SET_CONFIG, commandReport(CMD_SAVE_TO_FLASH));
  }

  async reconnectUsb(): Promise<void> {
    await this.open();
    await this.device.sendFeatureReport(REPORT_SET_CONFIG, commandReport(CMD_RECONNECT_USB));
  }

  async readSerialNumber(): Promise<string> {
    await this.open();

    const reportLength = featureReportPayloadSize(this.device, REPORT_COMMAND);
    const payload = new Uint8Array(new ArrayBuffer(reportLength));
    payload[0] = DEVICE_SYSTEM;
    payload[1] = ACTION_READ_SERIAL_NUMBER;

    if (isBluetoothFeatureReport(reportLength)) {
      fillFeatureReportChecksum(REPORT_COMMAND, payload);
    }

    await this.device.sendFeatureReport(REPORT_COMMAND, payload);

    while (true) {
      const report = await this.device.receiveFeatureReport(REPORT_RESULT);

      if (isSerialNumberResult(report)) {
        return decodeSerialNumber(new DataView(report.buffer, report.byteOffset + 4, SERIAL_NUMBER_SIZE));
      }

      await sleep(10);
    }
  }
}

export function webHidAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.hid);
}

export function getDeviceLabel(device: HIDDevice | null): string {
  if (!device) {
    return "No device";
  }

  const productId = device.productId.toString(16).padStart(4, "0").toUpperCase();
  return `${device.productName || "DS5 Bridge"} · 054C:${productId}`;
}

function getHid(): HID {
  if (!navigator.hid) {
    throw new Error(WEBHID_UNAVAILABLE_ERROR);
  }

  return navigator.hid;
}

function commandReport(command: number): Uint8Array<ArrayBuffer> {
  const report = new Uint8Array(new ArrayBuffer(FEATURE_REPORT_PAYLOAD_SIZE));
  report[0] = command;
  return report;
}

function featureReportPayloadSize(device: HIDDevice, reportId: number): number {
  return (
    device.collections
      .flatMap((collection) => collection.featureReports ?? [])
      .find((report) => report.reportId === reportId)
      ?.items?.[0]?.reportCount ?? FEATURE_REPORT_DEFAULT_PAYLOAD_SIZE
  );
}

function isBluetoothFeatureReport(reportLength: number): boolean {
  return reportLength > FEATURE_REPORT_DEFAULT_PAYLOAD_SIZE;
}

function isSerialNumberResult(report: DataView): boolean {
  return (
    report.byteLength >= SERIAL_NUMBER_SIZE + 4 &&
    report.getUint8(0) === REPORT_RESULT &&
    report.getUint8(1) === DEVICE_SYSTEM &&
    report.getUint8(2) === ACTION_READ_SERIAL_NUMBER
  );
}

function decodeSerialNumber(data: DataView): string {
  return new TextDecoder("shift_jis").decode(data).replace(/\0/g, "").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function fillFeatureReportChecksum(reportId: number, reportData: Uint8Array): void {
  if (reportData.byteLength <= FEATURE_REPORT_CHECKSUM_SIZE) {
    return;
  }

  const body = new DataView(reportData.buffer, reportData.byteOffset, reportData.byteLength - FEATURE_REPORT_CHECKSUM_SIZE);
  const crc = crc32([FEATURE_REPORT_CHECKSUM_PREFIX, reportId], body);

  reportData[reportData.byteLength - 4] = crc & 0xff;
  reportData[reportData.byteLength - 3] = (crc >>> 8) & 0xff;
  reportData[reportData.byteLength - 2] = (crc >>> 16) & 0xff;
  reportData[reportData.byteLength - 1] = (crc >>> 24) & 0xff;
}

function crc32(prefixBytes: number[], dataView: DataView): number {
  let crc = -1 >>> 0;

  for (const byte of prefixBytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }

  for (let i = 0; i < dataView.byteLength; ++i) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ dataView.getUint8(i)) & 0xff];
  }

  return (crc ^ -1) >>> 0;
}

function makeCrcTable(): number[] {
  const table: number[] = [];

  for (let n = 0; n < 256; ++n) {
    let c = n;

    for (let k = 0; k < 8; ++k) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
}

const crcTable = makeCrcTable();
