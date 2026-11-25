import { test } from "node:test";
import assert from "node:assert/strict";
import { mutedUntil, nextNotifyMode, notificationContent, notifySkipReason, shouldNotify } from "../src/notify.ts";
import { initialState, openThread, threadKey, upsertThreads, type ChatMessage, type State } from "../src/store.ts";

const DM = threadKey("user", "1");
const G = threadKey("group", "9");

function state(extra: Partial<State> = {}): State {
  const s = upsertThreads(initialState(), [
    { id: "1", kind: "user", name: "An" },
    { id: "9", kind: "group", name: "Team" },
  ]);
  return { ...s, ...extra };
}

function msg(key: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: "m", threadKey: key, senderName: "An", isSelf: false, ts: 1, text: "hello", ...extra };
}

test("direct messages notify, own messages do not", () => {
  assert.equal(shouldNotify(msg(DM), state(), new Map()), true);
  assert.equal(shouldNotify(msg(DM, { isSelf: true }), state(), new Map()), false);
});

test("group messages notify for every message unless set to mentions only", () => {
  assert.equal(shouldNotify(msg(G), state(), new Map()), true);
  assert.equal(shouldNotify(msg(G), state(), new Map([[G, Infinity]])), false);
  const mentions = state({ notifyGroups: "mentions" });
  assert.equal(shouldNotify(msg(G), mentions, new Map()), false);
  assert.equal(shouldNotify(msg(G, { mentionsMe: true }), mentions, new Map()), true);
  assert.equal(shouldNotify(msg(G, { mentionsMe: true }), mentions, new Map([[G, Infinity]])), true);
  assert.equal(notifySkipReason(msg(G), mentions, new Map()), "group message without mention");
  assert.equal(shouldNotify(msg(DM), mentions, new Map([[DM, Infinity]])), false);
});

test("open chat, muted chats and off mode are silent", () => {
  assert.equal(shouldNotify(msg(DM), openThread(state(), DM), new Map()), false);
  assert.equal(shouldNotify(msg(DM), state(), new Map([[DM, Infinity]]), 1000), false);
  assert.equal(shouldNotify(msg(DM), state(), new Map([[DM, 500]]), 1000), true);
  assert.equal(shouldNotify(msg(DM), state({ notify: "off" }), new Map()), false);
});

test("mute entries use seconds, -1 means forever", () => {
  assert.equal(mutedUntil({ duration: -1, startTime: 10 }), Infinity);
  assert.equal(mutedUntil({ duration: 3600, startTime: 1000 }), 4600000);
});

test("notification text respects sender-only mode and truncates", () => {
  assert.deepEqual(notificationContent(msg(G, { senderName: "Chi" }), state()), { title: "Chi in Team", body: "hello" });
  assert.deepEqual(notificationContent(msg(DM), state({ notify: "sender" })), { title: "An", body: "New message" });
  const long = notificationContent(msg(DM, { text: "x".repeat(200) }), state()).body;
  assert.equal(Array.from(long).length, 120);
});

test("modes cycle", () => {
  assert.equal(nextNotifyMode("full"), "sender");
  assert.equal(nextNotifyMode("sender"), "off");
  assert.equal(nextNotifyMode("off"), "full");
});

test("the open chat notifies only while the terminal is not focused", () => {
  const open = openThread(state(), DM);
  assert.equal(shouldNotify(msg(DM), open, new Map()), false);
  assert.equal(shouldNotify(msg(DM), { ...open, terminalFocused: false }, new Map()), true);
  assert.equal(notifySkipReason(msg(DM), open, new Map()), "chat open and terminal focused");
});
