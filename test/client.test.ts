import { test } from "node:test";
import assert from "node:assert/strict";
import { closeReason } from "../src/zalo/client.ts";

test("disconnect reasons explain sessions opened elsewhere", () => {
  assert.equal(closeReason(3000, "", false), "Zalo Web opened elsewhere");
  assert.match(closeReason(1000, "NORMAL_CLOSURE", false), /opened elsewhere/);
  assert.equal(closeReason(1000, "NORMAL_CLOSURE", true), "closed (1000: NORMAL_CLOSURE)");
  assert.equal(closeReason(1006, "", false), "closed (1006)");
});
