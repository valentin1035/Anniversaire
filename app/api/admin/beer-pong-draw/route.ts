import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { shuffleArray } from "@/lib/beer-pong";
import { getEventByOrder, getPlayers, saveBeerPongDraw } from "@/lib/data";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const players = await getPlayers();
    if (players.length < 12) {
      return redirectTo(
        request.url,
        "/admin/beer-pong",
        `Il faut au minimum 12 joueurs (actuellement ${players.length}).`,
        true
      );
    }

    const shuffled = shuffleArray(players).slice(0, 12);
    const beerPongEvent = await getEventByOrder(1);
    if (!beerPongEvent) {
      throw new Error("L'épreuve Beer Pong est introuvable.");
    }

    await saveBeerPongDraw(
      beerPongEvent.id,
      shuffled.map((player) => player.id)
    );

    revalidatePath("/admin/beer-pong");
    revalidatePath("/epreuves/1");
    revalidatePath("/classement");
    revalidatePath("/");

    return redirectTo(
      request.url,
      "/admin/beer-pong",
      "Nouveau tirage effectué — bracket réinitialisé et points Beer Pong retirés du classement.",
      false
    );
  } catch (error) {
    return redirectTo(request.url, "/admin/beer-pong", (error as Error).message, true);
  }
}
