import { NextResponse } from "next/server";

export function redirectTo(requestUrl: string, path: string, message?: string, isError = false) {
  const url = new URL(path, requestUrl);
  if (message) {
    url.searchParams.set(isError ? "error" : "success", message);
  }
  return NextResponse.redirect(url, { status: 302 });
}
