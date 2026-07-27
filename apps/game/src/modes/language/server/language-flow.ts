import {
  createLanguageAmbiguityEligibility,
  parseEvidenceRecord,
  type DeceptiveTextControlClass,
  type EvidenceRecord,
  type LanguageAmbiguityEligibility,
} from "../../../../../../packages/content/src/index.js";
import {
  createLanguageCandidatePresentation,
  resolveLanguageCandidateId,
  RoundPlay,
  type EntertainmentRoundResult,
  type LanguageCandidatePresentation,
  type LanguageCandidateSet,
} from "../../../../../../packages/domain/src/index.js";
import {
  assertPublicProjectionSafe,
  RevealAuthority,
  type RevealGuards,
  type RevealRequest,
  type RevealVersions,
} from "../../../server/reveal/index.js";

type RecordValue = Record<string, unknown>;
type Clue = Readonly<{
  clueId: string;
  text: string;
  clueVersionId: string;
  order: 1 | 2;
}>;
type ControlAnnotationInput = Readonly<{
  versionId: string;
  text: string;
}>;
type Selection = Readonly<{
  transitionId: string;
  candidateId: string;
  acceptedAt: string;
}>;
type PublicControlAnnotation = Readonly<{
  versionId: string;
  text: string;
  detectedControlClasses: readonly DeceptiveTextControlClass[];
}>;
type RevealedProjection = Readonly<{
  state: "REVEALED";
  mode: "language";
  correctness: boolean;
  correctLanguage: Readonly<{ candidateId: string; label: string }>;
  approvedAttribution: string;
  approvedEvidence: string;
  helpfulSignals: readonly string[];
  misleadingSignals: readonly string[];
  versions: RevealVersions;
}>;
type PreRevealProjection = Readonly<{
  state: "PRE_REVEAL";
  mode: "language";
  candidateSetVersionId: string;
  presentedCandidateCount: number;
}>;

export interface LanguageFlowInput {
  readonly evidence: EvidenceRecord;
  readonly eligibility: LanguageAmbiguityEligibility;
  readonly candidateSet: LanguageCandidateSet;
  readonly presentation: LanguageCandidatePresentation;
  readonly roundPlay: RoundPlay;
  readonly sessionId: string;
  readonly roundId: string;
  readonly roundVersionId: string;
  readonly excerpt: string;
  readonly prompt: string;
  readonly modeVersionId: string;
  readonly rulesVersionId: string;
  readonly revealVersionId: string;
  readonly clues: readonly Clue[];
  readonly controlAnnotation: ControlAnnotationInput | null;
}

export class LanguageFlowError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "LanguageFlowError";
  }
}

const INPUT_FIELDS = Object.freeze([
  "evidence", "eligibility", "candidateSet", "presentation", "roundPlay",
  "sessionId", "roundId", "roundVersionId", "excerpt", "prompt",
  "modeVersionId", "rulesVersionId", "revealVersionId", "clues",
  "controlAnnotation",
]);
const CLUE_FIELDS = Object.freeze(["clueId", "text", "clueVersionId", "order"]);
const ANNOTATION_FIELDS = Object.freeze(["versionId", "text"]);
const ANSWER_FIELDS = Object.freeze(["transitionId", "candidateId", "acceptedAt"]);
const REVEAL_FIELDS = Object.freeze(["authority", "request", "guards"]);
const REQUEST_FIELDS = Object.freeze([
  "participantLineageId", "betaDay", "manifestLineageId", "manifestVersionId",
  "sessionId", "roundId", "acceptedAnswerId", "requestedAt",
]);
const GUARD_FIELDS = Object.freeze([
  "inputValid", "authenticated", "authorized", "credentialValid",
  "antiForgeryValid", "rateLimitAllowed",
]);
const APPROVED_CONTROL_ANNOTATIONS: Readonly<Record<string, string>> = Object.freeze({
  "language-control-annotation-v1":
    "The excerpt contains approved visible annotations for bidirectional or zero-width controls.",
});
const FLOW_TOKEN = Symbol("validated language flow");

