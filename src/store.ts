import { cleanText } from "./format.ts";
import { fold, messageMatches } from "./search.ts";
import type { GroupNotify, NotifyMode } from "./notify.ts";

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
  quote?: { from: string; text: string };
  source?: QuoteSource;
};

export type QuoteSource = {
  content: unknown;
  msgType: string;
  propertyExt: unknown;
  uidFrom: string;
  msgId: string;
  cliMsgId: string;
  ts: string;
  ttl: number;
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
  people: Record<string, string>;
  unread: Record<string, number>;
  read: ReadState;
  divider: { key: string; ts: number } | null;
  activeKey: string | null;
  activeRead: boolean;
  connection: Connection;
  notify: NotifyMode;
  notifyGroups: GroupNotify;
  terminalFocused: boolean;
  openRequest: { key: string; seq: number } | null;
};

export type ReadState = { since: number; chats: Record<string, number> };

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
    people: {},
    unread: {},
    read: { since: Infinity, chats: {} },
    divider: null,
    activeKey: null,
    activeRead: false,
    connection: { state: "idle" },
    notify: "full",
    notifyGroups: "all",
    terminalFocused: true,
    openRequest: null,
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

export function readPoint(state: Pick<State, "read" | "messages">, key: string): number {
  let point = state.read.chats[key] ?? state.read.since;
  for (const m of state.messages[key] ?? []) if (m.isSelf && m.ts > point) point = m.ts;
  return point;
}

function recount(state: State, keys: Iterable<string>): State {
  let unread = state.unread;
  for (const key of keys) {
    const point = readPoint(state, key);
    const count = (state.messages[key] ?? []).filter((m) => !m.isSelf && !m.recalled && m.ts > point).length;
    if ((unread[key] ?? 0) === count) continue;
    if (unread === state.unread) unread = { ...unread };
    if (count > 0) unread[key] = count;
    else delete unread[key];
  }
  return unread === state.unread ? state : { ...state, unread };
}

function newestTs(state: State, key: string): number {
  const list = state.messages[key] ?? [];
  return list.length > 0 ? list[list.length - 1]!.ts : 0;
}

export function markRead(state: State, key: string, now: number = Date.now()): State {
  const newest = newestTs(state, key);
  const ts = Math.max(state.read.chats[key] ?? 0, newest || now);
  const next = { ...state, read: { ...state.read, chats: { ...state.read.chats, [key]: ts } } };
  return recount(next, [key]);
}

export function applyReadState(state: State, read: ReadState): State {
  const chats: Record<string, number> = {};
  for (const [key, ts] of Object.entries(read.chats ?? {})) if (typeof ts === "number" && key.includes(":")) chats[key] = ts;
  const since = typeof read.since === "number" ? read.since : Date.now();
  return recount({ ...state, read: { since, chats } }, Object.keys(state.messages));
}

export function addMessages(state: State, incoming: ChatMessage[]): State {
  if (incoming.length === 0) return state;
  const messages = { ...state.messages };
  const threads = { ...state.threads };
  const touched = new Set<string>();

  for (const raw of incoming) {
    const msg = {
      ...raw,
      text: cleanText(raw.text),
      senderName: cleanText(raw.senderName),
      quote: raw.quote ? { from: cleanText(raw.quote.from), text: cleanText(raw.quote.text) } : undefined,
    };
    const list = touched.has(msg.threadKey) ? messages[msg.threadKey]! : [...(messages[msg.threadKey] ?? [])];
    touched.add(msg.threadKey);
    messages[msg.threadKey] = list;
    const existing = list.findIndex((m) => m.id === msg.id);
    if (existing !== -1) {
      const old = list[existing]!;
      const serverTs = old.isSelf && msg.source && !old.source && msg.ts !== old.ts;
      if ((msg.cliMsgId && !old.cliMsgId) || (msg.source && !old.source)) {
        list[existing] = { ...old, cliMsgId: old.cliMsgId ?? msg.cliMsgId, source: old.source ?? msg.source, ts: serverTs ? msg.ts : old.ts };
      }
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
  }

  for (const key of touched) messages[key]!.sort((a, b) => a.ts - b.ts);
  let next: State = { ...state, messages, threads };
  if (state.activeKey && state.activeRead && state.terminalFocused && touched.has(state.activeKey)) next = markRead(next, state.activeKey, 0);
  return recount(next, touched);
}

export function markRecalled(state: State, key: string, msgId: string): State {
  const list = state.messages[key];
  if (!list || !list.some((m) => m.id === msgId)) return state;
  return recount({
    ...state,
    messages: { ...state.messages, [key]: list.map((m) => (m.id === msgId ? { ...m, recalled: true } : m)) },
  }, [key]);
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

export type ReactionOwner = { uid: string; name: string | null; icons: string[]; ts: number; mine: boolean };

export function personName(state: Pick<State, "people" | "threads">, uid: string): string | null {
  return state.people[uid] ?? (state.threads[`user:${uid}`]?.placeholder ? null : state.threads[`user:${uid}`]?.name ?? null);
}

export function reactionOwners(
  entries: Record<string, ReactionEntry> | undefined,
  state: Pick<State, "people" | "threads" | "selfId">,
): ReactionOwner[] {
  const owners: ReactionOwner[] = [];
  for (const [uid, { icons }] of Object.entries(entries ?? {})) {
    const sorted = Object.entries(icons).sort((a, b) => a[1] - b[1]);
    if (sorted.length === 0) continue;
    const mine = !!state.selfId && uid === state.selfId;
    owners.push({ uid, name: mine ? "You" : personName(state, uid), icons: sorted.map(([icon]) => icon), ts: sorted[sorted.length - 1]![1], mine });
  }
  return owners.sort((a, b) => b.ts - a.ts || a.uid.localeCompare(b.uid));
}

export function rememberPeople(state: State, names: Record<string, string>): State {
  const changed = Object.entries(names).map(([uid, name]) => [uid, cleanText(name)] as const).filter(([uid, name]) => uid && name && name !== uid && state.people[uid] !== name);
  if (changed.length === 0) return state;
  return { ...state, people: { ...state.people, ...Object.fromEntries(changed) } };
}

export function removeMessage(state: State, key: string, msgId: string): State {
  const list = state.messages[key];
  if (!list || !list.some((m) => m.id === msgId)) return state;
  return recount({ ...state, messages: { ...state.messages, [key]: list.filter((m) => m.id !== msgId) } }, [key]);
}

export function openThread(state: State, key: string, read = true): State {
  const opened = { ...state, activeKey: key, activeRead: read };
  if (!read) return opened;
  const divider = state.unread[key] ? { key, ts: readPoint(state, key) } : state.divider?.key === key ? state.divider : null;
  return markRead({ ...opened, divider }, key);
}

export function dividerTs(state: State): number | null {
  const key = state.activeKey;
  if (!key) return null;
  if (state.divider?.key === key) return state.divider.ts;
  return state.unread[key] ? readPoint(state, key) : null;
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
  const q = fold(filter.trim());
  const list = Object.values(state.threads).filter(
    (t) => !q || fold(t.name).includes(q) || (state.messages[t.key] ?? []).some((m) => messageMatches(m, filter)),
  );
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
