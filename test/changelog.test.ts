import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { latestRelease } from "../scripts/changelog.mjs";

test("the newest released section is found, skipping Unreleased", () => {
  const md = "# Changelog\n\n## [Unreleased]\n\n- wip\n\n## [1.2.0] - 2026-12-01\n\n### Added\n\n- thing\n\n## [1.1.0] - 2026-11-01\n\n- old\n";
  assert.deepEqual(latestRelease(md), { version: "1.2.0", date: "2026-12-01", notes: "### Added\n\n- thing" });
});

test("a changelog without releases has no latest release", () => {
  assert.equal(latestRelease("# Changelog\n\n## [Unreleased]\n"), null);
});

test("the project changelog's newest release matches package.json", () => {
  const release = latestRelease(readFileSync("CHANGELOG.md", "utf8"));
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(release?.version, pkg.version);
  assert.ok(release!.notes.length > 0);
});
