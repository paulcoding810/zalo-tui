#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsx = join(root, "node_modules", ".bin", "tsx");
const child = spawn(tsx, ["--tsconfig", join(root, "tsconfig.json"), join(root, "src", "index.tsx")], {
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
