import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { GroupNotify, NotifyMode } from "../notify.ts";
import type { Activity, ReadState } from "../store.ts";
import { imageSizeFromFile } from "image-size/fromFile";
import { statSync } from "node:fs";
import { Zalo, type API, type Credentials, type LoginQRCallback } from "zca-js";

export const stateDir = process.env.ZALO_TUI_HOME ?? join(homedir(), ".config", "zalo-tui");
const credentialsPath = join(stateDir, "credentials.json");
export const qrPath = join(stateDir, "qr.png");
const settingsPath = join(stateDir, "settings.json");

export type Settings = { notify?: NotifyMode; notifyGroups?: GroupNotify };

export function loadSettings(): Settings {
  try {
    return JSON.parse(readFileSync(settingsPath, "utf8")) as Settings;
  } catch {
    return {};
  }
}

export function saveSettings(settings: Settings): void {
  ensureStateDir();
  writeFileSync(settingsPath, JSON.stringify({ ...loadSettings(), ...settings }), { mode: 0o600 });
}

const activityPath = join(stateDir, "activity.json");

export function loadActivity(): Activity {
  try {
    return JSON.parse(readFileSync(activityPath, "utf8")) as Activity;
  } catch {
    return {};
  }
}

export function saveActivity(activity: Activity): void {
  ensureStateDir();
  writeFileSync(activityPath, JSON.stringify(activity), { mode: 0o600 });
}

const readPath = join(stateDir, "read.json");

export function loadReadState(): ReadState | null {
  try {
    const value = JSON.parse(readFileSync(readPath, "utf8")) as ReadState;
    return value && typeof value.since === "number" && value.chats && typeof value.chats === "object" ? value : null;
  } catch {
    return null;
  }
}

export function saveReadState(read: ReadState): void {
  ensureStateDir();
  writeFileSync(readPath, JSON.stringify(read), { mode: 0o600 });
}

export function ensureStateDir(): void {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  chmodSync(stateDir, 0o700);
}

export function loadCredentials(): Credentials | null {
  if (!existsSync(credentialsPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(credentialsPath, "utf8")) as Credentials;
    return parsed.imei && parsed.cookie && parsed.userAgent ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCredentials(credentials: Credentials): void {
  ensureStateDir();
  writeFileSync(credentialsPath, JSON.stringify(credentials), { mode: 0o600 });
  chmodSync(credentialsPath, 0o600);
}

export function clearCredentials(): void {
  rmSync(credentialsPath, { force: true });
}

async function imageMetadataGetter(filePath: string) {
  try {
    const { width, height } = await imageSizeFromFile(filePath);
    if (!width || !height) return null;
    return { width, height, size: statSync(filePath).size };
  } catch {
    return null;
  }
}

function createZalo(): Zalo {
  return new Zalo({ selfListen: true, checkUpdate: false, logging: false, imageMetadataGetter });
}

export function restore(credentials: Credentials): Promise<API> {
  return createZalo().login(credentials);
}

export function loginWithQR(callback: LoginQRCallback): Promise<API> {
  ensureStateDir();
  return createZalo().loginQR({ qrPath }, callback);
}
