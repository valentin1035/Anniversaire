import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { applyClearAllSessionCookies } from "@/lib/session-cookies";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  const response = redirectTo(request.url, "/admin", "Déconnexion admin réussie.", false);
  applyClearAllSessionCookies(response);
  revalidatePath("/admin");
  revalidatePath("/admin/beer-pong");
  revalidatePath("/admin/molkpute");
  revalidatePath("/epreuves/1");
  revalidatePath("/epreuves/2");
  revalidatePath("/epreuves/3");
  revalidatePath("/admin/golf-debile");
  revalidatePath("/admin/debile100");
  revalidatePath("/epreuves/5");
  revalidatePath("/");
  return response;
}
