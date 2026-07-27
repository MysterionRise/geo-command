import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod, lstat, mkdir, open, realpath, rename, unlink,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const H64 = /^[0-9a-f]{64}$/u;
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class StorageError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "StorageError";
  }
}
const fail = (code: string): never => { throw new StorageError(code); };

export interface SnapshotIdentity {
  readonly objectId: string;
  readonly plaintextSha256: string;
  readonly byteLength: number;
}
interface StoreConfig {
  readonly root: string;
  readonly key: Uint8Array;
  readonly volumeAttestation: "APPROVED_ENCRYPTED_VOLUME";
  readonly ownershipAttestation: "ACQUISITION_OWNED";
}
interface PutInput {
  readonly identity: SnapshotIdentity;
  readonly plaintext: Uint8Array;
}
interface Envelope {
  readonly version: 1;
  readonly identity: SnapshotIdentity;
  readonly iv: string;
  readonly ciphertext: string;
  readonly tag: string;
}
interface DirectoryIdentity {
  readonly device: number;
  readonly inode: number;
}

const identityBytes = (identity: SnapshotIdentity): Buffer =>
  Buffer.from(JSON.stringify({
    objectId: identity.objectId,
    plaintextSha256: identity.plaintextSha256,
    byteLength: identity.byteLength,
  }), "utf8");
const digest = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
const contained = (root: string, path: string): boolean => {
  const child = relative(root, path);
  return child !== "" && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
};
const validateIdentity = (identity: SnapshotIdentity, plaintext?: Uint8Array): void => {
  if (
    !H64.test(identity.objectId) || !H64.test(identity.plaintextSha256)
    || identity.objectId !== identity.plaintextSha256
    || !Number.isSafeInteger(identity.byteLength) || identity.byteLength < 0
    || (plaintext !== undefined
      && (identity.byteLength !== plaintext.byteLength
        || identity.plaintextSha256 !== digest(plaintext)))
  ) fail("IDENTITY_REJECTED");
};
const assertOrdinary = async (path: string, directory: boolean): Promise<void> => {
  const entry = await lstat(path).catch(() => fail("PATH_REJECTED"));
  if (entry.isSymbolicLink()) fail("SYMLINK_REJECTED");
  if (directory ? !entry.isDirectory() : !entry.isFile()) fail("PATH_REJECTED");
  const expectedMode = directory ? DIRECTORY_MODE : FILE_MODE;
  if ((entry.mode & 0o777) !== expectedMode) fail("PERMISSION_REJECTED");
  if (process.getuid !== undefined && entry.uid !== process.getuid()) fail("OWNERSHIP_REJECTED");
};
const assertNoSymlinkComponents = async (path: string): Promise<void> => {
  let cursor = resolve(path);
  const parts: string[] = [];
  while (cursor !== dirname(cursor)) {
    parts.push(cursor);
    cursor = dirname(cursor);
  }
  for (const part of parts.reverse()) {
    const entry = await lstat(part).catch(() => undefined);
    if (entry?.isSymbolicLink()) fail("SYMLINK_REJECTED");
  }
};
const initializeChild = async (path: string): Promise<void> => {
  const existing = await lstat(path).catch(() => undefined);
  if (existing === undefined) await mkdir(path, { mode: DIRECTORY_MODE });
  await assertOrdinary(path, true);
};
const encrypt = (identity: SnapshotIdentity, plaintext: Uint8Array, key: Uint8Array): Envelope => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(identityBytes(identity));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    version: 1, identity, iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"), tag: cipher.getAuthTag().toString("base64"),
  };
};
const decrypt = (raw: Uint8Array, identity: SnapshotIdentity, key: Uint8Array): Uint8Array => {
  try {
    const envelope = JSON.parse(Buffer.from(raw).toString("utf8")) as Envelope;
    if (envelope.version !== 1
      || !identityBytes(envelope.identity).equals(identityBytes(identity))) {
      return fail("IDENTITY_CONFLICT");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm", key, Buffer.from(envelope.iv, "base64"), { authTagLength: TAG_BYTES },
    );
    decipher.setAAD(identityBytes(identity));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final(),
    ]);
    validateIdentity(identity, plaintext);
    return new Uint8Array(plaintext);
  } catch (error) {
    if (error instanceof StorageError && error.message === "IDENTITY_CONFLICT") throw error;
    return fail("AUTHENTICATION_REJECTED");
  }
};

const initializeRoot = async (config: StoreConfig) => {
  if (
    !isAbsolute(config.root)
    || config.volumeAttestation !== "APPROVED_ENCRYPTED_VOLUME"
    || config.ownershipAttestation !== "ACQUISITION_OWNED"
    || !(config.key instanceof Uint8Array) || config.key.byteLength !== 32
  ) fail("ROOT_REJECTED");
  const root = resolve(config.root);
  const workspace = resolve(process.cwd());
  if (root === workspace || contained(workspace, root)) fail("ROOT_REJECTED");
  await assertNoSymlinkComponents(root);
  await assertOrdinary(root, true);
  if (await realpath(root) !== root) fail("SYMLINK_REJECTED");
  await chmod(root, DIRECTORY_MODE);
  const objects = join(root, "objects");
  const staging = join(root, "staging");
  await initializeChild(objects);
  await initializeChild(staging);
  return {
    root, objects, staging,
    rootIdentity: await directoryIdentity(root),
    objectsIdentity: await directoryIdentity(objects),
    stagingIdentity: await directoryIdentity(staging),
  };
};

const categorical = async <Value>(
  operation: () => Promise<Value>,
  code: string,
): Promise<Value> => {
  try { return await operation(); } catch (error) {
    if (error instanceof StorageError) throw error;
    return fail(code);
  }
};

