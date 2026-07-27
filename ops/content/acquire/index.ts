import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  authorizeOperatorRun,
  authorizePolicy,
  acquireAuthorizedCommitReceipt,
  AcquisitionOrchestrationError,
  AuthorizedSourceError,
  BoundedGitHubTransport,
  GitHubObjectAdapter,
  orchestrateAcquisitionDraft,
  canonicalSha256,
  validateAcquisitionRequest,
  type AcquisitionRequest,
  type AcquisitionOrchestrationInput,
  type AuthorizedOperatorRun,
  type AuthorizedPolicy,
  type OperatorAuthorizationInput,
  type PolicyAuthorizationInput,
} from "@codeguessr/content/operator/acquisition";
import { OperatorStateError, prepareOperatorState } from "./operator-state";

type Json = Record<string, unknown>;
type DescriptorOperatorAuthorization = Omit<
  OperatorAuthorizationInput,
  "commit" | "subtree"
>;
interface ExecutionDescriptor {
  readonly request: unknown;
  readonly repositoryPolicy: PolicyAuthorizationInput;
  readonly attributionPolicy: PolicyAuthorizationInput;
  readonly operatorAuthorization: DescriptorOperatorAuthorization;
}
interface ProjectControls {
  readonly repositoryPolicy: Readonly<Record<string, unknown>>;
  readonly attributionPolicy: Readonly<Record<string, unknown>>;
  readonly approvedPolicyRegister: PolicyAuthorizationInput["register"];
  readonly operatorAuthorizationRegister: OperatorAuthorizationInput["register"];
}
export interface AuthorizedExecution {
  readonly request: AcquisitionRequest;
  readonly repositoryPolicy: AuthorizedPolicy;
  readonly attributionPolicy: AuthorizedPolicy;
  readonly attributionPolicyDocument: Readonly<Record<string, unknown>>;
  readonly operatorRun: AuthorizedOperatorRun;
  readonly operatorAuthorization: OperatorAuthorizationInput;
}
interface Dependencies {
  loadRunDescriptor(reference: string): Promise<unknown>;
  loadProjectControls(): Promise<unknown>;
  fetch(request: Request): Promise<Response>;
  now(): number;
  osIdentity(): string;
  prepareOperatorState?(): Promise<Readonly<{
    open(operatorRun: AuthorizedOperatorRun): Promise<
      Pick<AcquisitionOrchestrationInput, "store" | "audit">
    >;
    dispose(): void;
  }>>;
}
export class OperatorCommandError extends Error {
  public constructor(code: string) { super(code); this.name = "OperatorCommandError"; }
}
const fail = (code: string): never => { throw new OperatorCommandError(code); };
const exact = (value: unknown, keys: readonly string[]): value is Json =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const cloneFreeze = <Value>(value: Value): Value => {
  const clone = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item !== null && typeof item === "object") {
      Object.values(item).forEach(freeze);
      Object.freeze(item);
    }
  };
  freeze(clone);
  return clone;
};
const runReference = (argv: readonly string[]): string => {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  if (args.length !== 2 || args[0] !== "--run") return fail("ARGUMENTS_REJECTED");
  const reference = args[1] ?? fail("ARGUMENTS_REJECTED");
  if (reference.length === 0
    || /^[a-z][a-z0-9+.-]*:\/\//iu.test(reference)
    || /(?:token|credential|secret|authorization|config)/iu.test(reference)) {
    fail("RUN_REFERENCE_REJECTED");
  }
  return reference;
};
const descriptor = (raw: unknown): ExecutionDescriptor => {
  if (!exact(raw, [
    "attributionPolicy", "operatorAuthorization", "repositoryPolicy", "request",
  ])) fail("DESCRIPTOR_REJECTED");
  return raw as unknown as ExecutionDescriptor;
};
const projectControls = (raw: unknown): ProjectControls => {
  if (!exact(raw, [
    "approvedPolicyRegister", "attributionPolicy", "operatorAuthorizationRegister",
    "repositoryPolicy",
  ])) fail("PROJECT_CONTROL_REJECTED");
  return raw as unknown as ProjectControls;
};
const trustedReceiptTime = (now: number): string => {
  if (!Number.isFinite(now) || now < 0) return fail("HOST_CLOCK_REJECTED");
  return new Date(Math.floor(now / 1_000) * 1_000).toISOString().replace(".000Z", "Z");
};
const exactEntry = (value: unknown, keys: readonly string[]): boolean => {
  const entry = value as Json;
  const fields = entry !== null && typeof entry === "object" && "validThrough" in entry
    ? [...keys, "validThrough"] : keys;
  return exact(value, fields)
    && Array.isArray(entry.approvals)
    && entry.approvals.every((approval) =>
      exact(approval, ["approvedAt", "approverId", "role"]));
};
const exactAuthorizationShapes = (input: ExecutionDescriptor): void => {
  for (const authorization of [input.repositoryPolicy, input.attributionPolicy]) {
    if (!exact(authorization, [
      "authoritativeReceiptTime", "binding", "policy", "purpose", "register",
    ]) || !exact(authorization.binding, ["entryId", "registerHash", "registerVersion"])
      || !exact(authorization.register, ["entries", "registerVersion"])
      || !authorization.register.entries.every((entry) => exactEntry(entry, [
        "approvals", "entryId", "permittedPurposes", "policyClass", "policyHash",
        "policyVersion", "validFrom",
      ]))) fail("DESCRIPTOR_REJECTED");
  }
  const operator = input.operatorAuthorization;
  if (!exact(operator, [
    "authoritativeReceiptTime", "binding", "callerObservationTime", "githubDate",
    "operatorName", "osIdentity", "purpose", "register", "repository", "tokenAllowance",
  ]) || !exact(operator.binding, ["entryId", "registerHash", "registerVersion"])
    || !exact(operator.register, ["entries", "registerVersion"])
    || !operator.register.entries.every((entry) => exactEntry(entry, [
      "approvals", "entryId", "operatorName", "osIdentity", "purposes", "repositories",
      "tokenAllowance", "validFrom",
    ]))) fail("DESCRIPTOR_REJECTED");
};
const repositoryScope = (
  input: ExecutionDescriptor,
  controlledPolicy: Readonly<Record<string, unknown>>,
) => {
  const policy = controlledPolicy as Json;
  const request = input.request as Json;
  const repositories = Array.isArray(policy.repositories)
    ? policy.repositories : fail("AUTHORIZATION_BINDING_REJECTED");
  const purposes = Array.isArray(policy.permittedPurposes)
    ? policy.permittedPurposes : fail("AUTHORIZATION_BINDING_REJECTED");
  if (typeof request?.repository !== "string" || typeof request.subtree !== "string"
    || typeof request.purpose !== "string") fail("AUTHORIZATION_BINDING_REJECTED");
  const admission = repositories.find((candidate) =>
    exact(candidate, ["approvedSubtrees", "repository"])
    && candidate.repository === request.repository) as Json | undefined;
  if (admission === undefined || !Array.isArray(admission.approvedSubtrees)
    || !admission.approvedSubtrees.includes(request.subtree)
    || !purposes.includes(request.purpose)) {
    fail("AUTHORIZATION_BINDING_REJECTED");
  }
  return {
    repository: request.repository,
    subtree: request.subtree,
    purpose: request.purpose,
  };
};

