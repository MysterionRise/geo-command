import {
  createPublicModeContract,
  type PublicModeContract,
  type PublicRound,
  type PublicRoundInput,
} from "../components/arcade/mode-contract";
import type {
  LanguageCatalogueEntry,
} from "../server/content/catalogue/language-entry";
import type {
  ProvenanceCatalogueEntry,
} from "../server/content/catalogue/provenance-entry";
import { DEMO_MODE } from "./demo-game";
import {
  ACTIVE_REHEARSAL_APPROVAL_REGISTER,
  hashRehearsalApprovalArtifact,
  hashRehearsalApprovalRegister,
  type RehearsalApprovalRegister,
  type RehearsalApprovalRegisterEntry,
} from "./rehearsal-approval-register";

const syntheticDefault = Object.freeze({
  kind: "SYNTHETIC_DEFAULT" as const,
  mode: DEMO_MODE,
  notice: "Synthetic local demo. Not an approved beta corpus.",
  approval: null,
  serverReveals: null,
});

type ApprovedInput = Readonly<{
  language: LanguageCatalogueEntry;
  provenance: ProvenanceCatalogueEntry;
  approval: Readonly<{
    artifactId: string;
    artifactHash: string;
    approvalId: string;
    decision: "APPROVED_NON_PUBLIC_REHEARSAL";
    approvedBy: string;
    approvedAt: string;
    languagePromotionIdentifier: string;
    provenancePromotionIdentifier: string;
    languageCatalogueHash: string;
    provenanceCatalogueHash: string;
    registerVersion: string;
    registerHash: string;
  }>;
}>;
export type ApprovedRehearsal = Readonly<{
  kind: "APPROVED_NON_PUBLIC_REHEARSAL";
  mode: PublicModeContract;
  notice: string;
  approval: Readonly<{
    approvalId: string; approvedBy: string; approvedAt: string;
  }>;
  serverReveals: Readonly<{
    language: LanguageCatalogueEntry["serverReveal"];
    provenance: ProvenanceCatalogueEntry["serverReveal"];
  }>;
}>;

const fail = (message: string): never => {
  throw new TypeError(`rehearsal catalogue ${message}`);
};

const text = (value: unknown): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail("contains blank approval text");
  }
  return value.trim();
};

const deepFrozen = (value: unknown, seen = new Set<object>()): void => {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) fail("entry is not a frozen approved boundary");
  for (const nested of Object.values(value)) deepFrozen(nested, seen);
};

const exact = (value: unknown, fields: readonly string[]): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail("input shape is invalid");
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join("|") !== [...fields].sort().join("|")) {
    fail("input shape is invalid");
  }
  return input;
};

const mutableRound = (round: PublicRound): PublicRoundInput => ({
  roundId: round.roundId,
  roundVersionId: round.roundVersionId,
  excerpt: { ...round.excerpt },
  mode: {
    kind: round.mode.kind,
    contractVersionId: round.mode.contractVersionId,
    calibrationVersionId: round.mode.calibrationVersionId,
    prompt: round.mode.prompt,
    candidates: round.mode.candidates.map((candidate) => ({ ...candidate })),
    clues: round.mode.clues.map((clue) => ({ ...clue })),
  },
  versions: { ...round.versions },
});

const parseRegister = (value: unknown): RehearsalApprovalRegister => {
  const register = exact(value, ["versionId", "entries", "registerHash"]);
  if (!Array.isArray(register.entries)) return fail("approval register is invalid");
  const entries = register.entries.map((entry) => exact(entry, [
    "approvalId", "artifactId", "artifactHash", "decision",
    "languagePromotionIdentifier", "provenancePromotionIdentifier",
    "languageCatalogueHash", "provenanceCatalogueHash",
  ])) as unknown as readonly RehearsalApprovalRegisterEntry[];
  const versionId = text(register.versionId);
  if (register.registerHash !==
    hashRehearsalApprovalRegister(versionId, entries)) {
    return fail("approval register hash is invalid");
  }
  return {
    versionId,
    entries,
    registerHash: register.registerHash as string,
  };
};