const fail = (message: string): never => {
  throw new LanguageFlowError(message);
};

const record = (value: unknown, field: string): RecordValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(`${field} must be an object`);
  }
  return value as RecordValue;
};

const exact = (value: RecordValue, fields: readonly string[], field: string): void => {
  const actual = Object.keys(value);
  if (actual.length !== fields.length || fields.some((key) => !actual.includes(key))) {
    fail(`${field} field set is invalid`);
  }
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(`${field} must be non-blank`);
  }
  return value;
};

const instant = (value: unknown, field: string): string => {
  const parsed = text(value, field);
  if (!Number.isFinite(Date.parse(parsed))) fail(`${field} must be a valid instant`);
  return parsed;
};

const requireDeepFrozen = (value: unknown, field: string, seen = new Set<object>()): void => {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  if (!Object.isFrozen(value)) fail(`${field} must be a deeply frozen boundary`);
  for (const nested of Object.values(value)) requireDeepFrozen(nested, field, seen);
};

const exactValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((entry, index) => exactValue(entry, right[index]));
  }
  const leftRecord = left as RecordValue;
  const rightRecord = right as RecordValue;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(rightRecord, key) && exactValue(leftRecord[key], rightRecord[key]));
};

const revalidateEvidence = (value: EvidenceRecord): EvidenceRecord => {
  requireDeepFrozen(value, "evidence");
  let canonical: EvidenceRecord;
  try {
    canonical = parseEvidenceRecord(value);
  } catch {
    return fail("evidence failed semantic revalidation");
  }
  if (!exactValue(value, canonical)) fail("evidence has an invalid exact shape");
  return value;
};

const certifyCandidateSet = (candidateSet: LanguageCandidateSet): void => {
  requireDeepFrozen(candidateSet, "candidate set");
  const correct = candidateSet.candidates.find(({ id }) => id === candidateSet.correctCandidateId) ??
    fail("candidate set has no correct candidate");
  let certifiedId: string;
  try {
    certifiedId = resolveLanguageCandidateId(candidateSet, correct.canonicalLabel);
  } catch {
    return fail("candidate set was not created by the certified factory");
  }
  if (certifiedId !== candidateSet.correctCandidateId) fail("candidate set correct answer is not certified");
};

const revalidateEligibility = (
  eligibility: LanguageAmbiguityEligibility,
  candidateSet: LanguageCandidateSet,
): LanguageAmbiguityEligibility => {
  requireDeepFrozen(eligibility, "eligibility");
  let canonical: LanguageAmbiguityEligibility;
  try {
    canonical = createLanguageAmbiguityEligibility(Object.freeze({
      eligibilityVersionId: eligibility.eligibilityVersionId,
      contentId: eligibility.contentId,
      evidenceVersion: eligibility.evidenceVersion,
      candidateSet,
      publicationEligibility: eligibility.publicationEligibility,
      technicalReviews: eligibility.technicalReviews,
      deceptiveTextControlReview: eligibility.deceptiveTextControlReview,
    }));
  } catch {
    return fail("eligibility failed semantic revalidation");
  }
  if (!exactValue(eligibility, canonical)) fail("eligibility has an invalid exact shape or binding");
  return eligibility;
};

const revalidatePresentation = (
  presentation: LanguageCandidatePresentation,
  candidateSet: LanguageCandidateSet,
  sessionId: string,
): LanguageCandidatePresentation => {
  requireDeepFrozen(presentation, "presentation");
  let canonical: LanguageCandidatePresentation;
  try {
    canonical = createLanguageCandidatePresentation(candidateSet, presentation.orderingRecord);
  } catch {
    return fail("presentation failed certified ordering revalidation");
  }
  if (!exactValue(presentation, canonical)) fail("presentation has invalid ordering semantics or shape");
  if (presentation.orderingRecord.sessionId !== sessionId) fail("presentation ordering is not bound to the session");
  return presentation;
};