const assertTrustedControls = (
  input: ExecutionDescriptor,
  controls: ProjectControls,
): void => {
  const pairs = [
    [input.repositoryPolicy.policy, controls.repositoryPolicy],
    [input.attributionPolicy.policy, controls.attributionPolicy],
    [input.repositoryPolicy.register, controls.approvedPolicyRegister],
    [input.attributionPolicy.register, controls.approvedPolicyRegister],
    [input.operatorAuthorization.register, controls.operatorAuthorizationRegister],
  ] as const;
  if (pairs.some(([untrusted, trusted]) =>
    canonicalSha256(untrusted) !== canonicalSha256(trusted))) {
    fail("PROJECT_CONTROL_MISMATCH");
  }
};

export const authorizeExecutionDescriptor = (
  raw: unknown,
  rawControls: unknown,
  receiptTime: string,
  osIdentity: string,
): AuthorizedExecution => {
  const input = descriptor(raw);
  exactAuthorizationShapes(input);
  const controls = projectControls(rawControls);
  assertTrustedControls(input, controls);
  const repositoryPolicy = authorizePolicy({
    ...input.repositoryPolicy,
    authoritativeReceiptTime: receiptTime,
  });
  const attributionPolicy = authorizePolicy({
    ...input.attributionPolicy,
    authoritativeReceiptTime: receiptTime,
  });
  const request = validateAcquisitionRequest(
    input.request,
    repositoryScope(input, controls.repositoryPolicy) as never,
  );
  const operatorAuthorization = cloneFreeze({
    ...input.operatorAuthorization,
    commit: request.commit,
    subtree: request.subtree,
    osIdentity,
    authoritativeReceiptTime: receiptTime,
    githubDate: new Date(receiptTime).toUTCString(),
  });
  const operatorRun = authorizeOperatorRun(operatorAuthorization);
  if (repositoryPolicy.policyClass !== "REPOSITORY_ADMISSION"
    || attributionPolicy.policyClass !== "ATTRIBUTION_MARKER"
    || repositoryPolicy.purpose !== request.purpose
    || attributionPolicy.purpose !== request.purpose
    || operatorRun.repository !== request.repository
    || operatorRun.purpose !== request.purpose
    || operatorRun.callerObservationTime !== request.observationTime) {
    fail("AUTHORIZATION_BINDING_REJECTED");
  }
  return Object.freeze({
    request, repositoryPolicy, attributionPolicy, operatorRun,
    operatorAuthorization,
    attributionPolicyDocument: controls.attributionPolicy,
  });
};
export const runOperatorCommand = async (
  argv: readonly string[],
  dependencies: Dependencies,
) => {
  const reference = runReference(argv);
  const receiptTime = trustedReceiptTime(dependencies.now());
  const osIdentity = dependencies.osIdentity();
  const raw = await dependencies.loadRunDescriptor(reference)
    .catch(() => fail("RUN_DESCRIPTOR_REJECTED"));
  const controls = await dependencies.loadProjectControls()
    .catch(() => fail("PROJECT_CONTROL_REJECTED"));
  let execution: AuthorizedExecution;
  try { execution = authorizeExecutionDescriptor(raw, controls, receiptTime, osIdentity); }
  catch { return fail("AUTHORIZATION_REJECTED"); }
  const preparedState = dependencies.prepareOperatorState === undefined
    ? undefined
    : await dependencies.prepareOperatorState()
      .catch(() => fail("OPERATOR_STATE_REJECTED"));
  try {
    const transport = new BoundedGitHubTransport({ fetch: dependencies.fetch });
    const source = await acquireAuthorizedCommitReceipt({
      request: execution.request,
      repositoryPolicy: execution.repositoryPolicy,
      attributionPolicy: execution.attributionPolicy,
      preflightOperatorRun: execution.operatorRun,
      operatorAuthorization: execution.operatorAuthorization,
      transport,
    });
    if (preparedState === undefined) return source.receipt;
    const state = await preparedState.open(source.operatorRun)
      .catch(() => fail("OPERATOR_STATE_REJECTED"));
    const objects = new GitHubObjectAdapter({ request: execution.request, transport });
    return await orchestrateAcquisitionDraft({
      receipt: source.receipt,
      repositoryPolicy: execution.repositoryPolicy,
      attributionPolicy: execution.attributionPolicy,
      attributionPolicyDocument: execution.attributionPolicyDocument as never,
      operatorRun: source.operatorRun,
      loadTree: (sha) => objects.loadTree(sha),
      loadBlob: (sha) => objects.loadBlob(sha),
      store: state.store,
      audit: state.audit,
    });
  } catch (error) {
    if (
      error instanceof OperatorCommandError
      || error instanceof AuthorizedSourceError
      || error instanceof AcquisitionOrchestrationError
      || error instanceof OperatorStateError
    ) return fail(error.message);
    return fail("ACQUISITION_REJECTED");
  } finally {
    preparedState?.dispose();
  }
};

