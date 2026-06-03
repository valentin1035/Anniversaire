import { NextRequest } from "next/server";
import { applyClearPlayerCookies } from "@/lib/auth";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  const response = redirectTo(request.url, "/", "Déconnexion réussie.", false);
  applyClearPlayerCookies(response);
  return response;
}
