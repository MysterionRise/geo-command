import { describe, expect, it } from "vitest";

import {
  acceptAnswer,
  createAuthoritativeState,
  openInteraction,
  revealAnswer,
  revealClue,
  setCorrectionStatus,
  setSessionStatus,
  StateRuleError,
  type AnswerGateChecks,
  type AuthoritativeState,
  type CorrectionStatus,
  type InteractionStatus,
  type SessionStatus,
} from "../src/session/index.js";

const acceptedAnswer = {
  answerId: "answer-17",
  acceptedAt: "2026-09-01T00:17:00.000Z",
} as const;

const passingGates: AnswerGateChecks = {
  credentialValid: true,
  utcWindowValid: true,
  graceWindowValid: true,
};

const state = (
  overrides: Partial<{
    session: SessionStatus;
    interaction: InteractionStatus;
    correction: CorrectionStatus;
    cluesRevealed: 0 | 1 | 2;
    answer: typeof acceptedAnswer | null;
  }> = {},
): AuthoritativeState => {
  const interaction = overrides.interaction ?? "OPEN";
  return createAuthoritativeState({
    session: overrides.session ?? "IN_PROGRESS",
    interaction,
    correction: overrides.correction ?? "ACTIVE",
    cluesRevealed: overrides.cluesRevealed ?? 0,
    answer:
      overrides.answer === undefined
        ? interaction === "ANSWERED" || interaction === "REVEALED"
          ? acceptedAnswer
          : null
        : overrides.answer,
  });
};

