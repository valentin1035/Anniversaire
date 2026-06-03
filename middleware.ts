import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  allSessionCookieNames,
  readCookieTokenValue,
  sessionCookieBase,
  sessionCookiePaths
} from "@/lib/session-cookies";

/** Retire les cookies de session vides ou invalides côté navigateur. */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const expired = new Date(0);

  for (const name of allSessionCookieNames) {
    const value = readCookieTokenValue(request.cookies.get(name)?.value);
    if (value) {
      continue;
    }

    if (!request.cookies.has(name)) {
      continue;
    }

    for (const path of sessionCookiePaths) {
      response.cookies.set(name, "", {
        ...sessionCookieBase,
        path,
        expires: expired,
        maxAge: 0
      });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
