import { test } from "node:test";
import assert from "node:assert/strict";
import type { Key } from "ink";
import { navStep } from "../src/ui/nav.ts";

const none = {} as Key;
const ctrl = { ctrl: true } as Key;

test("j/k and arrows move by one and stop at the ends", () => {
  assert.equal(navStep("j", none, 2, 5, 3), 3);
  assert.equal(navStep("k", none, 2, 5, 3), 1);
  assert.equal(navStep("", { downArrow: true } as Key, 4, 5, 3), 4);
  assert.equal(navStep("", { upArrow: true } as Key, 0, 5, 3), 0);
});

test("g and G jump to the ends", () => {
  assert.equal(navStep("g", none, 3, 5, 3), 0);
  assert.equal(navStep("G", none, 1, 5, 3), 4);
});

test("ctrl+d and ctrl+u move half a page", () => {
  assert.equal(navStep("d", ctrl, 0, 20, 5), 5);
  assert.equal(navStep("u", ctrl, 3, 20, 5), 0);
  assert.equal(navStep("d", ctrl, 18, 20, 5), 19);
});

test("other keys and empty lists are ignored", () => {
  assert.equal(navStep("x", none, 1, 5, 3), null);
  assert.equal(navStep("a", ctrl, 1, 5, 3), null);
  assert.equal(navStep("j", { meta: true } as Key, 1, 5, 3), null);
  assert.equal(navStep("j", none, 0, 0, 3), null);
});