describe("orthogonal authoritative state", () => {
  it("stores exactly five immutable dimensions", () => {
    const current = state({ correction: "CONTENT_WITHDRAWN", cluesRevealed: 2 });

    expect(Object.keys(current).sort()).toEqual([
      "answer",
      "cluesRevealed",
      "correction",
      "interaction",
      "session",
    ]);
    expect(current.session).toBe("IN_PROGRESS");
    expect(current.correction).toBe("CONTENT_WITHDRAWN");
    expect(Object.isFrozen(current)).toBe(true);
  });

  it("keeps participant withdrawal distinct from content withdrawal", () => {
    const current = state({
      session: "WITHDRAWN",
      correction: "CONTENT_WITHDRAWN",
    });

    expect(current.session).toBe("WITHDRAWN");
    expect(current.correction).toBe("CONTENT_WITHDRAWN");
  });

  it.each([
    ["REVEALED", null, "REVEALED requires an accepted answer"],
    ["ANSWERED", null, "ANSWERED requires an accepted answer"],
    ["OPEN", acceptedAnswer, "OPEN cannot contain an accepted answer"],
    ["UNSEEN", acceptedAnswer, "UNSEEN cannot contain an accepted answer"],
  ] as const)("rejects impossible %s answer conjunctions", (interaction, answer, message) => {
    expect(() =>
      createAuthoritativeState({
        session: "IN_PROGRESS",
        interaction,
        correction: "ACTIVE",
        cluesRevealed: 0,
        answer,
      }),
    ).toThrowError(new StateRuleError(message));
  });

  it("classifies every constructed state conjunction as valid or impossible", () => {
    const sessions: readonly SessionStatus[] = [
      "NOT_STARTED",
      "IN_PROGRESS",
      "COMPLETED",
      "EXPIRED",
      "WITHDRAWN",
    ];
    const interactions: readonly InteractionStatus[] = [
      "UNSEEN",
      "OPEN",
      "ANSWERED",
      "REVEALED",
    ];
    const corrections: readonly CorrectionStatus[] = [
      "ACTIVE",
      "VOID",
      "CONTENT_WITHDRAWN",
    ];
    const clues = [0, 1, 2] as const;
    const answerStates = [false, true] as const;
    let valid = 0;
    let impossible = 0;

    for (const session of sessions) {
      for (const interaction of interactions) {
        for (const correction of corrections) {
          for (const cluesRevealed of clues) {
            for (const answerPresent of answerStates) {
              const expectedValid =
                answerPresent ===
                (interaction === "ANSWERED" || interaction === "REVEALED");
              let constructed = false;
              try {
                createAuthoritativeState({
                  session,
                  interaction,
                  correction,
                  cluesRevealed,
                  answer: answerPresent ? acceptedAnswer : null,
                });
                constructed = true;
              } catch (error) {
                expect(error instanceof StateRuleError).toBe(true);
              }
              expect(constructed).toBe(expectedValid);
              if (constructed) valid += 1;
              else impossible += 1;
            }
          }
        }
      }
    }

    expect(valid).toBe(180);
    expect(impossible).toBe(180);
  });

  it("accepts an answer for every and only the permitted cross-dimension conjunction", () => {
    const sessions: readonly SessionStatus[] = [
      "NOT_STARTED",
      "IN_PROGRESS",
      "COMPLETED",
      "EXPIRED",
      "WITHDRAWN",
    ];
    const interactions: readonly InteractionStatus[] = [
      "UNSEEN",
      "OPEN",
      "ANSWERED",
      "REVEALED",
    ];
    const corrections: readonly CorrectionStatus[] = [
      "ACTIVE",
      "VOID",
      "CONTENT_WITHDRAWN",
    ];
    const clues = [0, 1, 2] as const;
    const booleans = [false, true] as const;
    const answerStates = [false, true] as const;
    let checked = 0;
    let permitted = 0;

    for (const session of sessions) {
      for (const interaction of interactions) {
        for (const correction of corrections) {
          for (const cluesRevealed of clues) {
            for (const answerPresent of answerStates) {
              for (const credentialValid of booleans) {
                for (const utcWindowValid of booleans) {
                  for (const graceWindowValid of booleans) {
                    let resultOk = false;
                    try {
                      const current = createAuthoritativeState({
                        session,
                        interaction,
                        correction,
                        cluesRevealed,
                        answer: answerPresent ? acceptedAnswer : null,
                      });
                      resultOk = acceptAnswer(current, acceptedAnswer, {
                        credentialValid,
                        utcWindowValid,
                        graceWindowValid,
                      }).ok;
                    } catch (error) {
                      expect(error instanceof StateRuleError).toBe(true);
                    }
                    const expected =
                      session === "IN_PROGRESS" &&
                      interaction === "OPEN" &&
                      correction === "ACTIVE" &&
                      !answerPresent &&
                      credentialValid &&
                      utcWindowValid &&
                      graceWindowValid;
                    expect(resultOk).toBe(expected);
                    checked += 1;
                    if (resultOk) permitted += 1;
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(checked).toBe(2_880);
    expect(permitted).toBe(3);
  });

  it("records one immutable answer and moves interaction to answered", () => {
    const before = state();
    const result = acceptAnswer(before, acceptedAnswer, passingGates);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.interaction).toBe("ANSWERED");
    expect(result.state.answer).toEqual(acceptedAnswer);
    expect(Object.isFrozen(result.state.answer)).toBe(true);
    expect(before.answer).toBe(null);
    expect(acceptAnswer(result.state, acceptedAnswer, passingGates)).toMatchObject({
      ok: false,
      error: { code: "ANSWER_ALREADY_ACCEPTED" },
    });
  });

  it.each([
    ["credentialValid", "CREDENTIAL_INVALID"],
    ["utcWindowValid", "UTC_WINDOW_INVALID"],
    ["graceWindowValid", "GRACE_WINDOW_INVALID"],
  ] as const)("reports a failed %s gate without changing state", (gate, code) => {
    const before = state();
    const result = acceptAnswer(before, acceptedAnswer, {
      ...passingGates,
      [gate]: false,
    });

    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(before.interaction).toBe("OPEN");
    expect(before.answer).toBe(null);
  });

  it("reveals only an accepted answer", () => {
    expect(revealAnswer(state())).toMatchObject({
      ok: false,
      error: { code: "ANSWER_REQUIRED" },
    });

    const result = revealAnswer(state({ interaction: "ANSWERED" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.interaction).toBe("REVEALED");
  });

  it("opens an unseen active round only while its session is in progress", () => {
    expect(openInteraction(state({ interaction: "UNSEEN" })).ok).toBe(true);
    expect(openInteraction(state({ session: "EXPIRED", interaction: "UNSEEN" }))).toMatchObject({
      ok: false,
      error: { code: "SESSION_NOT_IN_PROGRESS" },
    });
    expect(openInteraction(state({ interaction: "UNSEEN", correction: "VOID" }))).toMatchObject({
      ok: false,
      error: { code: "CORRECTION_NOT_ACTIVE" },
    });
  });

  it("advances clues from zero to two only in the answerable conjunction", () => {
    const first = revealClue(state());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.cluesRevealed).toBe(1);

    const second = revealClue(first.state);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.cluesRevealed).toBe(2);
    expect(revealClue(second.state)).toMatchObject({
      ok: false,
      error: { code: "CLUE_LIMIT_REACHED" },
    });
    expect(revealClue(state({ correction: "VOID" }))).toMatchObject({
      ok: false,
      error: { code: "CORRECTION_NOT_ACTIVE" },
    });
  });

  it.each([
    ["NOT_STARTED", "IN_PROGRESS", true],
    ["NOT_STARTED", "WITHDRAWN", true],
    ["IN_PROGRESS", "COMPLETED", true],
    ["IN_PROGRESS", "EXPIRED", true],
    ["IN_PROGRESS", "WITHDRAWN", true],
    ["COMPLETED", "EXPIRED", false],
    ["EXPIRED", "IN_PROGRESS", false],
    ["WITHDRAWN", "IN_PROGRESS", false],
  ] as const)("freezes session transition %s to %s", (from, to, permitted) => {
    expect(setSessionStatus(state({ session: from }), to).ok).toBe(permitted);
  });

  it("makes correction terminal while retaining historical answers", () => {
    const answered = state({ interaction: "ANSWERED" });
    const voided = setCorrectionStatus(answered, "VOID");
    const withdrawn = setCorrectionStatus(answered, "CONTENT_WITHDRAWN");

    expect(voided).toMatchObject({
      ok: true,
      state: { correction: "VOID", answer: acceptedAnswer },
    });
    expect(withdrawn).toMatchObject({
      ok: true,
      state: { correction: "CONTENT_WITHDRAWN", answer: acceptedAnswer },
    });
    if (voided.ok) {
      expect(setCorrectionStatus(voided.state, "CONTENT_WITHDRAWN")).toMatchObject({
        ok: false,
        error: { code: "CORRECTION_ALREADY_TERMINAL" },
      });
      expect(acceptAnswer(voided.state, acceptedAnswer, passingGates)).toMatchObject({
        ok: false,
        error: { code: "ANSWER_ALREADY_ACCEPTED" },
      });
    }
  });
});
