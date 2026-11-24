import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAttachment } from "../src/attachment.ts";

const files = new Set(["/Users/me/Pictures/a.jpg", "/Users/me/My Photos/bãi biển.PNG", "/Users/me/doc.pdf"]);
const exists = (p: string) => files.has(p);
const parse = (text: string) => parseAttachment(text, exists, "/Users/me");

test("plain text is not an attachment", () => {
  assert.equal(parse("hello"), null);
  assert.equal(parse("/Users/me/Pictures/a.jpg is nice"), null);
  assert.equal(parse("/nope/missing.jpg"), null);
});

test("a dragged-in path asks for confirmation", () => {
  assert.deepEqual(parse("/Users/me/Pictures/a.jpg "), { path: "/Users/me/Pictures/a.jpg", caption: "", kind: "photo", confirm: true });
  assert.deepEqual(parse("/Users/me/My\\ Photos/bãi\\ biển.PNG"), {
    path: "/Users/me/My Photos/bãi biển.PNG",
    caption: "",
    kind: "photo",
    confirm: true,
  });
  assert.deepEqual(parse("'/Users/me/doc.pdf'"), { path: "/Users/me/doc.pdf", caption: "", kind: "file", confirm: true });
});

test("commands send directly, with caption and ~", () => {
  assert.deepEqual(parse("/photo ~/Pictures/a.jpg đẹp quá"), {
    path: "/Users/me/Pictures/a.jpg",
    caption: "đẹp quá",
    kind: "photo",
    confirm: false,
  });
  assert.deepEqual(parse('/file "/Users/me/My Photos/bãi biển.PNG"'), {
    path: "/Users/me/My Photos/bãi biển.PNG",
    caption: "",
    kind: "file",
    confirm: false,
  });
});

test("command errors are reported", () => {
  assert.deepEqual(parse("/photo"), { error: "usage: /photo <path> [caption]" });
  assert.deepEqual(parse("/photo ~/x.jpg"), { error: "file not found: ~/x.jpg" });
  assert.deepEqual(parse("/photo ~/doc.pdf"), { error: "not a photo (jpg, jpeg, png, webp): doc.pdf" });
});
