export type Layout = {
  sidebarWidth: number;
  paneHeight: number;
  listStart: number;
  listFilterRow: boolean;
  threadCount: number;
  paneRows: (string | null)[];
};

export type Hit = { kind: "chat"; index: number } | { kind: "message"; msgId: string } | { kind: "compose" } | null;

export function hitTest(layout: Layout, x: number, y: number): Hit {
  const contentRow = y - 2;
  if (y === layout.paneHeight + 3) return { kind: "compose" };
  if (contentRow < 0 || contentRow >= layout.paneHeight) return null;
  if (x <= layout.sidebarWidth) {
    if (x <= 1 || x >= layout.sidebarWidth) return null;
    const row = contentRow - (layout.listFilterRow ? 1 : 0);
    const index = layout.listStart + row;
    return row >= 0 && index < layout.threadCount ? { kind: "chat", index } : null;
  }
  const msgId = layout.paneRows[contentRow];
  return msgId ? { kind: "message", msgId } : null;
}
