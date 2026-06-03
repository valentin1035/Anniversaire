import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { shuffleArray } from "@/lib/molkpute";
import { getEventByOrder, getPlayers, saveMolkputeDraw } from "@/lib/data";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const players = await getPlayers();
    if (players.length < 12) {
      return redirectTo(
        request.url,
        "/admin/molkpute",
        `Il faut au minimum 12 joueurs (actuellement ${players.length}).`,
        true
      );
    }

    const shuffled = shuffleArray(players).slice(0, 12);
    const eventItem = await getEventByOrder(2);
    if (!eventItem) {
      throw new Error("L'épreuve Molkpute est introuvable.");
    }

    await saveMolkputeDraw(
      eventItem.id,
      shuffled.map((player) => player.id)
    );

    revalidatePath("/admin/molkpute");
    revalidatePath("/epreuves/2");

    return redirectTo(
      request.url,
      "/admin/molkpute",
      "Nouveau tirage effectué — 6 équipes de 2 et poule réinitialisée.",
      false
    );
  } catch (error) {
    return redirectTo(request.url, "/admin/molkpute", (error as Error).message, true);
  }
}
