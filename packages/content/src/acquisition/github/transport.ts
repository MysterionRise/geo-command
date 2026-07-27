import {
  AcquisitionRequestError,
  type GitHubEndpoint,
  validateGitHubEndpoint,
} from "./request";

export const GITHUB_REQUEST_TIMEOUT_MS = 15_000;
const MAX_ACTIVE_REQUESTS = 4;
const MAX_REQUESTS = 500;
const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;

export class GitHubTransportError extends Error {
  public constructor(code: string) {
    super(code);
    this.name = "GitHubTransportError";
  }
}

export class GitHubRateLimitPause extends Error {
  public constructor(public readonly resumeAfterEpochMs: number) {
    super("RATE_LIMIT_PAUSE");
    this.name = "GitHubRateLimitPause";
  }
}

export interface GitHubTransportOptions {
  readonly fetch: (request: Request) => Promise<Response>;
  readonly now?: () => number;
  readonly token?: string;
}
export interface GitHubResponseReceipt {
  readonly data: unknown;
  readonly responseDate: string;
}

const transportFailure = (code: string): never => {
  throw new GitHubTransportError(code);
};

const positiveInteger = (value: string | null): number | undefined => {
  if (value === null || !/^[1-9]\d*$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};
const IMF_FIXDATE =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/u;
const deepFreeze = <Value>(value: Value): Value => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export class BoundedGitHubTransport {
  readonly #fetch: GitHubTransportOptions["fetch"];
  readonly #now: () => number;
  readonly #token: string | undefined;
  #activeRequests = 0;
  #requestCount = 0;
  #responseBytes = 0;

  public constructor(options: GitHubTransportOptions) {
    this.#fetch = options.fetch;
    this.#now = options.now ?? Date.now;
    this.#token = options.token;
  }

  public async requestJson(endpoint: GitHubEndpoint): Promise<unknown> {
    return (await this.#request(endpoint, false)).data;
  }

  public async requestReceipt(endpoint: GitHubEndpoint): Promise<GitHubResponseReceipt> {
    const receipt = await this.#request(endpoint, true);
    return deepFreeze({
      data: receipt.data,
      responseDate: receipt.responseDate ?? transportFailure("RESPONSE_DATE_REJECTED"),
    });
  }

  async #request(
    endpoint: GitHubEndpoint,
    requireResponseDate: boolean,
  ): Promise<{ readonly data: unknown; readonly responseDate?: string }> {
    let validatedEndpoint: GitHubEndpoint;
    try {
      validatedEndpoint = validateGitHubEndpoint(endpoint);
    } catch (error) {
      if (error instanceof AcquisitionRequestError) return transportFailure("ENDPOINT_REJECTED");
      throw error;
    }
    if (this.#activeRequests >= MAX_ACTIVE_REQUESTS) {
      return transportFailure("CONCURRENCY_LIMIT");
    }
    if (this.#requestCount >= MAX_REQUESTS) return transportFailure("REQUEST_LIMIT");
    this.#activeRequests += 1;
    this.#requestCount += 1;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), GITHUB_REQUEST_TIMEOUT_MS);
    try {
      const response = await this.#send(validatedEndpoint, abortController.signal);
      this.#validateResponse(response);
      const responseDate = requireResponseDate ? this.#responseDate(response) : undefined;
      const data = await this.#parseJson(response);
      return responseDate === undefined ? { data } : { data, responseDate };
    } catch (error) {
      if (abortController.signal.aborted) return transportFailure("TRANSPORT_FAILURE");
      if (error instanceof GitHubTransportError || error instanceof GitHubRateLimitPause) {
        throw error;
      }
      return transportFailure("TRANSPORT_FAILURE");
    } finally {
      clearTimeout(timeout);
      this.#activeRequests -= 1;
    }
  }

  #responseDate(response: Response): string {
    const value = response.headers.get("date");
    if (value === null || !IMF_FIXDATE.test(value)
      || Number.isNaN(Date.parse(value)) || new Date(value).toUTCString() !== value) {
      return transportFailure("RESPONSE_DATE_REJECTED");
    }
    return value;
  }

  async #send(endpoint: GitHubEndpoint, signal: AbortSignal): Promise<Response> {
    const headers = new Headers({ accept: "application/vnd.github+json" });
    if (this.#token !== undefined) headers.set("authorization", `Bearer ${this.#token}`);
    const request = new Request(endpoint, {
      headers,
      method: "GET",
      redirect: "manual",
      signal,
    });
    try {
      return await this.#fetch(request);
    } catch {
      return transportFailure("TRANSPORT_FAILURE");
    }
  }

  #validateResponse(response: Response): void {
    if (response.redirected || (response.status >= 300 && response.status < 400)) {
      transportFailure("REDIRECT_REJECTED");
    }
    if (response.status === 403 || response.status === 429) {
      this.#handleRateLimit(response);
    }
    if (!response.ok) transportFailure("HTTP_ERROR");
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null) {
      const length = Number(declaredLength);
      if (!Number.isSafeInteger(length) || length < 0) {
        transportFailure("MALFORMED_RESPONSE");
      }
      if (this.#responseBytes + length > MAX_RESPONSE_BYTES) {
        transportFailure("RESPONSE_BYTE_LIMIT");
      }
    }
  }

  #handleRateLimit(response: Response): never {
    const retryAfterSeconds = positiveInteger(response.headers.get("retry-after"));
    if (retryAfterSeconds !== undefined) {
      throw new GitHubRateLimitPause(this.#now() + retryAfterSeconds * 1_000);
    }
    const remaining = response.headers.get("x-ratelimit-remaining");
    const resetSeconds = positiveInteger(response.headers.get("x-ratelimit-reset"));
    if (
      remaining === "0"
      && resetSeconds !== undefined
      && resetSeconds * 1_000 > this.#now()
    ) {
      throw new GitHubRateLimitPause(resetSeconds * 1_000);
    }
    return transportFailure("RATE_LIMIT_REJECTED");
  }

  async #parseJson(response: Response): Promise<unknown> {
    const bytes = await this.#readBoundedBody(response);
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    } catch {
      return transportFailure("MALFORMED_RESPONSE");
    }
  }

  async #readBoundedBody(response: Response): Promise<Uint8Array> {
    if (response.body === null) return new Uint8Array();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bodyBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (this.#responseBytes + value.byteLength > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return transportFailure("RESPONSE_BYTE_LIMIT");
      }
      this.#responseBytes += value.byteLength;
      bodyBytes += value.byteLength;
      chunks.push(value);
    }
    const bytes = new Uint8Array(bodyBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
}
