import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import {
  adminCookieName,
  allSessionCookieNames,
  applyAdminSessionCookies,
  applyClearAdminCookies,
  applyClearAllSessionCookies,
  applyClearPlayerCookies,
  applyPlayerSessionCookies,
  playerCookieName,
  sessionCookieBase,
  sessionCookieName,
  sessionCookiePaths,
  readCookieTokenValue
} from "@/lib/session-cookies";

export {
  adminCookieName,
  applyAdminSessionCookies,
  applyClearAdminCookies,
  applyClearAllSessionCookies,
  applyClearPlayerCookies,
  applyPlayerSessionCookies,
  playerCookieName,
  sessionCookieName
} from "@/lib/session-cookies";

const encoder = new TextEncoder();

export type PlayerSession = {
  role: "player";
  playerId: string;
  pseudo: string;
};

export type AdminSession = {
  role: "admin";
};

type SessionPayload = PlayerSession | AdminSession;

function getJwtSecret() {
  return encoder.encode(env.appSecret);
}

async function signPayload(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

async function verifyPayload<T>(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as T;
}

function readTokenFromStore(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  names: string[]
): string | null {
  for (const name of names) {
    const value = readCookieTokenValue(cookieStore.get(name)?.value);
    if (value) {
      return value;
    }
  }
  return null;
}

export function hashSecretCode(secretCode: string) {
  return createHash("sha256").update(secretCode).digest("hex");
}

export async function createPlayerSessionToken(playerId: string, pseudo: string) {
  return signPayload({
    role: "player",
    playerId,
    pseudo
  });
}

export async function createAdminSessionToken() {
  return signPayload({
    role: "admin"
  });
}

export async function clearAllSessions() {
  const cookieStore = await cookies();
  const expired = new Date(0);

  for (const name of allSessionCookieNames) {
    for (const path of sessionCookiePaths) {
      cookieStore.set(name, "", {
        ...sessionCookieBase,
        path,
        expires: expired,
        maxAge: 0
      });
    }
  }
}

export async function clearAdminSession() {
  await clearAllSessions();
}

export async function clearPlayerSession() {
  await clearAllSessions();
}

async function readSessionPayload(names: string[]): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = readTokenFromStore(cookieStore, names);

  if (!token) {
    return null;
  }

  try {
    return await verifyPayload<SessionPayload>(token);
  } catch {
    return null;
  }
}

export async function getPlayerSession() {
  const payload = await readSessionPayload([sessionCookieName, playerCookieName]);
  if (!payload || payload.role !== "player") {
    return null;
  }
  return payload;
}

export async function getAdminSession() {
  const payload = await readSessionPayload([sessionCookieName, adminCookieName]);
  if (!payload || payload.role !== "admin") {
    return null;
  }
  return payload;
}

/** @deprecated Utiliser applyPlayerSessionCookies sur la NextResponse */
export async function setPlayerSession(playerId: string, pseudo: string) {
  await clearAllSessions();
  const token = await createPlayerSessionToken(playerId, pseudo);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    ...sessionCookieBase,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

/** @deprecated Utiliser applyAdminSessionCookies sur la NextResponse */
export async function setAdminSession() {
  await clearAllSessions();
  const token = await createAdminSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    ...sessionCookieBase,
    path: "/",
    maxAge: 60 * 60 * 12
  });
}
