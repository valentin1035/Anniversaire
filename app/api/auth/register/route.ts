import { NextRequest } from "next/server";
import { setPlayerSession } from "@/lib/auth";
import { registerPlayer } from "@/lib/data";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pseudo = String(formData.get("pseudo") ?? "");
    const { player, secretCode } = await registerPlayer(pseudo);
    await setPlayerSession(player.id, player.pseudo);
    return redirectTo(
      request.url,
      "/",
      `Inscription OK. Ton code secret est ${secretCode} (à conserver).`,
      false
    );
  } catch (error) {
    return redirectTo(request.url, "/", (error as Error).message, true);
  }
}
