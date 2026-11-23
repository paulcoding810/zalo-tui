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
  threadKey: string;
  senderName: string;
  isSelf: boolean;
  ts: number;
  text: string;
  recalled?: boolean;
};

export type Connection = {
  state: "idle" | "connecting" | "connected" | "closed";
  reason?: string;
};

export type State = {
  selfId: string;
  selfName: string;
  threads: Record<string, Thread>;
  messages: Record<string, ChatMessage[]>;
  unread: Record<string, number>;
  activeKey: string | null;
  connection: Connection;
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
    unread: {},
    activeKey: null,
    connection: { state: "idle" },
  };
}

export function upsertThreads(state: State, threads: Omit<Thread, "key" | "lastTs">[]): State {
  const next = { ...state.threads };
  for (const t of threads) {
    const key = threadKey(t.kind, t.id);
    const existing = next[key];
    next[key] = { ...t, key, lastTs: existing?.lastTs ?? 0, placeholder: t.placeholder ?? false };
  }
  return { ...state, threads: next };
}

export function addMessages(state: State, incoming: ChatMessage[], countUnread: boolean): State {
  if (incoming.length === 0) return state;
  const messages = { ...state.messages };
  const threads = { ...state.threads };
  const unread = { ...state.unread };
  const touched = new Set<string>();

  for (const msg of incoming) {
    const list = touched.has(msg.threadKey) ? messages[msg.threadKey]! : [...(messages[msg.threadKey] ?? [])];
    touched.add(msg.threadKey);
    messages[msg.threadKey] = list;
    if (list.some((m) => m.id === msg.id)) continue;
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

export function openThread(state: State, key: string): State {
  const unread = { ...state.unread };
  delete unread[key];
  return { ...state, activeKey: key, unread };
}

export function setConnection(state: State, connection: Connection): State {
  return { ...state, connection };
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
