import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMessages,
  initialState,
  markRecalled,
  openThread,
  sortedThreads,
  threadKey,
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
  let s = addMessages(base(), [msg("b", A, 20), msg("a", A, 10)], false);
  s = addMessages(s, [msg("a", A, 10), msg("c", A, 15)], false);
  assert.deepEqual(s.messages[A]!.map((m) => m.id), ["a", "c", "b"]);
});

test("unread counts only live messages from others in inactive threads", () => {
  let s = openThread(base(), G);
  s = addMessages(s, [msg("1", A, 1), msg("2", A, 2, { isSelf: true }), msg("3", G, 3)], true);
  s = addMessages(s, [msg("4", A, 4)], false);
  assert.equal(s.unread[A], 1);
  assert.equal(s.unread[G], undefined);
  s = openThread(s, A);
  assert.equal(s.unread[A], undefined);
  assert.equal(s.activeKey, A);
});

test("threads with activity come first, the rest alphabetically", () => {
  let s = addMessages(base(), [msg("x", G, 5), msg("y", A, 50)], false);
  assert.deepEqual(sortedThreads(s).map((t) => t.name), ["An", "Team", "Binh"]);
  assert.deepEqual(sortedThreads(s, "bi").map((t) => t.name), ["Binh"]);
});

test("unknown threads are created from the message", () => {
  const stranger = threadKey("user", "77");
  const s = addMessages(base(), [msg("m", stranger, 1, { senderName: "Chi" })], true);
  assert.equal(s.threads[stranger]!.name, "Chi");
  assert.equal(s.threads[stranger]!.placeholder, false);
  const self = addMessages(base(), [msg("n", threadKey("user", "88"), 1, { isSelf: true, senderName: "me" })], true);
  assert.equal(self.threads[threadKey("user", "88")]!.placeholder, true);
});

test("upsert keeps activity time", () => {
  let s = addMessages(base(), [msg("y", A, 50)], false);
  s = upsertThreads(s, [{ id: "1", kind: "user", name: "An Nguyen" }]);
  assert.equal(s.threads[A]!.lastTs, 50);
  assert.equal(s.threads[A]!.name, "An Nguyen");
});

test("recalled messages are flagged", () => {
  let s = addMessages(base(), [msg("a", A, 1)], false);
  s = markRecalled(s, A, "a");
  assert.equal(s.messages[A]![0]!.recalled, true);
  assert.equal(markRecalled(s, A, "missing"), s);
});
