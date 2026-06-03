import { NextRequest } from "next/server";
import {
  applyPlayerSessionCookies,
  createPlayerSessionToken
} from "@/lib/auth";
import { loginPlayer } from "@/lib/data";
import { readFormText } from "@/lib/form-fields";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pseudo = readFormText(formData, "pseudo");
    const player = await loginPlayer(pseudo);
    const token = await createPlayerSessionToken(player.id, player.pseudo);
    const response = redirectTo(request.url, "/", "Connexion réussie.", false);
    applyPlayerSessionCookies(response, token);
    return response;
  } catch (error) {
    return redirectTo(request.url, "/", (error as Error).message, true);
  }
}
