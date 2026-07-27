import {
  AcquisitionRequestError,
  buildCommitEndpoint,
  buildGitObjectEndpoint,
  validateAcquisitionRequest,
  validateGitHubEndpoint,
} from "./request";

interface Expectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toThrow(expected?: unknown): void;
}

interface TestApi {
  readonly describe: (name: string, callback: () => unknown) => void;
  readonly expect: (actual: unknown) => Expectation;
  readonly it: (name: string, callback: () => unknown) => void;
}

const testModuleName: string = "vitest";
const { describe, expect, it } = (await import(testModuleName)) as TestApi;

const approvedScope = {
  repository: "mysterionrise/encrypted-information-retrieval",
  subtree: "src/encrypted_ir",
  purpose: "LANGUAGE_CANDIDATE",
} as const;

const validInput = {
  repository: approvedScope.repository,
  commit: "a".repeat(40),
  subtree: approvedScope.subtree,
  purpose: approvedScope.purpose,
  observationTime: "2026-07-27T15:00:00Z",
} as const;

describe("acquisition request boundary", () => {
  it("accepts one exact approved immutable request", () => {
    expect(validateAcquisitionRequest(validInput, approvedScope)).toEqual(validInput);
  });

  it("rejects unknown, missing, or policy-widening input fields", () => {
    expect(() => validateAcquisitionRequest(
      { ...validInput, repository: undefined },
      approvedScope,
    )).toThrow("request fields must match exactly");
    expect(() => validateAcquisitionRequest(
      { ...validInput, url: "https://api.github.com/" },
      approvedScope,
    )).toThrow("request fields must match exactly");
    expect(() => validateAcquisitionRequest(
      { ...validInput, repositories: [validInput.repository] },
      approvedScope,
    )).toThrow("request fields must match exactly");
  });

  it("rejects an unapproved or non-canonical repository", () => {
    expect(() => validateAcquisitionRequest(
      { ...validInput, repository: "other/repository" },
      approvedScope,
    )).toThrow("repository is not the approved repository");
    expect(() => validateAcquisitionRequest(
      { ...validInput, repository: "MysterionRise/encrypted-information-retrieval" },
      approvedScope,
    )).toThrow("repository is not canonical");
  });

  it("rejects mutable and malformed commit references", () => {
    for (const commit of ["main", "refs/heads/main", "A".repeat(40), "a".repeat(39)]) {
      expect(() => validateAcquisitionRequest(
        { ...validInput, commit },
        approvedScope,
      )).toThrow("commit must be forty lowercase hexadecimal characters");
    }
  });

  it("rejects path escape, normalization, and unapproved subtree variants", () => {
    for (const subtree of [
      "../src",
      "/src/encrypted_ir",
      "src//encrypted_ir",
      "src\\encrypted_ir",
      "src/./encrypted_ir",
      "src/encrypted_ir/",
      "src/other",
    ]) {
      expect(() => validateAcquisitionRequest(
        { ...validInput, subtree },
        approvedScope,
      )).toThrow();
    }
  });

  it("rejects unknown or unauthorized purposes", () => {
    expect(() => validateAcquisitionRequest(
      { ...validInput, purpose: "GENERAL_CRAWL" },
      approvedScope,
    )).toThrow("purpose is unknown");
    expect(() => validateAcquisitionRequest(
      { ...validInput, purpose: "RECORDED_AGENT_PARTICIPATION_CANDIDATE" },
      approvedScope,
    )).toThrow("purpose is not approved");
  });

  it("requires a whole-second UTC observation time", () => {
    for (const observationTime of [
      "2026-07-27T15:00:00.000Z",
      "2026-07-27T15:00:00+00:00",
      "not-a-time",
    ]) {
      expect(() => validateAcquisitionRequest(
        { ...validInput, observationTime },
        approvedScope,
      )).toThrow("observationTime must be whole-second RFC3339 UTC");
    }
  });

  it("rejects a calendar date that JavaScript would normalize", () => {
    expect(() => validateAcquisitionRequest(
      { ...validInput, observationTime: "2026-02-30T15:00:00Z" },
      approvedScope,
    )).toThrow("observationTime must be whole-second RFC3339 UTC");
  });

  it("builds only immutable commit and Git object endpoints", () => {
    const request = validateAcquisitionRequest(validInput, approvedScope);
    expect(buildCommitEndpoint(request)).toBe(
      `https://api.github.com/repos/${validInput.repository}/commits/${validInput.commit}`,
    );
    expect(buildGitObjectEndpoint(request, "trees", "b".repeat(40))).toBe(
      `https://api.github.com/repos/${validInput.repository}/git/trees/${"b".repeat(40)}`,
    );
    expect(buildGitObjectEndpoint(request, "blobs", "c".repeat(40))).toBe(
      `https://api.github.com/repos/${validInput.repository}/git/blobs/${"c".repeat(40)}`,
    );
  });

  it("rejects mutable Git object identities and unexpected object kinds", () => {
    const request = validateAcquisitionRequest(validInput, approvedScope);
    expect(() => buildGitObjectEndpoint(request, "trees", "main"))
      .toThrow("object SHA must be forty lowercase hexadecimal characters");
    expect(() => buildGitObjectEndpoint(request, "commits" as "trees", "b".repeat(40)))
      .toThrow("Git object kind is not allowed");
  });

  it("accepts only exact HTTPS API endpoints without query or credentials", () => {
    const endpoint = buildCommitEndpoint(
      validateAcquisitionRequest(validInput, approvedScope),
    );
    expect(validateGitHubEndpoint(endpoint)).toBe(endpoint);
    for (const candidate of [
      endpoint.replace("https:", "http:"),
      endpoint.replace("api.github.com", "github.com"),
      `${endpoint}?recursive=1`,
      `${endpoint}/`,
      `https://token@api.github.com/repos/${validInput.repository}/commits/${validInput.commit}`,
      "https://api.github.com/graphql",
      `https://api.github.com/repos/${validInput.repository}/zipball/${validInput.commit}`,
      `https://raw.githubusercontent.com/${validInput.repository}/${validInput.commit}/file.ts`,
    ]) {
      expect(() => validateGitHubEndpoint(candidate)).toThrow();
    }
  });

  it("uses a specific request-boundary error", () => {
    expect(() => validateGitHubEndpoint("https://github.com/owner/repo"))
      .toThrow(AcquisitionRequestError);
  });
});
