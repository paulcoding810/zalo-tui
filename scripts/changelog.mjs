import { readFileSync } from "node:fs";

export function latestRelease(markdown) {
  const heading = /^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/m;
  const match = heading.exec(markdown);
  if (!match) return null;
  const start = match.index + match[0].length;
  const rest = markdown.slice(start);
  const next = rest.search(/^## \[/m);
  const notes = (next === -1 ? rest : rest.slice(0, next)).trim();
  return { version: match[1], date: match[2] ?? null, notes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, file = "CHANGELOG.md"] = process.argv.slice(2);
  const release = latestRelease(readFileSync(file, "utf8"));
  if (!release) {
    console.error(`no released version found in ${file}`);
    process.exit(1);
  }
  if (command === "version") console.log(release.version);
  else if (command === "notes") console.log(release.notes);
  else {
    console.error("usage: node scripts/changelog.mjs version|notes [file]");
    process.exit(2);
  }
}
