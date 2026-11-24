import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClickEvents, parseWheelEvents } from "../src/terminalMouse.ts";

test("wheel events are parsed with position, other mouse events ignored", () => {
  assert.deepEqual(parseWheelEvents("\u001b[<64;10;5M\u001b[<65;50;7M"), [
    { direction: -1, x: 10, y: 5 },
    { direction: 1, x: 50, y: 7 },
  ]);
  assert.deepEqual(parseWheelEvents("\u001b[<0;3;4M\u001b[<0;3;4m\u001b[<35;3;4M"), []);
  assert.deepEqual(parseWheelEvents("\u001b[<68;2;2M"), [{ direction: -1, x: 2, y: 2 }]);
  assert.deepEqual(parseWheelEvents("plain text"), []);
});

test("left-button presses are clicks; releases, drags and other buttons are not", () => {
  assert.deepEqual(parseClickEvents("\u001b[<0;3;4M\u001b[<0;3;4m"), [{ x: 3, y: 4 }]);
  assert.deepEqual(parseClickEvents("\u001b[<2;3;4M\u001b[<32;3;4M\u001b[<64;3;4M"), []);
  assert.deepEqual(parseClickEvents("\u001b[<4;7;8M"), [{ x: 7, y: 8 }]);
});
