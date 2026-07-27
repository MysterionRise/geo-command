import { describe, expect, it } from "vitest";

import {
  ManifestBook,
  ManifestRuleError,
  type ManifestRound,
} from "../src/manifest/index.js";

const activeDays = ["2026-09-01", "2026-09-02"] as const;

const rounds = (
  prefix: string,
): readonly [ManifestRound, ManifestRound, ManifestRound, ManifestRound, ManifestRound] => [
  { position: 1, roundId: `${prefix}-p1`, mode: "provenance" },
  { position: 2, roundId: `${prefix}-l1`, mode: "language" },
  { position: 3, roundId: `${prefix}-p2`, mode: "provenance" },
  { position: 4, roundId: `${prefix}-l2`, mode: "language" },
  { position: 5, roundId: `${prefix}-p3`, mode: "provenance" },
];

const withFirstDay = () =>
  ManifestBook.forActiveDays(activeDays).createLineage({
    betaDay: activeDays[0],
    lineageId: "lineage-day-1",
    initialVersionId: "day-1-v1",
    recordedAt: "2026-08-31T20:00:00.000Z",
    rounds: rounds("day-1"),
  });

describe("daily manifest lineages", () => {
  it("permits exactly one lineage for each configured UTC beta day", () => {
    const book = withFirstDay();

    expect(() =>
      book.createLineage({
        betaDay: activeDays[0],
        lineageId: "duplicate-day",
        initialVersionId: "duplicate-v1",
        recordedAt: "2026-08-31T21:00:00.000Z",
        rounds: rounds("duplicate"),
      }),
    ).toThrowError(new ManifestRuleError("A lineage already exists for 2026-09-01"));

    expect(() =>
      book.createLineage({
        betaDay: "2026-09-03",
        lineageId: "inactive-day",
        initialVersionId: "inactive-v1",
        recordedAt: "2026-09-02T20:00:00.000Z",
        rounds: rounds("inactive"),
      }),
    ).toThrowError(new ManifestRuleError("2026-09-03 is not an active beta day"));
  });

  it("requires five distinct positions containing three provenance and two language rounds", () => {
    const invalidRounds = [
      { position: 1, roundId: "p1", mode: "provenance" },
      { position: 2, roundId: "p2", mode: "provenance" },
      { position: 3, roundId: "p3", mode: "provenance" },
      { position: 4, roundId: "p4", mode: "provenance" },
      { position: 4, roundId: "l1", mode: "language" },
    ] as unknown as readonly [
      ManifestRound,
      ManifestRound,
      ManifestRound,
      ManifestRound,
      ManifestRound,
    ];

    expect(() =>
      ManifestBook.forActiveDays(activeDays).createLineage({
        betaDay: activeDays[0],
        lineageId: "invalid",
        initialVersionId: "invalid-v1",
        recordedAt: "2026-08-31T20:00:00.000Z",
        rounds: invalidRounds,
      }),
    ).toThrowError(
      new ManifestRuleError(
        "A manifest version must have positions 1 through 5 exactly once",
      ),
    );
  });

  it("rejects five distinct positions with the wrong mode ratio", () => {
    const wrongRatio = [
      { position: 1, roundId: "p1", mode: "provenance" },
      { position: 2, roundId: "p2", mode: "provenance" },
      { position: 3, roundId: "p3", mode: "provenance" },
      { position: 4, roundId: "p4", mode: "provenance" },
      { position: 5, roundId: "l1", mode: "language" },
    ] as const;

    expect(() =>
      ManifestBook.forActiveDays(activeDays).createLineage({
        betaDay: activeDays[0],
        lineageId: "wrong-ratio",
        initialVersionId: "wrong-ratio-v1",
        recordedAt: "2026-08-31T20:00:00.000Z",
        rounds: wrongRatio,
      }),
    ).toThrowError(
      new ManifestRuleError(
        "A manifest version must contain three provenance and two language rounds",
      ),
    );
  });

  it("creates successor versions only from a recorded correction or reserve promotion", () => {
    const book = withFirstDay();

    expect(() =>
      book.promoteVersion({
        betaDay: activeDays[0],
        versionId: "day-1-v2",
        recordedAt: "2026-09-01T01:00:00.000Z",
        record: {
          kind: "MANUAL" as "CORRECTION",
          recordId: "operator-note-1",
          reason: "unrecorded manual change",
        },
        replacement: {
          position: 1,
          roundId: "reserve-p1",
          mode: "provenance",
        },
      }),
    ).toThrowError(
      new ManifestRuleError(
        "A successor version requires a correction or reserve-promotion record",
      ),
    );

    const promoted = book.promoteVersion({
      betaDay: activeDays[0],
      versionId: "day-1-v2",
      recordedAt: "2026-09-01T01:00:00.000Z",
      record: {
        kind: "RESERVE_PROMOTION",
        recordId: "promotion-1",
        reason: "scheduled round quarantined",
      },
      replacement: {
        position: 1,
        roundId: "reserve-p1",
        mode: "provenance",
      },
    });

    expect(promoted.currentIssuanceVersion(activeDays[0]).versionId).toBe(
      "day-1-v2",
    );
    expect(promoted.isEligibleForNewIssuance(activeDays[0], "day-1-v1")).toBe(
      false,
    );
    expect(promoted.isEligibleForNewIssuance(activeDays[0], "day-1-v2")).toBe(
      true,
    );
  });

  it("keeps versions deeply immutable and does not alter the prior version on promotion", () => {
    const before = withFirstDay();
    const original = before.currentIssuanceVersion(activeDays[0]);
    const after = before.promoteVersion({
      betaDay: activeDays[0],
      versionId: "day-1-v2",
      recordedAt: "2026-09-01T02:00:00.000Z",
      record: {
        kind: "CORRECTION",
        recordId: "correction-1",
        reason: "answer ambiguity confirmed",
      },
      replacement: {
        position: 2,
        roundId: "reserve-l1",
        mode: "language",
      },
    });

    expect(Object.isFrozen(original)).toBe(true);
    expect(Object.isFrozen(original.rounds)).toBe(true);
    expect(original.rounds[1]?.roundId).toBe("day-1-l1");
    expect(after.currentIssuanceVersion(activeDays[0]).rounds[1]?.roundId).toBe(
      "reserve-l1",
    );
    expect(before.currentIssuanceVersion(activeDays[0]).versionId).toBe("day-1-v1");
  });

  it("permanently binds an issued participant-day session to the issuance version", () => {
    const issued = withFirstDay().issueSession({
      betaDay: activeDays[0],
      participantId: "participant-1",
      sessionId: "session-1",
      issuedAt: "2026-09-01T00:15:00.000Z",
    });
    const promoted = issued.promoteVersion({
      betaDay: activeDays[0],
      versionId: "day-1-v2",
      recordedAt: "2026-09-01T01:00:00.000Z",
      record: {
        kind: "RESERVE_PROMOTION",
        recordId: "promotion-1",
        reason: "scheduled round quarantined",
      },
      replacement: {
        position: 1,
        roundId: "reserve-p1",
        mode: "provenance",
      },
    });

    expect(promoted.bindingFor("session-1")).toMatchObject({
      betaDay: activeDays[0],
      lineageId: "lineage-day-1",
      manifestVersionId: "day-1-v1",
    });
    expect(() =>
      promoted.issueSession({
        betaDay: activeDays[0],
        participantId: "participant-1",
        sessionId: "session-1",
        issuedAt: "2026-09-01T02:00:00.000Z",
      }),
    ).toThrowError(new ManifestRuleError("Session session-1 is already issued"));
  });

  it("issues new sessions only during their UTC beta day", () => {
    expect(() =>
      withFirstDay().issueSession({
        betaDay: activeDays[0],
        participantId: "participant-1",
        sessionId: "late-session",
        issuedAt: "2026-09-02T00:00:00.000Z",
      }),
    ).toThrowError(
      new ManifestRuleError("New sessions can only be issued during 2026-09-01 UTC"),
    );
  });

  it("does not schedule a round twice in one version or across daily lineages", () => {
    expect(() => {
      const duplicate = [...rounds("day-1")];
      duplicate[4] = { position: 5, roundId: "day-1-p1", mode: "provenance" };
      ManifestBook.forActiveDays(activeDays).createLineage({
        betaDay: activeDays[0],
        lineageId: "lineage-day-1",
        initialVersionId: "day-1-v1",
        recordedAt: "2026-08-31T20:00:00.000Z",
        rounds: duplicate as unknown as readonly [
          ManifestRound,
          ManifestRound,
          ManifestRound,
          ManifestRound,
          ManifestRound,
        ],
      });
    }).toThrowError(
      new ManifestRuleError("Round IDs must be distinct within a manifest version"),
    );

    const firstDay = withFirstDay();
    const secondDayRounds = [...rounds("day-2")];
    secondDayRounds[0] = {
      position: 1,
      roundId: "day-1-p1",
      mode: "provenance",
    };

    expect(() =>
      firstDay.createLineage({
        betaDay: activeDays[1],
        lineageId: "lineage-day-2",
        initialVersionId: "day-2-v1",
        recordedAt: "2026-09-01T20:00:00.000Z",
        rounds: secondDayRounds as unknown as readonly [
          ManifestRound,
          ManifestRound,
          ManifestRound,
          ManifestRound,
          ManifestRound,
        ],
      }),
    ).toThrowError(
      new ManifestRuleError("Round day-1-p1 is already scheduled in another lineage"),
    );
  });
});
