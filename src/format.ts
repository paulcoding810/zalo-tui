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
  return cleanText(rawMessageText(data));
}

function rawMessageText(data: { msgType?: string; content: Content }): string {
  const { content, msgType = "" } = data;
  if (typeof content === "string") return content;
  const label = LABELS[msgType] ?? (msgType.replace(/^chat\./, "") || "message");
  if (!content || typeof content !== "object") return `[${label}]`;
  const title = str(content.title);
  const href = str(content.href);
  if (label === "link") return ["[link]", title === href ? "" : title, href].filter(Boolean).join(" ");
  return title ? `[${label}] ${title}` : `[${label}]`;
}

function webUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  return /^https?:\/\/[^\s\u0000-\u001f\u007f-\u009f]+$/.test(url) ? url : undefined;
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

export function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");
}

export type WrappedLine = { text: string; start: number };

export function wrapWithOffsets(text: string, width: number): WrappedLine[] {
  if (width <= 0) return [{ text, start: 0 }];
  const out: WrappedLine[] = [];
  let base = 0;
  for (const paragraph of text.split("\n")) {
    const chars = Array.from(paragraph);
    let start = 0;
    while (chars.length - start > width) {
      const space = chars.lastIndexOf(" ", start + width);
      const end = space > start ? space : start + width;
      out.push({ text: chars.slice(start, end).join(""), start: base + start });
      start = space > start ? end + 1 : end;
    }
    out.push({ text: chars.slice(start).join(""), start: base + start });
    base += chars.length + 1;
  }
  return out;
}

export function wrapText(text: string, width: number): string[] {
  return wrapWithOffsets(text, width).map((l) => l.text);
}

export type LinkRange = { start: number; end: number; url: string };
export type Segment = { text: string; url?: string };

export function textLinkRanges(text: string): LinkRange[] {
  return findLinks(text).map((l) => {
    const start = Array.from(text.slice(0, l.start)).length;
    return { start, end: start + Array.from(text.slice(l.start, l.end)).length, url: l.url };
  });
}

export function linkSegments(line: WrappedLine, ranges: LinkRange[]): Segment[] {
  const chars = Array.from(line.text);
  const segments: Segment[] = [];
  chars.forEach((c, i) => {
    const at = line.start + i;
    const url = ranges.find((r) => at >= r.start && at < r.end)?.url;
    const last = segments[segments.length - 1];
    if (last && last.url === url) last.text += c;
    else segments.push(url ? { text: c, url } : { text: c });
  });
  return segments.length ? segments : [{ text: "" }];
}

export function hyperlink(url: string, text: string): string {
  const safe = cleanText(url);
  return `\u001b]8;;${safe}\u0007${text}\u001b]8;;\u0007`;
}
