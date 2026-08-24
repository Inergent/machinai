import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Signed-cookie sessions.
 *
 * No session store and no JWT library: the payload is small, we only need to
 * know it hasn't been tampered with, and a stateless cookie keeps the webhook
 * path free of any database dependency.
 *
 * Note this signs rather than encrypts. Everything in here is a GitHub login
 * and an expiry — readable by the holder, which is fine — so the only property
 * that matters is that it cannot be forged.
 */

const COOKIE = "machinai_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;

export interface Session {
  login: string;
  avatarUrl: string;
  /** Seconds since epoch. */
  exp: number;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function serialize(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function deserialize(raw: string | undefined): Session | null {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Session;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export async function currentSession(): Promise<Session | null> {
  // A missing AUTH_SECRET is a deployment error, not a signed-out user — but
  // treating it as signed-out is the safe direction to fail.
  try {
    const store = await cookies();
    return deserialize(store.get(COOKIE)?.value);
  } catch {
    return null;
  }
}

export function sessionCookie(session: Session) {
  return {
    name: COOKIE,
    value: serialize(session),
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_S,
  };
}

export const clearedCookie = {
  name: COOKIE,
  value: "",
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 0,
};

export const newState = () => randomBytes(16).toString("hex");

/**
 * Who is allowed in. A single-tenant allowlist for now; Phase 6 replaces it
 * with real accounts.
 */
export function isAllowed(login: string): boolean {
  const allowed = (process.env.MACHINAI_ALLOWED_LOGINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  // Empty allowlist means nobody, not everybody — a misconfigured deploy must
  // not become an open door.
  return allowed.includes(login.toLowerCase());
}

export function expiry(): number {
  return Math.floor(Date.now() / 1000) + MAX_AGE_S;
}
