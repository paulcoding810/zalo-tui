import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, messageText, wrapText } from "../src/format.ts";

test("plain text is returned as is", () => {
  assert.equal(messageText({ msgType: "webchat", content: "xin chào" }), "xin chào");
});

test("attachments get a label", () => {
  assert.equal(messageText({ msgType: "chat.photo", content: { title: "", href: "https://x/p.jpg" } }), "[photo]");
  assert.equal(messageText({ msgType: "chat.sticker", content: { id: 1 } }), "[sticker]");
  assert.equal(messageText({ msgType: "share.file", content: { title: "report.pdf" } }), "[file] report.pdf");
  assert.equal(
    messageText({ msgType: "chat.recommended", content: { title: "Docs", href: "https://example.com" } }),
    "[link] Docs https://example.com",
  );
});

test("unknown types fall back to the type name", () => {
  assert.equal(messageText({ msgType: "chat.something", content: {} }), "[something]");
  assert.equal(messageText({ content: null }), "[message]");
});

test("formatTime shows only the time for today", () => {
  const now = new Date(2026, 10, 23, 22, 0);
  assert.equal(formatTime(new Date(2026, 10, 23, 9, 5).getTime(), now), "09:05");
  assert.equal(formatTime(new Date(2026, 10, 20, 18, 30).getTime(), now), "20/11 18:30");
});

test("wrapText splits by width and keeps newlines", () => {
  assert.deepEqual(wrapText("abcdef", 4), ["abcd", "ef"]);
  assert.deepEqual(wrapText("ab\n\ncd", 10), ["ab", "", "cd"]);
  assert.deepEqual(wrapText("Việt Nam", 4), ["Việt", "Nam"]);
  assert.deepEqual(wrapText("tin nhắn rất dài", 9), ["tin nhắn", "rất dài"]);
  assert.deepEqual(wrapText("abcdefghij xy", 4), ["abcd", "efgh", "ij", "xy"]);
});
