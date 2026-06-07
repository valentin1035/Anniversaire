import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { addPlayerBonusPoint } from "@/lib/data";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const playerId = String(formData.get("playerId") ?? "").trim();

    if (!playerId) {
      throw new Error("Joueur requis.");
    }

    await addPlayerBonusPoint(playerId);

    revalidatePath("/admin");
    revalidatePath("/classement");
    revalidatePath("/");

    return redirectTo(request.url, "/admin", "+1 pt bonus ajouté au classement global.", false);
  } catch (error) {
    return redirectTo(request.url, "/admin", (error as Error).message, true);
  }
}
