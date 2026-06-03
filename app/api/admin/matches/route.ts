import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { createMatch, updateMatchWinner } from "@/lib/data";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const action = String(formData.get("action") ?? "create");

    if (action === "updateWinner") {
      const matchId = String(formData.get("matchId") ?? "");
      const winnerIdRaw = String(formData.get("winnerId") ?? "");
      const winnerId = winnerIdRaw.trim() === "" ? null : winnerIdRaw;
      await updateMatchWinner(matchId, winnerId);
      return redirectTo(request.url, "/admin", "Gagnant mis à jour.", false);
    }

    const eventId = String(formData.get("eventId") ?? "");
    const playerAId = String(formData.get("playerAId") ?? "");
    const playerBId = String(formData.get("playerBId") ?? "");
    const scheduledAt = String(formData.get("scheduledAt") ?? "");
    await createMatch(eventId, playerAId, playerBId, scheduledAt);
    return redirectTo(request.url, "/admin", "Match créé.", false);
  } catch (error) {
    return redirectTo(request.url, "/admin", (error as Error).message, true);
  }
}
