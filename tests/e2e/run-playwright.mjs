import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export const normalizePlaywrightArgs = (args) => args[0] === "--" ? args.slice(1) : [...args];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const require = createRequire(import.meta.url);
  const result = spawnSync(process.execPath, [require.resolve("@playwright/test/cli"), "test", ...normalizePlaywrightArgs(process.argv.slice(2))], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
}
