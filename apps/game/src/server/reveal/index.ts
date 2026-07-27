export type RevealCorrectionStatus = "ACTIVE" | "VOID" | "CONTENT_WITHDRAWN";

export interface AcceptedAnswerEntitlement {
  readonly participantLineageId: string;
  readonly betaDay: string;
  readonly manifestLineageId: string;
  readonly manifestVersionId: string;
  readonly sessionId: string;
  readonly roundId: string;
  readonly acceptedAnswerId: string;
  readonly acceptedAt: string;
  readonly expiresAt: string;
  readonly correctionStatus: RevealCorrectionStatus;
  readonly revealBlocked: boolean;
}

export interface RevealRequest {
  readonly participantLineageId: string;
  readonly betaDay: string;
  readonly manifestLineageId: string;
  readonly manifestVersionId: string;
  readonly sessionId: string;
  readonly roundId: string;
  readonly acceptedAnswerId: string;
  readonly requestedAt: string;
}

export interface RevealGuards {
  readonly inputValid: boolean;
  readonly authenticated: boolean;
  readonly authorized: boolean;
  readonly credentialValid: boolean;
  readonly antiForgeryValid: boolean;
  readonly rateLimitAllowed: boolean;
}

export interface RevealExplanation {
  readonly helpfulSignals: readonly string[];
  readonly misleadingSignals: readonly string[];
}

export interface RevealVersions {
  readonly content: string;
  readonly candidateSet: string;
  readonly scoring: string;
  readonly rules: string;
  readonly evidence: string;
  readonly reveal: string;
}

export interface ProtectedRevealPayload {
  readonly correctness: boolean;
  readonly requiredAttribution: string;
  readonly displayApprovedSourceEvidence: string;
  readonly explanation: RevealExplanation;
  readonly versions: RevealVersions;
}

export interface RevealPayloadProvider {
  load(entitlement: AcceptedAnswerEntitlement): ProtectedRevealPayload;
}

export type RevealDenialReason =
  | "NOT_READY"
  | "EXPIRED"
  | "REPLAYED"
  | "SCOPE_MISMATCH"
  | "GUARD_REJECTED"
  | "ROUND_BLOCKED"
  | "PAYLOAD_REJECTED";

export interface RevealDenialScope {
  readonly participantLineageId: string;
  readonly betaDay: string;
  readonly manifestLineageId: string;
  readonly manifestVersionId: string;
  readonly roundId: string;
}

export interface RevealDenied {
  readonly outcome: "DENIED";
  readonly scope: RevealDenialScope;
  readonly deniedAt: string;
  readonly reason: RevealDenialReason;
}

export interface RevealAuthorized {
  readonly outcome: "AUTHORIZED";
  readonly payload: ProtectedRevealPayload;
}

export interface RevealAuthorizedAudit {
  readonly outcome: "AUTHORIZED";
  readonly acceptedAnswerId: string;
  readonly revealedAt: string;
  readonly correctness: boolean;
  readonly evidenceVersionId: string;
  readonly revealVersionId: string;
}

export type RevealAuthorizationResult =
  | {
      readonly response: RevealAuthorized;
      readonly audit: RevealAuthorizedAudit;
      readonly next: RevealAuthority;
    }
  | {
      readonly response: RevealDenied;
      readonly audit: RevealDenied;
      readonly next: RevealAuthority;
    };

export type PublicProjectionChannel =
  | "PUBLIC_BUNDLE"
  | "SOURCE_MAP"
  | "PREFETCH"
  | "ANALYTICS"
  | "LOG";

export class RevealContainmentError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RevealContainmentError";
  }
}

export class RevealRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RevealRuleError";
  }
}

const PROTECTED_PROJECTION_FIELDS = new Set([
  "prerevealanswer",
  "futureanswer",
  "futureanswers",
  "restrictedevidence",
  "correctanswer",
]);

const nonBlank = (value: string): boolean =>
  typeof value === "string" && value.trim().length > 0;

const validInstant = (value: string): boolean =>
  nonBlank(value) && Number.isFinite(Date.parse(value));