const parse = (value: unknown, projectRegister: unknown): ApprovedInput => {
  const root = exact(value, ["language", "provenance", "approval"]);
  const language = root.language as LanguageCatalogueEntry;
  const provenance = root.provenance as ProvenanceCatalogueEntry;
  deepFrozen(language);
  deepFrozen(provenance);
  if (language.status !== "APPROVED_LANGUAGE_CATALOGUE_ENTRY"
    || language.publicRound.mode.kind !== "language"
    || provenance.status !== "APPROVED_PROVENANCE_CATALOGUE_ENTRY"
    || provenance.publicRound.mode.kind !== "provenance") {
    return fail("entries are not approved mode records");
  }
  if (language.publicRound.excerpt.versionId !== language.bindings.contentVersionId
    || language.serverReveal.versions.content !== language.bindings.contentHash
    || language.serverReveal.versions.evidence !== language.bindings.evidenceVersionId
    || language.serverReveal.versions.reveal !== language.bindings.revealVersionId
    || provenance.publicRound.excerpt.versionId !== provenance.bindings.contentVersionId
    || provenance.serverReveal.versions.content !== provenance.bindings.contentHash
    || provenance.serverReveal.versions.evidence !== provenance.bindings.evidenceVersionId
    || provenance.serverReveal.versions.reveal !== provenance.bindings.revealVersionId) {
    return fail("entry lineage does not match its approved bindings");
  }
  const approval = exact(root.approval, [
    "artifactId", "artifactHash", "approvalId", "decision",
    "approvedBy", "approvedAt",
    "languagePromotionIdentifier", "provenancePromotionIdentifier",
    "languageCatalogueHash", "provenanceCatalogueHash",
    "registerVersion", "registerHash",
  ]);
  const register = parseRegister(projectRegister);
  const artifact = {
    artifactId: approval.artifactId,
    approvalId: approval.approvalId,
    decision: approval.decision,
    approvedBy: approval.approvedBy,
    approvedAt: approval.approvedAt,
    languagePromotionIdentifier: approval.languagePromotionIdentifier,
    provenancePromotionIdentifier: approval.provenancePromotionIdentifier,
    languageCatalogueHash: approval.languageCatalogueHash,
    provenanceCatalogueHash: approval.provenanceCatalogueHash,
  };
  const registered = register.entries.find(
    ({ approvalId }) => approvalId === approval.approvalId,
  );
  if (approval.decision !== "APPROVED_NON_PUBLIC_REHEARSAL"
    || !Number.isFinite(Date.parse(text(approval.approvedAt)))
    || approval.artifactHash !== hashRehearsalApprovalArtifact(artifact)
    || approval.registerVersion !== register.versionId
    || approval.registerHash !== register.registerHash
    || registered === undefined
    || registered.artifactId !== approval.artifactId
    || registered.artifactHash !== approval.artifactHash
    || registered.decision !== approval.decision
    || approval.languagePromotionIdentifier !== language.bindings.promotionIdentifier
    || approval.provenancePromotionIdentifier !==
      provenance.bindings.promotionIdentifier
    || approval.languageCatalogueHash !== language.bindings.catalogueHash
    || approval.provenanceCatalogueHash !== provenance.bindings.catalogueHash
    || registered.languagePromotionIdentifier !==
      approval.languagePromotionIdentifier
    || registered.provenancePromotionIdentifier !==
      approval.provenancePromotionIdentifier
    || registered.languageCatalogueHash !== approval.languageCatalogueHash
    || registered.provenanceCatalogueHash !== approval.provenanceCatalogueHash) {
    return fail("approval register does not bind both promoted entries");
  }
  return {
    language,
    provenance,
    approval: root.approval as ApprovedInput["approval"],
  };
};

const approved = (input: ApprovedInput): ApprovedRehearsal => {
  const rounds = DEMO_MODE.rounds.map(mutableRound);
  rounds[0] = mutableRound(input.provenance.publicRound);
  rounds[3] = mutableRound(input.language.publicRound);
  return Object.freeze({
    kind: "APPROVED_NON_PUBLIC_REHEARSAL",
    mode: createPublicModeContract({
      sessionContractVersionId: `non-public:${input.approval.approvalId}`,
      rounds,
    }),
    notice: "Approved non-public rehearsal; not an approved beta corpus.",
    approval: Object.freeze({
      approvalId: text(input.approval.approvalId),
      approvedBy: text(input.approval.approvedBy),
      approvedAt: text(input.approval.approvedAt),
    }),
    serverReveals: Object.freeze({
      language: input.language.serverReveal,
      provenance: input.provenance.serverReveal,
    }),
  });
};

export function selectRehearsalCatalogue(
  input: unknown,
  projectRegister: unknown = ACTIVE_REHEARSAL_APPROVAL_REGISTER,
): RehearsalCatalogue {
  try {
    return approved(parse(input, projectRegister));
  } catch {
    return syntheticDefault;
  }
}

export type RehearsalCatalogue = typeof syntheticDefault | ApprovedRehearsal;
export const ACTIVE_REHEARSAL_CATALOGUE = selectRehearsalCatalogue(null);
export {
  createRehearsalReveal,
  issueRehearsalRevealCapability,
} from "./rehearsal-reveal";