const parseClues = (
  value: unknown,
  candidateSet: LanguageCandidateSet,
  roundPlay: RoundPlay,
): readonly Clue[] => {
  const entries: readonly unknown[] = Array.isArray(value) ? value : fail("clues must be an array");
  if (!Object.isFrozen(entries)) fail("clues must be a frozen boundary");
  if (entries.length !== candidateSet.clues.length) fail("clue count does not match the candidate set");
  return Object.freeze(entries.map((entry, index) => {
    const input = record(entry, `clues[${index}]`);
    requireDeepFrozen(input, `clues[${index}]`);
    exact(input, CLUE_FIELDS, `clues[${index}]`);
    const expected = candidateSet.clues[index] ?? fail("candidate-set clue is unavailable");
    const roundExpected = roundPlay.definition.clues[index] ?? fail("round clue is unavailable");
    if (input.clueId !== expected.clueId ||
      input.clueVersionId !== expected.clueVersionId || input.order !== expected.order ||
      input.clueId !== roundExpected.clueId || input.clueVersionId !== roundExpected.clueVersionId ||
      input.order !== roundExpected.order) {
      fail("clue identity, version, or order does not match the round");
    }
    return Object.freeze({
      clueId: text(input.clueId, `clues[${index}].clueId`),
      text: text(input.text, `clues[${index}].text`),
      clueVersionId: text(input.clueVersionId, `clues[${index}].clueVersionId`),
      order: expected.order as 1 | 2,
    });
  }));
};

const detectedControls = (excerpt: string): readonly DeceptiveTextControlClass[] => {
  const classes: DeceptiveTextControlClass[] = [];
  if (/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u.test(excerpt)) classes.push("bidi");
  if (/[\u200B-\u200D\u2060-\u2064\uFEFF]/u.test(excerpt)) classes.push("zero-width");
  return Object.freeze(classes);
};

const sameClassSet = (
  left: readonly DeceptiveTextControlClass[],
  right: readonly DeceptiveTextControlClass[],
): boolean => left.length === right.length && left.every((entry) => right.includes(entry));

const parseControlAnnotation = (
  value: unknown,
  eligibility: LanguageAmbiguityEligibility,
  excerpt: string,
): PublicControlAnnotation | null => {
  const review = eligibility.deceptiveTextControlReview;
  const actualClasses = detectedControls(excerpt);
  if (!sameClassSet(actualClasses, review.detectedControlClasses)) {
    fail("detected control classes do not match the approved annotation review");
  }
  if (review.disposition === "absent") {
    if (actualClasses.length !== 0 || value !== null) fail("absent controls require no annotation");
    return null;
  }
  const input = record(value, "control annotation");
  requireDeepFrozen(input, "control annotation");
  exact(input, ANNOTATION_FIELDS, "control annotation");
  const versionId = text(input.versionId, "control annotation version");
  if (versionId !== review.visibleAnnotationVersion) fail("control annotation version is not approved");
  const approvedText = APPROVED_CONTROL_ANNOTATIONS[versionId] ??
    fail("control annotation version has no approved content");
  if (text(input.text, "control annotation text") !== approvedText) {
    fail("control annotation text does not match its approved version");
  }
  return Object.freeze({
    versionId,
    text: approvedText,
    detectedControlClasses: Object.freeze([...review.detectedControlClasses]),
  });
};

const validateRound = (
  roundPlay: RoundPlay,
  roundVersionId: string,
  evidence: EvidenceRecord,
  candidateSet: LanguageCandidateSet,
): void => {
  if (!(roundPlay instanceof RoundPlay)) fail("roundPlay must be an actual RoundPlay");
  const definition = roundPlay.definition;
  if (definition.roundVersionId !== roundVersionId ||
    definition.scoringVersionId !== candidateSet.scoringVersionId ||
    definition.clueSetVersionId !== candidateSet.clueSetVersionId ||
    definition.baseExcerpt.referenceId !== evidence.stableId ||
    definition.baseExcerpt.versionId !== evidence.contentHash ||
    !exactValue(definition.clues, candidateSet.clues)) {
    fail("round version or content, scoring, and clue bindings are invalid");
  }
  if (roundPlay.acceptedClueIds.length !== 0 || roundPlay.acceptedAnswer !== null) {
    fail("roundPlay must begin before clues and answer acceptance");
  }
};

