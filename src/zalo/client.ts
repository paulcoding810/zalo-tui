import { CloseReason, Reactions, ThreadType, type API, type Message, type Reaction, type Undo } from "zca-js";
import { basename } from "node:path";
import type { AttachmentRequest } from "../attachment.ts";
import { attachmentUrl, cleanText, messageText } from "../format.ts";
import { parseReactionContent } from "../reactions.ts";
import { loadActivity, saveActivity } from "./session.ts";
import { mutedUntil, notificationContent, notifySkipReason, showNotification } from "../notify.ts";
import { debugLog } from "../debug.ts";
import {
  activitySnapshot,
  addMessages,
  applyActivity,
  applyReaction,
  markRecalled,
  removeMessage,
  parseKey,
  setConnection,
  threadKey,
  upsertThreads,
  type ChatMessage,
  type Store,
} from "../store.ts";

const ATTACHMENT_TIMEOUT_MS = 90_000;
const REACTION_FALLBACK_MS = 3000;

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
  private deleted = new Set<string>();
  private historyPending = new Set<ThreadType>();
  private reactionTimer: NodeJS.Timeout | null = null;
  private savedActivity = "";
  private saveTimer: NodeJS.Timeout | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private api: API,
    private store: Store,
  ) {}

  private toChatMessage(m: Message): ChatMessage {
    const kind = m.type === ThreadType.Group ? "group" : "user";
    const mentions = m.type === ThreadType.Group ? (m.data.mentions ?? []) : [];
    return {
      id: String(m.data.msgId),
      cliMsgId: m.data.cliMsgId ? String(m.data.cliMsgId) : undefined,
      senderId: String(m.data.uidFrom),
      threadKey: threadKey(kind, m.threadId),
      senderName: m.isSelf ? "me" : m.data.dName || m.data.uidFrom,
      isSelf: m.isSelf,
      ts: Number(m.data.ts) || Date.now(),
      text: messageText(m.data),
      mentionsMe: mentions.some((x) => x.uid === this.selfId || x.uid === "-1" || x.type === 1),
      url: attachmentUrl(m.data.content),
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
    this.store.update((s) => ({ ...s, selfId, selfName: cleanText(selfName) }));
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
      const kind = state.threads[m.threadKey]?.kind ?? "unknown";
      const skip =
        notifySkipReason(m, state, this.muted, now) ??
        (now - (this.lastNotified.get(m.threadKey) ?? 0) < 5000 ? "throttled" : null);
      debugLog(`notify ${kind} ${skip ? `skipped: ${skip}` : "shown"} (terminal ${state.terminalFocused ? "focused" : "unfocused"})`);
      if (skip) continue;
      this.lastNotified.set(m.threadKey, now);
      const { title, body } = notificationContent(m, state);
      showNotification(title, body);
    }
  }

  private attachListener(): void {
    const { listener } = this.api;
    listener.on("connected", () => {
      this.store.update((s) => setConnection(s, { state: "connected" }));
      this.historyPending = new Set([ThreadType.User, ThreadType.Group]);
      listener.requestOldMessages(ThreadType.User);
      listener.requestOldMessages(ThreadType.Group);
      if (this.reactionTimer) clearTimeout(this.reactionTimer);
      this.reactionTimer = setTimeout(() => this.requestReactions(), REACTION_FALLBACK_MS);
    });
    listener.on("disconnected", (code, reason) => {
      this.store.update((s) => setConnection(s, { state: "connecting", reason: closeReason(code, reason) }));
    });
    listener.on("closed", (code, reason) => {
      this.store.update((s) => setConnection(s, { state: "closed", reason: closeReason(code, reason) }));
    });
    listener.on("error", () => {});
    listener.on("message", (m) => this.ingest([m], true));
    listener.on("old_messages", (ms, type) => {
      this.ingest(ms, false);
      this.historyPending.delete(type);
      if (this.historyPending.size === 0) this.requestReactions();
    });
    listener.on("reaction", (r) => this.ingestReactions([r]));
    listener.on("old_reactions", (rs) => this.ingestReactions(rs));
    listener.on("undo", (u: Undo) => {
      const key = threadKey(u.isGroup ? "group" : "user", u.threadId);
      this.store.update((s) => markRecalled(s, key, String(u.data.content.globalMsgId)));
    });
  }

  private requestReactions(): void {
    if (!this.reactionTimer) return;
    clearTimeout(this.reactionTimer);
    this.reactionTimer = null;
    this.api.listener.requestOldReactions(ThreadType.User);
    this.api.listener.requestOldReactions(ThreadType.Group);
  }

  private ingestReactions(reactions: Reaction[]): void {
    this.store.update((s) => {
      let next = s;
      for (const r of reactions) {
        const key = threadKey(r.isGroup ? "group" : "user", r.threadId);
        const { msgIds, icon } = parseReactionContent(r.data.content);
        next = applyReaction(next, key, msgIds, r.data.uidFrom, icon, Number(r.data.ts) || Date.now());
      }
      return next;
    });
  }

  private ingest(messages: Message[], live: boolean): void {
    const converted = messages.map((m) => this.toChatMessage(m)).filter((m) => !this.deleted.has(m.id));
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

  async sendAttachment(key: string, request: AttachmentRequest): Promise<void> {
    const { kind, id } = parseKey(key);
    const type = kind === "group" ? ThreadType.Group : ThreadType.User;
    if (request.kind === "file" && this.store.getState().connection.state !== "connected") {
      throw new Error("files need the live connection; reconnect first");
    }
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timed out after 90s")), ATTACHMENT_TIMEOUT_MS);
    });
    const result = await Promise.race([
      this.api.sendMessage({ msg: request.caption, attachments: [request.path] }, id, type),
      timeout,
    ]).finally(() => clearTimeout(timer));
    const sent = result.attachment[0]?.msgId;
    if (sent === undefined) throw new Error("Zalo did not accept the attachment");
    const name = basename(request.path);
    const now = Date.now();
    const local: ChatMessage[] = [];
    if (result.message?.msgId !== undefined && request.kind === "file") {
      local.push({ id: String(result.message.msgId), threadKey: key, senderName: "me", isSelf: true, ts: now - 1, text: request.caption });
    }
    const caption = request.kind === "photo" && request.caption ? ` ${request.caption}` : "";
    local.push({ id: String(sent), threadKey: key, senderName: "me", isSelf: true, ts: now, text: `[${request.kind}] ${name}${caption}` });
    this.store.update((s) => addMessages(s, local, false));
  }

  private destination(message: ChatMessage) {
    if (!message.cliMsgId) throw new Error("this message can't be changed yet");
    const { kind, id } = parseKey(message.threadKey);
    return { threadId: id, type: kind === "group" ? ThreadType.Group : ThreadType.User, cliMsgId: message.cliMsgId };
  }

  async recall(message: ChatMessage): Promise<void> {
    if (!message.isSelf) throw new Error("only your own messages can be recalled");
    const { threadId, type, cliMsgId } = this.destination(message);
    await this.api.undo({ msgId: message.id, cliMsgId }, threadId, type);
    this.store.update((s) => markRecalled(s, message.threadKey, message.id));
  }

  async deleteForMe(message: ChatMessage): Promise<void> {
    const { threadId, type, cliMsgId } = this.destination(message);
    const uidFrom = message.isSelf ? this.selfId : message.senderId;
    if (!uidFrom) throw new Error("sender unknown for this message");
    await this.api.deleteMessage({ data: { cliMsgId, msgId: message.id, uidFrom }, threadId, type }, true);
    this.deleted.add(message.id);
    this.store.update((s) => removeMessage(s, message.threadKey, message.id));
  }

  async react(message: ChatMessage, icon: string): Promise<void> {
    if (!message.cliMsgId) throw new Error("this message can't be reacted to yet");
    const { kind, id } = parseKey(message.threadKey);
    await this.api.addReaction(icon as Reactions, {
      data: { msgId: message.id, cliMsgId: message.cliMsgId },
      threadId: id,
      type: kind === "group" ? ThreadType.Group : ThreadType.User,
    });
    this.store.update((s) => applyReaction(s, message.threadKey, [message.id], this.selfId, icon, Date.now()));
  }

  stop(): void {
    if (this.reactionTimer) clearTimeout(this.reactionTimer);
    this.reactionTimer = null;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.unsubscribe?.();
    this.saveNow();
    try {
      this.api.listener.stop();
    } catch {}
  }
}
