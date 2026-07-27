import type { AuthoritativeEvent } from "../events/index.js";
import {
  addExclusion,
  correctionReasons,
  dispositionsByParticipant,
  fail,
  metric,
  parseChanceInput,
  type AnalysisDisposition,
  type ChanceFormulaInput,
  type FormulaVersions,
} from "./types.js";

type Mode = "provenance" | "language";
type Answer = Extract<AuthoritativeEvent, { readonly eventFamilyId: "ANSWER_ACCEPTED" }>;
type Display = Extract<AuthoritativeEvent, { readonly eventFamilyId: "ROUND_DISPLAYED" }>;
type Reveal = Extract<AuthoritativeEvent, { readonly eventFamilyId: "REVEAL_AUTHORIZED" }>;

const scopeKey = (event: Answer | Display): string => `${event.participantLineageId}|${event.betaDay}|${event.manifestLineageId}|${event.manifestVersionId}|${event.sessionId}|${event.roundId}`;

const dispositionKind = (disposition: AnalysisDisposition | undefined): "MISSING" | "INCLUDED" | "EXCLUDED" =>
  disposition === undefined || disposition.state === "PENDING" ? "MISSING" : disposition.state;

const summary = (mode: Mode, input: ChanceFormulaInput) => {
  const displays = new Map<string, Display>();
  const reveals = new Map<string, Reveal>();
  const answers: Answer[] = [];
  for (const event of input.events) {
    if (event.eventFamilyId === "ROUND_DISPLAYED") {
      const key = scopeKey(event);
      if (displays.has(key)) fail("Ambiguous duplicate round display");
      displays.set(key, event);
    } else if (event.eventFamilyId === "ANSWER_ACCEPTED") answers.push(event);
    else if (event.eventFamilyId === "REVEAL_AUTHORIZED") {
      if (reveals.has(event.acceptedAnswerId)) fail("Ambiguous answer reveal join");
      reveals.set(event.acceptedAnswerId, event);
    }
  }
  const answerScopes = new Set<string>();
  const answerIds = new Set(answers.map((answer) => answer.eventId));
  for (const answer of answers) {
    const key = scopeKey(answer);
    if (answerScopes.has(key)) fail("Multiple accepted answers for one scoped round");
    answerScopes.add(key);
    const display = displays.get(key);
    if (!display) fail("Answer is orphaned from its full display scope");
    if (answer.acceptedAt < display.displayedAt) fail("Answer chronology precedes round display");
  }
  for (const reveal of reveals.values()) {
    if (!answerIds.has(reveal.acceptedAnswerId)) fail("Reveal is orphaned from an accepted answer");
    const answer = answers.find((candidate) => candidate.eventId === reveal.acceptedAnswerId)!;
    if (reveal.revealedAt < answer.acceptedAt || reveal.acceptedAt < answer.acceptedAt) fail("Reveal chronology precedes accepted answer");
  }

  const candidateSets = new Map<string, Readonly<{ mode: Mode; candidateCount: number }>>();
  for (const answer of answers) {
    const prior = candidateSets.get(answer.candidateSetVersionId);
    if (prior !== undefined && (prior.candidateCount !== answer.candidateCount || prior.mode !== answer.mode)) fail("Candidate-set version has candidate-count or mode drift");
    candidateSets.set(answer.candidateSetVersionId, Object.freeze({ mode: answer.mode, candidateCount: answer.candidateCount }));
    if (answer.mode === "provenance" && answer.candidateCount !== 2) fail("Provenance candidate count must equal two");
  }

  const dispositions = dispositionsByParticipant(input);
  const corrections = correctionReasons(input.events);
  const exclusions = new Map<string, number>();
  const candidateHistogram = new Map<number, number>();
  const clueHistogram = new Map<number, number>([[0, 0], [1, 0], [2, 0]]);
  let accepted = 0; let revealed = 0; let correct = 0; let missing = 0;

  for (const answer of answers.filter((entry) => entry.mode === mode).sort((a, b) => a.eventId.localeCompare(b.eventId))) {
    const display = displays.get(scopeKey(answer));
    if (!display || display.mode !== answer.mode) fail("Answer does not bind exactly one displayed round in the same mode");
    const correction = corrections.get(answer.roundId);
    if (correction) { addExclusion(exclusions, correction); continue; }
    const disposition = dispositions.get(answer.participantLineageId);
    const kind = dispositionKind(disposition);
    if (kind === "MISSING") { missing += 1; continue; }
    if (kind === "EXCLUDED") {
      addExclusion(exclusions, (disposition as Extract<AnalysisDisposition, { state: "EXCLUDED" }>).reasonClass);
      continue;
    }
    accepted += 1;
    candidateHistogram.set(answer.candidateCount, (candidateHistogram.get(answer.candidateCount) ?? 0) + 1);
    clueHistogram.set(answer.clueCount, (clueHistogram.get(answer.clueCount) ?? 0) + 1);
    const reveal = reveals.get(answer.eventId);
    if (!reveal) { missing += 1; continue; }
    revealed += 1;
    if (reveal.correctness) correct += 1;
  }

  const candidateCountHistogram = Object.freeze([...candidateHistogram.entries()].sort(([a], [b]) => a - b)
    .map(([candidateCount, count]) => Object.freeze({ candidateCount, count })));
  const clueCountHistogram = Object.freeze([...clueHistogram.entries()].sort(([a], [b]) => a - b)
    .map(([clueCount, count]) => Object.freeze({ clueCount, count })));
  const chanceBaselineSum = candidateCountHistogram.reduce((sum, entry) => sum + entry.count * (1 / entry.candidateCount), 0);
  const base = metric(`CHANCE_AWARE_${mode.toUpperCase()}`, input.versions,
    Object.freeze({ accepted, revealed, correct }), accepted, missing, exclusions);
  return Object.freeze({ ...base, candidateCountHistogram, chanceBaselineSum,
    chanceBaselineMean: accepted === 0 ? null : chanceBaselineSum / accepted, clueCountHistogram });
};

export const calculateChanceAwareModeSummaries = (value: unknown) => {
  const input = parseChanceInput(value);
  return Object.freeze({ provenance: summary("provenance", input), language: summary("language", input) });
};

export type ChanceAwareModeSummaries = ReturnType<typeof calculateChanceAwareModeSummaries>;
export type { FormulaVersions };
