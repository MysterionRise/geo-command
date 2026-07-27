import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

test("defines the pnpm workspace boundary", () => {
  assert.equal(
    existsSync(new URL("../../pnpm-workspace.yaml", import.meta.url)),
    true,
    "pnpm-workspace.yaml must define the workspace boundary",
  );
});
