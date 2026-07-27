export type SessionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "EXPIRED"
  | "WITHDRAWN";

export type InteractionStatus = "UNSEEN" | "OPEN" | "ANSWERED" | "REVEALED";

export type CorrectionStatus = "ACTIVE" | "VOID" | "CONTENT_WITHDRAWN";

export type ClueState = 0 | 1 | 2;

export interface AcceptedAnswer {
  readonly answerId: string;
  readonly acceptedAt: string;
}

export interface AuthoritativeState {
  readonly session: SessionStatus;
  readonly interaction: InteractionStatus;
  readonly correction: CorrectionStatus;
  readonly cluesRevealed: ClueState;
  readonly answer: AcceptedAnswer | null;
}

export interface AnswerGateChecks {
  readonly credentialValid: boolean;
  readonly utcWindowValid: boolean;
  readonly graceWindowValid: boolean;
}

export type StateTransitionErrorCode =
  | "SESSION_NOT_IN_PROGRESS"
  | "SESSION_TRANSITION_PROHIBITED"
  | "INTERACTION_NOT_UNSEEN"
  | "INTERACTION_NOT_OPEN"
  | "INTERACTION_NOT_ANSWERED"
  | "CORRECTION_NOT_ACTIVE"
  | "CORRECTION_ALREADY_TERMINAL"
  | "INVALID_CORRECTION_TARGET"
  | "CLUE_LIMIT_REACHED"
  | "ANSWER_ALREADY_ACCEPTED"
  | "ANSWER_REQUIRED"
  | "CREDENTIAL_INVALID"
  | "UTC_WINDOW_INVALID"
  | "GRACE_WINDOW_INVALID"
  | "INVALID_ANSWER";

export interface StateTransitionError {
  readonly code: StateTransitionErrorCode;
  readonly message: string;
}

export type StateTransitionResult =
  | { readonly ok: true; readonly state: AuthoritativeState }
  | { readonly ok: false; readonly error: StateTransitionError };

export class StateRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "StateRuleError";
  }
}

const SESSION_STATUSES: readonly SessionStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "EXPIRED",
  "WITHDRAWN",
];

const INTERACTION_STATUSES: readonly InteractionStatus[] = [
  "UNSEEN",
  "OPEN",
  "ANSWERED",
  "REVEALED",
];

const CORRECTION_STATUSES: readonly CorrectionStatus[] = [
  "ACTIVE",
  "VOID",
  "CONTENT_WITHDRAWN",
];

const SESSION_TRANSITIONS = Object.freeze({
    NOT_STARTED: Object.freeze(["IN_PROGRESS", "WITHDRAWN"]),
    IN_PROGRESS: Object.freeze(["COMPLETED", "EXPIRED", "WITHDRAWN"]),
    COMPLETED: Object.freeze([]),
    EXPIRED: Object.freeze([]),
    WITHDRAWN: Object.freeze([]),
  } as const satisfies Readonly<Record<SessionStatus, readonly SessionStatus[]>>);

const assertKnown = <T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T => {
  if (!allowed.includes(value as T)) {
    throw new StateRuleError(`${label} is not supported`);
  }
  return value as T;
};

const frozenAnswer = (answer: AcceptedAnswer): AcceptedAnswer => {
  if (typeof answer.answerId !== "string" || answer.answerId.trim().length === 0) {
    throw new StateRuleError("answerId must not be empty");
  }
  if (
    typeof answer.acceptedAt !== "string" ||
    !Number.isFinite(Date.parse(answer.acceptedAt))
  ) {
    throw new StateRuleError("acceptedAt must be a valid instant");
  }
  return Object.freeze({
    answerId: answer.answerId,
    acceptedAt: answer.acceptedAt,
  });
};

export function createAuthoritativeState(
  input: AuthoritativeState,
): AuthoritativeState {
  const session = assertKnown(input.session, SESSION_STATUSES, "session");
  const interaction = assertKnown(
    input.interaction,
    INTERACTION_STATUSES,
    "interaction",
  );
  const correction = assertKnown(
    input.correction,
    CORRECTION_STATUSES,
    "correction",
  );
  if (input.cluesRevealed !== 0 && input.cluesRevealed !== 1 && input.cluesRevealed !== 2) {
    throw new StateRuleError("cluesRevealed must be 0, 1, or 2");
  }

  const requiresAnswer = interaction === "ANSWERED" || interaction === "REVEALED";
  if (requiresAnswer && input.answer === null) {
    throw new StateRuleError(`${interaction} requires an accepted answer`);
  }
  if (!requiresAnswer && input.answer !== null) {
    throw new StateRuleError(`${interaction} cannot contain an accepted answer`);
  }

  return Object.freeze({
    session,
    interaction,
    correction,
    cluesRevealed: input.cluesRevealed,
    answer: input.answer === null ? null : frozenAnswer(input.answer),
  });
}

