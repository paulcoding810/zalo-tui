import { homedir } from "node:os";
import { basename, extname } from "node:path";

export const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export type AttachmentRequest = {
  path: string;
  caption: string;
  kind: "photo" | "file";
  confirm: boolean;
};

export type ParseResult = AttachmentRequest | { error: string } | null;

function readPath(input: string): { path: string; rest: string } | null {
  const text = input.trimStart();
  if (!text) return null;
  const quote = text[0];
  if (quote === "'" || quote === '"') {
    const end = text.indexOf(quote, 1);
    if (end === -1) return null;
    return { path: text.slice(1, end), rest: text.slice(end + 1) };
  }
  let path = "";
  let i = 0;
  for (; i < text.length; i++) {
    const c = text[i]!;
    if (c === "\\" && i + 1 < text.length) {
      path += text[++i];
      continue;
    }
    if (/\s/.test(c)) break;
    path += c;
  }
  return { path, rest: text.slice(i) };
}

function expandHome(path: string, home: string): string {
  if (path === "~") return home;
  return path.startsWith("~/") ? home + path.slice(1) : path;
}

export function attachmentKind(path: string): "photo" | "file" {
  return PHOTO_EXTENSIONS.includes(extname(path).slice(1).toLowerCase()) ? "photo" : "file";
}

export function parseAttachment(
  text: string,
  exists: (path: string) => boolean,
  home: string = homedir(),
): ParseResult {
  const command = /^\/(photo|file)(?:\s+|$)/.exec(text);
  if (command) {
    const parsed = readPath(text.slice(command[0].length));
    if (!parsed || !parsed.path) return { error: `usage: /${command[1]} <path> [caption]` };
    const path = expandHome(parsed.path, home);
    if (!exists(path)) return { error: `file not found: ${parsed.path}` };
    const kind = command[1] === "photo" ? "photo" : "file";
    if (kind === "photo" && attachmentKind(path) !== "photo") {
      return { error: `not a photo (${PHOTO_EXTENSIONS.join(", ")}): ${basename(path)}` };
    }
    return { path, caption: parsed.rest.trim(), kind, confirm: false };
  }
  const trimmed = text.trim();
  if (!trimmed.startsWith("/") && !trimmed.startsWith("~") && !trimmed.startsWith("'/") && !trimmed.startsWith('"/')) {
    return null;
  }
  const parsed = readPath(trimmed);
  if (!parsed || !parsed.path || parsed.rest.trim()) return null;
  const path = expandHome(parsed.path, home);
  if (!exists(path)) return null;
  return { path, caption: "", kind: attachmentKind(path), confirm: true };
}