const requiredText = (value: string, field: string): string => {
  if (!nonBlank(value)) throw new RevealRuleError(`${field} must not be empty`);
  return value.trim();
};

const freezeStrings = (values: readonly string[], field: string): readonly string[] => {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RevealRuleError(`${field} must be a non-empty string list`);
  }
  return Object.freeze(values.map((value, index) => requiredText(value, `${field}[${index}]`)));
};

const freezePayload = (payload: ProtectedRevealPayload): ProtectedRevealPayload =>
  Object.freeze({
    correctness: (() => {
      if (typeof payload.correctness !== "boolean") {
        throw new RevealRuleError("correctness must be a boolean");
      }
      return payload.correctness;
    })(),
    requiredAttribution: requiredText(payload.requiredAttribution, "requiredAttribution"),
    displayApprovedSourceEvidence: requiredText(
      payload.displayApprovedSourceEvidence,
      "displayApprovedSourceEvidence",
    ),
    explanation: Object.freeze({
      helpfulSignals: freezeStrings(payload.explanation.helpfulSignals, "helpfulSignals"),
      misleadingSignals: freezeStrings(
        payload.explanation.misleadingSignals,
        "misleadingSignals",
      ),
    }),
    versions: Object.freeze({
      content: requiredText(payload.versions.content, "versions.content"),
      candidateSet: requiredText(payload.versions.candidateSet, "versions.candidateSet"),
      scoring: requiredText(payload.versions.scoring, "versions.scoring"),
      rules: requiredText(payload.versions.rules, "versions.rules"),
      evidence: requiredText(payload.versions.evidence, "versions.evidence"),
      reveal: requiredText(payload.versions.reveal, "versions.reveal"),
    }),
  });

const freezeEntitlement = (
  entitlement: AcceptedAnswerEntitlement,
): AcceptedAnswerEntitlement => Object.freeze({ ...entitlement });

const denialScope = (request: RevealRequest): RevealDenialScope =>
  Object.freeze({
    participantLineageId: request.participantLineageId,
    betaDay: request.betaDay,
    manifestLineageId: request.manifestLineageId,
    manifestVersionId: request.manifestVersionId,
    roundId: request.roundId,
  });

const requestIsBound = (
  request: RevealRequest,
  entitlement: AcceptedAnswerEntitlement,
): boolean =>
  request.participantLineageId === entitlement.participantLineageId &&
  request.betaDay === entitlement.betaDay &&
  request.manifestLineageId === entitlement.manifestLineageId &&
  request.manifestVersionId === entitlement.manifestVersionId &&
  request.sessionId === entitlement.sessionId &&
  request.roundId === entitlement.roundId &&
  request.acceptedAnswerId === entitlement.acceptedAnswerId;

const requestIsBounded = (request: RevealRequest): boolean =>
  nonBlank(request.participantLineageId) &&
  nonBlank(request.betaDay) &&
  nonBlank(request.manifestLineageId) &&
  nonBlank(request.manifestVersionId) &&
  nonBlank(request.sessionId) &&
  nonBlank(request.roundId) &&
  nonBlank(request.acceptedAnswerId) &&
  validInstant(request.requestedAt);

const guardsPass = (guards: RevealGuards): boolean =>
  guards.inputValid === true &&
  guards.authenticated === true &&
  guards.authorized === true &&
  guards.credentialValid === true &&
  guards.antiForgeryValid === true &&
  guards.rateLimitAllowed === true;

export class RevealAuthority {
  readonly #entitlement: AcceptedAnswerEntitlement;
  readonly #provider: RevealPayloadProvider;
  #used: boolean;

  private constructor(
    entitlement: AcceptedAnswerEntitlement,
    provider: RevealPayloadProvider,
    used: boolean,
  ) {
    this.#entitlement = entitlement;
    this.#provider = provider;
    this.#used = used;
    Object.freeze(this);
  }

