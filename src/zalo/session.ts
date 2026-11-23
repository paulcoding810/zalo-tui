import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { NotifyMode } from "../notify.ts";
import { Zalo, type API, type Credentials, type LoginQRCallback } from "zca-js";

export const stateDir = process.env.ZALO_TUI_HOME ?? join(homedir(), ".config", "zalo-tui");
const credentialsPath = join(stateDir, "credentials.json");
export const qrPath = join(stateDir, "qr.png");
const settingsPath = join(stateDir, "settings.json");

export type Settings = { notify?: NotifyMode };

export function loadSettings(): Settings {
  try {
    return JSON.parse(readFileSync(settingsPath, "utf8")) as Settings;
  } catch {
    return {};
  }
}

export function saveSettings(settings: Settings): void {
  ensureStateDir();
  writeFileSync(settingsPath, JSON.stringify(settings), { mode: 0o600 });
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

function createZalo(): Zalo {
  return new Zalo({ selfListen: true, checkUpdate: false, logging: false });
}

export function restore(credentials: Credentials): Promise<API> {
  return createZalo().login(credentials);
}

export function loginWithQR(callback: LoginQRCallback): Promise<API> {
  ensureStateDir();
  return createZalo().loginQR({ qrPath }, callback);
}
