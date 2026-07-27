import {
  BoundedGitHubTransport,
  GitHubRateLimitPause,
  GitHubTransportError,
  GITHUB_REQUEST_TIMEOUT_MS,
} from "./transport";
import { validateGitHubEndpoint } from "./request";

interface AsyncExpectation {
  readonly rejects: {
    not: { toThrow(expected?: unknown): Promise<void> };
    toBeInstanceOf(expected: unknown): Promise<void>;
    toThrow(expected?: unknown): Promise<void>;
  };
  toBe(expected: unknown): void;
  toBeInstanceOf(expected: unknown): void;
  toEqual(expected: unknown): void;
}
interface TestApi {
  readonly describe: (name: string, callback: () => unknown) => void;
  readonly expect: (actual: unknown) => AsyncExpectation;
  readonly it: (name: string, callback: () => unknown) => void;
  readonly vi: {
    advanceTimersByTimeAsync(milliseconds: number): Promise<void>;
    useFakeTimers(): void;
    useRealTimers(): void;
  };
}
const testModuleName: string = "vitest";
const { describe, expect, it, vi } = (await import(testModuleName)) as TestApi;
const endpoint = validateGitHubEndpoint(
  `https://api.github.com/repos/owner/repo/commits/${"a".repeat(40)}`,
);
const json = (value: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(value), init);

