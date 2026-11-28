import { test } from "node:test";
import assert from "node:assert/strict";
import { closeReason } from "../src/zalo/client.ts";

test("disconnect reasons explain sessions opened elsewhere", () => {
  assert.equal(closeReason(3000, "", false), "Zalo Web opened elsewhere");
  assert.match(closeReason(1000, "NORMAL_CLOSURE", false), /opened elsewhere/);
  assert.equal(closeReason(1000, "NORMAL_CLOSURE", true), "closed (1000: NORMAL_CLOSURE)");
  assert.equal(closeReason(1006, "", false), "closed (1006)");
});

import { ThreadType } from "zca-js";
import { Store, rememberPeople, threadKey } from "../src/store.ts";
import { ZaloClient } from "../src/zalo/client.ts";

function raw(extra: Record<string, unknown> = {}) {
  return {
    type: ThreadType.User,
    threadId: "7",
    isSelf: false,
    data: { msgId: "11", cliMsgId: "22", uidFrom: "7", dName: "Bao", ts: "1000", msgType: "webchat", content: "yes agreed", ttl: 0, propertyExt: undefined, ...extra },
  };
}

test("incoming replies keep what they quote and the data needed to reply", () => {
  const store = new Store();
  store.update((s) => rememberPeople({ ...s, selfId: "1" }, { "8": "Chi" }));
  const client = new ZaloClient({} as never, store) as unknown as { selfId: string; toChatMessage: (m: unknown) => any };
  client.selfId = "1";
  const reply = client.toChatMessage(raw({ quote: { ownerId: "1", msg: "ship friday?", fromD: "Paul", attach: "" } }));
  assert.deepEqual(reply.quote, { from: "me", text: "ship friday?" });
  assert.deepEqual(reply.source, { content: "yes agreed", msgType: "webchat", propertyExt: undefined, uidFrom: "7", msgId: "11", cliMsgId: "22", ts: "1000", ttl: 0 });
  assert.deepEqual(client.toChatMessage(raw({ quote: { ownerId: "8", msg: "", fromD: "", attach: "{}" } })).quote, { from: "Chi", text: "[attachment]" });
  assert.equal(client.toChatMessage(raw()).quote, undefined);
});

test("sending a reply passes the quoted message to zca-js", async () => {
  const calls: unknown[][] = [];
  const api = { sendMessage: async (...args: unknown[]) => (calls.push(args), { message: { msgId: 99 }, attachment: [] }) };
  const store = new Store();
  const client = new ZaloClient(api as never, store);
  const key = threadKey("user", "7");
  const target = (client as unknown as { toChatMessage: (m: unknown) => any }).toChatMessage(raw());
  await client.send(key, "ok", target);
  assert.deepEqual(calls[0], [{ msg: "ok", quote: target.source }, "7", ThreadType.User]);
  assert.deepEqual(store.getState().messages[key]![0]!.quote, { from: "Bao", text: "yes agreed" });
  await assert.rejects(client.send(key, "x", { ...target, source: undefined }), /can't be replied/);
});
