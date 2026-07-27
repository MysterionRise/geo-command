import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const rootPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url)));
const harness = new URL("./support-gate.mjs", import.meta.url);

test("the accessibility command and executable support gate exist", () => {
  assert.equal(rootPackage.scripts["test:a11y"], "node tests/accessibility/run-accessibility.mjs");
  assert.equal(existsSync(harness), true, "accessibility support gate is missing");
});

test("unrecorded browser and assistive-technology evidence blocks invitations", async () => {
  const { evaluateAccessibilityEvidence, ACCESSIBILITY_TARGETS } = await import(harness.href);
  assert.equal(ACCESSIBILITY_TARGETS.minimumViewport.width, 320);
  assert.equal(ACCESSIBILITY_TARGETS.minimumViewport.height, 568);
  assert.equal(ACCESSIBILITY_TARGETS.noJavaScript, "EXPLANATION_ONLY");
  assert.deepEqual(ACCESSIBILITY_TARGETS.browserFamilies, ["Chrome desktop", "Edge desktop", "Firefox desktop", "Safari macOS", "Safari iOS/iPadOS", "Chrome Android"]);
  assert.deepEqual(ACCESSIBILITY_TARGETS.assistiveTechnology, ["VoiceOver + Safari macOS", "VoiceOver + Safari iOS", "NVDA + Chrome Windows", "NVDA + Firefox Windows"]);
  assert.deepEqual(ACCESSIBILITY_TARGETS.majorVersionSlots, [null, null]);
  assert.deepEqual(evaluateAccessibilityEvidence({ frozenVersions: {}, completedFlows: [] }), {
    status: "INDETERMINATE",
    invitationsBlocked: true,
  });
});

test("local Chromium evidence never satisfies the frozen browser and AT matrix", async () => {
  const { evaluateAccessibilityEvidence } = await import(harness.href);
  assert.equal(evaluateAccessibilityEvidence({
    frozenVersions: { "Chrome desktop": ["local Chromium"] },
    completedFlows: ["Chrome desktop/local Chromium/local automated keyboard"],
  }).status, "INDETERMINATE");
});

const checks = { keyboardOnly: true, visibleFocus: true, announcements: true, screenReaderLabels: true, contrast: true, nonColorState: true, textEquivalent: true, responsive: true, reducedMotion: true, noJavaScriptExplanationOnly: true };
const families = ["Chrome desktop", "Edge desktop", "Firefox desktop", "Safari macOS", "Safari iOS/iPadOS", "Chrome Android"];
const combinations = ["VoiceOver + Safari macOS", "VoiceOver + Safari iOS", "NVDA + Chrome Windows", "NVDA + Firefox Windows"];
const syntheticCompleteFixture = {
  evidenceKind: "SYNTHETIC_TEST_FIXTURE",
  frozenVersions: Object.fromEntries(families.map((family) => [family, ["124", "123"]])),
  browserFlows: families.flatMap((family) => ["124", "123"].map((version) => ({ family, version, checks: { ...checks } }))),
  assistiveTechnologyFlows: combinations.map((combination) => ({ combination, checks: { ...checks } })),
};

const genericAuthority = {
  trustDomainId: "accessibility-review-domain-v1",
  verifyEvidence: () => true,
};

test("synthetic evidence never passes; only authenticated operational evidence can exercise PASS", async () => {
  const { evaluateAccessibilityEvidence } = await import(harness.href);
  assert.deepEqual(evaluateAccessibilityEvidence(syntheticCompleteFixture, genericAuthority), { status: "INDETERMINATE", invitationsBlocked: true });
  const operationalFixture = { ...syntheticCompleteFixture, evidenceKind: "OPERATIONAL_MEASURED", authorityDomainId: genericAuthority.trustDomainId };
  assert.deepEqual(evaluateAccessibilityEvidence(operationalFixture, genericAuthority), { status: "PASS", invitationsBlocked: false });
  assert.equal(evaluateAccessibilityEvidence(operationalFixture, { ...genericAuthority, verifyEvidence: () => false }).status, "INDETERMINATE");
  assert.equal(evaluateAccessibilityEvidence({ ...operationalFixture, authorityDomainId: "foreign-domain" }, genericAuthority).status, "INDETERMINATE");
  assert.equal(evaluateAccessibilityEvidence({ ...syntheticCompleteFixture, browserFlows: syntheticCompleteFixture.browserFlows.map((row) => `${row.family}/${row.version}`) }).status, "INDETERMINATE");
});

