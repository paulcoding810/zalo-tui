import { spawn } from "node:child_process";

export function openUrl(url: string): boolean {
  if (!/^https?:\/\//.test(url)) return false;
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? null : "xdg-open";
  if (!command) return false;
  try {
    const child = spawn(command, [url], { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
