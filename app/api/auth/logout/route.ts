import { NextRequest } from "next/server";
import { clearPlayerSession } from "@/lib/auth";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  await clearPlayerSession();
  return redirectTo(request.url, "/", "Déconnexion réussie.", false);
}