const approvedDisclosure = (evidence: EvidenceRecord): string => {
  const disclosure = evidence.sourceClass === "model-output"
    ? evidence.approvedPublicAttributionOrDisclosureText
    : evidence.sourceClass === "stack-overflow"
      ? evidence.approvedRevealAttribution
      : evidence.attributionOrDisclosureText;
  if (text(disclosure, "approved attribution") !== evidence.attributionOrDisclosureText) {
    fail("approved attribution does not match the evidence record");
  }
  return disclosure;
};

const preReveal = (candidateSet: LanguageCandidateSet): PreRevealProjection => Object.freeze({
  state: "PRE_REVEAL",
  mode: "language",
  candidateSetVersionId: candidateSet.versionId,
  presentedCandidateCount: candidateSet.presentedCandidateCount,
});

const validateRequest = (value: unknown): RevealRequest => {
  const input = record(value, "request");
  requireDeepFrozen(input, "request");
  exact(input, REQUEST_FIELDS, "request");
  for (const field of REQUEST_FIELDS.slice(0, -1)) text(input[field], `request.${field}`);
  instant(input.requestedAt, "request.requestedAt");
  return value as RevealRequest;
};

const validateGuards = (value: unknown): RevealGuards => {
  const input = record(value, "guards");
  requireDeepFrozen(input, "guards");
  exact(input, GUARD_FIELDS, "guards");
  for (const field of GUARD_FIELDS) {
    if (typeof input[field] !== "boolean") fail(`guard ${field} must be boolean`);
  }
  return value as RevealGuards;
};

const validateAuthorizedVersions = (
  versions: RevealVersions,
  input: Readonly<LanguageFlowInput>,
): void => {
  if (versions.content !== input.evidence.contentHash ||
    versions.candidateSet !== input.candidateSet.versionId ||
    versions.scoring !== input.candidateSet.scoringVersionId ||
    versions.rules !== input.rulesVersionId ||
    versions.evidence !== input.evidence.evidenceReference.versionId ||
    versions.reveal !== input.revealVersionId) {
    fail("authorized version binding does not match the language flow");
  }
};

export class LanguageFlow {
  readonly #input: Readonly<LanguageFlowInput>;
  readonly #roundPlay: RoundPlay;
  readonly #selection: Selection | null;

  private constructor(
    token: symbol,
    input: Readonly<LanguageFlowInput>,
    roundPlay: RoundPlay,
    selection: Selection | null,
  ) {
    if (token !== FLOW_TOKEN) throw new LanguageFlowError("flow construction is factory-only");
    this.#input = input;
    this.#roundPlay = roundPlay;
    this.#selection = selection;
    Object.freeze(this);
  }

  public static create(value: unknown): LanguageFlow {
    const raw = record(value, "language flow input");
    exact(raw, INPUT_FIELDS, "language flow input");
    const input = raw as unknown as LanguageFlowInput;
    const sessionId = text(input.sessionId, "sessionId");
    const roundId = text(input.roundId, "roundId");
    const roundVersionId = text(input.roundVersionId, "roundVersionId");
    const evidence = revalidateEvidence(input.evidence);
    certifyCandidateSet(input.candidateSet);
    const eligibility = revalidateEligibility(input.eligibility, input.candidateSet);
    if (eligibility.contentId !== evidence.stableId ||
      eligibility.evidenceVersion !== evidence.evidenceReference.versionId ||
      eligibility.candidateSetVersionId !== input.candidateSet.versionId) {
      fail("language eligibility is not bound to evidence and candidates");
    }
    const presentation = revalidatePresentation(input.presentation, input.candidateSet, sessionId);
    validateRound(input.roundPlay, roundVersionId, evidence, input.candidateSet);
    const excerpt = text(input.excerpt, "excerpt");
    if (excerpt !== evidence.excerpt) fail("round excerpt does not match accepted evidence");
    const clues = parseClues(input.clues, input.candidateSet, input.roundPlay);
    const controlAnnotation = parseControlAnnotation(input.controlAnnotation, eligibility, excerpt);
    const acceptedInput = Object.freeze({
      evidence,
      eligibility,
      candidateSet: input.candidateSet,
      presentation,
      roundPlay: input.roundPlay,
      sessionId,
      roundId,
      roundVersionId,
      excerpt,
      prompt: text(input.prompt, "prompt"),
      modeVersionId: text(input.modeVersionId, "modeVersionId"),
      rulesVersionId: text(input.rulesVersionId, "rulesVersionId"),
      revealVersionId: text(input.revealVersionId, "revealVersionId"),
      clues,
      controlAnnotation,
    });
    return new LanguageFlow(FLOW_TOKEN, acceptedInput, input.roundPlay, null);
  }

