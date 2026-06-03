import type { NextResponse } from "next/server";

/** Cookie unique (évite 2 cookies admin+joueur en parallèle) */
export const sessionCookieName = "birthday_session";
/** Anciens noms — encore effacés à chaque connexion / déconnexion */
export const playerCookieName = "birthday_player_session";
export const adminCookieName = "birthday_admin_session";

export const allSessionCookieNames = [
  sessionCookieName,
  adminCookieName,
  playerCookieName
] as const;

export const sessionCookiePaths = ["/", "/admin"] as const;

export const sessionCookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production"
};

/** Évite `.trim()` sur une valeur de cookie absente ou non textuelle. */
export function readCookieTokenValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Supprime tous les cookies de session (ancien + nouveau format). Compatible Edge. */
export function applyClearAllSessionCookies(response: NextResponse) {
  const expired = new Date(0);

  for (const name of allSessionCookieNames) {
    for (const path of sessionCookiePaths) {
      response.cookies.delete({ name, path });
      response.cookies.set(name, "", {
        ...sessionCookieBase,
        path,
        expires: expired,
        maxAge: 0
      });
    }
  }
}

export function applyPlayerSessionCookies(response: NextResponse, token: string) {
  applyClearAllSessionCookies(response);
  response.cookies.set(sessionCookieName, token, {
    ...sessionCookieBase,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function applyAdminSessionCookies(response: NextResponse, token: string) {
  applyClearAllSessionCookies(response);
  response.cookies.set(sessionCookieName, token, {
    ...sessionCookieBase,
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export function applyClearAdminCookies(response: NextResponse) {
  applyClearAllSessionCookies(response);
}

export function applyClearPlayerCookies(response: NextResponse) {
  applyClearAllSessionCookies(response);
}
