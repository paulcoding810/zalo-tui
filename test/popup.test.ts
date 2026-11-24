import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleChoices } from "../src/ui/ChoicePopup.tsx";
import { placePopup, popupContentAt } from "../src/ui/Popup.tsx";

const rows = [null, null, null, null, null, null, "m1", "m1", "m2", "m3"];

test("the popup sits above the selected message when there is room", () => {
  assert.deepEqual(placePopup(rows, "m2", 30, 60, 30, 6), { left: 58, top: 3, width: 30, height: 6 });
});

test("it uses the side with more room and shrinks to fit, never covering the selection", () => {
  const top = ["m1", "m2", null, null, null, null, null, null, null, null];
  assert.deepEqual(placePopup(top, "m1", 30, 60, 30, 6), { left: 58, top: 2, width: 30, height: 6 });
  const middle = [null, null, null, null, "m1", null, null, null, null, null];
  const frame = placePopup(middle, "m1", 30, 60, 30, 12);
  assert.deepEqual(frame, { left: 58, top: 6, width: 30, height: 6 });
  assert.equal(placePopup(rows, "m1", 30, 60, 30, 10).height, 7);
  assert.equal(placePopup(rows, null, 30, 60, 30, 6).top, 0);
  const tight = ["a", "a", "a", "m1", "b", "b", "b"];
  assert.equal(placePopup(tight, "m1", 30, 60, 30, 9).top, 0);
});

test("the popup shrinks to fit narrow and short panes", () => {
  const frame = placePopup(rows, "m2", 30, 20, 40, 30);
  assert.equal(frame.width, 18);
  assert.equal(frame.height, 9);
});

test("clicks map to content cells inside the frame and null outside", () => {
  const frame = { left: 40, top: 3, width: 20, height: 6 };
  assert.deepEqual(popupContentAt(frame, 42, 5), { col: 0, row: 0 });
  assert.deepEqual(popupContentAt(frame, 50, 8), { col: 8, row: 3 });
  assert.equal(popupContentAt(frame, 39, 5), null);
  assert.equal(popupContentAt(frame, 42, 10), null);
});

test("choice lists scroll so the cursor row stays visible", () => {
  const frame = { left: 0, top: 0, width: 30, height: 6 };
  assert.deepEqual(visibleChoices(frame, 9, 0), [0, 1, 2]);
  assert.deepEqual(visibleChoices(frame, 9, 4), [2, 3, 4]);
  assert.deepEqual(visibleChoices(frame, 9, 8), [6, 7, 8]);
  assert.deepEqual(visibleChoices(frame, 2, 1), [0, 1]);
  assert.deepEqual(visibleChoices({ ...frame, height: 3 }, 2, 1), [1]);
});
