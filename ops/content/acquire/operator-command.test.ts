import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalSha256,
  READ_ONLY_PUBLIC_REPOSITORY_TOKEN,
} from "@codeguessr/content/operator/acquisition";
import { OperatorCommandError, runOperatorCommand } from "./index";
const testModuleName: string = "vitest";
const { describe, expect, it } = await import(testModuleName) as any;
const root = process.cwd();
const receipt = "2026-01-01T00:00:00Z";
const receiptMs = Date.parse(receipt);
const githubDate = "Thu, 01 Jan 2026 00:00:00 GMT";
const purpose = "LANGUAGE_CANDIDATE";
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
}), {
  status: 200,
  headers: { "content-type": "application/json", date: githubDate },
});
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

  it("authorizes project-controlled scope and performs one unauthenticated public request", async () => {
    const fixture = effectiveFixture();
    let captured: Request | undefined;
    const result = await runOperatorCommand(["--run", "run.json"], dependencies(
      fixture,
      async (request) => {
        captured = request;
        return successfulResponse();
      },
    ) as never);
    expect(captured?.url).toBe(
      `https://api.github.com/repos/owner/repo/commits/${"a".repeat(40)}`,
    );
    expect(captured?.headers.get("authorization")).toBe(null);
    expect(result).toEqual({
      status: "AUTHORIZED_COMMIT_RECEIPT",
      repository: "owner/repo",
      childSha: "a".repeat(40),
      parentSha: "b".repeat(40),
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
      const error = await runOperatorCommand(["--run", "run.json"], dependencies(
        fixture,
        async () => new Response(JSON.stringify(data), { headers: { date: githubDate } }),
      ) as never).catch((failure) => failure);
      expect(error.message).toBe("COMMIT_RECEIPT_REJECTED");
    }
    const skew = await runOperatorCommand(["--run", "run.json"], dependencies(
      fixture,
      async () => new Response(JSON.stringify({
        sha: "a".repeat(40),
        parents: [{ sha: "b".repeat(40) }],
      }), { headers: { date: "Thu, 01 Jan 2026 00:06:00 GMT" } }),
    ) as never).catch((failure) => failure);
    expect(skew.message).toBe("RECEIPT_AUTHORIZATION_REJECTED");
  });
});
