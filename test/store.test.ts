import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activitySnapshot,
  addMessages,
  applyActivity,
  applyReaction,
  initialState,
  markRecalled,
  openThread,
  reactionKey,
  reactionSummary,
  reactionOwners,
  rememberPeople,
  removeMessage,
  sortedThreads,
  threadKey,
  applyReadState,
  markRead,
  dividerTs,
  upsertThreads,
  type ChatMessage,
} from "../src/store.ts";

const A = threadKey("user", "1");
const G = threadKey("group", "9");

function msg(id: string, key: string, ts: number, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id, threadKey: key, senderName: "An", isSelf: false, ts, text: id, ...extra };
}

function base() {
  return upsertThreads(initialState(), [
    { id: "1", kind: "user", name: "An" },
    { id: "2", kind: "user", name: "Binh" },
    { id: "9", kind: "group", name: "Team" },
  ]);
}

test("messages are deduped by id and sorted by time", () => {
  let s = addMessages(base(), [msg("b", A, 20), msg("a", A, 10)]);
  s = addMessages(s, [msg("a", A, 10), msg("c", A, 15)]);
  assert.deepEqual(s.messages[A]!.map((m) => m.id), ["a", "c", "b"]);
});

test("unread counts messages from others newer than the chat's read point", () => {
  let s = applyReadState(base(), { since: 5, chats: { [G]: 0 } });
  s = addMessages(s, [msg("1", A, 1), msg("2", A, 6), msg("3", A, 7), msg("4", G, 3), msg("5", G, 4, { isSelf: true }), msg("6", G, 8)]);
  assert.deepEqual(s.unread, { [A]: 2, [G]: 1 });
  s = markRecalled(s, A, "3");
  assert.equal(s.unread[A], 1);
  s = addMessages(s, [msg("7", A, 9, { isSelf: true })]);
  assert.equal(s.unread[A], undefined);
});

test("nothing is unread before the read state is loaded", () => {
  const s = addMessages(base(), [msg("1", A, 1)]);
  assert.deepEqual(s.unread, {});
});

test("previewing keeps unread; opening marks read and leaves a divider", () => {
  let s = applyReadState(base(), { since: 0, chats: {} });
  s = addMessages(s, [msg("1", A, 10), msg("2", A, 20)]);
  s = openThread(s, A, false);
  assert.equal(s.unread[A], 2);
  assert.equal(dividerTs(s), 0);
  s = addMessages(s, [msg("3", A, 30)]);
  assert.equal(s.unread[A], 3);
  s = openThread(s, A);
  assert.equal(s.unread[A], undefined);
  assert.equal(s.activeRead, true);
  assert.equal(dividerTs(s), 0);
  assert.ok(s.read.chats[A]! >= 30);
  s = addMessages(s, [msg("4", A, Date.now() + 60_000)]);
  assert.equal(s.unread[A], undefined);
  s = addMessages({ ...s, terminalFocused: false }, [msg("5", A, Date.now() + 120_000)]);
  assert.equal(s.unread[A], 1);
  s = openThread(s, G);
  assert.equal(dividerTs(s), null);
});

test("threads with activity come first, the rest alphabetically", () => {
  let s = addMessages(base(), [msg("x", G, 5), msg("y", A, 50)]);
  assert.deepEqual(sortedThreads(s).map((t) => t.name), ["An", "Team", "Binh"]);
  assert.deepEqual(sortedThreads(s, "bi").map((t) => t.name), ["Binh"]);
});

test("unknown threads are created from the message", () => {
  const stranger = threadKey("user", "77");
  const s = addMessages(base(), [msg("m", stranger, 1, { senderName: "Chi" })]);
  assert.equal(s.threads[stranger]!.name, "Chi");
  assert.equal(s.threads[stranger]!.placeholder, false);
  const self = addMessages(base(), [msg("n", threadKey("user", "88"), 1, { isSelf: true, senderName: "me" })]);
  assert.equal(self.threads[threadKey("user", "88")]!.placeholder, true);
});

test("upsert keeps activity time", () => {
  let s = addMessages(base(), [msg("y", A, 50)]);
  s = upsertThreads(s, [{ id: "1", kind: "user", name: "An Nguyen" }]);
  assert.equal(s.threads[A]!.lastTs, 50);
  assert.equal(s.threads[A]!.name, "An Nguyen");
});

test("recalled messages are flagged", () => {
  let s = addMessages(base(), [msg("a", A, 1)]);
  s = markRecalled(s, A, "a");
  assert.equal(s.messages[A]![0]!.recalled, true);
  assert.equal(markRecalled(s, A, "missing"), s);
});

test("activity round-trips and restores order across runs", () => {
  const doc = threadKey("user", "55");
  let s = addMessages(base(), [msg("a", G, 100), msg("b", doc, 200, { isSelf: true })]);
  s = upsertThreads(s, [{ id: "55", kind: "user", name: "My Documents" }]);
  const saved = JSON.parse(JSON.stringify(activitySnapshot(s)));
  assert.deepEqual(Object.keys(saved).sort(), [doc, G].sort());
  const fresh = applyActivity(base(), saved);
  assert.deepEqual(sortedThreads(fresh).map((t) => t.name), ["My Documents", "Team", "An", "Binh"]);
  assert.equal(fresh.threads[doc]!.placeholder, false);
  const newer = addMessages(base(), [msg("z", G, 500)]);
  assert.equal(applyActivity(newer, saved).threads[G]!.lastTs, 500);
  assert.equal(Object.keys(applyActivity(base(), { "bad": { name: "x", ts: 1 }, "x:1": { name: "y", ts: 2 } } as never).threads).length, 3);
});

