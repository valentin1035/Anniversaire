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
        "/epreuves/1",
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
    return redirectTo(request.url, "/epreuves/1", "Tirage effectué.", false);
  } catch (error) {
    return redirectTo(request.url, "/epreuves/1", (error as Error).message, true);
  }
}
