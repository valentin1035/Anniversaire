import { NextRequest } from "next/server";
import {
  applyAdminSessionCookies,
  createAdminSessionToken
} from "@/lib/auth";
import { env } from "@/lib/env";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  if (password !== env.adminPassword) {
    return redirectTo(request.url, "/admin", "Mot de passe admin invalide.", true);
  }

  const token = await createAdminSessionToken();
  const response = redirectTo(request.url, "/admin", "Connexion admin réussie.", false);
  applyAdminSessionCookies(response, token);
  return response;
}