  public publicRound() {
    const { candidateSet, presentation, roundId, excerpt, prompt, clues, controlAnnotation } = this.#input;
    const candidates = presentation.candidateIds.map((candidateId) => {
      const candidate = candidateSet.candidates.find(({ id }) => id === candidateId);
      if (!candidate) return fail("presented candidate is unavailable");
      return Object.freeze({ id: candidate.id, label: candidate.canonicalLabel });
    });
    return Object.freeze({
      roundId,
      excerpt,
      prompt,
      candidates: Object.freeze(candidates),
      presentedCandidateCount: presentation.presentedCandidateCount,
      clues: Object.freeze(clues.map(({ clueId, text: clueText, order }) =>
        Object.freeze({ clueId, text: clueText, order }))),
      controlAnnotation,
      versions: Object.freeze({
        round: this.#input.roundVersionId,
        excerpt: this.#input.evidence.contentHash,
        candidates: candidateSet.versionId,
        orderingRecord: presentation.orderingRecord.recordId,
        orderingPolicy: candidateSet.orderingPolicy.versionId,
        clues: candidateSet.clueSetVersionId,
        cluePolicy: candidateSet.cluePolicyVersionId,
        scoring: candidateSet.scoringVersionId,
        calibration: candidateSet.calibration.versionId,
        rules: this.#input.rulesVersionId,
        mode: this.#input.modeVersionId,
        evidence: this.#input.evidence.evidenceReference.versionId,
        eligibility: this.#input.eligibility.eligibilityVersionId,
        controlReview: this.#input.eligibility.deceptiveTextControlReview.versionId,
      }),
    });
  }

