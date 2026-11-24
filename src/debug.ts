import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { ensureStateDir, stateDir } from "./zalo/session.ts";

const enabled = !!process.env.ZALO_TUI_DEBUG;

export function debugLog(line: string): void {
  if (!enabled) return;
  try {
    ensureStateDir();
    appendFileSync(join(stateDir, "debug.log"), `${new Date().toISOString()} ${line}\n`, { mode: 0o600 });
  } catch {}
}
