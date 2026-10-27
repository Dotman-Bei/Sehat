import "server-only";
import { db, now } from "./db";

/** An error whose message is safe to show to the caller. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const fail = (status: number, message: string): never => {
  throw new ApiError(status, message);
};

const NO_STORE = { "Cache-Control": "private, no-store" };

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, { ...init, headers: { ...NO_STORE, ...(init.headers ?? {}) } });
}

/**
 * Wraps a route handler: maps ApiError to its status, hides everything else.
 * Never logs request bodies or report contents; only the route and the error class.
 */
export function handle<A extends unknown[]>(fn: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") checkOrigin(req);
      return await fn(req, ...rest);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message }, { status: e.status });
      console.error(`[api] ${req.method} ${new URL(req.url).pathname} failed:`, (e as Error)?.name ?? "Error");
      return json({ error: "Something went wrong on the server." }, { status: 500 });
    }
  };
}

/** Writes must come from this site: refuses cross-site requests that ride on the session cookie. */
function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) fail(403, "Missing origin.");
  if (new URL(origin!).host !== host) fail(403, "Cross-site request refused.");
}

export async function readJson<T>(req: Request, maxBytes = 64 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) fail(413, "Request too large.");
  try {
    return JSON.parse(text) as T;
  } catch {
    return fail(400, "Expected a JSON body.");
  }
}

/** Fixed-window rate limit stored in the database. */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const d = await db();
  const t = now();
  const row = (await d.get("SELECT window_start, count FROM rate WHERE key = ?", key)) as { window_start: number; count: number } | undefined;
  if (!row || t - row.window_start >= windowSeconds) {
    (await d.run("INSERT INTO rate(key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1", key, t));
    return;
  }
  if (row.count >= limit) fail(429, "Too many requests. Try again later.");
  (await d.run("UPDATE rate SET count = count + 1 WHERE key = ?", key));
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

/** The reports API only runs when the build is configured for it (chain live + reports live). */
export function requireLive() {
  if (process.env.NEXT_PUBLIC_SEHAT_REPORTS !== "live" || !/^0x[0-9a-fA-F]{40}$/.test(process.env.NEXT_PUBLIC_SEHAT_ESCROW ?? "")) {
    fail(404, "The reports service is not enabled on this build.");
  }
}
