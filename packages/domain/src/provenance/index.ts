export type ProvenanceSourceClass =
  | "model-output"
  | "project-owned-human"
  | "stack-overflow";

export type SourceRegimeSelection =
  | "project-owned-fallback"
  | "stack-overflow-enabled";

export interface ProvenanceCandidateInput {
  id: string;
  sourceClass: ProvenanceSourceClass;
  label: string;
}

export interface SourceRegimeApprovalSnapshot {
  readonly role: "Don";
  readonly signerId: string;
  readonly signedAt: string;
  readonly signature: string;
}

export interface CoveredItemSnapshot {
  readonly postId: string;
  readonly revisionId: string;
  readonly licenseName: string;
  readonly licenseVersion: string;
}

export interface SourceRegimeDeterminationSnapshot {
  readonly determinationId: string;
  readonly writtenText: string;
  readonly reviewerId: string;
  readonly reviewerName: string;
  readonly scope: string;
  readonly contributionRevisionDateTreatment: string;
  readonly consideredLicenseVersions: readonly string[];
  readonly attributionFormat: string;
  readonly shareAlikeTreatment: string;
  readonly effectiveDate: string;
  readonly presentationDesignVersion: string;
  readonly interactionDesignVersion: string;
  readonly attributionAtRevealSatisfiesLicense: true;
  readonly firstDisplayAttributionRequired: false;
  readonly coveredItems: readonly CoveredItemSnapshot[];
  readonly approval: SourceRegimeApprovalSnapshot;
}

export interface SourceRegimeSnapshotInput {
  readonly versionId: string;
  readonly selectedAt: string;
  readonly selection: SourceRegimeSelection;
  readonly allowedSourceClasses: readonly ProvenanceSourceClass[];
  readonly determination: SourceRegimeDeterminationSnapshot | null;
}

export interface ProvenanceRegimeInput {
  readonly sourceRegime: unknown;
  readonly candidates: readonly unknown[];
}

export interface ProvenanceRegime {
  readonly versionId: string;
  readonly selectedAt: string;
  readonly selection: SourceRegimeSelection;
  readonly candidates: readonly Readonly<ProvenanceCandidateInput>[];
  readonly sourceRegime: SourceRegimeSnapshotInput;
}

export class ProvenanceRegimeRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProvenanceRegimeRuleError";
  }
}

const EXPECTED_CLASSES = Object.freeze({
  "project-owned-fallback": Object.freeze<ProvenanceSourceClass[]>([
    "project-owned-human", "model-output",
  ]),
  "stack-overflow-enabled": Object.freeze<ProvenanceSourceClass[]>([
    "model-output", "stack-overflow",
  ]),
});

const LABELS: Readonly<Record<ProvenanceSourceClass, string>> = Object.freeze({
  "model-output": "Recorded model output",
  "project-owned-human": "Project-owned human sample",
  "stack-overflow": "Recorded Stack Overflow publication",
});

const record = (value: unknown, field: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProvenanceRegimeRuleError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProvenanceRegimeRuleError(`${field} must be a non-blank string`);
  }
  return value.trim();
};

const instant = (value: unknown, field: string): string => {
  const parsed = text(value, field);
  if (!Number.isFinite(Date.parse(parsed))) {
    throw new ProvenanceRegimeRuleError(`${field} must be a valid instant`);
  }
  return parsed;
};

const date = (value: unknown, field: string): string => {
  const parsed = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(parsed) || !Number.isFinite(Date.parse(`${parsed}T00:00:00Z`))) {
    throw new ProvenanceRegimeRuleError(`${field} must be a valid date`);
  }
  return parsed;
};

const requireFrozen = (value: object, field: string): void => {
  if (!Object.isFrozen(value)) {
    throw new ProvenanceRegimeRuleError(`${field} must be frozen`);
  }
};

const frozenTexts = (value: unknown, field: string): readonly string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ProvenanceRegimeRuleError(`${field} must be a non-empty array`);
  }
  requireFrozen(value, field);
  return Object.freeze(value.map((entry, index) => text(entry, `${field}[${index}]`)));
};

const parseApproval = (value: unknown): SourceRegimeApprovalSnapshot => {
  const input = record(value, "determination.approval");
  requireFrozen(input, "determination.approval");
  if (input.role !== "Don") {
    throw new ProvenanceRegimeRuleError("determination.approval.role must be Don");
  }
  return Object.freeze({
    role: "Don",
    signerId: text(input.signerId, "determination.approval.signerId"),
    signedAt: instant(input.signedAt, "determination.approval.signedAt"),
    signature: text(input.signature, "determination.approval.signature"),
  });
};

const parseCoveredItems = (value: unknown): readonly CoveredItemSnapshot[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ProvenanceRegimeRuleError("determination.coveredItems must be non-empty");
  }
  requireFrozen(value, "determination.coveredItems");
  return Object.freeze(value.map((entry, index) => {
    const item = record(entry, `determination.coveredItems[${index}]`);
    requireFrozen(item, `determination.coveredItems[${index}]`);
    return Object.freeze({
      postId: text(item.postId, `coveredItems[${index}].postId`),
      revisionId: text(item.revisionId, `coveredItems[${index}].revisionId`),
      licenseName: text(item.licenseName, `coveredItems[${index}].licenseName`),
      licenseVersion: text(item.licenseVersion, `coveredItems[${index}].licenseVersion`),
    });
  }));
};