const permitted = (state: AuthoritativeState): StateTransitionResult =>
  Object.freeze({ ok: true, state });

const prohibited = (
  code: StateTransitionErrorCode,
  message: string,
): StateTransitionResult =>
  Object.freeze({
    ok: false,
    error: Object.freeze({ code, message }),
  });

const replace = (
  state: AuthoritativeState,
  changes: Partial<AuthoritativeState>,
): StateTransitionResult => permitted(createAuthoritativeState({ ...state, ...changes }));

const requireAnswerable = (
  state: AuthoritativeState,
): StateTransitionResult | null => {
  if (state.session !== "IN_PROGRESS") {
    return prohibited(
      "SESSION_NOT_IN_PROGRESS",
      "The session must be in progress",
    );
  }
  if (state.interaction !== "OPEN") {
    return prohibited("INTERACTION_NOT_OPEN", "The interaction must be open");
  }
  if (state.correction !== "ACTIVE") {
    return prohibited("CORRECTION_NOT_ACTIVE", "The correction state must be active");
  }
  return null;
};

export function acceptAnswer(
  state: AuthoritativeState,
  answer: AcceptedAnswer,
  gates: AnswerGateChecks,
): StateTransitionResult {
  if (state.answer !== null) {
    return prohibited("ANSWER_ALREADY_ACCEPTED", "An answer was already accepted");
  }
  const conjunctionFailure = requireAnswerable(state);
  if (conjunctionFailure) return conjunctionFailure;
  if (!gates.credentialValid) {
    return prohibited("CREDENTIAL_INVALID", "The credential gate failed");
  }
  if (!gates.utcWindowValid) {
    return prohibited("UTC_WINDOW_INVALID", "The UTC window gate failed");
  }
  if (!gates.graceWindowValid) {
    return prohibited("GRACE_WINDOW_INVALID", "The grace window gate failed");
  }

  try {
    return replace(state, {
      interaction: "ANSWERED",
      answer: frozenAnswer(answer),
    });
  } catch (error) {
    return prohibited(
      "INVALID_ANSWER",
      error instanceof Error ? error.message : "The answer is invalid",
    );
  }
}

export function openInteraction(state: AuthoritativeState): StateTransitionResult {
  if (state.session !== "IN_PROGRESS") {
    return prohibited(
      "SESSION_NOT_IN_PROGRESS",
      "The session must be in progress",
    );
  }
  if (state.correction !== "ACTIVE") {
    return prohibited("CORRECTION_NOT_ACTIVE", "The correction state must be active");
  }
  if (state.interaction !== "UNSEEN") {
    return prohibited(
      "INTERACTION_NOT_UNSEEN",
      "Only an unseen interaction can be opened",
    );
  }
  return replace(state, { interaction: "OPEN" });
}

export function revealClue(state: AuthoritativeState): StateTransitionResult {
  const conjunctionFailure = requireAnswerable(state);
  if (conjunctionFailure) return conjunctionFailure;
  if (state.cluesRevealed === 2) {
    return prohibited("CLUE_LIMIT_REACHED", "No more than two clues may be revealed");
  }
  return replace(state, {
    cluesRevealed: state.cluesRevealed === 0 ? 1 : 2,
  });
}

export function revealAnswer(state: AuthoritativeState): StateTransitionResult {
  if (state.answer === null) {
    return prohibited("ANSWER_REQUIRED", "Reveal requires an accepted answer");
  }
  if (state.interaction !== "ANSWERED") {
    return prohibited(
      "INTERACTION_NOT_ANSWERED",
      "Only an answered interaction can be revealed",
    );
  }
  return replace(state, { interaction: "REVEALED" });
}

export function setSessionStatus(
  state: AuthoritativeState,
  target: SessionStatus,
): StateTransitionResult {
  if (!SESSION_STATUSES.includes(target)) {
    return prohibited(
      "SESSION_TRANSITION_PROHIBITED",
      "The requested session status is unsupported",
    );
  }
  const allowedTargets: readonly SessionStatus[] = SESSION_TRANSITIONS[state.session];
  if (!allowedTargets.includes(target)) {
    return prohibited(
      "SESSION_TRANSITION_PROHIBITED",
      `${state.session} cannot transition to ${target}`,
    );
  }
  return replace(state, { session: target });
}

export function setCorrectionStatus(
  state: AuthoritativeState,
  target: CorrectionStatus,
): StateTransitionResult {
  if (target === "ACTIVE") {
    return prohibited(
      "INVALID_CORRECTION_TARGET",
      "A correction transition must end in a terminal correction status",
    );
  }
  if (state.correction !== "ACTIVE") {
    return prohibited(
      "CORRECTION_ALREADY_TERMINAL",
      "The correction state is already terminal",
    );
  }
  return replace(state, { correction: target });
}
