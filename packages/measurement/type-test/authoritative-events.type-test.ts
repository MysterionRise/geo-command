import type { AuthoritativeEvent } from "../src/events/index.js";

declare const event: AuthoritativeEvent;

const eventId: string = event.eventId;
const acceptedAt: string = event.acceptedAt;
void eventId;
void acceptedAt;

if (event.eventFamilyId === "SESSION_COMPLETED") {
  const activeRounds: number = event.roundCounts.ACTIVE;
  void activeRounds;

  // @ts-expect-error SESSION_COMPLETED never carries answer candidate data.
  event.candidateId;

  // @ts-expect-error authoritative nested counts are deeply readonly.
  event.roundCounts.ACTIVE = 0;
}

if (event.eventFamilyId === "REVEAL_DENIED") {
  const reason: "NOT_READY" | "EXPIRED" | "REPLAYED" | "SCOPE_MISMATCH" | "GUARD_REJECTED" | "ROUND_BLOCKED" | "PAYLOAD_REJECTED" = event.denialReasonClass;
  void reason;

  // @ts-expect-error denied reveals contain no correctness fact.
  event.correctness;
}

// @ts-expect-error only the parser can produce a branded authoritative event.
const arbitrary: AuthoritativeEvent = Object.freeze({ eventId: "not-authoritative" });
void arbitrary;
