import type { EvidenceRecord, PublicationEligibility } from "../../../../../../packages/content/src/index.js";
import { RoundPlay, type ProvenanceRegime } from "../../../../../../packages/domain/src/index.js";
import { createProvenanceCalibration, type ProvenanceCalibration } from "./provenance-calibration.js";
import { assertProvenanceProjectionPreflight, createProvenancePublicProjection } from "./provenance-projection.js";
import { RevealAuthority, type RevealGuards, type RevealRequest } from "../../../server/reveal/index.js";

type RecordValue = Record<string, unknown>;
type Clue = Readonly<{ clueId: string; text: string; clueVersionId: string; order: 1 | 2 }>;
type Selection = Readonly<{ transitionId: string; candidateId: string; acceptedAt: string }>;
type PublicProjection = ReturnType<typeof createProvenancePublicProjection>;
type RevealedProjection = Extract<PublicProjection, { readonly state: "REVEALED" }>;
type PreRevealProjection = Extract<PublicProjection, { readonly state: "PRE_REVEAL" }>;

export interface ProvenanceFlowInput {
  readonly evidence: EvidenceRecord;
  readonly eligibility: PublicationEligibility;
  readonly regime: ProvenanceRegime;
  readonly roundPlay: RoundPlay;
  readonly calibration: ProvenanceCalibration;
  readonly roundId: string;
  readonly excerpt: string;
  readonly prompt: string;
  readonly modeVersionId: string;
  readonly rulesVersionId: string;
  readonly revealVersionId: string;
  readonly clues: readonly Clue[];
}

export class ProvenanceFlowError extends Error {
  public constructor(message: string) { super(message); this.name = "ProvenanceFlowError"; }
}

const INPUT_FIELDS = ["evidence", "eligibility", "regime", "roundPlay", "calibration", "roundId", "excerpt", "prompt", "modeVersionId", "rulesVersionId", "revealVersionId", "clues"];
const CLUE_FIELDS = ["clueId", "text", "clueVersionId", "order"];
const ANSWER_FIELDS = ["transitionId", "candidateId", "acceptedAt"];
const REVEAL_FIELDS = ["authority", "request", "guards"];
const FLOW_TOKEN = Symbol("validated provenance flow");
const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) throw new ProvenanceFlowError(`${field} must be non-blank`);
  return value;
};
const record = (value: unknown): RecordValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ProvenanceFlowError("input must be an object");
  return value as RecordValue;
};
const exact = (value: RecordValue, fields: readonly string[], name: string): void => {
  const unknown = Object.keys(value).filter((field) => !fields.includes(field));
  const missing = fields.filter((field) => !(field in value));
  if (unknown.length || missing.length) throw new ProvenanceFlowError(`${name} field set is invalid`);
};
const preReveal = (regime: ProvenanceRegime) => Object.freeze({
  state: "PRE_REVEAL" as const, mode: "provenance" as const, sourceRegimeVersionId: regime.versionId,
  candidates: Object.freeze(regime.candidates.map(({ id, label }) => Object.freeze({ id, label }))),
});
const parseClues = (value: unknown, roundPlay: RoundPlay): readonly Clue[] => {
  if (!Array.isArray(value) || value.length !== 2) throw new ProvenanceFlowError("flow requires exactly two clues");
  return Object.freeze(value.map((entry, index) => {
    const clue = record(entry);
    exact(clue, CLUE_FIELDS, "clue");
    const expected = roundPlay.definition.clues[index];
    if (!expected || clue.clueId !== expected.clueId || clue.clueVersionId !== expected.clueVersionId || clue.order !== expected.order) {
      throw new ProvenanceFlowError("clue identity, order, or version does not match the round");
    }
    return Object.freeze({ clueId: text(clue.clueId, "clueId"), text: text(clue.text, "clue text"), clueVersionId: text(clue.clueVersionId, "clueVersionId"), order: expected.order });
  }));
};