test("a measured accessibility check failure fails after the matrix is sufficient", async () => {
  const { evaluateAccessibilityEvidence } = await import(harness.href);
  const evidence = structuredClone(syntheticCompleteFixture);
  evidence.assistiveTechnologyFlows[0].checks.visibleFocus = false;
  const operational = { ...evidence, evidenceKind: "OPERATIONAL_MEASURED", authorityDomainId: genericAuthority.trustDomainId };
  assert.equal(evaluateAccessibilityEvidence(operational, genericAuthority).status, "FAIL");
});

test("duplicate rows cannot hide a measured failure or satisfy exact matrix completeness", async () => {
  const { evaluateAccessibilityEvidence } = await import(harness.href);
  const operational = { ...structuredClone(syntheticCompleteFixture), evidenceKind: "OPERATIONAL_MEASURED", authorityDomainId: genericAuthority.trustDomainId };

  const duplicateBrowser = structuredClone(operational);
  duplicateBrowser.browserFlows.push(structuredClone(duplicateBrowser.browserFlows[0]));
  assert.equal(evaluateAccessibilityEvidence(duplicateBrowser, genericAuthority).status, "INDETERMINATE");
  duplicateBrowser.browserFlows.at(-1).checks.contrast = false;
  assert.equal(evaluateAccessibilityEvidence(duplicateBrowser, genericAuthority).status, "FAIL");

  const duplicateAssistiveTechnology = structuredClone(operational);
  duplicateAssistiveTechnology.assistiveTechnologyFlows.push(structuredClone(duplicateAssistiveTechnology.assistiveTechnologyFlows[0]));
  assert.equal(evaluateAccessibilityEvidence(duplicateAssistiveTechnology, genericAuthority).status, "INDETERMINATE");
  duplicateAssistiveTechnology.assistiveTechnologyFlows.at(-1).checks.screenReaderLabels = false;
  assert.equal(evaluateAccessibilityEvidence(duplicateAssistiveTechnology, genericAuthority).status, "FAIL");
});

test("shared operational evidence and every nested row use exact envelopes", async () => {
  const { evaluateAccessibilityEvidence } = await import(harness.href);
  const variants = [];
  const extraTopLevel = { ...structuredClone(syntheticCompleteFixture), evidenceKind: "OPERATIONAL_MEASURED", authorityDomainId: genericAuthority.trustDomainId, claimedPass: true };
  variants.push(extraTopLevel);
  const extraBrowserField = { ...structuredClone(syntheticCompleteFixture), evidenceKind: "OPERATIONAL_MEASURED", authorityDomainId: genericAuthority.trustDomainId };
  extraBrowserField.browserFlows[0].claimedPass = true;
  variants.push(extraBrowserField);
  const extraAssistiveTechnologyField = { ...structuredClone(syntheticCompleteFixture), evidenceKind: "OPERATIONAL_MEASURED", authorityDomainId: genericAuthority.trustDomainId };
  extraAssistiveTechnologyField.assistiveTechnologyFlows[0].claimedPass = true;
  variants.push(extraAssistiveTechnologyField);
  const extraCheck = { ...structuredClone(syntheticCompleteFixture), evidenceKind: "OPERATIONAL_MEASURED", authorityDomainId: genericAuthority.trustDomainId };
  extraCheck.browserFlows[0].checks.claimedAccessible = true;
  variants.push(extraCheck);
  for (const variant of variants) assert.equal(evaluateAccessibilityEvidence(variant, genericAuthority).status, "INDETERMINATE");
});
