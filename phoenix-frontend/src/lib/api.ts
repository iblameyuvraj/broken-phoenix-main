import { clearCache, getCached, setCached } from "./cache";

// NEXT_PUBLIC_* variables are inlined at build time.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const TOKEN_KEY = "phoenix.token";

let token: string | null = null;
let tokenLoaded = false;

function readStoredToken(): string | null {
  // The server has no window: touching localStorage during SSR/prerender crashes the build.
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getToken(): string | null {
  if (!tokenLoaded) {
    token = readStoredToken();
    tokenLoaded = true;
  }
  return token;
}

export function setToken(value: string | null) {
  token = value;
  tokenLoaded = true;
  if (typeof window !== "undefined") {
    if (value) window.localStorage.setItem(TOKEN_KEY, value);
    else window.localStorage.removeItem(TOKEN_KEY);
  }
  // Never let the next user see the previous user's cached data.
  clearCache();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: boolean;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  // The token is part of the key: two sessions never share a cache entry.
  const cacheKey = `${getToken() ?? "anonymous"}:${path}`;
  if (method === "GET" && opts.cache) {
    const hit = getCached<T>(cacheKey);
    if (hit !== undefined) return hit;
  }

  const currentToken = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: opts.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Check your connection.");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }

  const data = (await res.json()) as T;
  if (method === "GET") {
    if (opts.cache) setCached(cacheKey, data);
  } else {
    // Any write can change what a GET would return.
    clearCache();
  }
  return data;
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return err.message;
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 402) return "Not enough credits. Ask the workspace owner to top up.";
    if (err.status === 403) return "You don't have permission to do that.";
    if (err.status === 404) return "Not found (or you don't have access).";
    if (err.status >= 500) return "Server error. Please try again.";
    return err.message;
  }
  return "Unexpected error.";
}
