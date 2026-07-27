import { expect, test } from "@playwright/test";
import { createLanguageFlow } from "../../apps/game/src/modes/language/server/language-flow.js";
import {
  guards,
  languageFixture,
  request,
  transitionId,
} from "../../apps/game/test/support/language-flow-fixture.js";

const clueText = [
  "Look at the type annotation.",
  "Compare the runtime syntax.",
] as const;

const flowInput = (options: Parameters<typeof languageFixture>[0] = {}) => {
  const data = languageFixture(options);
  const clues = data.candidateSet.clues.map((clue, index) => Object.freeze({
    ...clue,
    text: clueText[index]!,
  }));
  const controlReview = data.eligibility.deceptiveTextControlReview;
  return {
    data,
    input: {
      evidence: data.evidence,
      eligibility: data.eligibility,
      candidateSet: data.candidateSet,
      presentation: data.presentation,
      roundPlay: data.roundPlay,
      sessionId: request.sessionId,
      roundId: request.roundId,
      roundVersionId: "language-round-v1",
      excerpt: data.evidence.excerpt,
      prompt: "Which programming language is this?",
      modeVersionId: "language-mode-v1",
      rulesVersionId: "language-rules-v1",
      revealVersionId: "language-reveal-v1",
      clues: Object.freeze(clues),
      controlAnnotation: controlReview.disposition === "approved-visible-annotation"
        ? Object.freeze({
          versionId: controlReview.visibleAnnotationVersion!,
          text: "The excerpt contains approved visible annotations for bidirectional or zero-width controls.",
        })
        : null,
    },
  };
};

const answer = Object.freeze({
  transitionId,
  candidateId: "lang-ts-01",
  acceptedAt: "2026-08-03T10:00:00Z",
});

const preReveal = Object.freeze({
  state: "PRE_REVEAL",
  mode: "language",
  candidateSetVersionId: "language-set-v1",
  presentedCandidateCount: 3,
});

test("runs a real language round through authorized public-only reveal", () => {
  const { data, input } = flowInput();
  const outcome = createLanguageFlow(input)
    .acceptClue("language-clue-one")
    .acceptAnswer(answer)
    .reveal({ authority: data.authority, request, guards });

  expect(outcome.publicProjection).toMatchObject({
    state: "REVEALED",
    mode: "language",
    correctness: true,
    correctLanguage: { candidateId: "lang-ts-01", label: "TypeScript" },
  });
  expect(outcome.answeredRoundPlay.acceptedAnswer).toMatchObject({
    answerId: transitionId,
    candidateId: "lang-ts-01",
    correct: true,
  });
  expect(outcome.result).toMatchObject({
    classification: "ENTERTAINMENT_ONLY",
    correct: true,
    cluesUsed: 1,
    points: 800,
  });
  expect(JSON.parse(JSON.stringify(outcome))).toEqual(outcome.publicProjection);
  expect(JSON.stringify(outcome)).not.toMatch(
    /acceptedAnswer|transition|distractorRationale|creator-language|authorization-language/i,
  );
});

test("fails closed for denied and cross-scope reveals", () => {
  const deniedData = flowInput();
  const denied = createLanguageFlow(deniedData.input).acceptAnswer(answer).reveal({
    authority: deniedData.data.authority,
    request,
    guards: Object.freeze({ ...guards, authorized: false }),
  });
  expect(denied).toEqual(preReveal);

  const crossScopeData = flowInput();
  const crossScope = createLanguageFlow(crossScopeData.input).acceptAnswer(answer).reveal({
    authority: crossScopeData.data.authority,
    request: Object.freeze({ ...request, sessionId: "other-session" }),
    guards,
  });
  expect(crossScope).toEqual(preReveal);
  expect(JSON.stringify([denied, crossScope])).not.toMatch(
    /correctLanguage|approvedEvidence|helpfulSignals|misleadingSignals/i,
  );
});

test("keeps approved bidi and zero-width controls inert and visibly annotated", () => {
  for (const [control, controlClass] of [
    ["\u202E", "bidi"],
    ["\u200B", "zero-width"],
  ] as const) {
    const excerpt = `const safe = 1; // ${control} annotated`;
    const { input } = flowInput({
      annotatedControls: true,
      detectedControlClasses: [controlClass],
      excerpt,
    });
    const round = createLanguageFlow(input).publicRound();

    expect(round.excerpt).toBe(excerpt);
    expect(round.controlAnnotation).toEqual({
      versionId: "language-control-annotation-v1",
      text: "The excerpt contains approved visible annotations for bidirectional or zero-width controls.",
      detectedControlClasses: [controlClass],
    });
  }
});
