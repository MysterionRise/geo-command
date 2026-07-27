export type CredentialProjectionChannel =
  | "QUERY_STRING"
  | "ANALYTICS"
  | "APPLICATION_LOG"
  | "REFERRER"
  | "SHARE_OUTPUT";

export interface TokenGenerator {
  generate(): string;
}

export interface TokenDigester {
  digest(rawToken: string): string;
}

export interface LineageIdGenerator {
  generate(): string;
}

export interface EnrollmentCredentialDelivery {
  readonly credentialId: string;
  readonly participantLineageId: string;
  readonly expiresAt: string;
  takeRawToken(): string;
}

export interface CascadeRevocationPlan {
  readonly invitationId: string;
  readonly participantLineageId: string;
  readonly enrollmentCredentialIds: readonly string[];
  readonly dailySessionCredentialIds: readonly string[];
  readonly revealCredentialIds: readonly string[];
  readonly revokedAt: string;
}

export interface CascadeRevocationPort {
  execute(plan: CascadeRevocationPlan): void;
}

export interface RecruiterVerificationRequest {
  readonly invitationId: string;
  readonly participantLineageId: string;
  readonly recruiterId: string;
  readonly verificationRecordId: string;
  readonly verifiedAt: string;
}

export interface RecruiterVerificationPort {
  isRecordedVerification(request: RecruiterVerificationRequest): boolean;
}

export interface SignedCohortRule {
  readonly versionId: string;
  readonly signedBy: string;
  readonly signatureId: string;
  readonly signedAt: string;
}

export interface SignedAdultEligibilityPolicy {
  readonly versionId: string;
  readonly adultOnly: true;
  readonly approvedBy: string;
  readonly signatureId: string;
  readonly signedAt: string;
}

export type ReissueVerification =
  | {
      readonly kind: "ORIGINAL_CHANNEL_CONTROL";
      readonly channelControlRef: string;
    }
  | {
      readonly kind: "RECRUITER_VERIFICATION";
      readonly recruiterId: string;
      readonly verificationRecordId: string;
      readonly verifiedAt: string;
    };

interface ParticipantLineageRecord {
  readonly recordType: "PARTICIPANT_LINEAGE";
  readonly participantLineageId: string;
}

interface InvitationRecord {
  readonly recordType: "INVITATION";
  readonly invitationId: string;
  readonly participantLineageId: string;
  readonly recruitmentChannelRef: string;
  readonly issuedAt: string;
  readonly cohortRuleVersionId: string;
  readonly eligibilityPolicyVersionId: string;
  status: "ISSUED" | "ENROLLED" | "REVOKED";
}

interface CredentialRecord {
  readonly recordType: "ENROLLMENT_CREDENTIAL";
  readonly credentialId: string;
  readonly invitationId: string;
  readonly participantLineageId: string;
  readonly tokenDigest: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  status: "ACTIVE" | "USED" | "REVOKED";
}

interface EnrollmentRecord {
  readonly recordType: "ENROLLMENT";
  readonly enrollmentId: string;
  readonly invitationId: string;
  readonly participantLineageId: string;
  readonly credentialId: string;
  readonly enrolledAt: string;
}

interface EnrollmentAudit {
  readonly auditId: string;
  readonly event:
    | "COHORT_RULE_RECORDED"
    | "ADULT_POLICY_RECORDED"
    | "INVITATION_ISSUED"
    | "ENROLLED"
    | "CREDENTIAL_REISSUED"
    | "INVITATION_REVOKED";
  readonly invitationId?: string;
  readonly participantLineageId?: string;
  readonly occurredAt: string;
}

export class EnrollmentRuleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EnrollmentRuleError";
  }
}

const HOUR_MS = 3_600_000;

const requireText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) throw new EnrollmentRuleError(`${label} is required`);
  return normalized;
};

const timestamp = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new EnrollmentRuleError(`${value} is not a valid instant`);
  return parsed;
};

const freezeCredential = (credential: CredentialRecord): CredentialRecord =>
  Object.freeze({ ...credential });

export class EnrollmentRegistry {
  readonly #tokenGenerator: TokenGenerator;
  readonly #tokenDigester: TokenDigester;
  readonly #lineageIdGenerator: LineageIdGenerator;
  readonly #recruiterVerification: RecruiterVerificationPort;
  readonly #cascadeRevocation: CascadeRevocationPort;
  #cohortRule: SignedCohortRule | undefined;
  #adultPolicy: SignedAdultEligibilityPolicy | undefined;
  readonly #lineages = new Map<string, ParticipantLineageRecord>();
  readonly #invitations = new Map<string, InvitationRecord>();
  readonly #credentials = new Map<string, CredentialRecord>();
  readonly #enrollments = new Map<string, EnrollmentRecord>();
  readonly #audits: EnrollmentAudit[] = [];

