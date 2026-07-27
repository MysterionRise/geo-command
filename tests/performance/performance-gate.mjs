const browserFamilies = Object.freeze(["Chrome desktop", "Edge desktop", "Firefox desktop", "Safari macOS", "Safari iOS/iPadOS", "Chrome Android"]);
const interactions = Object.freeze(["scrolling", "clue activation", "answer selection", "reveal navigation"]);
const reference = Object.freeze({ logicalProcessorCores: 4, availableMemoryGiB: 4, downstreamMbps: 10, roundTripLatencyMilliseconds: 100, viewport: Object.freeze({ width: 320, height: 568 }) });
const excerptBoundary = Object.freeze({ renderedLines: 400, utf8Bytes: 32 * 1024, rule: "FIRST_BOUNDARY" });

export const PERFORMANCE_TARGETS = Object.freeze({
  load: Object.freeze({ activeSessions: 100, requestsPerSecond: 20, durationSeconds: 900 }),
  serverP95Milliseconds: Object.freeze({ shell: 500, manifest: 750, clue: 750, answer: 750, reveal: 750 }),
  serverEndpoints: Object.freeze(["manifest", "clue", "answer", "reveal"]),
  excerptBoundary,
  client: Object.freeze({ renderP95Milliseconds: 1000, interactionP95Milliseconds: 100, interactions, reference }),
  samples: Object.freeze({ serverPerEndpoint: 1000, clientPerBrowserFamily: 100 }),
  freshnessMaximumMinutes: 5,
  availabilityMinimumPercentPerMinute: 99,
});

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const nonnegative = (value) => finite(value) && value >= 0;
const sample = (value, minimum) => Number.isSafeInteger(value) && value >= minimum;

export function evaluatePerformanceEvidence(evidence = {}) {
  const serverNames = Object.keys(PERFORMANCE_TARGETS.serverP95Milliseconds);
  const hasLoad = same(evidence.load, PERFORMANCE_TARGETS.load);
  const serverComplete = serverNames.every((name) => sample(evidence.server?.[name]?.sampleCount, 1000) && nonnegative(evidence.server[name].p95Milliseconds));
  const clientComplete = browserFamilies.every((family) => {
    const row = evidence.client?.[family];
    return sample(row?.sampleCount, 100) && nonnegative(row.renderP95Milliseconds) && same(row.reference, reference)
      && same(row.excerptBoundary, excerptBoundary)
      && interactions.every((name) => nonnegative(row.interactionP95Milliseconds?.[name]));
  });
  const mutationComplete = typeof evidence.mutation?.automaticRetryWithoutIdempotencyKey === "boolean"
    && Number.isSafeInteger(evidence.mutation?.maximumAcceptedTransitionsPerRepeatedKey) && evidence.mutation.maximumAcceptedTransitionsPerRepeatedKey >= 0;
  const freshnessComplete = nonnegative(evidence.freshness?.maximumAgeMinutes)
    && typeof evidence.freshness?.staleManifestAndRevealFailClosed === "boolean";
  const availabilityComplete = nonnegative(evidence.availability?.percent) && evidence.availability.percent <= 100 && evidence.availability?.measurement === "PER_MINUTE";
  if (!hasLoad || !serverComplete || !clientComplete || !mutationComplete || !freshnessComplete || !availabilityComplete) {
    return Object.freeze({ status: "INDETERMINATE", invitationsBlocked: true });
  }
  const missed = serverNames.some((name) => evidence.server[name].p95Milliseconds >= PERFORMANCE_TARGETS.serverP95Milliseconds[name])
    || browserFamilies.some((family) => evidence.client[family].renderP95Milliseconds >= 1000
      || interactions.some((name) => evidence.client[family].interactionP95Milliseconds[name] >= 100))
    || evidence.mutation.automaticRetryWithoutIdempotencyKey
    || evidence.mutation.maximumAcceptedTransitionsPerRepeatedKey > 1
    || evidence.freshness.maximumAgeMinutes > 5 || !evidence.freshness.staleManifestAndRevealFailClosed
    || evidence.availability.percent < 99;
  return Object.freeze({ status: missed ? "FAIL" : "PASS", invitationsBlocked: missed });
}
