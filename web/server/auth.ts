import "server-only";
// Sign-In with Ethereum (EIP-4361) and an HMAC-signed session cookie.
// Signing in never moves funds or costs gas; it proves control of a wallet to this server.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseSiweMessage } from "viem/siwe";
import { publicClient } from "@/lib/chain";
import { ACTIVE_NETWORK } from "@/lib/config";
import { db, now } from "./db";
import { clientIp, fail, rateLimit } from "./http";

const COOKIE = "sehat_session";
const SESSION_SECONDS = 12 * 60 * 60;
const NONCE_SECONDS = 10 * 60;

function secret(): Buffer {
  const env = process.env.SEHAT_SESSION_SECRET;
  if (env && env.length >= 32) return Buffer.from(env);
  if (process.env.NODE_ENV === "production") throw new Error("SEHAT_SESSION_SECRET (32+ characters) is required in production.");
  // Development: a random secret kept under .data/ so sessions survive restarts.
  const file = path.join(process.cwd(), ".data", "session-secret");
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, randomBytes(48).toString("hex"), { mode: 0o600 });
  }
  return Buffer.from(readFileSync(file, "utf8"));
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export async function issueNonce(req: Request): Promise<string> {
  await rateLimit(`nonce:${clientIp(req)}`, 30, 10 * 60);
  const nonce = randomBytes(16).toString("hex");
  await (await db()).run("INSERT INTO nonces(nonce, created_at) VALUES (?, ?)", nonce, now());
  await (await db()).run("DELETE FROM nonces WHERE created_at < ?", now() - 24 * 3600);
  return nonce;
}

/** Verifies a signed SIWE message for this site and returns the signer (lowercase). */
export async function verifySignIn(req: Request, message: string, signature: `0x${string}`): Promise<string> {
  await rateLimit(`signin:${clientIp(req)}`, 20, 10 * 60);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const fields = parseSiweMessage(message);
  if (!fields.address || !fields.nonce || !fields.domain) fail(400, "The sign-in message is incomplete.");
  if (fields.domain !== host) fail(400, "The sign-in message is for a different site.");
  if (fields.chainId !== ACTIVE_NETWORK.chainId) fail(400, `Sign in on ${ACTIVE_NETWORK.name} (chain ${ACTIVE_NETWORK.chainId}).`);
  const issued = fields.issuedAt ? Math.floor(fields.issuedAt.getTime() / 1000) : 0;
  if (Math.abs(now() - issued) > NONCE_SECONDS) fail(400, "The sign-in message has expired. Try again.");

  const row = await (await db()).get("SELECT created_at, used FROM nonces WHERE nonce = ?", fields.nonce!) as { created_at: number; used: number } | undefined;
  if (!row || row.used || now() - row.created_at > NONCE_SECONDS) fail(400, "The sign-in request has expired. Try again.");

  // Works for ordinary wallets and smart-contract wallets (ERC-1271 / ERC-6492).
  const ok = await publicClient.verifySiweMessage({ message, signature, domain: host, nonce: fields.nonce });
  if (!ok) fail(401, "The signature does not match the wallet.");

  await (await db()).run("UPDATE nonces SET used = 1 WHERE nonce = ?", fields.nonce!);
  return fields.address!.toLowerCase();
}

export function sessionCookie(req: Request, address: string): string {
  const payload = b64(JSON.stringify({ a: address.toLowerCase(), e: now() + SESSION_SECONDS }));
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

/** The signed-in wallet (lowercase), or null. */
export function session(req: Request): string | null {
  const raw = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return walletFromCookie(raw);
}

/** Session for server components and pages (reads the request cookies). */
export async function sessionFromCookies(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  return walletFromCookie((await cookies()).get(COOKIE)?.value);
}

function walletFromCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { a, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { a: string; e: number };
    return e > now() && /^0x[0-9a-f]{40}$/.test(a) ? a : null;
  } catch {
    return null;
  }
}

export function requireSession(req: Request): string {
  const who = session(req);
  if (!who) fail(401, "Sign in with your wallet first.");
  return who!;
}
