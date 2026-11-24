export type WheelEvent = { direction: -1 | 1; x: number; y: number };

const listeners = new Set<(event: WheelEvent) => void>();

export function onWheel(listener: (event: WheelEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function parseWheelEvents(text: string): WheelEvent[] {
  const events: WheelEvent[] = [];
  for (const m of text.matchAll(/\u001b\[<(\d+);(\d+);(\d+)([Mm])/g)) {
    const button = Number(m[1]) & ~(4 | 8 | 16);
    if (m[4] !== "M" || (button !== 64 && button !== 65)) continue;
    events.push({ direction: button === 64 ? -1 : 1, x: Number(m[2]), y: Number(m[3]) });
  }
  return events;
}

export function trackMouseWheel(): () => void {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return () => {};
  const onData = (data: Buffer | string) => {
    for (const event of parseWheelEvents(String(data))) for (const l of listeners) l(event);
  };
  process.stdin.on("data", onData);
  process.stdout.write("\u001b[?1000h\u001b[?1006h");
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    process.stdin.off("data", onData);
    process.stdout.write("\u001b[?1006l\u001b[?1000l");
  };
}
