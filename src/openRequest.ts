import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const KEY = /^(user|group):\d+$/;

export function openRequestFile(dir: string, pid: number = process.pid): string {
  return join(dir, `open-${pid}`);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function openChatCommand(key: string, file: string, pid: number = process.pid): string | null {
  if (!KEY.test(key)) return null;
  return `printf %s ${key} > ${shellQuote(file)} && kill -USR2 ${pid}`;
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

export function listenForOpenRequests(file: string, onOpen: (key: string) => void): () => void {
  const handler = () => {
    const key = readOpenRequest(file);
    if (key) onOpen(key);
  };
  process.on("SIGUSR2", handler);
  return () => {
    process.off("SIGUSR2", handler);
    rmSync(file, { force: true });
  };
}
