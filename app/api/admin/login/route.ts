import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { redirectTo } from "@/lib/http";
import { setAdminSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  if (password !== env.adminPassword) {
    return redirectTo(request.url, "/admin", "Mot de passe admin invalide.", true);
  }

  await setAdminSession();
  return redirectTo(request.url, "/admin", "Connexion admin réussie.", false);
}
