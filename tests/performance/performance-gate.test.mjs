import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const rootPackage = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url)));
const harness = new URL("./performance-gate.mjs", import.meta.url);

test("the performance command and executable measurement gate exist", () => {
  assert.equal(rootPackage.scripts["test:performance"], "node --test tests/performance/*.test.mjs");
  assert.equal(existsSync(harness), true, "performance gate is missing");
});

test("the frozen boundary is exact and missing evidence is launch-blocking", async () => {
  const { evaluatePerformanceEvidence, PERFORMANCE_TARGETS } = await import(harness.href);
  assert.deepEqual(PERFORMANCE_TARGETS.load, { activeSessions: 100, requestsPerSecond: 20, durationSeconds: 900 });
  assert.deepEqual(PERFORMANCE_TARGETS.serverP95Milliseconds, { shell: 500, manifest: 750, clue: 750, answer: 750, reveal: 750 });
  assert.deepEqual(PERFORMANCE_TARGETS.excerptBoundary, { renderedLines: 400, utf8Bytes: 32 * 1024, rule: "FIRST_BOUNDARY" });
  assert.equal(PERFORMANCE_TARGETS.client.renderP95Milliseconds, 1000);
  assert.equal(PERFORMANCE_TARGETS.client.interactionP95Milliseconds, 100);
  assert.equal(PERFORMANCE_TARGETS.samples.serverPerEndpoint, 1000);
  assert.equal(PERFORMANCE_TARGETS.samples.clientPerBrowserFamily, 100);
  assert.equal(PERFORMANCE_TARGETS.freshnessMaximumMinutes, 5);
  assert.equal(PERFORMANCE_TARGETS.availabilityMinimumPercentPerMinute, 99);
  assert.deepEqual(PERFORMANCE_TARGETS.serverEndpoints, ["manifest", "clue", "answer", "reveal"]);
  assert.deepEqual(PERFORMANCE_TARGETS.client.interactions, ["scrolling", "clue activation", "answer selection", "reveal navigation"]);
  assert.deepEqual(PERFORMANCE_TARGETS.client.reference, { logicalProcessorCores: 4, availableMemoryGiB: 4, downstreamMbps: 10, roundTripLatencyMilliseconds: 100, viewport: { width: 320, height: 568 } });
  assert.deepEqual(evaluatePerformanceEvidence({}), { status: "INDETERMINATE", invitationsBlocked: true });
});

const syntheticSufficientFixture = {
  evidenceKind: "SYNTHETIC_TEST_FIXTURE",
  load: { activeSessions: 100, requestsPerSecond: 20, durationSeconds: 900 },
  server: Object.fromEntries(["shell", "manifest", "clue", "answer", "reveal"].map((name) => [name, { sampleCount: 1000, p95Milliseconds: name === "shell" ? 499 : 749 }])),
  client: Object.fromEntries(["Chrome desktop", "Edge desktop", "Firefox desktop", "Safari macOS", "Safari iOS/iPadOS", "Chrome Android"].map((name) => [name, { sampleCount: 100, renderP95Milliseconds: 999, interactionP95Milliseconds: { scrolling: 99, "clue activation": 99, "answer selection": 99, "reveal navigation": 99 }, excerptBoundary: { renderedLines: 400, utf8Bytes: 32 * 1024, rule: "FIRST_BOUNDARY" }, reference: { logicalProcessorCores: 4, availableMemoryGiB: 4, downstreamMbps: 10, roundTripLatencyMilliseconds: 100, viewport: { width: 320, height: 568 } } }])),
  mutation: { automaticRetryWithoutIdempotencyKey: false, maximumAcceptedTransitionsPerRepeatedKey: 1 },
  freshness: { maximumAgeMinutes: 5, staleManifestAndRevealFailClosed: true },
  availability: { percent: 99, measurement: "PER_MINUTE" },
};

test("a synthetic fixture exercises PASS only with every sufficient row and exact mutation guarantees", async () => {
  const { evaluatePerformanceEvidence } = await import(harness.href);
  assert.deepEqual(evaluatePerformanceEvidence(syntheticSufficientFixture), { status: "PASS", invitationsBlocked: false });
});

test("a sufficient threshold miss fails, while any insufficient row takes precedence", async () => {
  const { evaluatePerformanceEvidence } = await import(harness.href);
  const miss = structuredClone(syntheticSufficientFixture);
  miss.server.answer.p95Milliseconds = 750;
  assert.equal(evaluatePerformanceEvidence(miss).status, "FAIL");
  miss.client["Chrome Android"].sampleCount = 99;
  assert.equal(evaluatePerformanceEvidence(miss).status, "INDETERMINATE");
});

test("freshness, availability, missing-key retry, and repeated-key duplication are measured failures", async () => {
  const { evaluatePerformanceEvidence } = await import(harness.href);
  for (const mutate of [
    (value) => { value.freshness.maximumAgeMinutes = 5.01; },
    (value) => { value.freshness.staleManifestAndRevealFailClosed = false; },
    (value) => { value.availability.percent = 98.99; },
    (value) => { value.mutation.automaticRetryWithoutIdempotencyKey = true; },
    (value) => { value.mutation.maximumAcceptedTransitionsPerRepeatedKey = 2; },
  ]) {
    const evidence = structuredClone(syntheticSufficientFixture);
    mutate(evidence);
    assert.equal(evaluatePerformanceEvidence(evidence).status, "FAIL");
  }
});

test("malformed numeric evidence is indeterminate and outranks another measured miss", async () => {
  const { evaluatePerformanceEvidence } = await import(harness.href);
  const mutations = [
    (value) => { value.server.shell.sampleCount = 1000.5; value.server.answer.p95Milliseconds = 999; },
    (value) => { value.client["Chrome desktop"].sampleCount = Infinity; },
    (value) => { value.server.clue.p95Milliseconds = -1; },
    (value) => { value.client["Firefox desktop"].renderP95Milliseconds = NaN; },
    (value) => { value.freshness.maximumAgeMinutes = -1; },
    (value) => { value.availability.percent = 101; },
    (value) => { value.mutation.maximumAcceptedTransitionsPerRepeatedKey = -1; },
  ];
  for (const mutate of mutations) {
    const evidence = structuredClone(syntheticSufficientFixture);
    mutate(evidence);
    assert.equal(evaluatePerformanceEvidence(evidence).status, "INDETERMINATE");
  }
});
