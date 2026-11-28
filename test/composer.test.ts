import { test } from "node:test";
import assert from "node:assert/strict";
import { composerLines, composerWindow, cursorLine, verticalMove, wordStart } from "../src/ui/composerLayout.ts";

const chars = (s: string) => Array.from(s);
const spans = (s: string, w: number) => composerLines(chars(s), w).map(({ start, end }) => [start, end]);

test("lines break at newlines and wrap at the width", () => {
  assert.deepEqual(spans("ab\ncdefg", 3), [[0, 2], [3, 6], [6, 8]]);
  assert.deepEqual(spans("abc", 3), [[0, 3], [3, 3]]);
  assert.deepEqual(spans("", 5), [[0, 0]]);
  assert.deepEqual(spans("a\n", 5), [[0, 1], [2, 2]]);
  assert.deepEqual(composerLines(chars("abcdef"), 3).map((l) => l.soft), [true, true, false]);
});

test("wide characters take two columns", () => {
  assert.deepEqual(spans("😀😀😀", 4), [[0, 2], [2, 3]]);
  assert.deepEqual(spans("a😀b", 2), [[0, 1], [1, 2], [2, 3]]);
  assert.deepEqual(spans("tiếng Việt", 20), [[0, 10]]);
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

test("up and down keep the column and never skip or stick at full lines", () => {
  const move = (s: string, w: number, cursor: number, dir: -1 | 1) => {
    const c = chars(s);
    return verticalMove(composerLines(c, w), c, cursor, dir);
  };
  assert.equal(move("hello\nhi\nworld", 20, 4, 1), 8);
  assert.equal(move("hello\nhi\nworld", 20, 8, 1), 11);
  assert.equal(move("hello\nhi\nworld", 20, 1, -1), null);
  assert.equal(move("hello\nhi\nworld", 20, 13, -1), 8);
  const a = "aaaaaaaaaabbbbbbbbbb\ncc";
  assert.equal(move(a, 10, 20, -1), 9);
  const d = "dddddddddd\neeeeeeeeeeffffffffff";
  assert.equal(move(d, 10, 10, 1), 20);
  assert.equal(move("😀😀\nabcd", 10, 2, 1), 7);
});

test("word deletion stops at the previous word start", () => {
  assert.equal(wordStart(chars("send the  "), 10), 5);
  assert.equal(wordStart(chars("send the"), 8), 5);
  assert.equal(wordStart(chars("one"), 3), 0);
  assert.equal(wordStart(chars(""), 0), 0);
});