test("reactions keep every icon a person adds until they remove them", () => {
  let s = base();
  const summary = (selfId = "") => reactionSummary(s.reactions[reactionKey(A, "m1")], selfId);
  s = applyReaction(s, A, ["m1"], "u1", "/-heart", 10);
  s = applyReaction(s, A, ["m1"], "u2", "/-heart", 11);
  s = applyReaction(s, A, ["m1"], "u3", "/-strong", 12);
  assert.deepEqual(summary(), [
    { icon: "/-heart", count: 2, mine: false },
    { icon: "/-strong", count: 1, mine: false },
  ]);
  assert.deepEqual(summary("u3").map((r) => r.mine), [false, true]);
  s = applyReaction(s, A, ["m1"], "u2", "/-strong", 20);
  s = applyReaction(s, A, ["m1"], "u2", "/-heart", 15);
  assert.deepEqual(summary("u2"), [
    { icon: "/-heart", count: 2, mine: true },
    { icon: "/-strong", count: 2, mine: true },
  ]);
  s = applyReaction(s, A, ["m1"], "u1", ":>", 25);
  s = applyReaction(s, A, ["m1"], "u1", "", 30);
  s = applyReaction(s, A, ["m1"], "u1", "/-heart", 28);
  assert.deepEqual(summary("u1").filter((r) => r.mine), []);
  s = applyReaction(s, A, ["m1"], "u1", ":-((", 31);
  assert.deepEqual(summary("u1").filter((r) => r.mine).map((r) => r.icon), [":-(("]);
  const unchanged = applyReaction(s, A, ["m1"], "u2", "/-strong", 20);
  assert.equal(unchanged, s);
  assert.deepEqual(reactionSummary(undefined), []);
});


test("a duplicate message fills in a missing client id", () => {
  let s = addMessages(base(), [msg("a", A, 1)]);
  s = addMessages(s, [msg("a", A, 1, { cliMsgId: "c1", text: "other" })]);
  assert.equal(s.messages[A]!.length, 1);
  assert.equal(s.messages[A]![0]!.cliMsgId, "c1");
  assert.equal(s.messages[A]![0]!.text, "a");
});

test("removing a message drops only that message", () => {
  let s = addMessages(base(), [msg("a", A, 1), msg("b", A, 2)]);
  s = removeMessage(s, A, "a");
  assert.deepEqual(s.messages[A]!.map((m) => m.id), ["b"]);
  assert.equal(removeMessage(s, A, "missing"), s);
});

test("reaction owners list newest first with names from people, friends or nothing", () => {
  let s = upsertThreads(base(), [{ id: "u2", kind: "user", name: "Friend" }]);
  s = { ...s, selfId: "me" };
  s = rememberPeople(s, { u1: "Member\u0007", u3: "u3", u4: "" });
  s = applyReaction(s, A, ["m1"], "u1", "/-heart", 10);
  s = applyReaction(s, A, ["m1"], "u1", "/-strong", 30);
  s = applyReaction(s, A, ["m1"], "u2", ":>", 20);
  s = applyReaction(s, A, ["m1"], "me", "/-heart", 25);
  s = applyReaction(s, A, ["m1"], "u3", ":-((", 5);
  s = applyReaction(s, A, ["m1"], "u5", "/-heart", 1);
  s = applyReaction(s, A, ["m1"], "u5", "", 2);
  assert.deepEqual(
    reactionOwners(s.reactions[reactionKey(A, "m1")], s).map((o) => [o.uid, o.name, o.icons, o.mine]),
    [
      ["u1", "Member", ["/-heart", "/-strong"], false],
      ["me", "You", ["/-heart"], true],
      ["u2", "Friend", [":>"], false],
      ["u3", null, [":-(("], false],
    ],
  );
  assert.equal(rememberPeople(s, { u1: "Member" }), s);
});

test("read points come from server times, so a fast local clock can't hide new messages", () => {
  let s = applyReadState(base(), { since: 0, chats: {} });
  s = addMessages(s, [msg("1", A, 1000)]);
  s = markRead(s, A, 999_999);
  assert.equal(s.read.chats[A], 1000);
  s = addMessages(s, [msg("2", A, 1500)]);
  assert.equal(s.unread[A], 1);
  s = addMessages(s, [msg("me", A, 999_999, { isSelf: true })]);
  assert.equal(s.unread[A], undefined);
  s = addMessages(s, [msg("me", A, 1600, { isSelf: true, source: { content: "", msgType: "webchat", propertyExt: undefined, uidFrom: "0", msgId: "me", cliMsgId: "c", ts: "1600", ttl: 0 } })]);
  s = addMessages(s, [msg("3", A, 1700)]);
  assert.equal(s.unread[A], 1);
});
