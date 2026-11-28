import { test } from "node:test";
import assert from "node:assert/strict";
import { composerLines, composerWindow, cursorLine, verticalMove, wordStart } from "../src/ui/composerLayout.ts";

const chars = (s: string) => Array.from(s);

test("lines break at newlines and wrap at the width", () => {
  assert.deepEqual(composerLines(chars("ab\ncdefg"), 3), [
    { start: 0, end: 2 },
    { start: 3, end: 6 },
    { start: 6, end: 8 },
  ]);
  assert.deepEqual(composerLines(chars("abc"), 3), [
    { start: 0, end: 3 },
    { start: 3, end: 3 },
  ]);
  assert.deepEqual(composerLines([], 5), [{ start: 0, end: 0 }]);
  assert.deepEqual(composerLines(chars("a\n"), 5), [
    { start: 0, end: 1 },
    { start: 2, end: 2 },
  ]);
});

test("the cursor sits on the right line at breaks", () => {
  const lines = composerLines(chars("ab\ncdefg"), 3);
  assert.equal(cursorLine(lines, 2), 0);
  assert.equal(cursorLine(lines, 3), 1);
  assert.equal(cursorLine(lines, 6), 2);
});

test("the window keeps the cursor visible", () => {
  const lines = composerLines(chars("1\n2\n3\n4\n5\n6\n7"), 10);
  assert.deepEqual(composerWindow(lines, 13, 5), { top: 2, rows: 5 });
  assert.deepEqual(composerWindow(lines, 0, 5), { top: 0, rows: 5 });
  assert.deepEqual(composerWindow(composerLines([], 10), 0, 5), { top: 0, rows: 1 });
});

test("up and down keep the column where possible", () => {
  const lines = composerLines(chars("hello\nhi\nworld"), 20);
  assert.equal(verticalMove(lines, 4, 1), 8);
  assert.equal(verticalMove(lines, 8, 1), 11);
  assert.equal(verticalMove(lines, 1, -1), null);
  assert.equal(verticalMove(lines, 13, -1), 8);
});

test("word deletion stops at the previous word start", () => {
  assert.equal(wordStart(chars("send the  "), 10), 5);
  assert.equal(wordStart(chars("send the"), 8), 5);
  assert.equal(wordStart(chars("one"), 3), 0);
  assert.equal(wordStart(chars(""), 0), 0);
});