export class ProvenanceFlow {
  readonly #input: Readonly<ProvenanceFlowInput>;
  readonly #roundPlay: RoundPlay;
  readonly #selection: Selection | null;
  private constructor(token: symbol, input: Readonly<ProvenanceFlowInput>, roundPlay: RoundPlay, selection: Selection | null) {
    if (token !== FLOW_TOKEN) throw new ProvenanceFlowError("flow construction is factory-only");
    this.#input = input; this.#roundPlay = roundPlay; this.#selection = selection; Object.freeze(this);
  }
  public static create(value: unknown): ProvenanceFlow {
    const raw = record(value);
    const unknown = Object.keys(raw).filter((field) => !INPUT_FIELDS.includes(field));
    if (unknown.length) throw new ProvenanceFlowError(`unknown input field ${unknown[0]}`);
    for (const field of INPUT_FIELDS) if (!(field in raw)) throw new ProvenanceFlowError(`missing input field ${field}`);
    const input = raw as unknown as ProvenanceFlowInput;
    if (!(input.roundPlay instanceof RoundPlay)) throw new ProvenanceFlowError("roundPlay must be an actual RoundPlay");
    assertProvenanceProjectionPreflight(input.evidence, input.eligibility, input.regime);
    if (input.excerpt !== input.evidence.excerpt) throw new ProvenanceFlowError("excerpt does not match recorded evidence");
    const calibration = createProvenanceCalibration(input.calibration);
    const definition = input.roundPlay.definition;
    if (calibration.sourceRegimeVersionId !== input.regime.versionId ||
        calibration.presentedCandidateCount !== input.regime.candidates.length ||
        calibration.chanceBaseline !== 1 / input.regime.candidates.length) {
      throw new ProvenanceFlowError("calibration does not match the active source regime and candidates");
    }
    if (calibration.clueSetVersionId !== definition.clueSetVersionId ||
        calibration.configuredClueCount !== definition.clues.length ||
        calibration.scoringVersionId !== definition.scoringVersionId) {
      throw new ProvenanceFlowError("calibration does not match the configured clue set and scoring rule");
    }
    const clues = parseClues(input.clues, input.roundPlay);
    const frozen = Object.freeze({ ...input, calibration, roundId: text(input.roundId, "roundId"), excerpt: input.excerpt,
      prompt: text(input.prompt, "prompt"), modeVersionId: text(input.modeVersionId, "modeVersionId"),
      rulesVersionId: text(input.rulesVersionId, "rulesVersionId"), revealVersionId: text(input.revealVersionId, "revealVersionId"), clues });
    return new ProvenanceFlow(FLOW_TOKEN, frozen, input.roundPlay, null);
  }
  public publicRound() {
    const { evidence, regime, calibration, roundId, excerpt, prompt, modeVersionId, rulesVersionId, clues } = this.#input;
    const definition = this.#roundPlay.definition;
    return Object.freeze({
      roundId, excerpt, prompt,
      candidates: Object.freeze(regime.candidates.map(({ id, label }) => Object.freeze({ id, label }))),
      clues: Object.freeze(clues.map(({ clueId, text: clueText, order }) => Object.freeze({ clueId, text: clueText, order }))),
      versions: Object.freeze({ round: definition.roundVersionId, excerpt: definition.baseExcerpt.versionId, candidates: regime.versionId,
        clues: definition.clueSetVersionId, scoring: definition.scoringVersionId, rules: rulesVersionId, mode: modeVersionId, sourceRegime: regime.versionId,
        calibration: calibration.versionId, evidence: evidence.evidenceReference.versionId }),
    });
  }
  public acceptClue(clueId: string): ProvenanceFlow {
    if (this.#selection) throw new ProvenanceFlowError("clues cannot be accepted after an answer");
    return new ProvenanceFlow(FLOW_TOKEN, this.#input, this.#roundPlay.acceptClue(clueId), null);
  }
  public acceptAnswer(value: Selection): ProvenanceFlow {
    const answer = record(value);
    exact(answer, ANSWER_FIELDS, "answer");
    if (this.#selection) throw new ProvenanceFlowError("an answer was already accepted");
    const transitionId = text(value.transitionId, "transitionId");
    const candidateId = text(value.candidateId, "candidateId");
    if (!this.#input.regime.candidates.some(({ id }) => id === candidateId)) throw new ProvenanceFlowError("candidate is not in the active regime");
    if (!Number.isFinite(Date.parse(value.acceptedAt))) throw new ProvenanceFlowError("acceptedAt must be a valid instant");
    return new ProvenanceFlow(FLOW_TOKEN, this.#input, this.#roundPlay, Object.freeze({ transitionId, candidateId, acceptedAt: value.acceptedAt }));
  }
  public reveal(value: { readonly authority: RevealAuthority; readonly request: RevealRequest; readonly guards: RevealGuards }): PreRevealProjection | AuthorizedFlowOutcome {
    const envelope = record(value);
    exact(envelope, REVEAL_FIELDS, "reveal");
    if (!(value.authority instanceof RevealAuthority)) throw new ProvenanceFlowError("reveal authority is invalid");
    if (!this.#selection || this.#selection.transitionId !== value.request.acceptedAnswerId || this.#input.roundId !== value.request.roundId) return preReveal(this.#input.regime);
    const projection = createProvenancePublicProjection({ evidence: this.#input.evidence, eligibility: this.#input.eligibility,
      regime: this.#input.regime, authority: value.authority, request: value.request, guards: value.guards });
    if (projection.state !== "REVEALED") return projection;
    const expectedCorrectness = this.#selection.candidateId === projection.correctSource.candidateId;
    if (projection.correctness !== expectedCorrectness) throw new ProvenanceFlowError("authorized correctness disagrees with selected candidate");
    if (projection.versions.scoring !== this.#roundPlay.definition.scoringVersionId || projection.versions.rules !== this.#input.rulesVersionId ||
        projection.versions.reveal !== this.#input.revealVersionId || projection.versions.sourceRegime !== this.#input.regime.versionId) {
      throw new ProvenanceFlowError("authorized version does not match the flow");
    }
    const answeredRoundPlay = this.#roundPlay.acceptAnswer({ answerId: this.#selection.transitionId, candidateId: this.#selection.candidateId,
      acceptedAt: this.#selection.acceptedAt, candidateCount: this.#input.regime.candidates.length, correct: projection.correctness });
    return new AuthorizedFlowOutcome(projection, answeredRoundPlay);
  }
}

export class AuthorizedFlowOutcome {
  readonly #projection: RevealedProjection;
  readonly #roundPlay: RoundPlay;
  public constructor(projection: RevealedProjection, roundPlay: RoundPlay) {
    this.#projection = projection; this.#roundPlay = roundPlay; Object.freeze(this);
  }
  public get publicProjection() { return this.#projection; }
  public get answeredRoundPlay() { return this.#roundPlay; }
  public get result() { return this.#roundPlay.result(); }
  public toJSON() { return this.#projection; }
}

export function createProvenanceFlow(value: unknown): ProvenanceFlow {
  return ProvenanceFlow.create(value);
}
