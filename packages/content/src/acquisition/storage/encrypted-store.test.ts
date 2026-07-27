import { createHash, randomBytes } from "node:crypto";
import {
  chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat,
  symlink, writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openEncryptedStore, StorageError } from "./encrypted-store";

const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as {
  describe(name: string, callback: () => unknown): void;
  expect(value: unknown): any;
  it(name: string, callback: () => unknown): void;
};
const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const identityFor = (bytes: Uint8Array) => ({
  objectId: sha(bytes), plaintextSha256: sha(bytes), byteLength: bytes.byteLength,
});
const withRoot = async (run: (root: string) => Promise<void>): Promise<void> => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "codeguessr-acquisition-owned-")));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
};
const open = (root: string, key = randomBytes(32)) => openEncryptedStore({
  root, key, volumeAttestation: "APPROVED_ENCRYPTED_VOLUME",
  ownershipAttestation: "ACQUISITION_OWNED",
});

describe("external encrypted snapshot store", () => {
  it("writes authenticated ciphertext with strict permissions and immutable dedupe", async () => {
    await withRoot(async (root) => {
      const plaintext = new TextEncoder().encode("sensitive source canary");
      const identity = identityFor(plaintext);
      const store = await open(root);
      const first = await store.put({ identity, plaintext });
      const path = join(root, "objects", `${identity.objectId}.enc`);
      const before = await stat(path);
      expect(first).toEqual({ identity });
      expect((await stat(root)).mode & 0o777).toBe(0o700);
      expect((await stat(join(root, "objects"))).mode & 0o777).toBe(0o700);
      expect(before.mode & 0o777).toBe(0o600);
      expect((await readFile(path)).includes(Buffer.from(plaintext))).toBe(false);
      await store.put({ identity, plaintext });
      expect((await stat(path)).mtimeMs).toBe(before.mtimeMs);
      expect(await store.read(identity)).toEqual(plaintext);
    });
  });

  it("rejects identity mismatch before a durable object write", async () => {
    await withRoot(async (root) => {
      const store = await open(root);
      const plaintext = new TextEncoder().encode("payload");
      await expect(store.put({
        identity: { ...identityFor(plaintext), plaintextSha256: "a".repeat(64) },
        plaintext,
      })).rejects.toThrow("IDENTITY_REJECTED");
      expect(await readdir(join(root, "objects"))).toEqual([]);
    });
  });

  it("rejects relative, repository-contained, and symlink roots", async () => {
    await expect(open("relative")).rejects.toThrow(StorageError);
    await expect(open(join(process.cwd(), "external"))).rejects.toThrow("ROOT_REJECTED");
    await withRoot(async (root) => {
      const link = `${root}-link`;
      await symlink(root, link);
      try { await expect(open(link)).rejects.toThrow("SYMLINK_REJECTED"); }
      finally { await rm(link, { force: true }); }
    });
  });

  it("rejects directory/object substitution and authenticated-envelope tampering", async () => {
    await withRoot(async (root) => {
      const plaintext = new TextEncoder().encode("payload");
      const identity = identityFor(plaintext);
      const store = await open(root);
      await store.put({ identity, plaintext });
      const path = join(root, "objects", `${identity.objectId}.enc`);
      const envelope = JSON.parse(await readFile(path, "utf8"));
      envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`;
      await writeFile(path, JSON.stringify(envelope), { mode: 0o600 });
      await expect(store.read(identity)).rejects.toThrow("AUTHENTICATION_REJECTED");
      await rm(path);
      await symlink("/dev/null", path);
      await expect(store.read(identity)).rejects.toThrow("SYMLINK_REJECTED");
      expect((await lstat(path)).isSymbolicLink()).toBe(true);
    });
  });

  it("serializes concurrent writers without replacement and cleans failed staging", async () => {
    await withRoot(async (root) => {
      const plaintext = new TextEncoder().encode("racing payload");
      const identity = identityFor(plaintext);
      const store = await open(root);
      const results = await Promise.allSettled([
        store.put({ identity, plaintext }), store.put({ identity, plaintext }),
      ]);
      expect(results.filter(({ status }) => status === "fulfilled").length).toBe(1);
      expect(results.filter(({ status }) => status === "rejected").length).toBe(1);
      expect(await store.read(identity)).toEqual(plaintext);
      expect(await readdir(join(root, "staging"))).toEqual([]);
    });
  });

  it("reopens securely, canonicalizes identity, and copies the caller key", async () => {
    await withRoot(async (root) => {
      const key = randomBytes(32);
      const retainedKey = Buffer.from(key);
      const plaintext = new TextEncoder().encode("stable payload");
      const identity = identityFor(plaintext);
      const store = await open(root, key);
      await store.put({ identity, plaintext });
      key.fill(0);
      const reordered = {
        byteLength: identity.byteLength,
        plaintextSha256: identity.plaintextSha256,
        objectId: identity.objectId,
      };
      expect(await store.read(reordered)).toEqual(plaintext);
      expect(await (await open(root, retainedKey)).read(identity)).toEqual(plaintext);
    });
  });

  it("rejects objects and staging symlinks on reopen without following them", async () => {
    for (const child of ["objects", "staging"]) await withRoot(async (root) => {
      await open(root);
      const target = await realpath(await mkdtemp(join(tmpdir(), "store-target-")));
      try {
        await chmod(target, 0o755);
        await rm(join(root, child), { recursive: true });
        await symlink(target, join(root, child));
        await expect(open(root)).rejects.toThrow("SYMLINK_REJECTED");
        expect((await stat(target)).mode & 0o777).not.toBe(0o700);
      } finally { await rm(target, { recursive: true, force: true }); }
    });
  });

  it("rejects ordinary root and child-directory substitution by pinned identity", async () => {
    for (const substituted of ["root", "objects", "staging"] as const) {
      await withRoot(async (root) => {
        const store = await open(root);
        const moved = substituted === "root" ? `${root}-original` : join(root, `${substituted}-original`);
        const target = substituted === "root" ? root : join(root, substituted);
        await rename(target, moved);
        await mkdir(target, { mode: 0o700 });
        if (substituted === "root") {
          await mkdir(join(root, "objects"), { mode: 0o700 });
          await mkdir(join(root, "staging"), { mode: 0o700 });
        }
        try {
          const plaintext = new TextEncoder().encode("substitution payload");
          const failure = await store.put({
            identity: identityFor(plaintext), plaintext,
          }).catch((error) => error);
          expect(failure).toBeInstanceOf(StorageError);
          expect(failure.message).toBe("ROOT_IDENTITY_REJECTED");
          expect(await readdir(join(root, "objects"))).toEqual([]);
        } finally {
          await rm(target, { recursive: true, force: true });
          await rename(moved, target);
        }
      });
    }
  });

  it("redacts unexpected put failures and leaves staging empty", async () => {
    await withRoot(async (root) => {
      const bytes = new TextEncoder().encode("payload");
      const identity = identityFor(bytes);
      const plaintext = new Proxy(bytes, {
        get(target, property) {
          if (property === "byteLength") throw new Error(`${root}/canary`);
          return Reflect.get(target, property, target);
        },
      });
      const store = await open(root);
      const failure = await store.put({ identity, plaintext }).catch((error) => error);
      expect(failure).toBeInstanceOf(StorageError);
      expect(failure.message).toBe("WRITE_REJECTED");
      expect(failure.message.includes(root)).toBe(false);
      expect(failure.message.includes("canary")).toBe(false);
      expect(await readdir(join(root, "staging"))).toEqual([]);
    });
  });
});
