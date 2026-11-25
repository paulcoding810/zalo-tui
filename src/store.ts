import { cleanText } from "./format.ts";
import type { NotifyMode } from "./notify.ts";

export type ThreadKind = "user" | "group";

export type Thread = {
  key: string;
  id: string;
  kind: ThreadKind;
  name: string;
  lastTs: number;
  placeholder?: boolean;
};

export type ChatMessage = {
  id: string;
  cliMsgId?: string;
  senderId?: string;
  threadKey: string;
  senderName: string;
  isSelf: boolean;
  ts: number;
  text: string;
  recalled?: boolean;
  mentionsMe?: boolean;
  url?: string;
};

export type ReactionEntry = { icons: Record<string, number>; cleared: number };

export type Connection = {
  state: "idle" | "connecting" | "connected" | "closed";
  reason?: string;
};

export type State = {
  selfId: string;
  selfName: string;
  threads: Record<string, Thread>;
  messages: Record<string, ChatMessage[]>;
  reactions: Record<string, Record<string, ReactionEntry>>;
  unread: Record<string, number>;
  activeKey: string | null;
  connection: Connection;
  notify: NotifyMode;
  terminalFocused: boolean;
};

export function threadKey(kind: ThreadKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseKey(key: string): { kind: ThreadKind; id: string } {
  const i = key.indexOf(":");
  return { kind: key.slice(0, i) as ThreadKind, id: key.slice(i + 1) };
}

export function initialState(): State {
  return {
    selfId: "",
    selfName: "",
    threads: {},
    messages: {},
    reactions: {},
    unread: {},
    activeKey: null,
    connection: { state: "idle" },
    notify: "full",
    terminalFocused: true,
  };
}

export function upsertThreads(state: State, threads: Omit<Thread, "key" | "lastTs">[]): State {
  const next = { ...state.threads };
  for (const t of threads) {
    const key = threadKey(t.kind, t.id);
    const existing = next[key];
    next[key] = { ...t, name: cleanText(t.name), key, lastTs: existing?.lastTs ?? 0, placeholder: t.placeholder ?? false };
  }
  return { ...state, threads: next };
}

export function addMessages(state: State, incoming: ChatMessage[], countUnread: boolean): State {
  if (incoming.length === 0) return state;
  const messages = { ...state.messages };
  const threads = { ...state.threads };
  const unread = { ...state.unread };
  const touched = new Set<string>();

  for (const raw of incoming) {
    const msg = { ...raw, text: cleanText(raw.text), senderName: cleanText(raw.senderName) };
    const list = touched.has(msg.threadKey) ? messages[msg.threadKey]! : [...(messages[msg.threadKey] ?? [])];
    touched.add(msg.threadKey);
    messages[msg.threadKey] = list;
    const existing = list.findIndex((m) => m.id === msg.id);
    if (existing !== -1) {
      if (msg.cliMsgId && !list[existing]!.cliMsgId) list[existing] = { ...list[existing]!, cliMsgId: msg.cliMsgId };
      continue;
    }
    list.push(msg);

    const { kind, id } = parseKey(msg.threadKey);
    const thread = threads[msg.threadKey];
    if (!thread) {
      const name = kind === "user" && !msg.isSelf ? msg.senderName : id;
      threads[msg.threadKey] = { key: msg.threadKey, id, kind, name, lastTs: msg.ts, placeholder: name === id };
    } else if (msg.ts > thread.lastTs) {
      threads[msg.threadKey] = { ...thread, lastTs: msg.ts };
    }

    if (countUnread && !msg.isSelf && msg.threadKey !== state.activeKey) {
      unread[msg.threadKey] = (unread[msg.threadKey] ?? 0) + 1;
    }
  }

  for (const key of touched) messages[key]!.sort((a, b) => a.ts - b.ts);
  return { ...state, messages, threads, unread };
}

export function markRecalled(state: State, key: string, msgId: string): State {
  const list = state.messages[key];
  if (!list || !list.some((m) => m.id === msgId)) return state;
  return {
    ...state,
    messages: { ...state.messages, [key]: list.map((m) => (m.id === msgId ? { ...m, recalled: true } : m)) },
  };
}

export function reactionKey(threadKey: string, msgId: string): string {
  return `${threadKey}|${msgId}`;
}

export function applyReaction(
  state: State,
  threadKey: string,
  msgIds: string[],
  uid: string,
  icon: string,
  ts: number,
): State {
  let reactions = state.reactions;
  for (const msgId of msgIds) {
    const key = reactionKey(threadKey, msgId);
    const current = reactions[key] ?? {};
    const entry = current[uid] ?? { icons: {}, cleared: -Infinity };
    let updated: ReactionEntry;
    if (icon) {
      if (ts <= entry.cleared || (entry.icons[icon] ?? -Infinity) >= ts) continue;
      updated = { ...entry, icons: { ...entry.icons, [icon]: ts } };
    } else {
      if (ts <= entry.cleared) continue;
      updated = { icons: Object.fromEntries(Object.entries(entry.icons).filter(([, at]) => at > ts)), cleared: ts };
    }
    const next = { ...current, [uid]: updated };
    reactions = { ...reactions, [key]: next };
  }
  return reactions === state.reactions ? state : { ...state, reactions };
}

export type ReactionCount = { icon: string; count: number; mine: boolean };

export function reactionSummary(entries: Record<string, ReactionEntry> | undefined, selfId = ""): ReactionCount[] {
  const counts = new Map<string, ReactionCount>();
  for (const [uid, { icons }] of Object.entries(entries ?? {})) {
    for (const icon of Object.keys(icons)) {
      const entry = counts.get(icon) ?? { icon, count: 0, mine: false };
      entry.count += 1;
      if (selfId && uid === selfId) entry.mine = true;
      counts.set(icon, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.icon.localeCompare(b.icon));
}

export function removeMessage(state: State, key: string, msgId: string): State {
  const list = state.messages[key];
  if (!list || !list.some((m) => m.id === msgId)) return state;
  return { ...state, messages: { ...state.messages, [key]: list.filter((m) => m.id !== msgId) } };
}

export function openThread(state: State, key: string): State {
  const unread = { ...state.unread };
  delete unread[key];
  return { ...state, activeKey: key, unread };
}

export function setConnection(state: State, connection: Connection): State {
  return { ...state, connection };
}

export type Activity = Record<string, { name: string; ts: number }>;

export function activitySnapshot(state: State): Activity {
  const out: Activity = {};
  for (const t of Object.values(state.threads)) if (t.lastTs > 0) out[t.key] = { name: t.name, ts: t.lastTs };
  return out;
}

export function applyActivity(state: State, activity: Activity): State {
  const threads = { ...state.threads };
  for (const [key, entry] of Object.entries(activity)) {
    if (!entry || typeof entry.ts !== "number" || !key.includes(":")) continue;
    const existing = threads[key];
    if (existing) {
      if (entry.ts > existing.lastTs) threads[key] = { ...existing, lastTs: entry.ts };
      continue;
    }
    const { kind, id } = parseKey(key);
    if (kind !== "user" && kind !== "group") continue;
    const name = cleanText(entry.name || "") || id;
    threads[key] = { key, id, kind, name, lastTs: entry.ts, placeholder: name === id };
  }
  return { ...state, threads };
}

export function sortedThreads(state: State, filter = ""): Thread[] {
  const q = filter.trim().toLowerCase();
  const list = Object.values(state.threads).filter((t) => !q || t.name.toLowerCase().includes(q));
  return list.sort((a, b) => {
    if (a.lastTs !== b.lastTs) return b.lastTs - a.lastTs;
    return a.name.localeCompare(b.name);
  });
}

export class Store {
  private state: State = initialState();
  private listeners = new Set<() => void>();

  getState = (): State => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  update(fn: (state: State) => State): void {
    const next = fn(this.state);
    if (next === this.state) return;
    this.state = next;
    for (const l of this.listeners) l();
  }
}
