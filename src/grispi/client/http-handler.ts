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
  baseUrl: string = "https://api.grispi.net";
  headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

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
}
