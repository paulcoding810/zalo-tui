import { test } from "node:test";
import assert from "node:assert/strict";
import { Reactions } from "zca-js";
import { REACTIONS, parseReactionContent, reactionIcon, searchReactions } from "../src/reactions.ts";

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

test("reaction content is read from both live objects and stored JSON strings", () => {
  assert.deepEqual(parseReactionContent({ rMsg: [{ gMsgID: "8522", cMsgID: 1, msgType: 1 }], rIcon: "/-heart", rType: 5, source: 6 }), {
    msgIds: ["8522"],
    icon: "/-heart",
  });
  assert.deepEqual(parseReactionContent('{"rMsg":[{"gMsgID":8522356491615,"cMsgID":1,"msgType":1}],"rIcon":":>","rType":0,"source":6}'), {
    msgIds: ["8522356491615"],
    icon: ":>",
  });
  assert.deepEqual(parseReactionContent('{"rMsg":[],"rIcon":"","rType":-1}'), { msgIds: [], icon: "" });
  assert.deepEqual(parseReactionContent("not json"), { msgIds: [], icon: "" });
  assert.deepEqual(parseReactionContent(undefined), { msgIds: [], icon: "" });
});
