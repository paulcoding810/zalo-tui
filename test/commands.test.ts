import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyInput } from "../src/commands.ts";

const isFile = (p: string) => p === "/Users/me/a.jpg";
const classify = (t: string) => classifyInput(t, isFile, "/Users/me");

test("ordinary text is sent as is", () => {
  assert.deepEqual(classify("xin chào"), { kind: "text", text: "xin chào" });
  assert.deepEqual(classify("/Users/me/missing.jpg"), { kind: "text", text: "/Users/me/missing.jpg" });
  assert.deepEqual(classify("/ nothing"), { kind: "text", text: "/ nothing" });
});

test("double slash sends text starting with a slash", () => {
  assert.deepEqual(classify("//help"), { kind: "text", text: "/help" });
  assert.deepEqual(classify("//shrug ¯\\_(ツ)_/¯"), { kind: "text", text: "/shrug ¯\\_(ツ)_/¯" });
});

test("known commands are recognised, unknown ones are not sent", () => {
  assert.deepEqual(classify("/help"), { kind: "help" });
  assert.deepEqual(classify("/HELP me"), { kind: "help" });
  assert.equal(classify("/photo ~/a.jpg").kind, "attachment");
  assert.equal(classify("/Users/me/a.jpg").kind, "attachment");
  const unknown = classify("/foto ~/a.jpg");
  assert.equal(unknown.kind, "error");
  assert.match((unknown as { message: string }).message, /unknown command \/foto/);
  assert.equal(classify("/photo ~/missing.jpg").kind, "error");
});
