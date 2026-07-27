const browserFamilies = Object.freeze(["Chrome desktop", "Edge desktop", "Firefox desktop", "Safari macOS", "Safari iOS/iPadOS", "Chrome Android"]);
const assistiveTechnology = Object.freeze(["VoiceOver + Safari macOS", "VoiceOver + Safari iOS", "NVDA + Chrome Windows", "NVDA + Firefox Windows"]);

export const ACCESSIBILITY_TARGETS = Object.freeze({
  browserFamilies,
  majorVersionSlots: Object.freeze([null, null]),
  assistiveTechnology,
  minimumViewport: Object.freeze({ width: 320, height: 568 }),
  noJavaScript: "EXPLANATION_ONLY",
});

const checkNames = Object.freeze(["keyboardOnly", "visibleFocus", "announcements", "screenReaderLabels", "contrast", "nonColorState", "textEquivalent", "responsive", "reducedMotion", "noJavaScriptExplanationOnly"]);
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const result = (status) => Object.freeze({ status, invitationsBlocked: status !== "PASS" });

export function evaluateAccessibilityEvidence(evidence = {}, authority = {}) {
  if (evidence.evidenceKind !== "OPERATIONAL_MEASURED"
    || typeof evidence.authorityDomainId !== "string" || evidence.authorityDomainId.trim().length === 0
    || typeof authority !== "object" || authority === null
    || authority.trustDomainId !== evidence.authorityDomainId
    || typeof authority.verifyEvidence !== "function") {
    return result("INDETERMINATE");
  }
  try {
    if (authority.verifyEvidence(evidence) !== true) return result("INDETERMINATE");
  } catch {
    return result("INDETERMINATE");
  }
  const versions = evidence.frozenVersions ?? {};
  const browserFlows = Array.isArray(evidence.browserFlows) ? evidence.browserFlows : [];
  const atFlows = Array.isArray(evidence.assistiveTechnologyFlows) ? evidence.assistiveTechnologyFlows : [];
  const measuredFailure = [...browserFlows, ...atFlows].some((row) => isRecord(row) && isRecord(row.checks)
    && checkNames.some((name) => row.checks[name] === false));
  if (measuredFailure) return result("FAIL");
  const exactEvidence = exactKeys(evidence, ["assistiveTechnologyFlows", "authorityDomainId", "browserFlows", "evidenceKind", "frozenVersions"]);
  const versionsComplete = exactKeys(versions, browserFamilies) && browserFamilies.every((family) =>
    Array.isArray(versions[family]) && versions[family].length === 2
    && versions[family].every((version) => typeof version === "string" && /^\d+$/.test(version))
    && new Set(versions[family]).size === 2);
  const structuredBrowser = (row) => exactKeys(row, ["checks", "family", "version"])
    && exactKeys(row.checks, checkNames)
    && checkNames.every((name) => typeof row.checks[name] === "boolean");
  const structuredAt = (row) => exactKeys(row, ["checks", "combination"])
    && exactKeys(row.checks, checkNames)
    && checkNames.every((name) => typeof row.checks[name] === "boolean");
  const expectedBrowserRows = versionsComplete ? browserFamilies.flatMap((family) => versions[family].map((version) => ({ family, version }))) : [];
  const browsersComplete = browserFlows.length === browserFamilies.length * 2
    && browserFlows.every(structuredBrowser)
    && expectedBrowserRows.every(({ family, version }) => browserFlows.filter((row) => row.family === family && row.version === version).length === 1);
  const atComplete = atFlows.length === assistiveTechnology.length
    && atFlows.every(structuredAt)
    && assistiveTechnology.every((combination) => atFlows.filter((row) => row.combination === combination).length === 1);
  if (!exactEvidence || !versionsComplete || !browsersComplete || !atComplete) return result("INDETERMINATE");
  return result("PASS");
}
