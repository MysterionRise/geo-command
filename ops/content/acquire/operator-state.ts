import { lstat, mkdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  openAuditSink,
  openEncryptedStore,
  type AcquisitionOrchestrationInput,
  type AuthorizedOperatorRun,
} from "@codeguessr/content/operator/acquisition";

type OperatorState = Pick<AcquisitionOrchestrationInput, "store" | "audit">;
interface Environment {
  readonly CODEGUESSR_ACQUISITION_ROOT?: string | undefined;
  readonly CODEGUESSR_ACQUISITION_KEY_BASE64?: string | undefined;
  readonly CODEGUESSR_ACQUISITION_VOLUME_ATTESTATION?: string | undefined;
  readonly CODEGUESSR_ACQUISITION_OWNERSHIP_ATTESTATION?: string | undefined;
}
export class OperatorStateError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "OperatorStateError";
  }
}
const fail = (code: string): never => {
  throw new OperatorStateError(code);
};
const BASE64_KEY = /^[A-Za-z0-9+/]{43}=$/u;

const validateRoot = async (raw: string | undefined): Promise<string> => {
  if (raw === undefined || !isAbsolute(raw)) fail("OPERATOR_STATE_REJECTED");
  const root = resolve(raw as string);
  const workspace = resolve(process.cwd());
  const child = relative(workspace, root);
  if (root === workspace || (child !== ".." && !child.startsWith(`..${sep}`))) {
    fail("OPERATOR_STATE_REJECTED");
  }
  const entry = await lstat(root).catch(() => fail("OPERATOR_STATE_REJECTED"));
  if (
    entry.isSymbolicLink()
    || !entry.isDirectory()
    || (entry.mode & 0o777) !== 0o700
    || (process.getuid !== undefined && entry.uid !== process.getuid())
    || await realpath(root) !== root
  ) fail("OPERATOR_STATE_REJECTED");
  return root;
};
const decodeKey = (raw: string | undefined): Uint8Array => {
  if (raw === undefined || !BASE64_KEY.test(raw)) fail("OPERATOR_STATE_REJECTED");
  const accepted = raw as string;
  const key = Buffer.from(accepted, "base64");
  if (key.byteLength !== 32 || key.toString("base64") !== accepted) {
    fail("OPERATOR_STATE_REJECTED");
  }
  return new Uint8Array(key);
};
const childDirectory = async (root: string, name: string): Promise<string> => {
  const path = join(root, name);
  await mkdir(path, { mode: 0o700 }).catch((error: unknown) => {
    if ((error as { code?: string }).code !== "EEXIST") fail("OPERATOR_STATE_REJECTED");
  });
  const entry = await lstat(path).catch(() => fail("OPERATOR_STATE_REJECTED"));
  if (
    entry.isSymbolicLink()
    || !entry.isDirectory()
    || (entry.mode & 0o777) !== 0o700
    || (process.getuid !== undefined && entry.uid !== process.getuid())
  ) fail("OPERATOR_STATE_REJECTED");
  return path;
};

export const prepareOperatorState = async (
  environment: Environment,
): Promise<Readonly<{
  open(operatorRun: AuthorizedOperatorRun): Promise<OperatorState>;
  dispose(): void;
}>> => {
  if (
    environment.CODEGUESSR_ACQUISITION_VOLUME_ATTESTATION
      !== "APPROVED_ENCRYPTED_VOLUME"
    || environment.CODEGUESSR_ACQUISITION_OWNERSHIP_ATTESTATION
      !== "ACQUISITION_OWNED"
  ) fail("OPERATOR_STATE_REJECTED");
  const root = await validateRoot(environment.CODEGUESSR_ACQUISITION_ROOT);
  const key = decodeKey(environment.CODEGUESSR_ACQUISITION_KEY_BASE64);
  let snapshots: string;
  let auditRoot: string;
  try {
    snapshots = await childDirectory(root, "snapshots");
    auditRoot = await childDirectory(root, "audit");
  } catch (error) {
    key.fill(0);
    throw error;
  }
  let opened = false;
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    key.fill(0);
    disposed = true;
  };
  return Object.freeze({
    open: async (operatorRun) => {
      if (opened || disposed) fail("OPERATOR_STATE_REJECTED");
      opened = true;
      try {
        if (await validateRoot(root) !== root) fail("OPERATOR_STATE_REJECTED");
        if (
          await childDirectory(root, "snapshots") !== snapshots
          || await childDirectory(root, "audit") !== auditRoot
        ) fail("OPERATOR_STATE_REJECTED");
        const store = await openEncryptedStore({
          root: snapshots,
          key,
          volumeAttestation: "APPROVED_ENCRYPTED_VOLUME",
          ownershipAttestation: "ACQUISITION_OWNED",
        });
        const audit = await openAuditSink({
          root: auditRoot,
          ownershipAttestation: "ACQUISITION_OWNED",
          authorizedRun: operatorRun,
          projectOperatorRegisterHash: operatorRun.registerHash,
        });
        return Object.freeze({ store, audit });
      } catch {
        return fail("OPERATOR_STATE_REJECTED");
      } finally {
        dispose();
      }
    },
    dispose,
  });
};
