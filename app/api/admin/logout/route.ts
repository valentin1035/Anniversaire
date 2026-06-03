import { NextRequest } from "next/server";
import { clearAdminSession } from "@/lib/auth";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  await clearAdminSession();
  return redirectTo(request.url, "/admin", "Déconnexion admin réussie.", false);
}