  public static issue(
    entitlement: AcceptedAnswerEntitlement,
    provider: RevealPayloadProvider,
  ): RevealAuthority {
    for (const field of [
      "participantLineageId",
      "betaDay",
      "manifestLineageId",
      "manifestVersionId",
      "sessionId",
      "roundId",
      "acceptedAnswerId",
    ] as const) {
      requiredText(entitlement[field], `entitlement.${field}`);
    }
    if (!validInstant(entitlement.acceptedAt)) {
      throw new RevealRuleError("entitlement.acceptedAt must be a valid instant");
    }
    if (!validInstant(entitlement.expiresAt)) {
      throw new RevealRuleError("entitlement.expiresAt must be a valid instant");
    }
    if (Date.parse(entitlement.acceptedAt) >= Date.parse(entitlement.expiresAt)) {
      throw new RevealRuleError(
        "entitlement.acceptedAt must precede entitlement.expiresAt",
      );
    }
    if (
      entitlement.correctionStatus !== "ACTIVE" &&
      entitlement.correctionStatus !== "VOID" &&
      entitlement.correctionStatus !== "CONTENT_WITHDRAWN"
    ) {
      throw new RevealRuleError("entitlement.correctionStatus is not supported");
    }
    if (typeof entitlement.revealBlocked !== "boolean") {
      throw new RevealRuleError("entitlement.revealBlocked must be a boolean");
    }
    return new RevealAuthority(freezeEntitlement(entitlement), provider, false);
  }

  public authorize(
    request: RevealRequest,
    guards: RevealGuards,
  ): RevealAuthorizationResult {
    if (this.#used) return this.#deny(request, "REPLAYED");
    if (!requestIsBounded(request) || !guardsPass(guards)) {
      return this.#deny(request, "GUARD_REJECTED");
    }
    if (!requestIsBound(request, this.#entitlement)) {
      return this.#deny(request, "SCOPE_MISMATCH");
    }
    const requestedAt = Date.parse(request.requestedAt);
    if (requestedAt < Date.parse(this.#entitlement.acceptedAt)) {
      return this.#deny(request, "NOT_READY");
    }
    if (requestedAt >= Date.parse(this.#entitlement.expiresAt)) {
      return this.#deny(request, "EXPIRED");
    }
    if (
      this.#entitlement.correctionStatus !== "ACTIVE" ||
      this.#entitlement.revealBlocked
    ) {
      return this.#deny(request, "ROUND_BLOCKED");
    }

    let payload: ProtectedRevealPayload;
    try {
      payload = freezePayload(this.#provider.load(this.#entitlement));
    } catch {
      return this.#deny(request, "PAYLOAD_REJECTED");
    }
    const response = Object.freeze({
      outcome: "AUTHORIZED" as const,
      payload,
    });
    const audit = Object.freeze({
      outcome: "AUTHORIZED" as const,
      acceptedAnswerId: this.#entitlement.acceptedAnswerId,
      revealedAt: request.requestedAt,
      correctness: payload.correctness,
      evidenceVersionId: payload.versions.evidence,
      revealVersionId: payload.versions.reveal,
    });
    this.#used = true;
    return Object.freeze({
      response,
      audit,
      next: this,
    });
  }

  #deny(request: RevealRequest, reason: RevealDenialReason): RevealAuthorizationResult {
    const denied = Object.freeze({
      outcome: "DENIED" as const,
      scope: denialScope(request),
      deniedAt: request.requestedAt,
      reason,
    });
    return Object.freeze({ response: denied, audit: denied, next: this });
  }
}

const inspectProjection = (
  channel: PublicProjectionChannel,
  value: unknown,
): void => {
  if (Array.isArray(value)) {
    for (const entry of value) inspectProjection(channel, entry);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [field, nested] of Object.entries(value)) {
    const normalizedField = field.toLowerCase().replace(/[^a-z0-9]/gu, "");
    if (PROTECTED_PROJECTION_FIELDS.has(normalizedField)) {
      throw new RevealContainmentError(
        `${channel} projection contains protected field ${field}`,
      );
    }
    inspectProjection(channel, nested);
  }
};

export function assertPublicProjectionSafe(
  channel: PublicProjectionChannel,
  projection: unknown,
): void {
  inspectProjection(channel, projection);
}
