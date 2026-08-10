import {
  DEFAULT_ENVIRONMENT,
  GRISPI_BASE_URLS,
  GrispiEnvironment,
} from "./environment";

/**
 * Thrown when `fetch` itself fails (offline, DNS failure, CORS, etc.) — a
 * network-level failure that never reached an HTTP response.
 */
export class NetworkError extends Error {
  constructor(public cause: unknown) {
    super("network");
  }
}

/**
 * Thrown when the server responded but with a non-2xx status. `body` is the
 * parsed JSON response body when available (null if parsing failed or the
 * body was empty) — for developer-facing logging only, never surfaced
 * verbatim to the end user (V7 — Info Disclosure).
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`http_${status}`);
  }
}

export class HttpHandler {
  baseUrl: string = GRISPI_BASE_URLS[DEFAULT_ENVIRONMENT];
  headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** CORE-04 — routes every subsequent request through the resolved host. */
  setEnvironment(environment: GrispiEnvironment) {
    this.setBaseUrl(GRISPI_BASE_URLS[environment]);
  }

  async send<T>(url: string, options: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/${url}`, {
        ...options,
        headers: { ...this.headers, ...options.headers },
      });
    } catch (cause) {
      throw new NetworkError(cause);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new HttpError(response.status, body);
    }

    return response.json();
  }

  /**
   * Multipart upload path (Phase 4, attachment uploads). Deliberately does
   * NOT spread `this.headers` — that object always carries the default
   * `Content-Type: application/json`, and setting a `Content-Type` to any
   * string value (including `undefined`, which WHATWG `Headers` coerces to
   * the literal string `"undefined"` — confirmed live, RESEARCH.md
   * Architecture Patterns Pattern 1) breaks the browser's automatic
   * multipart boundary generation. `extraHeaders` should be
   * `Authentication.headers` only (tenantId + Authorization), confirmed to
   * never carry a content-type key (`src/grispi/client/authentication.ts`).
   */
  async sendMultipart<T>(
    url: string,
    formData: FormData,
    extraHeaders: Record<string, string>
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/${url}`, {
        method: "POST",
        cache: "no-cache",
        body: formData,
        headers: { ...extraHeaders },
      });
    } catch (cause) {
      throw new NetworkError(cause);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new HttpError(response.status, body);
    }

    return response.json();
  }
}
