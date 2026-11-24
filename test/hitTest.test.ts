import { test } from "node:test";
import assert from "node:assert/strict";
import { hitTest, type Layout } from "../src/ui/hitTest.ts";

const layout: Layout = {
  sidebarWidth: 30,
  paneHeight: 6,
  listStart: 2,
  listFilterRow: false,
  threadCount: 5,
  paneRows: [null, null, "m1", "m1", "m2", "m3"],
};

test("clicks in the chat list map to visible chats", () => {
  assert.deepEqual(hitTest(layout, 5, 2), { kind: "chat", index: 2 });
  assert.deepEqual(hitTest(layout, 5, 4), { kind: "chat", index: 4 });
  assert.equal(hitTest(layout, 5, 5), null);
  assert.equal(hitTest(layout, 5, 1), null);
  assert.equal(hitTest(layout, 1, 3), null);
  assert.deepEqual(hitTest({ ...layout, listFilterRow: true }, 5, 3), { kind: "chat", index: 2 });
  assert.equal(hitTest({ ...layout, listFilterRow: true }, 5, 2), null);
});

test("clicks in the message pane map to the message on that row", () => {
  assert.deepEqual(hitTest(layout, 40, 4), { kind: "message", msgId: "m1" });
  assert.deepEqual(hitTest(layout, 40, 5), { kind: "message", msgId: "m1" });
  assert.deepEqual(hitTest(layout, 40, 7), { kind: "message", msgId: "m3" });
  assert.equal(hitTest(layout, 40, 2), null);
  assert.equal(hitTest(layout, 40, 8), null);
});

test("the row under the panes is the message box", () => {
  assert.deepEqual(hitTest(layout, 10, 9), { kind: "compose" });
  assert.equal(hitTest(layout, 10, 10), null);
});
