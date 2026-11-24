import { Reactions } from "zca-js";

const EMOJI: Record<string, string> = {
  HEART: "❤", LIKE: "👍", HAHA: "😆", WOW: "😮", CRY: "😭", ANGRY: "😡", KISS: "😘", TEARS_OF_JOY: "😂",
  SHIT: "💩", ROSE: "🌹", BROKEN_HEART: "💔", DISLIKE: "👎", LOVE: "😍", CONFUSED: "😕", WINK: "😉", FADE: "🥀",
  SUN: "☀", BIRTHDAY: "🎂", BOMB: "💣", OK: "👌", PEACE: "✌", THANKS: "🤝", PUNCH: "👊", SHARE: "↪",
  PRAY: "🙏", NO: "🙅", BAD: "😖", LOVE_YOU: "🥰", SAD: "😓", VERY_SAD: "😢", COOL: "😎", NERD: "🤓",
  BIG_SMILE: "😁", SUNGLASSES: "🕶", NEUTRAL: "😐", SAD_FACE: "☹", BYE: "👋", SLEEPY: "😴", WIPE: "😅",
  DIG: "🤪", ANGUISH: "😫", HANDCLAP: "👏", ANGRY_FACE: "😠", F_CHAIR: "🪑", L_CHAIR: "🪑", R_CHAIR: "🪑",
  SILENT: "🤐", SURPRISE: "😲", EMBARRASSED: "😳", AFRAID: "😨", SAD2: "😞", BIG_LAUGH: "🤣", RICH: "🤑", BEER: "🍺",
};

export type ReactionOption = { code: string; name: string; emoji: string };

export const REACTIONS: ReactionOption[] = Object.entries(Reactions)
  .filter(([key, code]) => key !== "NONE" && typeof code === "string" && code)
  .map(([key, code]) => ({ code: code as string, name: key.toLowerCase().replace(/_/g, " "), emoji: EMOJI[key] ?? code }));

const BY_CODE = new Map(REACTIONS.map((r) => [r.code, r]));

export function reactionIcon(code: string): string {
  return BY_CODE.get(code)?.emoji ?? code;
}

export function searchReactions(query: string): ReactionOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return REACTIONS;
  const starts = REACTIONS.filter((r) => r.name.startsWith(q) || r.name.split(" ").some((w) => w.startsWith(q)));
  const contains = REACTIONS.filter((r) => !starts.includes(r) && r.name.includes(q));
  return [...starts, ...contains];
}
