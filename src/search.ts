import type { ChatMessage } from "./store.ts";

export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

export function messageMatches(m: ChatMessage, query: string): boolean {
  const q = fold(query.trim());
  if (!q || m.recalled) return false;
  return fold(m.text).includes(q) || (!!m.url && fold(m.url).includes(q));
}

export function searchMessages(messages: ChatMessage[], query: string): string[] {
  return messages.filter((m) => messageMatches(m, query)).map((m) => m.id);
}

export function stepMatch(matches: string[], messages: ChatMessage[], fromId: string | null, direction: -1 | 1): string | null {
  if (matches.length === 0) return null;
  const order = new Map(messages.map((m, i) => [m.id, i]));
  const from = fromId !== null && order.has(fromId) ? order.get(fromId)! : direction < 0 ? messages.length : -1;
  if (direction < 0) {
    for (let i = matches.length - 1; i >= 0; i--) if (order.get(matches[i]!)! < from) return matches[i]!;
    return matches[matches.length - 1]!;
  }
  for (const id of matches) if (order.get(id)! > from) return id;
  return matches[0]!;
}
