export type MetaAction = { kind: "recall" | "delete"; ids: string[] };

function idOf(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

export function metaAction(msgType: string | undefined, content: unknown): MetaAction | null {
  if (msgType === "chat.undo") {
    const id = content && typeof content === "object" ? idOf((content as { globalMsgId?: unknown }).globalMsgId) : null;
    return { kind: "recall", ids: id && id !== "0" ? [id] : [] };
  }
  if (msgType === "chat.delete") {
    const entries = Array.isArray(content) ? content : [];
    const ids = entries
      .map((e) => (e && typeof e === "object" ? idOf((e as { globalDelMsgId?: unknown }).globalDelMsgId) : null))
      .filter((id): id is string => !!id && id !== "0");
    return { kind: "delete", ids };
  }
  return null;
}