  public constructor(ports: {
    readonly tokenGenerator: TokenGenerator;
    readonly tokenDigester: TokenDigester;
    readonly lineageIdGenerator: LineageIdGenerator;
    readonly recruiterVerification: RecruiterVerificationPort;
    readonly cascadeRevocation: CascadeRevocationPort;
  }) {
    this.#tokenGenerator = ports.tokenGenerator;
    this.#tokenDigester = ports.tokenDigester;
    this.#lineageIdGenerator = ports.lineageIdGenerator;
    this.#recruiterVerification = ports.recruiterVerification;
    this.#cascadeRevocation = ports.cascadeRevocation;
  }

  public recordCohortRule(rule: SignedCohortRule): void {
    this.#validateSignature(rule.versionId, rule.signedBy, rule.signatureId, rule.signedAt);
    if (rule.signedBy.trim() !== "Don") {
      throw new EnrollmentRuleError("Cohort rule requires Don signature");
    }
    this.#cohortRule = Object.freeze({ ...rule });
    this.#audit("COHORT_RULE_RECORDED", rule.signedAt);
  }

  public recordAdultEligibilityPolicy(policy: SignedAdultEligibilityPolicy): void {
    this.#validateSignature(
      policy.versionId,
      policy.approvedBy,
      policy.signatureId,
      policy.signedAt,
    );
    if (policy.adultOnly !== true) {
      throw new EnrollmentRuleError("Eligibility and consent policy must be adult-only");
    }
    if (policy.approvedBy.trim() !== "Don") {
      throw new EnrollmentRuleError("Adult eligibility policy requires Don approval");
    }
    this.#adultPolicy = Object.freeze({ ...policy });
    this.#audit("ADULT_POLICY_RECORDED", policy.signedAt);
  }

  public issueInvitation(input: {
    readonly invitationId: string;
    readonly recruitmentChannelRef: string;
    readonly issuedAt: string;
  }): EnrollmentCredentialDelivery {
    if (this.#cohortRule === undefined) {
      throw new EnrollmentRuleError("Recruitment requires a signed fixed-cohort rule");
    }
    if (this.#adultPolicy === undefined) {
      throw new EnrollmentRuleError(
        "Recruitment requires a signed adult-only eligibility and consent policy",
      );
    }
    requireText(input.invitationId, "Invitation ID");
    requireText(input.recruitmentChannelRef, "Recruitment channel reference");
    timestamp(input.issuedAt);
    const participantLineageId = requireText(
      this.#lineageIdGenerator.generate(),
      "Generated participant lineage ID",
    );
    if (this.#invitations.has(input.invitationId)) {
      throw new EnrollmentRuleError(`Invitation ${input.invitationId} already exists`);
    }
    if (this.#lineages.has(participantLineageId)) {
      throw new EnrollmentRuleError(`Participant lineage ${participantLineageId} exists`);
    }

    const lineage = Object.freeze({
      recordType: "PARTICIPANT_LINEAGE" as const,
      participantLineageId,
    });
    const invitation: InvitationRecord = {
      recordType: "INVITATION",
      invitationId: input.invitationId,
      participantLineageId,
      recruitmentChannelRef: input.recruitmentChannelRef,
      issuedAt: input.issuedAt,
      cohortRuleVersionId: this.#cohortRule.versionId,
      eligibilityPolicyVersionId: this.#adultPolicy.versionId,
      status: "ISSUED",
    };
    this.#lineages.set(lineage.participantLineageId, lineage);
    this.#invitations.set(invitation.invitationId, invitation);
    const result = this.#newCredential(invitation, input.issuedAt);
    this.#audit(
      "INVITATION_ISSUED",
      input.issuedAt,
      invitation.invitationId,
      invitation.participantLineageId,
    );
    return result;
  }

  public enroll(input: {
    readonly rawToken: string;
    readonly enrolledAt: string;
  }): EnrollmentRecord {
    const digest = this.#tokenDigester.digest(input.rawToken);
    const credential = [...this.#credentials.values()].find(
      (candidate) => candidate.tokenDigest === digest,
    );
    if (credential === undefined) throw new EnrollmentRuleError("Enrollment credential is invalid");
    if (credential.status === "USED") {
      throw new EnrollmentRuleError("Enrollment credential is already used");
    }
    if (credential.status === "REVOKED") {
      throw new EnrollmentRuleError("Enrollment credential is revoked");
    }
    if (timestamp(input.enrolledAt) >= timestamp(credential.expiresAt)) {
      throw new EnrollmentRuleError("Enrollment credential is expired");
    }
    const invitation = this.#invitation(credential.invitationId);
    if (invitation.status === "REVOKED") {
      throw new EnrollmentRuleError("Invitation is revoked");
    }
    credential.status = "USED";
    invitation.status = "ENROLLED";
    const enrollment = Object.freeze({
      recordType: "ENROLLMENT" as const,
      enrollmentId: `${invitation.invitationId}:enrollment`,
      invitationId: invitation.invitationId,
      participantLineageId: invitation.participantLineageId,
      credentialId: credential.credentialId,
      enrolledAt: input.enrolledAt,
    });
    this.#enrollments.set(invitation.invitationId, enrollment);
    this.#audit(
      "ENROLLED",
      input.enrolledAt,
      invitation.invitationId,
      invitation.participantLineageId,
    );
    return enrollment;
  }

  public reissue(input: {
    readonly invitationId: string;
    readonly reissuedAt: string;
    readonly verification: ReissueVerification;
  }): EnrollmentCredentialDelivery {
    const invitation = this.#invitation(input.invitationId);
    if (invitation.status === "REVOKED") throw new EnrollmentRuleError("Invitation is revoked");
    if (!this.#validReissueVerification(invitation, input.verification)) {
      throw new EnrollmentRuleError(
        "Reissue requires original-channel control or recorded recruiter verification",
      );
    }
    for (const credential of this.#credentialsFor(invitation.invitationId)) {
      if (credential.status === "ACTIVE") credential.status = "REVOKED";
    }
    const result = this.#newCredential(invitation, input.reissuedAt);
    this.#audit(
      "CREDENTIAL_REISSUED",
      input.reissuedAt,
      invitation.invitationId,
      invitation.participantLineageId,
    );
    return result;
  }

  public revokeInvitation(input: {
    readonly invitationId: string;
    readonly revokedAt: string;
    readonly descendants: {
      readonly dailySessionCredentialIds: readonly string[];
      readonly revealCredentialIds: readonly string[];
    };
  }): void {
    timestamp(input.revokedAt);
    const invitation = this.#invitation(input.invitationId);
    invitation.status = "REVOKED";
    const credentials = this.#credentialsFor(input.invitationId);
    for (const credential of credentials) credential.status = "REVOKED";
    const plan: CascadeRevocationPlan = Object.freeze({
      invitationId: invitation.invitationId,
      participantLineageId: invitation.participantLineageId,
      enrollmentCredentialIds: Object.freeze(credentials.map(({ credentialId }) => credentialId)),
      dailySessionCredentialIds: Object.freeze([
        ...input.descendants.dailySessionCredentialIds,
      ]),
      revealCredentialIds: Object.freeze([...input.descendants.revealCredentialIds]),
      revokedAt: input.revokedAt,
    });
    this.#cascadeRevocation.execute(plan);
    this.#audit(
      "INVITATION_REVOKED",
      input.revokedAt,
      invitation.invitationId,
      invitation.participantLineageId,
    );
  }

  public stateForInvitation(invitationId: string): {
    readonly invitation: Readonly<InvitationRecord>;
    readonly lineage: ParticipantLineageRecord;
    readonly credential: Readonly<CredentialRecord>;
    readonly credentials: readonly Readonly<CredentialRecord>[];
    readonly enrollment?: EnrollmentRecord;
  } {
    const invitation = this.#invitation(invitationId);
    const credentials = this.#credentialsFor(invitationId).map(freezeCredential);
    const credential = credentials.at(-1);
    if (credential === undefined) throw new EnrollmentRuleError("Invitation has no credential");
    const enrollment = this.#enrollments.get(invitationId);
    return Object.freeze({
      invitation: Object.freeze({ ...invitation }),
      lineage: this.#lineages.get(invitation.participantLineageId)!,
      credential,
      credentials: Object.freeze(credentials),
      ...(enrollment === undefined ? {} : { enrollment }),
    });
  }

  public projectCredential(
    invitationId: string,
    channel: CredentialProjectionChannel,
  ): {
    readonly channel: CredentialProjectionChannel;
    readonly credentialId: string;
    readonly status: CredentialRecord["status"];
  } {
    const credential = this.stateForInvitation(invitationId).credential;
    return Object.freeze({ channel, credentialId: credential.credentialId, status: credential.status });
  }

  public gameplayLineageFor(invitationId: string): {
    readonly participantLineageId: string;
  } {
    const invitation = this.#invitation(invitationId);
    if (!this.#enrollments.has(invitationId)) throw new EnrollmentRuleError("Enrollment not found");
    return Object.freeze({ participantLineageId: invitation.participantLineageId });
  }

  public auditTrail(): readonly EnrollmentAudit[] {
    return Object.freeze(this.#audits.map((entry) => Object.freeze({ ...entry })));
  }

  #newCredential(
    invitation: InvitationRecord,
    issuedAt: string,
  ): EnrollmentCredentialDelivery {
    const issuedTimestamp = timestamp(issuedAt);
    const rawToken = requireText(this.#tokenGenerator.generate(), "Generated token");
    const tokenDigest = requireText(this.#tokenDigester.digest(rawToken), "Token digest");
    if ([...this.#credentials.values()].some((value) => value.tokenDigest === tokenDigest)) {
      throw new EnrollmentRuleError("Generated credential digest is not unique");
    }
    const credentialNumber = this.#credentialsFor(invitation.invitationId).length + 1;
    const credentialId = `${invitation.invitationId}:credential:${String(credentialNumber)}`;
    const expiresAt = new Date(issuedTimestamp + 72 * HOUR_MS).toISOString();
    this.#credentials.set(credentialId, {
      recordType: "ENROLLMENT_CREDENTIAL",
      credentialId,
      invitationId: invitation.invitationId,
      participantLineageId: invitation.participantLineageId,
      tokenDigest,
      issuedAt,
      expiresAt,
      status: "ACTIVE",
    });
    let deliverableToken: string | undefined = rawToken;
    return Object.freeze({
      credentialId,
      participantLineageId: invitation.participantLineageId,
      expiresAt,
      takeRawToken(): string {
        if (deliverableToken === undefined) {
          throw new EnrollmentRuleError(
            "Raw enrollment credential has already been delivered",
          );
        }
        const delivered = deliverableToken;
        deliverableToken = undefined;
        return delivered;
      },
    });
  }

  #validReissueVerification(
    invitation: InvitationRecord,
    verification: ReissueVerification | undefined,
  ): boolean {
    if (verification?.kind === "ORIGINAL_CHANNEL_CONTROL") {
      return verification.channelControlRef === invitation.recruitmentChannelRef;
    }
    if (verification?.kind === "RECRUITER_VERIFICATION") {
      timestamp(verification.verifiedAt);
      if (
        verification.recruiterId.trim().length === 0 ||
        verification.verificationRecordId.trim().length === 0
      ) {
        return false;
      }
      return this.#recruiterVerification.isRecordedVerification(
        Object.freeze({
          invitationId: invitation.invitationId,
          participantLineageId: invitation.participantLineageId,
          recruiterId: verification.recruiterId,
          verificationRecordId: verification.verificationRecordId,
          verifiedAt: verification.verifiedAt,
        }),
      );
    }
    return false;
  }

  #credentialsFor(invitationId: string): CredentialRecord[] {
    return [...this.#credentials.values()].filter(
      (credential) => credential.invitationId === invitationId,
    );
  }

  #invitation(invitationId: string): InvitationRecord {
    const invitation = this.#invitations.get(invitationId);
    if (invitation === undefined) throw new EnrollmentRuleError(`Invitation ${invitationId} not found`);
    return invitation;
  }

  #validateSignature(
    versionId: string,
    signer: string,
    signatureId: string,
    signedAt: string,
  ): void {
    requireText(versionId, "Version ID");
    requireText(signer, "Don approval");
    requireText(signatureId, "Signature ID");
    timestamp(signedAt);
  }

  #audit(
    event: EnrollmentAudit["event"],
    occurredAt: string,
    invitationId?: string,
    participantLineageId?: string,
  ): void {
    const scope = {
      ...(invitationId === undefined ? {} : { invitationId }),
      ...(participantLineageId === undefined ? {} : { participantLineageId }),
    };
    this.#audits.push(
      Object.freeze({
        auditId: `audit-${String(this.#audits.length + 1)}`,
        event,
        ...scope,
        occurredAt,
      }),
    );
  }
}
