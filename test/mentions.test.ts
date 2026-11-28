import { test } from "node:test";
import assert from "node:assert/strict";
import { filterMembers, mentionPositions, mentionQuery } from "../src/mentions.ts";

const chars = (s: string) => Array.from(s);

test("an @ at a word start opens a mention query", () => {
  assert.deepEqual(mentionQuery(chars("hi @Ch"), 6), { start: 3, query: "Ch" });
  assert.deepEqual(mentionQuery(chars("@"), 1), { start: 0, query: "" });
  assert.equal(mentionQuery(chars("mail a@b"), 8), null);
  assert.equal(mentionQuery(chars("hi @Chi there"), 13), null);
  assert.equal(mentionQuery(chars("no at"), 5), null);
});

test("members match by any word, accents optional", () => {
  const members = [
    { uid: "1", name: "Nguyễn Văn An" },
    { uid: "2", name: "Chi" },
    { uid: "3", name: "Lan Anh" },
  ];
  assert.deepEqual(filterMembers(members, "an").map((m) => m.uid), ["1", "3"]);
  assert.deepEqual(filterMembers(members, "van").map((m) => m.uid), ["1"]);
  assert.deepEqual(filterMembers(members, "hi").map((m) => m.uid), ["2"]);
  assert.equal(filterMembers(members, "").length, 3);
});

test("mention positions follow the final text and skip removed or partial names", () => {
  const picks = [
    { uid: "2", name: "Chi" },
    { uid: "1", name: "Nguyễn Văn An" },
    { uid: "9", name: "Gone" },
  ];
  assert.deepEqual(mentionPositions("@Nguyễn Văn An and @Chi, ok", picks), [
    { pos: 0, uid: "1", len: 14 },
    { pos: 19, uid: "2", len: 4 },
  ]);
  assert.deepEqual(mentionPositions("@Chingching", picks.slice(0, 1)), []);
  assert.deepEqual(mentionPositions("@Chi @Chi", [picks[0]!, picks[0]!]), [
    { pos: 0, uid: "2", len: 4 },
    { pos: 5, uid: "2", len: 4 },
  ]);
});
