import { test } from "node:test";
import assert from "node:assert/strict";
import { attachmentUrl, cleanText, findLinks, formatTime, hyperlink, linkSegments, messageLinks, messageText, textLinkRanges, wrapText, wrapWithOffsets } from "../src/format.ts";

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
  assert.equal(
    messageText({ msgType: "chat.recommended", content: { title: "https://example.com", href: "https://example.com" } }),
    "[link] https://example.com",
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

test("attachment url prefers the main link and falls back to the preview", () => {
  assert.equal(attachmentUrl({ href: "https://x/full.jpg", thumb: "https://x/t.jpg" }), "https://x/full.jpg");
  assert.equal(attachmentUrl({ href: "", thumb: "https://x/t.jpg" }), "https://x/t.jpg");
  assert.equal(attachmentUrl({ href: "zalo://internal", thumb: "" }), undefined);
  assert.equal(attachmentUrl("plain text https://x"), undefined);
  assert.equal(attachmentUrl(null), undefined);
});

test("links are found in text and trailing punctuation is dropped", () => {
  assert.deepEqual(findLinks("xem https://example.com/a?b=1, nhé"), [{ start: 4, end: 29, url: "https://example.com/a?b=1" }]);
  assert.deepEqual(findLinks("(see https://en.wikipedia.org/wiki/Foo_(bar))").map((l) => l.url), ["https://en.wikipedia.org/wiki/Foo_(bar)"]);
  assert.deepEqual(findLinks("www.zalo.me và http://a.vn/x.").map((l) => l.url), ["https://www.zalo.me", "http://a.vn/x"]);
  assert.deepEqual(findLinks("không có link, email a@b.com"), []);
});

test("message links combine the attachment link and text links without duplicates", () => {
  assert.deepEqual(messageLinks({ url: "https://x/p.jpg", text: "[photo]" }), ["https://x/p.jpg"]);
  assert.deepEqual(messageLinks({ url: "https://d.vn", text: "[link] Docs https://d.vn" }), ["https://d.vn"]);
  assert.deepEqual(messageLinks({ text: "a https://a.vn b https://b.vn" }), ["https://a.vn", "https://b.vn"]);
  assert.deepEqual(messageLinks({ text: "https://a.vn", recalled: true }), []);
});

test("control characters are stripped and links carry no escape codes", () => {
  assert.equal(cleanText("a\u001b]8;;evil\u0007b\u001b[2Jc\nd\te"), "a]8;;evilb[2Jc\nd\te");
  assert.equal(messageText({ content: "hi\u001b[31m" }), "hi[31m");
  assert.equal(attachmentUrl({ href: "https://x/\u001b]8;;y" }), undefined);
  assert.equal(hyperlink("https://a.vn/\u0007x", "t"), "\u001b]8;;https://a.vn/x\u0007t\u001b]8;;\u0007");
});

test("wrapped lines keep their offsets so links span line breaks", () => {
  const text = "đọc https://example.com/abcdef nhé";
  const lines = wrapWithOffsets(text, 12);
  assert.deepEqual(lines.map((l) => l.text), ["đọc", "https://exam", "ple.com/abcd", "ef nhé"]);
  const ranges = textLinkRanges(text);
  assert.deepEqual(ranges, [{ start: 4, end: 30, url: "https://example.com/abcdef" }]);
  assert.deepEqual(lines.map((l) => linkSegments(l, ranges)), [
    [{ text: "đọc" }],
    [{ text: "https://exam", url: "https://example.com/abcdef" }],
    [{ text: "ple.com/abcd", url: "https://example.com/abcdef" }],
    [{ text: "ef", url: "https://example.com/abcdef" }, { text: " nhé" }],
  ]);
  assert.deepEqual(wrapWithOffsets("ab\ncd", 10), [{ text: "ab", start: 0 }, { text: "cd", start: 3 }]);
});
