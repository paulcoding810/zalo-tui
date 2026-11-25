import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listenForOpenRequests, openChatCommand, openRequestFile, readOpenRequest } from "../src/openRequest.ts";

test("only chat keys become click commands", () => {
  assert.equal(openChatCommand("user:1; rm -rf ~", "/x", 1), null);
  assert.equal(openChatCommand("group:12", "/a'b", 7), `printf %s group:12 > '/a'\\''b' && kill -USR2 7`);
});

test("a click command opens the chat in this process and cleans up", async () => {
  process.report.reportOnSignal = false;
  const dir = mkdtempSync(join(tmpdir(), "zalo tui's "));
  const file = openRequestFile(dir);
  const opened = new Promise<string>((resolve) => {
    const stop = listenForOpenRequests(file, (key) => {
      stop();
      resolve(key);
    });
  });
  execFileSync("/bin/sh", ["-c", openChatCommand("group:42", file)!]);
  assert.equal(await opened, "group:42");
  assert.equal(existsSync(file), false);
});

test("bad request files are ignored and removed", () => {
  const file = join(mkdtempSync(join(tmpdir(), "zalo-tui-")), "open-1");
  writeFileSync(file, "nonsense");
  assert.equal(readOpenRequest(file), null);
  assert.equal(existsSync(file), false);
  assert.equal(readOpenRequest(file), null);
});
