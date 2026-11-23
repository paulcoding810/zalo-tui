import { CloseReason, ThreadType, type API, type Message, type Undo } from "zca-js";
import { messageText } from "../format.ts";
import { loadActivity, saveActivity } from "./session.ts";
import { mutedUntil, notificationContent, shouldNotify, showNotification } from "../notify.ts";
import {
  activitySnapshot,
  addMessages,
  applyActivity,
  markRecalled,
  parseKey,
  setConnection,
  threadKey,
  upsertThreads,
  type ChatMessage,
  type Store,
} from "../store.ts";

const HISTORY_REQUESTS = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function closeReason(code: number, reason: string): string {
  if (code === CloseReason.DuplicateConnection || code === CloseReason.KickConnection) {
    return "Zalo Web opened elsewhere";
  }
  return reason ? `closed (${code}: ${reason})` : `closed (${code})`;
}

export class ZaloClient {
  private resolving = new Set<string>();
  private historyLoaded = new Set<string>();
  private muted = new Map<string, number>();
  private lastNotified = new Map<string, number>();
  private selfId = "";
  private historyRequests = new Map<ThreadType, number>();
  private historyOldest = new Map<ThreadType, number>();
  private savedActivity = "";
  private saveTimer: NodeJS.Timeout | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private api: API,
    private store: Store,
  ) {}

  private toChatMessage(m: Message): ChatMessage {
    const kind = m.type === ThreadType.Group ? "group" : "user";
    const content = m.data.content;
    const href = typeof content === "object" && content && typeof content.href === "string" ? content.href : "";
    const mentions = m.type === ThreadType.Group ? (m.data.mentions ?? []) : [];
    return {
      id: String(m.data.msgId),
      threadKey: threadKey(kind, m.threadId),
      senderName: m.isSelf ? "me" : m.data.dName || m.data.uidFrom,
      isSelf: m.isSelf,
      ts: Number(m.data.ts) || Date.now(),
      text: messageText(m.data),
      mentionsMe: mentions.some((x) => x.uid === this.selfId || x.uid === "-1" || x.type === 1),
      url: /^https?:\/\//.test(href) ? href : undefined,
    };
  }

  async init(): Promise<void> {
    const selfId = this.api.getOwnId();
    this.selfId = selfId;
    void this.loadMuted();
    const [account, friends, groups] = await Promise.all([
      this.api.fetchAccountInfo().catch(() => null),
      this.api.getAllFriends().catch(() => []),
      this.api.getAllGroups().catch(() => ({ gridVerMap: {} })),
    ]);
    const selfName = account?.profile.displayName || account?.profile.zaloName || selfId;
    this.store.update((s) => ({ ...s, selfId, selfName }));
    this.store.update((s) =>
      upsertThreads(
        s,
        friends.map((f) => ({ id: f.userId, kind: "user" as const, name: f.displayName || f.zaloName || f.userId })),
      ),
    );
    await this.loadGroups(Object.keys(groups.gridVerMap ?? {}));
    const activity = loadActivity();
    this.savedActivity = JSON.stringify(activity);
    this.store.update((s) => applyActivity(s, activity));
    for (const t of Object.values(this.store.getState().threads)) if (t.placeholder) void this.resolveName(t.key);
    this.unsubscribe = this.store.subscribe(() => this.scheduleSave());
    this.attachListener();
    this.connect();
  }

  private async loadGroups(ids: string[]): Promise<void> {
    for (const batch of chunk(ids, 50)) {
      const info = await this.api.getGroupInfo(batch).catch(() => null);
      if (!info) continue;
      this.store.update((s) =>
        upsertThreads(
          s,
          batch.map((id) => ({ id, kind: "group" as const, name: info.gridInfoMap[id]?.name || id })),
        ),
      );
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, 2000);
  }

  private saveNow(): void {
    const json = JSON.stringify(activitySnapshot(this.store.getState()));
    if (json === this.savedActivity) return;
    try {
      saveActivity(JSON.parse(json));
      this.savedActivity = json;
    } catch {}
  }

  private requestHistory(type: ThreadType, lastMsgId?: string): void {
    this.historyRequests.set(type, (this.historyRequests.get(type) ?? 0) + 1);
    this.api.listener.requestOldMessages(type, lastMsgId ?? null);
  }

  private onOldMessages(messages: Message[], type: ThreadType): void {
    this.ingest(messages, false);
    if (messages.length === 0 || (this.historyRequests.get(type) ?? 0) >= HISTORY_REQUESTS) return;
    const oldest = messages.reduce((a, b) => (Number(b.data.ts) < Number(a.data.ts) ? b : a));
    const ts = Number(oldest.data.ts);
    if (!(ts < (this.historyOldest.get(type) ?? Infinity))) return;
    this.historyOldest.set(type, ts);
    this.requestHistory(type, String(oldest.data.msgId));
  }

  private async loadMuted(): Promise<void> {
    try {
      const r = await this.api.getMute();
      for (const e of r.chatEntries ?? []) this.muted.set(threadKey("user", String(e.id)), mutedUntil(e));
      for (const e of r.groupChatEntries ?? []) this.muted.set(threadKey("group", String(e.id)), mutedUntil(e));
    } catch {}
  }

  private notify(messages: ChatMessage[]): void {
    const state = this.store.getState();
    const now = Date.now();
    for (const m of messages) {
      if (!shouldNotify(m, state, this.muted, now)) continue;
      if (now - (this.lastNotified.get(m.threadKey) ?? 0) < 5000) continue;
      this.lastNotified.set(m.threadKey, now);
      const { title, body } = notificationContent(m, state);
      showNotification(title, body);
    }
  }

  private attachListener(): void {
    const { listener } = this.api;
    listener.on("connected", () => {
      this.store.update((s) => setConnection(s, { state: "connected" }));
      this.historyRequests.clear();
      this.historyOldest.clear();
      this.requestHistory(ThreadType.User);
      this.requestHistory(ThreadType.Group);
    });
    listener.on("disconnected", (code, reason) => {
      this.store.update((s) => setConnection(s, { state: "connecting", reason: closeReason(code, reason) }));
    });
    listener.on("closed", (code, reason) => {
      this.store.update((s) => setConnection(s, { state: "closed", reason: closeReason(code, reason) }));
    });
    listener.on("error", () => {});
    listener.on("message", (m) => this.ingest([m], true));
    listener.on("old_messages", (ms, type) => this.onOldMessages(ms, type));
    listener.on("undo", (u: Undo) => {
      const key = threadKey(u.isGroup ? "group" : "user", u.threadId);
      this.store.update((s) => markRecalled(s, key, String(u.data.content.globalMsgId)));
    });
  }

  private ingest(messages: Message[], live: boolean): void {
    const converted = messages.map((m) => this.toChatMessage(m));
    const before = this.store.getState().messages;
    const fresh = converted.filter((m) => !before[m.threadKey]?.some((x) => x.id === m.id));
    this.store.update((s) => addMessages(s, converted, live));
    if (live) this.notify(fresh);
    for (const key of new Set(converted.map((m) => m.threadKey))) {
      if (this.store.getState().threads[key]?.placeholder) void this.resolveName(key);
    }
  }

  private async resolveName(key: string): Promise<void> {
    if (this.resolving.has(key)) return;
    this.resolving.add(key);
    const { kind, id } = parseKey(key);
    try {
      let name: string | undefined;
      if (kind === "group") {
        name = (await this.api.getGroupInfo(id)).gridInfoMap[id]?.name;
      } else {
        const p = (await this.api.getUserInfo(id)).changed_profiles[id];
        name = p?.displayName || p?.zaloName;
      }
      if (name) this.store.update((s) => upsertThreads(s, [{ id, kind, name }]));
    } catch {}
  }

  connect(): void {
    this.store.update((s) => setConnection(s, { state: "connecting" }));
    try {
      this.api.listener.start({ retryOnClose: true });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.store.update((s) => setConnection(s, { state: "closed", reason }));
    }
  }

  async loadHistory(key: string): Promise<void> {
    const { kind, id } = parseKey(key);
    if (kind !== "group" || this.historyLoaded.has(key)) return;
    this.historyLoaded.add(key);
    if ((this.store.getState().messages[key]?.length ?? 0) >= 20) return;
    try {
      const history = await this.api.getGroupChatHistory(id, 50);
      this.ingest(history.groupMsgs, false);
    } catch {
      this.historyLoaded.delete(key);
    }
  }

  async send(key: string, text: string): Promise<void> {
    const { kind, id } = parseKey(key);
    const type = kind === "group" ? ThreadType.Group : ThreadType.User;
    const result = await this.api.sendMessage({ msg: text }, id, type);
    const msgId = result.message?.msgId;
    if (msgId === undefined) throw new Error("Zalo did not accept the message");
    this.store.update((s) =>
      addMessages(s, [{ id: String(msgId), threadKey: key, senderName: "me", isSelf: true, ts: Date.now(), text }], false),
    );
  }

  stop(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.unsubscribe?.();
    this.saveNow();
    try {
      this.api.listener.stop();
    } catch {}
  }
}
