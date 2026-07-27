import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalSha256,
  appendAuditEvent,
  READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
} from "@codeguessr/content/operator/acquisition";
import {
  OperatorCommandError,
  runInternalSourceReceiptStep,
  runOperatorCommand,
} from "./index";
const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;
const root = process.cwd();
const receipt = "2026-01-01T00:00:00Z";
const receiptMs = Date.parse(receipt);
const githubDate = "Thu, 01 Jan 2026 00:00:00 GMT";
const purpose = "LANGUAGE_CANDIDATE";
const childTreeSha = "c".repeat(40);
const parentTreeSha = "d".repeat(40);
const commitMessage = "Implement answer\n\nCo-authored-by: Claude <noreply@anthropic.com>";
const repositoryMetadata = {
  repositoryId: "R_1",
  repository: "owner/repo",
  visibility: "public",
  archived: false,
  disabled: false,
  licenseIdentifier: "MIT",
};
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const gitBlobSha = (value: Uint8Array): string =>
  createHash("sha1").update(`blob ${value.byteLength}\0`).update(value).digest("hex");
interface TreeEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: string;
  readonly sha: string;
}
const gitTree = (entries: readonly TreeEntry[]) => {
  const body = Buffer.concat(entries
    .map((entry) => ({
      entry,
      sortName: entry.type === "tree" ? `${entry.path}/` : entry.path,
    }))
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.sortName), Buffer.from(right.sortName)))
    .map(({ entry }) => Buffer.concat([
      Buffer.from(`${entry.mode === "040000" ? "40000" : entry.mode} ${entry.path}\0`),
      Buffer.from(entry.sha, "hex"),
    ])));
  return {
    sha: createHash("sha1").update(`tree ${body.byteLength}\0`).update(body).digest("hex"),
    truncated: false,
    tree: entries,
  };
};
const effectiveFixture = (validThrough?: string) => {
  const policy = (
    policyClass: "REPOSITORY_ADMISSION" | "ATTRIBUTION_MARKER",
  ) => ({
    policyClass,
    policyVersion: `${policyClass.toLowerCase()}-v1`,
    permittedPurposes: [purpose],
    ...(policyClass === "REPOSITORY_ADMISSION"
      ? { repositories: [{ repository: "owner/repo", approvedSubtrees: ["src"] }] }
      : {}),
  });
  const repositoryPolicy = policy("REPOSITORY_ADMISSION");
  const attributionPolicy = policy("ATTRIBUTION_MARKER");
  const policyEntry = (
    controlledPolicy: typeof repositoryPolicy | typeof attributionPolicy,
  ) => ({
    entryId: `${controlledPolicy.policyClass.toLowerCase()}-entry`,
    policyClass: controlledPolicy.policyClass,
    policyVersion: controlledPolicy.policyVersion,
    policyHash: canonicalSha256(controlledPolicy),
    permittedPurposes: [purpose],
    validFrom: receipt,
    ...(validThrough === undefined ? {} : { validThrough }),
    approvals: [
      { role: "Don", approverId: "approver-one", approvedAt: receipt },
      { role: "Rights/Safety Reviewer", approverId: "approver-two", approvedAt: receipt },
    ],
  });
  const approvedPolicyRegister = {
    registerVersion: "approved-policies-v1",
    entries: [policyEntry(repositoryPolicy), policyEntry(attributionPolicy)],
  };
  const operatorEntry = {
    entryId: "operator-entry",
    operatorName: "Operator",
    osIdentity: "uid:1",
    repositories: ["owner/repo"],
    purposes: [purpose],
    tokenAllowance: READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
    validFrom: receipt,
    ...(validThrough === undefined ? {} : { validThrough }),
    approvals: [
      { role: "Release Operator", approverId: "release", approvedAt: receipt },
      { role: "Security Reviewer", approverId: "security", approvedAt: receipt },
    ],
  };
  const operatorAuthorizationRegister = {
    registerVersion: "operators-v1",
    entries: [operatorEntry],
  };
  const policyInput = (
    controlledPolicy: typeof repositoryPolicy | typeof attributionPolicy,
  ) => {
    const entry = approvedPolicyRegister.entries.find(
      (candidate) => candidate.policyClass === controlledPolicy.policyClass,
    )!;
    return {
      policy: controlledPolicy,
      register: approvedPolicyRegister,
      binding: {
        registerVersion: approvedPolicyRegister.registerVersion,
        registerHash: canonicalSha256(approvedPolicyRegister),
        entryId: entry.entryId,
      },
      purpose,
      authoritativeReceiptTime: receipt,
    };
  };
  return {
    descriptor: {
      request: {
        repository: "owner/repo",
        commit: "a".repeat(40),
        subtree: "src",
        purpose,
        observationTime: receipt,
      },
      repositoryPolicy: policyInput(repositoryPolicy),
      attributionPolicy: policyInput(attributionPolicy),
      operatorAuthorization: {
        register: operatorAuthorizationRegister,
        binding: {
          registerVersion: operatorAuthorizationRegister.registerVersion,
          registerHash: canonicalSha256(operatorAuthorizationRegister),
          entryId: operatorEntry.entryId,
        },
        operatorName: operatorEntry.operatorName,
        osIdentity: operatorEntry.osIdentity,
        repository: "owner/repo",
        purpose,
        tokenAllowance: READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
        callerObservationTime: receipt,
        authoritativeReceiptTime: receipt,
        githubDate,
      },
    },
    controls: {
      repositoryPolicy,
      attributionPolicy,
      approvedPolicyRegister,
      operatorAuthorizationRegister,
    },
  };
};
const dependencies = (
  fixture: ReturnType<typeof effectiveFixture>,
  fetch: (request: Request) => Promise<Response>,
  now = receiptMs,
) => ({
  loadRunDescriptor: async () => fixture.descriptor,
  loadProjectControls: async () => fixture.controls,
  fetch,
  now: () => now,
  osIdentity: () => "uid:1",
});
const successfulResponse = () => new Response(JSON.stringify({
  sha: "a".repeat(40),
  parents: [{ sha: "b".repeat(40) }],
  commit: {
    message: commitMessage,
    tree: { sha: childTreeSha },
    verification: { verified: true, reason: "valid" },
    author: { name: "Developer" },
    committer: { name: "Developer" },
  },
  author: { login: "developer", type: "User" },
  committer: { login: "developer", type: "User" },
}), {
  status: 200,
  headers: { "content-type": "application/json", date: githubDate },
});
const parentResponse = () => new Response(JSON.stringify({
  sha: "b".repeat(40),
  commit: { tree: { sha: parentTreeSha } },
}), { status: 200, headers: { "content-type": "application/json" } });
const repositoryResponse = () => new Response(JSON.stringify({
  node_id: repositoryMetadata.repositoryId,
  full_name: repositoryMetadata.repository,
  visibility: repositoryMetadata.visibility,
  private: false,
  archived: repositoryMetadata.archived,
  disabled: repositoryMetadata.disabled,
  license: { spdx_id: repositoryMetadata.licenseIdentifier },
}), { status: 200, headers: { "content-type": "application/json" } });
describe("operator-only acquisition command", () => {
  it("exposes acquisition only through a node operator subpath and locked root runner", async () => {
    const workspace = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const content = JSON.parse(await readFile(join(root, "packages/content/package.json"), "utf8"));
    expect(workspace.scripts["acquire:content"]).toContain("tsx");
    expect(workspace.devDependencies.tsx).toBe("4.23.1");
    expect(content.devDependencies?.tsx).toBe(undefined);
    expect(content.exports["."]).toBe("./src/index.ts");
    expect(content.exports["./operator/acquisition"].node).toBe("./src/acquisition/index.ts");
    expect(content.exports["./operator/acquisition"].browser).toBe(null);
    expect(content.exports["./operator/acquisition"].default).toBe(null);
    const resolution = spawnSync("node", [
      "--import", "tsx", "--input-type=module", "-e",
      'const r=await import("@codeguessr/content");const a=await import("@codeguessr/content/operator/acquisition");console.log(`${"openEncryptedStore" in r}:${"openEncryptedStore" in a}`)',
    ], { cwd: join(root, "packages/content"), encoding: "utf8" });
    expect(resolution.status).toBe(0);
    expect(resolution.stdout.trim()).toBe("false:true");
    const scan = spawnSync("rg", [
      "-n", "@codeguessr/content/operator/acquisition", "apps/game", "packages/domain",
      "packages/measurement", "packages/content/src/index.ts",
    ], { cwd: root, encoding: "utf8" });
    expect(scan.status).toBe(1);
    const temporary = await mkdtemp(join(tmpdir(), "operator-run-"));
    try {
      const descriptorPath = join(temporary, "run.json");
      await writeFile(descriptorPath, JSON.stringify({
        request: effectiveFixture().descriptor.request,
        operatorEntryId: "not-authorized",
      }));
      const startup = spawnSync("pnpm", ["acquire:content", "--", "--run", descriptorPath], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CODEGUESSR_GITHUB_TOKEN: "startup-raw-canary" },
      });
      expect(startup.status).not.toBe(0);
      expect(startup.stderr).toContain("AUTHORIZATION_REJECTED");
      expect(`${startup.stdout}${startup.stderr}`).not.toContain("startup-raw-canary");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
  it("rejects unsafe arguments and a self-signed descriptor before network", async () => {
    let networkCalls = 0;
    const fixture = effectiveFixture();
    const deps = dependencies(fixture, async () => {
      networkCalls += 1;
      return successfulResponse();
    });
    for (const argv of [
      ["--token", "raw-canary"],
      ["--run", "https://example.test/run"],
      ["--run", "run.json", "--x"],
    ]) {
      const error = await runOperatorCommand(
        argv,
        deps as never,
      ).catch((failure) => failure);
      expect(error).toBeInstanceOf(OperatorCommandError);
      expect(error.message.includes("raw-canary")).toBe(false);
    }
    const untrustedControls = {
      ...fixture.controls,
      approvedPolicyRegister: {
        ...fixture.controls.approvedPolicyRegister,
        entries: [],
      },
    };
    const error = await runOperatorCommand(["--run", "run.json"], {
      ...deps,
      loadProjectControls: async () => untrustedControls,
    } as never).catch((failure) => failure);
    expect(error).toBeInstanceOf(OperatorCommandError);
    expect(error.message).toBe("AUTHORIZATION_REJECTED");
    expect(networkCalls).toBe(0);
  });
  it("rejects expired project controls using trusted host time before network", async () => {
    let networkCalls = 0;
    const fixture = effectiveFixture("2026-01-01T00:00:00Z");
    const error = await runOperatorCommand(["--run", "run.json"], dependencies(
      fixture,
      async () => {
        networkCalls += 1;
        return successfulResponse();
      },
      Date.parse("2026-01-02T00:00:00Z"),
    ) as never).catch((failure) => failure);
    expect(error).toBeInstanceOf(OperatorCommandError);
    expect(error.message).toBe("AUTHORIZATION_REJECTED");
    expect(networkCalls).toBe(0);
  });
  it("rejects a mismatched host operating-system identity before network", async () => {
    let networkCalls = 0;
    const fixture = effectiveFixture();
    const deps = {
      ...dependencies(fixture, async () => {
        networkCalls += 1;
        return successfulResponse();
      }),
      osIdentity: () => "uid:999",
    };
    const error = await runOperatorCommand(
      ["--run", "run.json"],
      deps as never,
    ).catch((failure) => failure);
    expect(error).toBeInstanceOf(OperatorCommandError);
    expect(error.message).toBe("AUTHORIZATION_REJECTED");
    expect(networkCalls).toBe(0);
  });

  it("requires prepared external state before any source network request", async () => {
    const fixture = effectiveFixture();
    let networkCalls = 0;
    const error = await runOperatorCommand(
      ["--run", "run.json"],
      dependencies(fixture, async () => {
        networkCalls += 1;
        return successfulResponse();
      }) as never,
    ).catch((failure) => failure);
    expect(error).toBeInstanceOf(OperatorCommandError);
    expect(error.message).toBe("OPERATOR_STATE_REJECTED");
    expect(networkCalls).toBe(0);
  });

  it("authorizes project-controlled scope and performs one unauthenticated public request", async () => {
    const fixture = effectiveFixture();
    const captured: Request[] = [];
    const result = await runInternalSourceReceiptStep(["--run", "run.json"], dependencies(
      fixture,
      async (request) => {
        captured.push(request);
        if (request.url.endsWith(`/commits/${"a".repeat(40)}`)) return successfulResponse();
        if (request.url.endsWith(`/commits/${"b".repeat(40)}`)) return parentResponse();
        if (request.url === "https://api.github.com/repos/owner/repo") {
          return repositoryResponse();
        }
        throw new Error("unexpected endpoint");
      },
    ) as never);
    expect(captured.map(({ url }) => url)).toEqual([
      `https://api.github.com/repos/owner/repo/commits/${"a".repeat(40)}`,
      `https://api.github.com/repos/owner/repo/commits/${"b".repeat(40)}`,
      "https://api.github.com/repos/owner/repo",
    ]);
    expect(captured.every(({ headers }) => headers.get("authorization") === null)).toBe(true);
    expect(result).toEqual({
      status: "AUTHORIZED_COMMIT_RECEIPT",
      repository: "owner/repo",
      subtree: "src",
      childSha: "a".repeat(40),
      parentSha: "b".repeat(40),
      childTreeSha,
      parentTreeSha,
      repositoryId: repositoryMetadata.repositoryId,
      repositoryMetadataHash: canonicalSha256(repositoryMetadata),
      licenseIdentifier: "MIT",
      commit: {
        author: { name: "Developer", login: "developer", type: "User" },
        committer: { name: "Developer", login: "developer", type: "User" },
        verification: { verified: true, reason: "valid" },
        message: commitMessage,
      },
      responseDate: githubDate,
      purpose,
      repositoryPolicyHash: canonicalSha256(fixture.controls.repositoryPolicy),
      attributionPolicyHash: canonicalSha256(fixture.controls.attributionPolicy),
      operatorEntryId: "operator-entry",
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects malformed commits and response-clock skew", async () => {
    const fixture = effectiveFixture();
    for (const data of [
      { sha: "malformed", parents: [] },
      { sha: "a".repeat(40), parents: [] },
      { sha: "a".repeat(40), parents: [{ sha: "b".repeat(40) }, { sha: "c".repeat(40) }] },
      { sha: "a".repeat(40), parents: [{ sha: "bad" }] },
    ]) {
      const error = await runInternalSourceReceiptStep(["--run", "run.json"], dependencies(
        fixture,
        async () => new Response(JSON.stringify(data), { headers: { date: githubDate } }),
      ) as never).catch((failure) => failure);
      expect(error.message).toBe("COMMIT_RECEIPT_REJECTED");
    }
    const skew = await runInternalSourceReceiptStep(["--run", "run.json"], dependencies(
      fixture,
      async () => new Response(JSON.stringify({
        sha: "a".repeat(40),
        parents: [{ sha: "b".repeat(40) }],
        commit: {
          message: commitMessage,
          tree: { sha: childTreeSha },
          verification: { verified: true, reason: "valid" },
          author: { name: "Developer" },
          committer: { name: "Developer" },
        },
        author: { login: "developer", type: "User" },
        committer: { login: "developer", type: "User" },
      }), { headers: { date: "Thu, 01 Jan 2026 00:06:00 GMT" } }),
    ) as never).catch((failure) => failure);
    expect(skew.message).toBe("RECEIPT_AUTHORIZATION_REJECTED");
  });

  it("composes certified Git objects into a quarantined draft when state is prepared", async () => {
    const fixture = effectiveFixture();
    const parentBytes = bytes("export const answer = 41;\n");
    const childBytes = bytes("export const answer = 42;\n");
    const licenseBytes = bytes("MIT License\n");
    const parentBlob = gitBlobSha(parentBytes);
    const childBlob = gitBlobSha(childBytes);
    const licenseBlob = gitBlobSha(licenseBytes);
    const parentSubtree = gitTree([
      { path: "answer.ts", mode: "100644", type: "blob", sha: parentBlob },
    ]);
    const childSubtree = gitTree([
      { path: "answer.ts", mode: "100644", type: "blob", sha: childBlob },
    ]);
    const parentRoot = gitTree([
      { path: "src", mode: "040000", type: "tree", sha: parentSubtree.sha },
    ]);
    const childRoot = gitTree([
      { path: "LICENSE", mode: "100644", type: "blob", sha: licenseBlob },
      { path: "src", mode: "040000", type: "tree", sha: childSubtree.sha },
    ]);
    const trees = new Map([
      [parentRoot.sha, parentRoot],
      [childRoot.sha, childRoot],
      [parentSubtree.sha, parentSubtree],
      [childSubtree.sha, childSubtree],
    ]);
    const blobs = new Map([
      [parentBlob, parentBytes],
      [childBlob, childBytes],
      [licenseBlob, licenseBytes],
    ]);
    const stored: string[] = [];
    let audit: readonly any[] = [];
    const order: string[] = [];
    const result = await runOperatorCommand(["--run", "run.json"], {
      ...dependencies(fixture, async (request) => {
        order.push("network");
        if (request.url.endsWith(`/commits/${"a".repeat(40)}`)) {
          return new Response(JSON.stringify({
            sha: "a".repeat(40),
            parents: [{ sha: "b".repeat(40) }],
            commit: {
              message: "Implement answer",
              tree: { sha: childRoot.sha },
              verification: { verified: true, reason: "valid" },
              author: { name: "Developer" },
              committer: { name: "Developer" },
            },
            author: { login: "developer", type: "User" },
            committer: { login: "developer", type: "User" },
          }), { headers: { date: githubDate } });
        }
        if (request.url.endsWith(`/commits/${"b".repeat(40)}`)) {
          return new Response(JSON.stringify({
            sha: "b".repeat(40), commit: { tree: { sha: parentRoot.sha } },
          }));
        }
        if (request.url === "https://api.github.com/repos/owner/repo") {
          return repositoryResponse();
        }
        const treeIdentity = request.url.match(/\/git\/trees\/([0-9a-f]{40})$/u)?.[1];
        if (treeIdentity !== undefined) {
          return new Response(JSON.stringify(trees.get(treeIdentity)));
        }
        const blobIdentity = request.url.match(/\/git\/blobs\/([0-9a-f]{40})$/u)?.[1];
        const content = blobIdentity === undefined ? undefined : blobs.get(blobIdentity);
        if (blobIdentity === undefined || content === undefined) {
          throw new Error("unexpected object endpoint");
        }
        return new Response(JSON.stringify({
          sha: blobIdentity,
          encoding: "base64",
          size: content.byteLength,
          content: Buffer.from(content).toString("base64"),
        }));
      }),
      prepareOperatorState: async () => {
        order.push("state");
        return {
          open: async () => ({
            store: {
              put: async ({ identity }: any) => {
                stored.push(identity.objectId);
                return { identity, created: true };
              },
              remove: async ({ objectId }: any) => {
                const index = stored.indexOf(objectId);
                if (index < 0) return false;
                stored.splice(index, 1);
                return true;
              },
            },
            audit: {
              append: async (event: unknown) => {
                audit = appendAuditEvent(audit, event);
                return audit;
              },
            },
          }),
          dispose: () => undefined,
        };
      },
    } as never);
    expect(result).toMatchObject({
      status: "DRAFT_REVIEW_REQUIRED",
      draftId: expect.stringMatching(/^draft:[0-9a-f]{64}$/u),
      draftHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      checkpointHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      artifactObjects: {
        draft: {
          objectId: expect.stringMatching(/^[0-9a-f]{64}$/u),
          plaintextSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
        },
        checkpoint: {
          objectId: expect.stringMatching(/^[0-9a-f]{64}$/u),
          plaintextSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
        },
        index: {
          objectId: expect.stringMatching(/^[0-9a-f]{64}$/u),
          plaintextSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("src/answer.ts");
    expect(JSON.stringify(result)).not.toContain("export const answer");
    expect(stored).toHaveLength(6);
    expect(audit.at(-1)?.eventType).toBe("DRAFT_COMPLETED");
    expect(audit.at(-1)?.subjectHash)
      .toBe((result as any).artifactObjects.index.objectId);
    expect(order[0]).toBe("state");
  });

  it("preserves a categorical state-opening failure after source certification", async () => {
    const fixture = effectiveFixture();
    let disposed = false;
    const error = await runOperatorCommand(["--run", "run.json"], {
      ...dependencies(fixture, async (request) => {
        if (request.url.endsWith(`/commits/${"a".repeat(40)}`)) return successfulResponse();
        if (request.url.endsWith(`/commits/${"b".repeat(40)}`)) return parentResponse();
        return repositoryResponse();
      }),
      prepareOperatorState: async () => ({
        open: async () => { throw new Error("state canary"); },
        dispose: () => { disposed = true; },
      }),
    } as never).catch((failure) => failure);
    expect(error).toBeInstanceOf(OperatorCommandError);
    expect(error.message).toBe("OPERATOR_STATE_REJECTED");
    expect(disposed).toBe(true);
  });
});
