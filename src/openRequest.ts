import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KEY = /^(user|group):\d+$/;

export function openRequestFile(dir: string, pid: number = process.pid): string {
  return join(dir, `open-${pid}`);
}

export function runningMarker(dir: string, pid: number = process.pid): string {
  return join(dir, `running-${pid}`);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function openChatCommand(key: string, dir: string, pid: number = process.pid): string | null {
  if (!KEY.test(key)) return null;
  const marker = shellQuote(runningMarker(dir, pid));
  return `[ -e ${marker} ] && printf %s ${key} > ${shellQuote(openRequestFile(dir, pid))} && kill -USR2 ${pid}`;
}

export function readOpenRequest(file: string): string | null {
  let key: string;
  try {
    key = readFileSync(file, "utf8").trim();
  } catch {
    return null;
  }
  rmSync(file, { force: true });
  return KEY.test(key) ? key : null;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function removeStaleRequests(dir: string): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const match = /^(?:open|running)-(\d+)$/.exec(name);
    if (match && Number(match[1]) !== process.pid && !isAlive(Number(match[1]))) rmSync(join(dir, name), { force: true });
  }
}

export function listenForOpenRequests(dir: string, onOpen: (key: string) => void): () => void {
  const file = openRequestFile(dir);
  const marker = runningMarker(dir);
  removeStaleRequests(dir);
  const handler = () => {
    const key = readOpenRequest(file);
    if (key) onOpen(key);
  };
  process.on("SIGUSR2", handler);
  try {
    writeFileSync(marker, "", { mode: 0o600 });
  } catch {}
  return () => {
    process.off("SIGUSR2", handler);
    rmSync(marker, { force: true });
    rmSync(file, { force: true });
  };
}
