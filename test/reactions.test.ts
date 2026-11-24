import { test } from "node:test";
import assert from "node:assert/strict";
import { Reactions } from "zca-js";
import { REACTIONS, reactionIcon, searchReactions } from "../src/reactions.ts";

test("every zca-js reaction except none is offered with an emoji", () => {
  const codes = Object.values(Reactions).filter((c) => c);
  assert.equal(REACTIONS.length, codes.length);
  for (const r of REACTIONS) assert.notEqual(r.emoji, r.code, `${r.name} has no emoji`);
});

test("search prefers word starts over substrings", () => {
  assert.deepEqual(searchReactions("ok").map((r) => r.name).slice(0, 2), ["ok", "broken heart"]);
  assert.equal(searchReactions("pray")[0]!.code, "_()_");
  assert.equal(searchReactions("heart")[0]!.name, "heart");
  assert.ok(searchReactions("heart").some((r) => r.name === "broken heart"));
  assert.deepEqual(searchReactions("zzz"), []);
});

test("icons fall back to the raw code for unknown reactions", () => {
  assert.equal(reactionIcon("/-heart"), "❤");
  assert.equal(reactionIcon(":-bye"), "👋");
  assert.equal(reactionIcon("/-unknown"), "/-unknown");
});
