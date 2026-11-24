import { parseAttachment, type AttachmentRequest } from "./attachment.ts";

export type InputAction =
  | { kind: "text"; text: string }
  | { kind: "attachment"; request: AttachmentRequest }
  | { kind: "help" }
  | { kind: "error"; message: string };

export const COMMANDS = ["photo", "file", "help"];

export function classifyInput(text: string, isFile: (path: string) => boolean, home?: string): InputAction {
  if (text.startsWith("//")) return { kind: "text", text: text.slice(1) };
  const attachment = parseAttachment(text, isFile, home);
  if (attachment) return "error" in attachment ? { kind: "error", message: attachment.error } : { kind: "attachment", request: attachment };
  const command = /^\/([a-z]+)(?:\s|$)/i.exec(text);
  if (!command) return { kind: "text", text };
  if (command[1]!.toLowerCase() === "help") return { kind: "help" };
  return { kind: "error", message: `unknown command /${command[1]} · /help lists commands · start with // to send text beginning with /` };
}
