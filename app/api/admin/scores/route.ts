import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { addScore } from "@/lib/data";
import { redirectTo } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const eventId = String(formData.get("eventId") ?? "");
    const playerId = String(formData.get("playerId") ?? "");
    const pointsRaw = Number(formData.get("points") ?? "0");

    if (!Number.isInteger(pointsRaw)) {
      throw new Error("Les points doivent être un nombre entier.");
    }

    await addScore(eventId, playerId, pointsRaw);
    return redirectTo(request.url, "/admin", "Points ajoutés.", false);
  } catch (error) {
    return redirectTo(request.url, "/admin", (error as Error).message, true);
  }
}
