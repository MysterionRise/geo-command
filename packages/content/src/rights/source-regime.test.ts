import {
  SourceRegimeControl,
  SourceRegimeRuleError,
  type RightsDeterminationInput,
  type StackOverflowItemIdentity,
} from "./source-regime";
interface Expectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toMatchObject(expected: unknown): void;
  toThrow(expected?: string | RegExp): void;
  toThrowError(expected?: unknown): void;
}
interface Each {
  <T>(cases: readonly T[]): (name: string, callback: (value: T) => unknown) => void;
}
interface TestFunction {
  (name: string, callback: () => unknown): void;
  readonly each: Each;
}
interface TestApi {
  readonly describe: (name: string, callback: () => unknown) => void;
  readonly expect: (actual: unknown) => Expectation;
  readonly it: TestFunction;
}
const testModuleName: string = "vitest";
const { describe, expect, it } = (await import(testModuleName)) as TestApi;
const item: StackOverflowItemIdentity = {
  postId: "post-17",
  revisionId: "revision-4",
  licenseName: "CC BY-SA",
  licenseVersion: "4.0",
  presentationDesignVersion: "presentation-2",
  interactionDesignVersion: "interaction-3",
  firstDisplayAttributionRequired: false,
};
const determination = (): RightsDeterminationInput => ({
  determinationId: "determination-1",
  writtenText: "Reveal attribution satisfies the covered license for this design.",
  reviewerId: "rights-reviewer-1",
  reviewerName: "Alex Reviewer",
  scope: "Delayed-attribution code guessing interaction",
  contributionRevisionDateTreatment: "Use the covered revision and its contribution date.",
  consideredLicenseVersions: ["CC BY-SA 4.0"],
  attributionFormat: "Author, post link, revision, and CC BY-SA 4.0 at reveal.",
  shareAlikeTreatment: "Covered reveal material retains the applicable notice.",
  effectiveDate: "2026-08-01",
  presentationDesignVersion: "presentation-2",
  interactionDesignVersion: "interaction-3",
  attributionAtRevealSatisfiesLicense: true,
  firstDisplayAttributionRequired: false,
  coveredItems: [{
    postId: item.postId,
    revisionId: item.revisionId,
    licenseName: item.licenseName,
    licenseVersion: item.licenseVersion,
  }],
  approval: {
    role: "Don",
    signerId: "don-1",
    signedAt: "2026-08-01T12:00:00.000Z",
    signature: "signed-determination-1",
  },
});
describe("source regime rights gate", () => {
  it("selects the recorded-agent versus project-controlled regime", () => {
    const control = SourceRegimeControl.select({
      versionId: "provenance-source-regime-v7",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "licensed-github-vs-project-controlled",
    } as never);
    expect(control.active).toMatchObject({
      selection: "licensed-github-vs-project-controlled",
      prompt: "Is an AI coding agent durably recorded as participating in this code change?",
      candidateCount: 2,
      allowedSourceClasses: ["licensed-github", "project-owned-human"],
    });
    expect(control.allowsCandidate({
      answer: "RECORDED_AGENT_PARTICIPATION",
      sourceClass: "licensed-github",
      markerClassification: "AGENT_RECORDED",
    })).toBe(true);
    expect(control.allowsCandidate({
      answer: "PROJECT_CONTROLLED_HUMAN_ONLY",
      sourceClass: "project-owned-human",
      creationOrCommissionBasis: "commissioned",
      recordedProjectAuthorization: "authorization-1",
      noAgentParticipationAttestation: "No AI coding agent participated.",
    })).toBe(true);
    expect(control.allowsCandidate({
      answer: "PROJECT_CONTROLLED_HUMAN_ONLY",
      sourceClass: "project-owned-human",
      creationOrCommissionBasis: "commissioned",
      recordedProjectAuthorization: "authorization-1",
    })).toBe(false);
  });
  it("selects the exclusive human-and-model fallback without a determination", () => {
    const control = SourceRegimeControl.select({
      versionId: "regime-1",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "project-owned-fallback",
    });
    expect(control.active.allowedSourceClasses).toEqual([
      "project-owned-human",
      "model-output",
    ]);
    expect(control.allowsSourceClass("stack-overflow")).toBe(false);
    expect(control.stackOverflowItemEligible(item)).toBe(false);
    expect(control.active.determination).toBe(null);
  });
  it("rejects Stack Overflow selection without an explicit determination", () => {
    expect(() => SourceRegimeControl.select({
      versionId: "regime-1",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "stack-overflow-enabled",
    })).toThrowError(new SourceRegimeRuleError(
      "stack-overflow-enabled requires an affirmative written determination",
    ));
  });
  it.each([
    "determinationId",
    "writtenText",
    "reviewerId",
    "reviewerName",
    "scope",
    "contributionRevisionDateTreatment",
    "attributionFormat",
    "shareAlikeTreatment",
    "effectiveDate",
    "presentationDesignVersion",
    "interactionDesignVersion",
  ] as const)("rejects a determination missing %s", (field) => {
    const incomplete = { ...determination(), [field]: " " };
    expect(() => SourceRegimeControl.select({
      versionId: "regime-1",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "stack-overflow-enabled",
      determination: incomplete,
    })).toThrow(field);
  });
  it("requires an affirmative delayed-attribution decision with no first-display duty", () => {
    expect(() => SourceRegimeControl.select({
      versionId: "regime-1",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "stack-overflow-enabled",
      determination: { ...determination(), attributionAtRevealSatisfiesLicense: false },
    })).toThrow("attributionAtRevealSatisfiesLicense must be true");
    expect(() => SourceRegimeControl.select({
      versionId: "regime-1",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "stack-overflow-enabled",
      determination: { ...determination(), firstDisplayAttributionRequired: true },
    })).toThrow("firstDisplayAttributionRequired must be false");
  });
  it("validates the approving role and recorded signature at runtime", () => {
    expect(() => SourceRegimeControl.select({
      versionId: "regime-1",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "stack-overflow-enabled",
      determination: {
        ...determination(),
        approval: { ...determination().approval, role: "Rights Reviewer" as "Don" },
      },
    })).toThrow("approval.role must be Don");
    expect(() => SourceRegimeControl.select({
      versionId: "regime-1",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "stack-overflow-enabled",
      determination: {
        ...determination(),
        approval: { ...determination().approval, signature: " " },
      },
    })).toThrow("approval.signature");
  });
  it("enables only an item exactly covered by the affirmative determination", () => {
    const control = SourceRegimeControl.select({
      versionId: "regime-2",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "stack-overflow-enabled",
      determination: determination(),
    });
    expect(control.stackOverflowItemEligible(item)).toBe(true);
    expect(control.allowsSourceClass("project-owned-human")).toBe(false);
    expect(Object.isFrozen(control.active)).toBe(true);
    expect(Object.isFrozen(control.active.determination?.coveredItems)).toBe(true);
  });
  it.each([
    { field: "postId", value: "post-18" },
    { field: "revisionId", value: "revision-5" },
    { field: "licenseName", value: "CC BY-SA International" },
    { field: "licenseVersion", value: "3.0" },
    { field: "presentationDesignVersion", value: "presentation-3" },
    { field: "interactionDesignVersion", value: "interaction-4" },
  ] as const)("excludes an item with mismatched $field", ({ field, value }) => {
    const control = SourceRegimeControl.select({
      versionId: "regime-2",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "stack-overflow-enabled",
      determination: determination(),
    });
    expect(control.stackOverflowItemEligible({ ...item, [field]: value })).toBe(false);
  });
  it("excludes an item requiring attribution on first display", () => {
    const control = SourceRegimeControl.select({
      versionId: "regime-2",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "stack-overflow-enabled",
      determination: determination(),
    });
    expect(control.stackOverflowItemEligible({
      ...item,
      firstDisplayAttributionRequired: true,
    })).toBe(false);
  });
  it("excludes an item missing its first-display attribution decision", () => {
    const control = SourceRegimeControl.select({
      versionId: "regime-2",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "stack-overflow-enabled",
      determination: determination(),
    });
    const incomplete = {
      postId: item.postId,
      revisionId: item.revisionId,
      licenseName: item.licenseName,
      licenseVersion: item.licenseVersion,
      presentationDesignVersion: item.presentationDesignVersion,
      interactionDesignVersion: item.interactionDesignVersion,
    };
    expect(control.stackOverflowItemEligible(
      incomplete as StackOverflowItemIdentity,
    )).toBe(false);
  });
  it("freezes the one active regime version when invitations start", () => {
    const control = SourceRegimeControl.select({
      versionId: "regime-1",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "project-owned-fallback",
    }).startInvitations("2026-08-03T00:00:00.000Z");
    expect(control.invitationsStartedAt).toBe("2026-08-03T00:00:00.000Z");
    expect(() => control.replace({
      versionId: "regime-2",
      selectedAt: "2026-08-04T00:00:00.000Z",
      selection: "stack-overflow-enabled",
      determination: determination(),
    })).toThrow("source regime cannot change after invitations start");
    expect(control.active.versionId).toBe("regime-1");
  });
  it("rejects selection before the Don approval was signed", () => {
    expect(() => SourceRegimeControl.select({
      versionId: "regime-2",
      selectedAt: "2026-08-01T11:59:59.000Z",
      selection: "stack-overflow-enabled",
      determination: determination(),
    })).toThrow("selectedAt must not precede approval.signedAt");
  });
  it("rejects selection before the determination effective date", () => {
    const rights = determination();
    expect(() => SourceRegimeControl.select({
      versionId: "regime-2",
      selectedAt: "2026-07-31T23:59:59.000Z",
      selection: "stack-overflow-enabled",
      determination: {
        ...rights,
        approval: { ...rights.approval, signedAt: "2026-07-31T20:00:00.000Z" },
      },
    })).toThrow("selectedAt must not precede determination.effectiveDate");
  });
  it("rejects invitation start before regime selection", () => {
    const control = SourceRegimeControl.select({
      versionId: "regime-1",
      selectedAt: "2026-08-02T00:00:00.000Z",
      selection: "project-owned-fallback",
    });
    expect(() => control.startInvitations("2026-08-01T23:59:59.000Z")).toThrow(
      "invitationsStartedAt must not precede selectedAt",
    );
  });
});