interface StoreContext {
  root: string;
  objects: string;
  staging: string;
  rootIdentity: DirectoryIdentity;
  objectsIdentity: DirectoryIdentity;
  stagingIdentity: DirectoryIdentity;
  key: Uint8Array;
}
const directoryIdentity = async (path: string): Promise<DirectoryIdentity> => {
  await assertOrdinary(path, true);
  const entry = await lstat(path);
  if (await realpath(path) !== path) fail("SYMLINK_REJECTED");
  return { device: entry.dev, inode: entry.ino };
};
const sameIdentity = (left: DirectoryIdentity, right: DirectoryIdentity): boolean =>
  left.device === right.device && left.inode === right.inode;
const verifyRoots = async (context: StoreContext): Promise<void> => {
  const { root, objects, staging } = context;
  const current = await Promise.all([
    directoryIdentity(root), directoryIdentity(objects), directoryIdentity(staging),
  ]);
  if (!sameIdentity(current[0], context.rootIdentity)
    || !sameIdentity(current[1], context.objectsIdentity)
    || !sameIdentity(current[2], context.stagingIdentity)) {
    fail("ROOT_IDENTITY_REJECTED");
  }
  if (!contained(root, objects) || !contained(root, staging)) fail("ROOT_REJECTED");
};
const readObject = async (
  context: StoreContext,
  identity: SnapshotIdentity,
): Promise<Uint8Array> => {
    validateIdentity(identity);
    await verifyRoots(context);
    const path = join(context.objects, `${identity.objectId}.enc`);
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
      .catch((error: unknown) =>
        (error as { code?: string }).code === "ELOOP"
          ? fail("SYMLINK_REJECTED") : fail("OBJECT_NOT_FOUND"));
    try {
      await verifyRoots(context);
      const entry = await handle.stat();
      if (!entry.isFile() || (entry.mode & 0o777) !== FILE_MODE
        || (process.getuid !== undefined && entry.uid !== process.getuid())) {
        fail("PERMISSION_REJECTED");
      }
      return decrypt(await handle.readFile(), identity, context.key);
    } finally { await handle.close(); }
};
const putObject = async (context: StoreContext, { identity, plaintext }: PutInput) => {
    validateIdentity(identity, plaintext);
    await verifyRoots(context);
    const destination = join(context.objects, `${identity.objectId}.enc`);
    const existing = await lstat(destination).catch(() => undefined);
    if (existing !== undefined) {
      if (existing.isSymbolicLink()) fail("SYMLINK_REJECTED");
      await readObject(context, identity);
      return Object.freeze({
        identity: Object.freeze({ ...identity }),
        created: false as const,
      });
    }
    const temporary = join(context.staging, `${identity.objectId}.${randomBytes(12).toString("hex")}.tmp`);
    const reservation = `${destination}.lock`;
    const handle = await open(
      temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      FILE_MODE,
    ).catch(() => fail("WRITE_REJECTED"));
    let published = false;
    try {
      await verifyRoots(context);
      try {
        await handle.writeFile(JSON.stringify(encrypt(identity, plaintext, context.key)));
        await handle.sync();
      } finally { await handle.close(); }
      const lock = await open(
        reservation, constants.O_CREAT | constants.O_EXCL
          | constants.O_WRONLY | constants.O_NOFOLLOW, FILE_MODE,
      ).catch(() => fail("WRITE_CONFLICT"));
      try {
        await verifyRoots(context);
        if (await lstat(destination).catch(() => undefined)) fail("WRITE_CONFLICT");
        await rename(temporary, destination);
        published = true;
        await verifyRoots(context);
        const directory = await open(context.objects, constants.O_RDONLY);
        try { await directory.sync(); } finally { await directory.close(); }
      } finally {
        await lock.close();
        await unlink(reservation).catch(() => undefined);
      }
    } finally {
      if (!published) await unlink(temporary).catch(() => undefined);
    }
    await readObject(context, identity);
    return Object.freeze({
      identity: Object.freeze({ ...identity }),
      created: true as const,
    });
};
const removeObject = async (
  context: StoreContext,
  identity: SnapshotIdentity,
): Promise<boolean> => {
  validateIdentity(identity);
  await verifyRoots(context);
  const path = join(context.objects, `${identity.objectId}.enc`);
  const existing = await lstat(path).catch(() => undefined);
  if (existing === undefined) return false;
  if (existing.isSymbolicLink()) fail("SYMLINK_REJECTED");
  await readObject(context, identity);
  await verifyRoots(context);
  await unlink(path);
  await verifyRoots(context);
  if (await lstat(path).catch(() => undefined) !== undefined) fail("DELETE_UNVERIFIED");
  const directory = await open(context.objects, constants.O_RDONLY);
  try { await directory.sync(); } finally { await directory.close(); }
  return true;
};
const buildEncryptedStore = async (config: StoreConfig) => {
  const paths = await initializeRoot(config);
  const context = { ...paths, key: Buffer.from(config.key) };
  const read = (identity: SnapshotIdentity) =>
    categorical(() => readObject(context, identity), "READ_REJECTED");
  const put = (input: PutInput) =>
    categorical(() => putObject(context, input), "WRITE_REJECTED");
  const remove = (identity: SnapshotIdentity) =>
    categorical(() => removeObject(context, identity), "DELETE_REJECTED");
  return Object.freeze({ put, read, remove });
};

export const openEncryptedStore = (config: StoreConfig) =>
  categorical(() => buildEncryptedStore(config), "STORE_OPEN_REJECTED");
