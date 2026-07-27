import assert from "node:assert/strict";
import test from "node:test";

import { normalizePlaywrightArgs } from "./run-playwright.mjs";

test("normalizes only a leading standalone separator", () => {
  assert.deepEqual(normalizePlaywrightArgs(["--", "--project=arcade", "--grep", "shell"]), ["--project=arcade", "--grep", "shell"]);
  assert.deepEqual(normalizePlaywrightArgs(["--project=arcade", "--", "shell"]), ["--project=arcade", "--", "shell"]);
});
