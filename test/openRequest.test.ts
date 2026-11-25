import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listenForOpenRequests,
  openChatCommand,
  openRequestFile,
  readOpenRequest,
  removeStaleRequests,
  runningMarker,
} from "../src/openRequest.ts";

test("only chat keys become click commands", () => {
  assert.equal(openChatCommand("user:1; rm -rf ~", "/x", 1), null);
  assert.equal(
    openChatCommand("group:12", "/a'b", 7),
    `[ -e '/a'\\''b/running-7' ] && printf %s group:12 > '/a'\\''b/open-7' && kill -USR2 7`,
  );
});

test("a click command opens the chat in this process and cleans up", async () => {
  process.report.reportOnSignal = false;
  const dir = mkdtempSync(join(tmpdir(), "zalo tui's "));
  let stop = () => {};
  const opened = new Promise<string>((resolve) => {
    stop = listenForOpenRequests(dir, resolve);
  });
  assert.equal(existsSync(runningMarker(dir)), true);
  execFileSync("/bin/sh", ["-c", openChatCommand("group:42", dir)!]);
  assert.equal(await opened, "group:42");
  assert.equal(existsSync(openRequestFile(dir)), false);
  stop();
  assert.equal(existsSync(runningMarker(dir)), false);
});

test("a click after the app quit signals nothing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "zalo-tui-"));
  const other = spawn("sleep", ["5"]);
  const exited = new Promise<string | null>((resolve) => other.on("exit", (_code, signal) => resolve(signal)));
  try {
    execFileSync("/bin/sh", ["-c", openChatCommand("user:1", dir, other.pid!)!]);
  } catch {}
  assert.equal(existsSync(openRequestFile(dir, other.pid!)), false);
  other.kill("SIGTERM");
  assert.equal(await exited, "SIGTERM");
});

test("leftovers from dead runs are removed at startup", () => {
  const dir = mkdtempSync(join(tmpdir(), "zalo-tui-"));
  const dead = 2 ** 22 + 12345;
  writeFileSync(runningMarker(dir, dead), "");
  writeFileSync(openRequestFile(dir, dead), "user:1");
  writeFileSync(runningMarker(dir, process.ppid), "");
  removeStaleRequests(dir);
  assert.equal(existsSync(runningMarker(dir, dead)), false);
  assert.equal(existsSync(openRequestFile(dir, dead)), false);
  assert.equal(existsSync(runningMarker(dir, process.ppid)), true);
});

test("bad request files are ignored and removed", () => {
  const file = join(mkdtempSync(join(tmpdir(), "zalo-tui-")), "open-1");
  writeFileSync(file, "nonsense");
  assert.equal(readOpenRequest(file), null);
  assert.equal(existsSync(file), false);
  assert.equal(readOpenRequest(file), null);
});
