import type { Key } from "ink";

export function navStep(input: string, key: Key, index: number, length: number, half: number): number | null {
  if (length === 0) return null;
  const clamp = (n: number) => Math.min(length - 1, Math.max(0, n));
  if (key.ctrl) {
    if (input === "d") return clamp(index + half);
    if (input === "u") return clamp(index - half);
    return null;
  }
  if (key.meta) return null;
  if (key.upArrow || input === "k") return clamp(index - 1);
  if (key.downArrow || input === "j") return clamp(index + 1);
  if (input === "g") return 0;
  if (input === "G") return length - 1;
  return null;
}
