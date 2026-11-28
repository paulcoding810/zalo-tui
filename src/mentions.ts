import { fold } from "./search.ts";

export type Member = { uid: string; name: string };
export type Mention = { pos: number; uid: string; len: number };

export const EVERYONE: Member = { uid: "-1", name: "All" };

export function mentionQuery(chars: string[], cursor: number): { start: number; query: string } | null {
  let i = cursor;
  while (i > 0 && chars[i - 1] !== "@" && !/\s/.test(chars[i - 1]!)) i--;
  if (i === 0 || chars[i - 1] !== "@") return null;
  if (i > 1 && !/\s/.test(chars[i - 2]!)) return null;
  return { start: i - 1, query: chars.slice(i, cursor).join("") };
}

export function filterMembers(members: Member[], query: string, limit = 5): Member[] {
  const q = fold(query);
  const starts: Member[] = [];
  const contains: Member[] = [];
  for (const m of members) {
    const name = fold(m.name);
    if (!q || name.startsWith(q) || name.split(/\s+/).some((w) => w.startsWith(q))) starts.push(m);
    else if (name.includes(q)) contains.push(m);
  }
  return [...starts, ...contains].slice(0, limit);
}

export function mentionPositions(text: string, picks: Member[]): Mention[] {
  const used = new Set<number>();
  const out: Mention[] = [];
  for (const pick of picks) {
    const token = `@${pick.name}`;
    let from = 0;
    while (true) {
      const pos = text.indexOf(token, from);
      if (pos === -1) break;
      from = pos + 1;
      const after = text[pos + token.length];
      if (used.has(pos) || (after !== undefined && /[\p{L}\p{N}_]/u.test(after))) continue;
      used.add(pos);
      out.push({ pos, uid: pick.uid, len: token.length });
      break;
    }
  }
  return out.sort((a, b) => a.pos - b.pos);
}
