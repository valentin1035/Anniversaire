import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const playerCookieName = "birthday_player_session";
const adminCookieName = "birthday_admin_session";
const encoder = new TextEncoder();

type PlayerSession = {
  role: "player";
  playerId: string;
  pseudo: string;
};

type AdminSession = {
  role: "admin";
};

function getJwtSecret() {
  return encoder.encode(env.appSecret);
}

async function signPayload(payload: PlayerSession | AdminSession) {
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

export function hashSecretCode(secretCode: string) {
  return createHash("sha256").update(secretCode).digest("hex");
}

export function generateSecretCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function setPlayerSession(playerId: string, pseudo: string) {
  const token = await signPayload({
    role: "player",
    playerId,
    pseudo
  });

  const cookieStore = await cookies();
  cookieStore.set(playerCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function getPlayerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(playerCookieName)?.value;
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyPayload<PlayerSession>(token);
    if (payload.role !== "player") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function clearPlayerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(playerCookieName);
}

export async function setAdminSession() {
  const token = await signPayload({
    role: "admin"
  });

  const cookieStore = await cookies();
  cookieStore.set(adminCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(adminCookieName)?.value;
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyPayload<AdminSession>(token);
    if (payload.role !== "admin") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(adminCookieName, "", {
    path: "/",
    maxAge: 0
  });
  cookieStore.set(adminCookieName, "", {
    path: "/admin",
    maxAge: 0
  });
  cookieStore.delete({
    name: adminCookieName,
    path: "/"
  });
  cookieStore.delete({
    name: adminCookieName,
    path: "/admin"
  });
}