describe("bounded GitHub transport", () => {
  it("uses one bounded manual-redirect GET and parses JSON", async () => {
    let captured: Request | undefined;
    const transport = new BoundedGitHubTransport({
      token: "token-canary",
      now: () => Date.parse("2026-07-27T15:00:00Z"),
      fetch: async (request: Request) => {
        captured = request;
        return json({ sha: "a".repeat(40) });
      },
    });
    expect(await transport.requestJson(endpoint)).toEqual({ sha: "a".repeat(40) });
    expect(captured?.method).toBe("GET");
    expect(captured?.redirect).toBe("manual");
    expect(captured?.signal).toBeInstanceOf(AbortSignal);
    expect(captured?.headers.get("authorization")).toBe("Bearer token-canary");
    expect(GITHUB_REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  it("rejects endpoints outside the exact allowlist before fetching", async () => {
    let calls = 0;
    const transport = new BoundedGitHubTransport({
      fetch: async () => { calls += 1; return json({}); },
    });
    await expect(transport.requestJson("https://github.com/owner/repo" as never))
      .rejects.toThrow("ENDPOINT_REJECTED");
    expect(calls).toBe(0);
  });

  it("rejects redirects, malformed JSON, and transport failures without raw bodies", async () => {
    for (const response of [
      new Response("raw-secret-canary", { status: 302, headers: { location: "https://evil.test" } }),
      new Response("raw-secret-canary", { status: 200 }),
    ]) {
      const transport = new BoundedGitHubTransport({ fetch: async () => response });
      await expect(transport.requestJson(endpoint)).rejects.not.toThrow("raw-secret-canary");
    }
    const transport = new BoundedGitHubTransport({
      fetch: async () => { throw new Error("token-canary raw-secret-canary"); },
    });
    await expect(transport.requestJson(endpoint)).rejects.toThrow("TRANSPORT_FAILURE");
    await expect(transport.requestJson(endpoint)).rejects.not.toThrow("token-canary");
  });

  it("does not retry terminal HTTP errors or leak their bodies", async () => {
    let calls = 0;
    const transport = new BoundedGitHubTransport({
      fetch: async () => {
        calls += 1;
        return new Response("raw-secret-canary", { status: 500 });
      },
    });
    await expect(transport.requestJson(endpoint)).rejects.toThrow("HTTP_ERROR");
    expect(calls).toBe(1);
    await expect(new BoundedGitHubTransport({
      fetch: async () => new Response("raw-secret-canary", { status: 401 }),
    }).requestJson(endpoint)).rejects.not.toThrow("raw-secret-canary");
  });

  it("pauses only for zero remaining quota with a future reset", async () => {
    const response = new Response("", {
      status: 403,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": `${Date.parse("2026-07-27T15:01:00Z") / 1_000}`,
      },
    });
    await expect(new BoundedGitHubTransport({
      now: () => Date.parse("2026-07-27T15:00:00Z"),
      fetch: async () => response,
    }).requestJson(endpoint)).rejects.toBeInstanceOf(GitHubRateLimitPause);
  });

  it("pauses for positive Retry-After on 403 or 429", async () => {
    for (const status of [403, 429]) {
      await expect(new BoundedGitHubTransport({
        fetch: async () => new Response("", {
          status,
          headers: { "retry-after": "2" },
        }),
      }).requestJson(endpoint)).rejects.toBeInstanceOf(GitHubRateLimitPause);
    }
  });

  it("terminates malformed rate-limit signals and ordinary forbidden responses", async () => {
    for (const headers of [
      {},
      { "retry-after": "0" },
      { "retry-after": "not-a-duration" },
      { "x-ratelimit-remaining": "1", "x-ratelimit-reset": "9999999999" },
      { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1" },
    ]) {
      await expect(new BoundedGitHubTransport({
        now: () => Date.parse("2026-07-27T15:00:00Z"),
        fetch: async () => new Response("", { status: 403, headers }),
      }).requestJson(endpoint)).rejects.toThrow("RATE_LIMIT_REJECTED");
    }
  });

  it("rejects a fifth concurrent request", async () => {
    const releases: Array<() => void> = [];
    const transport = new BoundedGitHubTransport({
      fetch: () => new Promise((resolve) => {
        releases.push(() => resolve(json({ ok: true })));
      }),
    });
    const active = Array.from({ length: 4 }, () => transport.requestJson(endpoint));
    await expect(transport.requestJson(endpoint)).rejects.toThrow("CONCURRENCY_LIMIT");
    releases.forEach((release) => release());
    await Promise.all(active);
  });

  it("enforces the 500-request and 50 MiB aggregate response bounds", async () => {
    const requestLimited = new BoundedGitHubTransport({ fetch: async () => json({}) });
    for (let index = 0; index < 500; index += 1) await requestLimited.requestJson(endpoint);
    await expect(requestLimited.requestJson(endpoint)).rejects.toThrow("REQUEST_LIMIT");

    const byteLimited = new BoundedGitHubTransport({
      fetch: async () => new Response("{}", {
        headers: { "content-length": `${50 * 1024 * 1024 + 1}` },
      }),
    });
    await expect(byteLimited.requestJson(endpoint)).rejects.toThrow("RESPONSE_BYTE_LIMIT");
  });

  it("stops streaming when an undeclared body crosses 50 MiB", async () => {
    const mebibyte = new Uint8Array(1024 * 1024);
    let cancelled = false;
    let emitted = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (emitted < 51) {
          controller.enqueue(mebibyte);
          emitted += 1;
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    const transport = new BoundedGitHubTransport({
      fetch: async () => new Response(body),
    });
    await expect(transport.requestJson(endpoint)).rejects.toThrow("RESPONSE_BYTE_LIMIT");
    expect(cancelled).toBe(true);
  });

  it("applies the byte bound cumulatively across bodies", async () => {
    const body = JSON.stringify("a".repeat(1024 * 1024 - 2));
    const transport = new BoundedGitHubTransport({
      fetch: async () => new Response(body),
    });
    for (let index = 0; index < 50; index += 1) await transport.requestJson(endpoint);
    await expect(transport.requestJson(endpoint)).rejects.toThrow("RESPONSE_BYTE_LIMIT");
  });

  it("aborts after fifteen seconds and never retries", async () => {
    vi.useFakeTimers();
    let calls = 0;
    try {
      const transport = new BoundedGitHubTransport({
        fetch: (request) => new Promise((_resolve, reject) => {
          calls += 1;
          request.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
      });
      const result = expect(transport.requestJson(endpoint)).rejects
        .toThrow("TRANSPORT_FAILURE");
      await vi.advanceTimersByTimeAsync(15_000);
      await result;
      expect(calls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the fifteen-second timeout active while reading the body", async () => {
    vi.useFakeTimers();
    let calls = 0;
    try {
      const transport = new BoundedGitHubTransport({
        fetch: async (request) => {
          calls += 1;
          let streamController: ReadableStreamDefaultController<Uint8Array>;
          const body = new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller;
            },
          });
          request.signal.addEventListener("abort", () =>
            streamController.error(new Error("aborted")));
          return new Response(body);
        },
      });
      const result = expect(transport.requestJson(endpoint)).rejects
        .toThrow("TRANSPORT_FAILURE");
      await vi.advanceTimersByTimeAsync(15_000);
      await result;
      expect(calls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reserves aggregate bytes safely across four concurrent bodies", async () => {
    const body = JSON.stringify("a".repeat(13 * 1024 * 1024 - 2));
    const transport = new BoundedGitHubTransport({
      fetch: async () => new Response(body),
    });
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => transport.requestJson(endpoint)),
    );
    expect(results.filter(({ status }) => status === "rejected").length).toBe(1);
  });

  it("uses a specific non-sensitive transport error", async () => {
    await expect(new BoundedGitHubTransport({
      fetch: async () => new Response("", { status: 500 }),
    }).requestJson(endpoint)).rejects.toBeInstanceOf(GitHubTransportError);
  });

  it("redacts a non-timeout response-stream failure and never retries", async () => {
    let calls = 0;
    const transport = new BoundedGitHubTransport({
      fetch: async () => {
        calls += 1;
        return new Response(new ReadableStream({
          pull(controller) {
            controller.error(new Error("raw-stream-canary"));
          },
        }));
      },
    });
    await expect(transport.requestJson(endpoint)).rejects.toThrow("TRANSPORT_FAILURE");
    await expect(new BoundedGitHubTransport({
      fetch: async () => new Response(new ReadableStream({
        pull(controller) { controller.error(new Error("raw-stream-canary")); },
      })),
    }).requestJson(endpoint)).rejects.not.toThrow("raw-stream-canary");
    expect(calls).toBe(1);
  });
});
