import type {
  AuthorizedReveal,
  RevealRequest as ArcadeRevealRequest,
} from "../components/arcade/arcade-shell";
import {
  RevealAuthority,
  type AcceptedAnswerEntitlement,
  type ProtectedRevealPayload,
  type RevealGuards,
  type RevealRequest,
} from "../server/reveal";
import {
  createDemoReveal,
} from "./demo-game";
import type {
  ApprovedRehearsal,
  RehearsalCatalogue,
} from "./rehearsal-catalogue";

const TOKEN = Symbol("H-002-backed rehearsal reveal");
const ROUND_SCORES = [0, 500, 800, 1000] as const;

const fail = (message: string): never => {
  throw new TypeError(`rehearsal reveal ${message}`);
};

const scoreIsReachable = (score: number, completedRounds: number): boolean => {
  let reachable = new Set([0]);
  for (let round = 0; round < completedRounds; round += 1) {
    reachable = new Set(
      [...reachable].flatMap((subtotal) =>
        ROUND_SCORES.map((points) => subtotal + points)),
    );
  }
  return reachable.has(score);
};

const selected = (
  catalogue: ApprovedRehearsal,
  value: ArcadeRevealRequest,
) => {
  if (!Number.isInteger(value.completedRounds)
    || value.completedRounds < 0
    || value.completedRounds > 4) fail("order is invalid");
  const round = catalogue.mode.rounds[value.completedRounds] ??
    fail("order is invalid");
  if (value.roundId !== round.roundId) fail("round order is invalid");
  if (value.roundVersionId !== round.roundVersionId) fail("round version is invalid");
  if (!round.mode.candidates.some(
    ({ candidateId }) => candidateId === value.candidateId,
  )) fail("candidate is invalid");
  if (!Number.isInteger(value.cluesUsed)
    || value.cluesUsed < 0
    || value.cluesUsed > round.mode.clues.length) fail("clue count is invalid");
  if (!Number.isSafeInteger(value.currentScore)
    || !scoreIsReachable(value.currentScore, value.completedRounds)) {
    fail("score is invalid");
  }
  const reveal = value.completedRounds === 0
    ? catalogue.serverReveals.provenance
    : value.completedRounds === 3
      ? catalogue.serverReveals.language
      : null;
  return { round, reveal };
};

export class RehearsalRevealCapability {
  readonly #authority: RevealAuthority;
  readonly #approvalId: string;
  readonly #candidateId: string;
  readonly #roundId: string;
  readonly #roundVersionId: string;

  private constructor(
    token: symbol,
    authority: RevealAuthority,
    approvalId: string,
    accepted: ArcadeRevealRequest,
  ) {
    if (token !== TOKEN) fail("capability construction is forbidden");
    this.#authority = authority;
    this.#approvalId = approvalId;
    this.#candidateId = accepted.candidateId;
    this.#roundId = accepted.roundId;
    this.#roundVersionId = accepted.roundVersionId;
    Object.freeze(this);
  }

  public authorize(
    approvalId: string,
    accepted: ArcadeRevealRequest,
    request: RevealRequest,
    guards: RevealGuards,
  ) {
    if (approvalId !== this.#approvalId
      || accepted.candidateId !== this.#candidateId
      || accepted.roundId !== this.#roundId
      || accepted.roundVersionId !== this.#roundVersionId) {
      return fail("authorization denied");
    }
    return this.#authority.authorize(request, guards);
  }

  public static issue(
    authority: RevealAuthority,
    approvalId: string,
    accepted: ArcadeRevealRequest,
  ): RehearsalRevealCapability {
    return new RehearsalRevealCapability(TOKEN, authority, approvalId, accepted);
  }
}

export function issueRehearsalRevealCapability(
  catalogue: RehearsalCatalogue,
  accepted: ArcadeRevealRequest,
  entitlement: AcceptedAnswerEntitlement,
  acceptedTransitionId: string,
): RehearsalRevealCapability {
  if (catalogue.kind !== "APPROVED_NON_PUBLIC_REHEARSAL") {
    return fail("capability requires an approved catalogue");
  }
  const { round, reveal } = selected(catalogue, accepted);
  if (reveal === null) return fail("capability requires a real rehearsal round");
  if (typeof acceptedTransitionId !== "string"
    || acceptedTransitionId.trim().length === 0
    || acceptedTransitionId === accepted.candidateId) {
    return fail("accepted transition identity is invalid");
  }
  if (entitlement.roundId !== round.roundId
    || entitlement.acceptedAnswerId !== acceptedTransitionId) {
    return fail("accepted-answer entitlement is not bound");
  }
  const payload: ProtectedRevealPayload = {
    correctness: accepted.candidateId === reveal.correctCandidateId,
    requiredAttribution: reveal.attribution,
    displayApprovedSourceEvidence: reveal.evidence,
    explanation: {
      helpfulSignals: reveal.helpfulSignals,
      misleadingSignals: reveal.misleadingSignals,
    },
    versions: {
      content: round.excerpt.versionId,
      candidateSet: round.versions.candidateSet,
      scoring: round.versions.scoring,
      rules: round.versions.rules,
      evidence: reveal.versions.evidence,
      reveal: reveal.versions.reveal,
    },
  };
  const authority = RevealAuthority.issue(entitlement, {
    load: () => payload,
  });
  return RehearsalRevealCapability.issue(
    authority,
    catalogue.approval.approvalId,
    accepted,
  );
}

export function createRehearsalReveal(
  catalogue: RehearsalCatalogue,
  value: ArcadeRevealRequest,
  authorization?: Readonly<{
    capability: RehearsalRevealCapability;
    request: RevealRequest;
    guards: RevealGuards;
  }>,
): AuthorizedReveal {
  if (catalogue.kind === "SYNTHETIC_DEFAULT") return createDemoReveal(value);
  const { round, reveal } = selected(catalogue, value);
  if (reveal === null) return createDemoReveal(value);
  if (!authorization
    || !(authorization.capability instanceof RehearsalRevealCapability)) {
    return fail("authorization required");
  }
  const result = authorization.capability.authorize(
    catalogue.approval.approvalId,
    value,
    authorization.request,
    authorization.guards,
  );
  if (result.response.outcome !== "AUTHORIZED") return fail("authorization denied");
  const payload = result.response.payload;
  if (payload.requiredAttribution !== reveal.attribution
    || payload.displayApprovedSourceEvidence !== reveal.evidence
    || payload.versions.content !== round.excerpt.versionId
    || payload.versions.candidateSet !== round.versions.candidateSet
    || payload.versions.scoring !== round.versions.scoring
    || payload.versions.rules !== round.versions.rules
    || payload.versions.evidence !== reveal.versions.evidence
    || payload.versions.reveal !== reveal.versions.reveal) {
    return fail("authorization payload drift");
  }
  const score = payload.correctness ? [1000, 800, 500][value.cluesUsed]! : 0;
  const completedRounds = value.completedRounds + 1;
  return Object.freeze({
    roundId: round.roundId,
    roundVersionId: round.roundVersionId,
    correct: payload.correctness,
    score,
    evidence: payload.displayApprovedSourceEvidence,
    explanation: payload.displayApprovedSourceEvidence,
    attribution: payload.requiredAttribution,
    helpfulSignals: payload.explanation.helpfulSignals,
    misleadingSignals: payload.explanation.misleadingSignals,
    versions: payload.versions,
    result: Object.freeze({
      score: value.currentScore + score,
      attainableMaximum: 5000,
      completedRounds,
      resultVersionId:
        `non-public:${catalogue.approval.approvalId}:round-${completedRounds}`,
    }),
  });
}
