import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeAccessibilityArgs, selectAccessibilityTests } from "./run-accessibility.mjs";

const rootPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url)));

test("the root accessibility command delegates argument handling to the scoped runner", () => {
  assert.equal(rootPackage.scripts["test:a11y"], "node tests/accessibility/run-accessibility.mjs");
});

test("normalizes pnpm's standalone separator and selects the requested mode", () => {
  assert.deepEqual(normalizeAccessibilityArgs(["--", "--mode=provenance"]), ["--mode=provenance"]);
  assert.deepEqual(selectAccessibilityTests([
    "accessibility-runner.test.mjs",
    "language-support.test.mjs",
    "provenance-support.test.mjs",
    "support-gate.test.mjs",
  ], ["--mode=provenance"]), [
    "accessibility-runner.test.mjs",
    "provenance-support.test.mjs",
    "support-gate.test.mjs",
  ]);
});

test("selects the exact privacy flow without mode-specific accessibility suites", () => {
  assert.deepEqual(normalizeAccessibilityArgs(["--", "--flow=privacy"]), ["--flow=privacy"]);
  assert.deepEqual(selectAccessibilityTests([
    "accessibility-runner.test.mjs",
    "language-support.test.mjs",
    "privacy-support.test.mjs",
    "provenance-support.test.mjs",
    "support-gate.test.mjs",
  ], ["--flow=privacy"]), [
    "accessibility-runner.test.mjs",
    "privacy-support.test.mjs",
    "support-gate.test.mjs",
  ]);
});

test("rejects unknown, duplicate, or unrelated accessibility arguments", () => {
  assert.throws(() => selectAccessibilityTests([], ["--mode=country"]), /unsupported accessibility mode/);
  assert.throws(() => selectAccessibilityTests([], ["--mode=provenance", "--mode=language"]), /exactly one mode/);
  assert.throws(() => selectAccessibilityTests([], ["--flow=account"]), /unsupported accessibility flow/);
  assert.throws(() => selectAccessibilityTests([], ["--flow=privacy", "--flow=privacy"]), /exactly one flow/);
  assert.throws(() => selectAccessibilityTests([], ["--mode=language", "--flow=privacy"]), /mode or flow/);
  assert.throws(() => selectAccessibilityTests([], ["--watch"]), /unsupported accessibility argument/);
  assert.throws(() => selectAccessibilityTests(["support-gate.test.mjs"], ["--mode=language"]), /no language accessibility test/);
  assert.throws(() => selectAccessibilityTests(["support-gate.test.mjs"], ["--flow=privacy"]), /no privacy accessibility test/);
});