  public acceptClue(clueId: string): LanguageFlow {
    if (this.#selection !== null) fail("clues cannot be accepted after an answer");
    return new LanguageFlow(FLOW_TOKEN, this.#input, this.#roundPlay.acceptClue(clueId), null);
  }

  public acceptAnswer(value: Selection): LanguageFlow {
    const input = record(value, "answer");
    requireDeepFrozen(input, "answer");
    exact(input, ANSWER_FIELDS, "answer");
    if (this.#selection !== null) fail("an answer was already accepted");
    const transitionId = text(input.transitionId, "answer transitionId");
    const candidateId = text(input.candidateId, "answer candidateId");
    if (this.#input.candidateSet.candidates.some(({ id }) => id === transitionId)) {
      fail("answer transition identity must be opaque and distinct from candidate identity");
    }
    if (!this.#input.candidateSet.candidates.some(({ id }) => id === candidateId)) {
      fail("answer candidate is not in the presented candidate set");
    }
    return new LanguageFlow(FLOW_TOKEN, this.#input, this.#roundPlay, Object.freeze({
      transitionId,
      candidateId,
      acceptedAt: instant(input.acceptedAt, "answer acceptedAt"),
    }));
  }

  public reveal(value: {
    readonly authority: RevealAuthority;
    readonly request: RevealRequest;
    readonly guards: RevealGuards;
  }): PreRevealProjection | AuthorizedLanguageFlowOutcome {
    const envelope = record(value, "reveal");
    exact(envelope, REVEAL_FIELDS, "reveal");
    if (!(value.authority instanceof RevealAuthority)) fail("reveal authority is invalid");
    const request = validateRequest(value.request);
    const guards = validateGuards(value.guards);
    if (this.#selection === null) return preReveal(this.#input.candidateSet);
    if (request.acceptedAnswerId !== this.#selection.transitionId ||
      request.roundId !== this.#input.roundId || request.sessionId !== this.#input.sessionId) {
      return preReveal(this.#input.candidateSet);
    }
    const authorization = value.authority.authorize(request, guards);
    if (authorization.response.outcome !== "AUTHORIZED" || authorization.audit.outcome !== "AUTHORIZED") {
      return preReveal(this.#input.candidateSet);
    }
    if (authorization.audit.acceptedAnswerId !== request.acceptedAnswerId ||
      authorization.audit.revealedAt !== request.requestedAt) {
      fail("authorized audit does not match the reveal request");
    }
    const payload = authorization.response.payload;
    validateAuthorizedVersions(payload.versions, this.#input);
    if (authorization.audit.evidenceVersionId !== payload.versions.evidence ||
      authorization.audit.revealVersionId !== payload.versions.reveal) {
      fail("authorized audit version binding does not match the payload");
    }
    const disclosure = approvedDisclosure(this.#input.evidence);
    const publicEvidence = `${this.#input.evidence.evidenceReference.artifactId}@${this.#input.evidence.evidenceReference.versionId}`;
    if (payload.requiredAttribution !== disclosure || payload.displayApprovedSourceEvidence !== publicEvidence) {
      fail("authorized reveal does not use the approved evidence disclosure");
    }
    const correct = this.#input.candidateSet.candidates.find(({ id }) =>
      id === this.#input.eligibility.correctCandidateId) ??
      fail("certified correct language is unavailable");
    const expectedCorrectness = this.#selection.candidateId === correct.id;
    if (payload.correctness !== expectedCorrectness) {
      fail("authorized correctness disagrees with the selected candidate");
    }
    const projection: RevealedProjection = Object.freeze({
      state: "REVEALED",
      mode: "language",
      correctness: payload.correctness,
      correctLanguage: Object.freeze({ candidateId: correct.id, label: correct.canonicalLabel }),
      approvedAttribution: payload.requiredAttribution,
      approvedEvidence: payload.displayApprovedSourceEvidence,
      helpfulSignals: Object.freeze([...payload.explanation.helpfulSignals]),
      misleadingSignals: Object.freeze([...payload.explanation.misleadingSignals]),
      versions: Object.freeze({ ...payload.versions }),
    });
    assertPublicProjectionSafe("PUBLIC_BUNDLE", projection);
    const answeredRoundPlay = this.#roundPlay.acceptAnswer({
      answerId: this.#selection.transitionId,
      candidateId: this.#selection.candidateId,
      acceptedAt: this.#selection.acceptedAt,
      candidateCount: this.#input.presentation.presentedCandidateCount,
      correct: payload.correctness,
    });
    return new AuthorizedLanguageFlowOutcome(projection, answeredRoundPlay);
  }
}

export class AuthorizedLanguageFlowOutcome {
  readonly #projection: RevealedProjection;
  readonly #roundPlay: RoundPlay;

  public constructor(projection: RevealedProjection, roundPlay: RoundPlay) {
    this.#projection = projection;
    this.#roundPlay = roundPlay;
    Object.freeze(this);
  }

  public get publicProjection(): RevealedProjection { return this.#projection; }
  public get answeredRoundPlay(): RoundPlay { return this.#roundPlay; }
  public get result(): EntertainmentRoundResult { return this.#roundPlay.result(); }
  public toJSON(): RevealedProjection { return this.#projection; }
}

export function createLanguageFlow(value: unknown): LanguageFlow {
  return LanguageFlow.create(value);
}
