import { CloseReason, ThreadType, type API, type Message, type Undo } from "zca-js";
import { messageText } from "../format.ts";
import {
  addMessages,
  markRecalled,
  parseKey,
  setConnection,
  threadKey,
  upsertThreads,
  type ChatMessage,
  type Store,
} from "../store.ts";

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

  constructor(
    private api: API,
    private store: Store,
  ) {}

  private toChatMessage(m: Message): ChatMessage {
    const kind = m.type === ThreadType.Group ? "group" : "user";
    return {
      id: String(m.data.msgId),
      threadKey: threadKey(kind, m.threadId),
      senderName: m.isSelf ? "me" : m.data.dName || m.data.uidFrom,
      isSelf: m.isSelf,
      ts: Number(m.data.ts) || Date.now(),
      text: messageText(m.data),
    };
  }

  async init(): Promise<void> {
    const selfId = this.api.getOwnId();
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

  private attachListener(): void {
    const { listener } = this.api;
    listener.on("connected", () => {
      this.store.update((s) => setConnection(s, { state: "connected" }));
      listener.requestOldMessages(ThreadType.User);
      listener.requestOldMessages(ThreadType.Group);
    });
    listener.on("disconnected", (code, reason) => {
      this.store.update((s) => setConnection(s, { state: "connecting", reason: closeReason(code, reason) }));
    });
    listener.on("closed", (code, reason) => {
      this.store.update((s) => setConnection(s, { state: "closed", reason: closeReason(code, reason) }));
    });
    listener.on("error", () => {});
    listener.on("message", (m) => this.ingest([m], true));
    listener.on("old_messages", (ms) => this.ingest(ms, false));
    listener.on("undo", (u: Undo) => {
      const key = threadKey(u.isGroup ? "group" : "user", u.threadId);
      this.store.update((s) => markRecalled(s, key, String(u.data.content.globalMsgId)));
    });
  }

  private ingest(messages: Message[], live: boolean): void {
    const converted = messages.map((m) => this.toChatMessage(m));
    this.store.update((s) => addMessages(s, converted, live));
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
    try {
      this.api.listener.stop();
    } catch {}
  }
}
