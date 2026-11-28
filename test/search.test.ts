import { test } from "node:test";
import assert from "node:assert/strict";
import { fold, messageMatches, searchMessages, stepMatch } from "../src/search.ts";
import { addMessages, applyReadState, initialState, sortedThreads, threadKey, upsertThreads, type ChatMessage } from "../src/store.ts";

const K = threadKey("user", "1");
const m = (id: string, text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id, threadKey: K, senderName: "An", isSelf: false, ts: Number(id.slice(1)), text, ...extra });

test("matching ignores case and Vietnamese accents", () => {
  assert.equal(fold("Kế Toán Đông"), "ke toan dong");
  assert.equal(messageMatches(m("m1", "Hóa đơn INV-4471"), "hoa don inv"), true);
  assert.equal(messageMatches(m("m1", "[link] ↗", { url: "https://pay.example/4471" }), "4471"), true);
  assert.equal(messageMatches(m("m1", "secret", { recalled: true }), "secret"), false);
  assert.equal(messageMatches(m("m1", "anything"), "  "), false);
});

test("n steps to older matches and N to newer, wrapping around", () => {
  const list = [m("m1", "inv a"), m("m2", "other"), m("m3", "inv b"), m("m4", "inv c")];
  const hits = searchMessages(list, "inv");
  assert.deepEqual(hits, ["m1", "m3", "m4"]);
  assert.equal(stepMatch(hits, list, null, -1), "m4");
  assert.equal(stepMatch(hits, list, "m4", -1), "m3");
  assert.equal(stepMatch(hits, list, "m2", -1), "m1");
  assert.equal(stepMatch(hits, list, "m1", -1), "m4");
  assert.equal(stepMatch(hits, list, "m3", 1), "m4");
  assert.equal(stepMatch(hits, list, "m4", 1), "m1");
  assert.equal(stepMatch([], list, null, -1), null);
});

test("the chat filter also finds chats by message text", () => {
  let s = upsertThreads(initialState(), [{ id: "1", kind: "user", name: "An" }, { id: "2", kind: "user", name: "Bình" }]);
  s = applyReadState(s, { since: 0, chats: {} });
  s = addMessages(s, [m("m1", "invoice INV-4471")]);
  assert.deepEqual(sortedThreads(s, "4471").map((t) => t.name), ["An"]);
  assert.deepEqual(sortedThreads(s, "binh").map((t) => t.name), ["Bình"]);
});
