import { NextRequest } from "next/server";
import { loginPlayer } from "@/lib/data";
import { redirectTo } from "@/lib/http";
import { setPlayerSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pseudo = String(formData.get("pseudo") ?? "");
    const secretCode = String(formData.get("secretCode") ?? "");
    const player = await loginPlayer(pseudo, secretCode);
    await setPlayerSession(player.id, player.pseudo);
    return redirectTo(request.url, "/", "Connexion réussie.", false);
  } catch (error) {
    return redirectTo(request.url, "/", (error as Error).message, true);
  }
}
