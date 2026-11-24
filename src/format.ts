type Content = string | Record<string, unknown> | null | undefined;

const LABELS: Record<string, string> = {
  "chat.photo": "photo",
  "chat.sticker": "sticker",
  "chat.gif": "gif",
  "chat.video.msg": "video",
  "chat.voice": "voice",
  "chat.doodle": "drawing",
  "chat.location.new": "location",
  "chat.recommended": "link",
  "chat.link": "link",
  "share.file": "file",
  "chat.webcontent": "card",
  "chat.todo": "todo",
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function messageText(data: { msgType?: string; content: Content }): string {
  const { content, msgType = "" } = data;
  if (typeof content === "string") return content;
  const label = LABELS[msgType] ?? (msgType.replace(/^chat\./, "") || "message");
  if (!content || typeof content !== "object") return `[${label}]`;
  const title = str(content.title);
  const href = str(content.href);
  if (label === "link") return ["[link]", title, href].filter(Boolean).join(" ");
  return title ? `[${label}] ${title}` : `[${label}]`;
}

function webUrl(value: unknown): string | undefined {
  return typeof value === "string" && /^https?:\/\//.test(value.trim()) ? value.trim() : undefined;
}

export function attachmentUrl(content: Content): string | undefined {
  if (!content || typeof content !== "object") return undefined;
  return webUrl(content.href) ?? webUrl(content.thumb);
}

export type LinkMatch = { start: number; end: number; url: string };

function trimLink(raw: string): string {
  let link = raw.replace(/[.,;:!?'"]+$/, "");
  while (link.endsWith(")") && (link.match(/\(/g)?.length ?? 0) < (link.match(/\)/g)?.length ?? 0)) {
    link = link.slice(0, -1).replace(/[.,;:!?'"]+$/, "");
  }
  return link;
}

export function findLinks(text: string): LinkMatch[] {
  const out: LinkMatch[] = [];
  for (const m of text.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"]+/gi)) {
    const raw = trimLink(m[0]);
    if (raw.length < 5) continue;
    const start = m.index ?? 0;
    const url = /^www\./i.test(raw) ? `https://${raw}` : raw;
    out.push({ start, end: start + raw.length, url });
  }
  return out;
}

export function messageLinks(message: { url?: string; text: string; recalled?: boolean }): string[] {
  if (message.recalled) return [];
  const urls = [message.url, ...findLinks(message.text).map((l) => l.url)].filter((u): u is string => !!u);
  return [...new Set(urls)];
}

const REACTION_ICONS: Record<string, string> = {
  "/-heart": "❤",
  "/-strong": "👍",
  ":>": "😆",
  ":o": "😮",
  ":-((": "😭",
  ":-h": "😡",
  ":-*": "😘",
  ":')": "😂",
  "/-weak": "👎",
  "/-rose": "🌹",
  "/-break": "💔",
  "/-ok": "👌",
  "_()_": "🙏",
  "/-thanks": "🙏",
  "/-v": "✌",
  ":handclap": "👏",
};

export function reactionIcon(code: string): string {
  return REACTION_ICONS[code] ?? code;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatTime(ts: number, now: Date = new Date()): string {
  const d = new Date(ts);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? hm : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hm}`;
}

export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const chars = Array.from(paragraph);
    if (chars.length === 0) {
      out.push("");
      continue;
    }
    let start = 0;
    while (chars.length - start > width) {
      const space = chars.lastIndexOf(" ", start + width);
      const end = space > start ? space : start + width;
      out.push(chars.slice(start, end).join(""));
      start = space > start ? end + 1 : end;
    }
    out.push(chars.slice(start).join(""));
  }
  return out;
}