const parseDetermination = (value: unknown): SourceRegimeDeterminationSnapshot => {
  const input = record(value, "determination");
  requireFrozen(input, "determination");
  if (input.attributionAtRevealSatisfiesLicense !== true) {
    throw new ProvenanceRegimeRuleError("determination must be affirmative");
  }
  if (input.firstDisplayAttributionRequired !== false) {
    throw new ProvenanceRegimeRuleError("first-display attribution must not be required");
  }
  const consideredLicenseVersions = frozenTexts(
    input.consideredLicenseVersions, "determination.consideredLicenseVersions",
  );
  const coveredItems = parseCoveredItems(input.coveredItems);
  for (const item of coveredItems) {
    if (!consideredLicenseVersions.includes(`${item.licenseName} ${item.licenseVersion}`)) {
      throw new ProvenanceRegimeRuleError("covered item license was not considered");
    }
  }
  return Object.freeze({
    determinationId: text(input.determinationId, "determination.determinationId"),
    writtenText: text(input.writtenText, "determination.writtenText"),
    reviewerId: text(input.reviewerId, "determination.reviewerId"),
    reviewerName: text(input.reviewerName, "determination.reviewerName"),
    scope: text(input.scope, "determination.scope"),
    contributionRevisionDateTreatment: text(input.contributionRevisionDateTreatment, "determination.contributionRevisionDateTreatment"),
    consideredLicenseVersions,
    attributionFormat: text(input.attributionFormat, "determination.attributionFormat"),
    shareAlikeTreatment: text(input.shareAlikeTreatment, "determination.shareAlikeTreatment"),
    effectiveDate: date(input.effectiveDate, "determination.effectiveDate"),
    presentationDesignVersion: text(input.presentationDesignVersion, "determination.presentationDesignVersion"),
    interactionDesignVersion: text(input.interactionDesignVersion, "determination.interactionDesignVersion"),
    attributionAtRevealSatisfiesLicense: true,
    firstDisplayAttributionRequired: false,
    coveredItems,
    approval: parseApproval(input.approval),
  });
};

const parseSnapshot = (value: unknown): SourceRegimeSnapshotInput => {
  const input = record(value, "sourceRegime");
  requireFrozen(input, "sourceRegime");
  const selection = input.selection;
  if (selection !== "project-owned-fallback" && selection !== "stack-overflow-enabled") {
    throw new ProvenanceRegimeRuleError("sourceRegime.selection is unknown");
  }
  const versionId = text(input.versionId, "sourceRegime.versionId");
  const selectedAt = instant(input.selectedAt, "sourceRegime.selectedAt");
  const classes = frozenTexts(input.allowedSourceClasses, "sourceRegime.allowedSourceClasses");
  if (classes.join("|") !== EXPECTED_CLASSES[selection].join("|")) {
    throw new ProvenanceRegimeRuleError("allowed source classes do not match selection");
  }
  const determination = selection === "project-owned-fallback"
    ? null
    : parseDetermination(input.determination);
  if (selection === "project-owned-fallback" && input.determination !== null) {
    throw new ProvenanceRegimeRuleError("fallback determination must be null");
  }
  if (determination && (
    Date.parse(selectedAt) < Date.parse(determination.approval.signedAt) ||
    Date.parse(selectedAt) < Date.parse(`${determination.effectiveDate}T00:00:00Z`)
  )) throw new ProvenanceRegimeRuleError("source regime predates its determination");
  return Object.freeze({
    versionId, selectedAt, selection,
    allowedSourceClasses: Object.freeze(classes as ProvenanceSourceClass[]),
    determination,
  });
};

const canonical = (value: string): string =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");

const parseCandidates = (
  value: unknown,
  classes: readonly ProvenanceSourceClass[],
): readonly Readonly<ProvenanceCandidateInput>[] => {
  if (!Array.isArray(value) || value.length !== classes.length) {
    throw new ProvenanceRegimeRuleError("candidates must exactly match allowed source classes");
  }
  const candidates = Object.freeze(value.map((entry, index) => {
    const input = record(entry, `candidates[${index}]`);
    const sourceClass = input.sourceClass;
    const expectedClass = classes[index];
    if (!expectedClass || sourceClass !== expectedClass) {
      throw new ProvenanceRegimeRuleError("candidate order must match allowed source classes");
    }
    const label = text(input.label, `candidates[${index}].label`);
    if (label !== LABELS[expectedClass]) {
      throw new ProvenanceRegimeRuleError("candidate label must state its recorded source");
    }
    return Object.freeze({
      id: text(input.id, `candidates[${index}].id`),
      sourceClass: expectedClass,
      label,
    });
  }));
  for (const field of ["id", "label"] as const) {
    const normalized = candidates.map((candidate) => canonical(candidate[field]));
    if (new Set(normalized).size !== normalized.length) {
      throw new ProvenanceRegimeRuleError(`candidate ${field} values must be distinct`);
    }
  }
  return candidates;
};

export const createProvenanceRegime = (value: unknown): ProvenanceRegime => {
  const input = record(value, "input");
  const sourceRegime = parseSnapshot(input.sourceRegime);
  const candidates = parseCandidates(input.candidates, sourceRegime.allowedSourceClasses);
  return Object.freeze({
    versionId: sourceRegime.versionId,
    selectedAt: sourceRegime.selectedAt,
    selection: sourceRegime.selection,
    candidates,
    sourceRegime,
  });
};
