import { test } from "node:test";
import assert from "node:assert/strict";
import { metaAction } from "../src/zalo/meta.ts";

test("recall markers point at the recalled message", () => {
  assert.deepEqual(
    metaAction("chat.undo", { globalMsgId: 8525365603783, cliMsgId: 1795532024506, deleteMsg: 0, srcId: 0, destId: "5972708084357177294" }),
    { kind: "recall", ids: ["8525365603783"] },
  );
  assert.deepEqual(metaAction("chat.undo", {}), { kind: "recall", ids: [] });
});

test("delete markers list the deleted messages", () => {
  assert.deepEqual(
    metaAction("chat.delete", [{ type: 1, actionType: 0, uidFrom: "1", uidTo: "2", clientDelMsgId: 1795532027287, globalDelMsgId: 8525365747565, destId: "2" }]),
    { kind: "delete", ids: ["8525365747565"] },
  );
  assert.deepEqual(metaAction("chat.delete", "garbage"), { kind: "delete", ids: [] });
});

test("ordinary messages are not markers", () => {
  assert.equal(metaAction("webchat", "hi"), null);
  assert.equal(metaAction("chat.photo", { href: "x" }), null);
  assert.equal(metaAction(undefined, null), null);
});
