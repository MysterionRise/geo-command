import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const supportedModes = new Set(["language", "provenance"]);
const supportedFlows = new Set(["privacy"]);

export const normalizeAccessibilityArgs = (args) => args[0] === "--" ? args.slice(1) : [...args];

export function selectAccessibilityTests(fileNames, rawArgs) {
  const args = normalizeAccessibilityArgs(rawArgs);
  const modeArgs = args.filter((argument) => argument.startsWith("--mode="));
  const flowArgs = args.filter((argument) => argument.startsWith("--flow="));
  if (modeArgs.length > 1) throw new Error("accessibility runs accept exactly one mode");
  if (flowArgs.length > 1) throw new Error("accessibility runs accept exactly one flow");
  if (modeArgs.length > 0 && flowArgs.length > 0) throw new Error("accessibility runs accept a mode or flow, not both");
  if (args.some((argument) => !argument.startsWith("--mode=") && !argument.startsWith("--flow="))) throw new Error("unsupported accessibility argument");
  const mode = modeArgs[0]?.slice("--mode=".length);
  const flow = flowArgs[0]?.slice("--flow=".length);
  if (mode !== undefined && !supportedModes.has(mode)) throw new Error("unsupported accessibility mode");
  if (flow !== undefined && !supportedFlows.has(flow)) throw new Error("unsupported accessibility flow");
  if (mode !== undefined && !fileNames.some((fileName) => fileName.startsWith(`${mode}-`) && fileName.endsWith(".test.mjs"))) {
    throw new Error(`no ${mode} accessibility test exists`);
  }
  if (flow !== undefined && !fileNames.some((fileName) => fileName.startsWith(`${flow}-`) && fileName.endsWith(".test.mjs"))) {
    throw new Error(`no ${flow} accessibility test exists`);
  }
  const scope = mode ?? flow;
  return [...fileNames]
    .filter((fileName) => fileName.endsWith(".test.mjs"))
    .filter((fileName) => scope === undefined
      || (!fileName.startsWith("language-") && !fileName.startsWith("provenance-") && !fileName.startsWith("privacy-"))
      || fileName.startsWith(`${scope}-`))
    .sort();
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && currentFile === fileURLToPath(pathToFileURL(process.argv[1]))) {
  const directory = dirname(currentFile);
  try {
    const selected = selectAccessibilityTests(readdirSync(directory), process.argv.slice(2));
    if (selected.length === 0) throw new Error("no accessibility tests selected");
    const result = spawnSync(process.execPath, ["--test", ...selected.map((fileName) => join(directory, fileName))], { stdio: "inherit" });
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