const policies = resolve(fileURLToPath(new URL("../policies", import.meta.url)));
const loadJson = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(resolve(policies, name), "utf8")) as unknown;
const realDependencies: Dependencies = {
  loadRunDescriptor: async (reference) =>
    JSON.parse(await readFile(resolve(reference), "utf8")) as unknown,
  loadProjectControls: async () => ({
    repositoryPolicy: await loadJson("repository-admission.v1.json"),
    attributionPolicy: await loadJson("attribution-markers.v1.json"),
    approvedPolicyRegister: await loadJson("approved-policy-register.v1.json"),
    operatorAuthorizationRegister: await loadJson("operator-authorization.v1.json"),
  }),
  fetch: (request) => globalThis.fetch(request),
  now: Date.now,
  osIdentity: () => process.getuid === undefined
    ? fail("HOST_IDENTITY_REJECTED") : `uid:${process.getuid()}`,
  prepareOperatorState: () => prepareOperatorState({
    CODEGUESSR_ACQUISITION_ROOT: process.env.CODEGUESSR_ACQUISITION_ROOT,
    CODEGUESSR_ACQUISITION_KEY_BASE64: process.env.CODEGUESSR_ACQUISITION_KEY_BASE64,
    CODEGUESSR_ACQUISITION_VOLUME_ATTESTATION:
      process.env.CODEGUESSR_ACQUISITION_VOLUME_ATTESTATION,
    CODEGUESSR_ACQUISITION_OWNERSHIP_ATTESTATION:
      process.env.CODEGUESSR_ACQUISITION_OWNERSHIP_ATTESTATION,
  }),
};
const main = async (): Promise<void> => {
  try {
    const progress = await runOperatorCommand(process.argv.slice(2), realDependencies);
    process.stdout.write(`${JSON.stringify(progress)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof OperatorCommandError ? error.message : "COMMAND_REJECTED"}\n`);
    process.exitCode = 1;
  }
};
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) void main();
