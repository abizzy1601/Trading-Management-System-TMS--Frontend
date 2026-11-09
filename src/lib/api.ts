import type { AuthResponse } from "./types";

/** An error from the API, normalised so UI code never has to inspect FastAPI's several `detail` shapes. */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
  get isPaywall() {
    return this.status === 402 && this.code === "subscription_required";
  }
}

export function parseErrorBody(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return new ApiError(status, detail);
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { loc?: unknown[]; msg?: string };
    const field = first.loc?.filter((p) => p !== "body").slice(-1)[0];
    return new ApiError(status, field ? `${String(field)}: ${first.msg}` : (first.msg ?? "Invalid request"));
  }
  if (detail && typeof detail === "object") {
    const d = detail as { code?: string; message?: string };
    return new ApiError(status, d.message ?? "Request failed", d.code);
  }
  return new ApiError(status, status >= 500 ? "Something went wrong on our side. Please try again." : "Request failed");
}

// The access token lives only in memory. The long-lived refresh token is an httpOnly cookie the page cannot read.
let accessToken: string | null = null;
let expiresAt = 0;
let refreshInFlight: Promise<AuthResponse | null> | null = null;

export function setAccessToken(token: string | null, expiresInSeconds = 0) {
  accessToken = token;
  expiresAt = token ? Date.now() + expiresInSeconds * 1000 : 0;
}

/** Exchange the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const data = (await res.json()) as AuthResponse;
      setAccessToken(data.access_token, data.expires_in);
      return data;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** A token that is valid for at least the next 30 seconds (used by the chat socket handshake). */
export async function getFreshToken(): Promise<string | null> {
  if (!accessToken || Date.now() > expiresAt - 30_000) await refreshSession();
  return accessToken;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

let onSessionLost: (() => void) | null = null;
export function setSessionLostHandler(fn: (() => void) | null) {
  onSessionLost = fn;
}

export async function api<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(withQuery(`/api${path}`, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    const renewed = await refreshSession();
    if (renewed) return api<T>(path, opts, true);
    onSessionLost?.();
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) throw parseErrorBody(res.status, body);
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
