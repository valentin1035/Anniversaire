import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { resetMolkputeMatch, setMolkputeMatchFinisher, submitMolkputeTurnPoints } from "@/lib/data";
import type { MolkputeTeamKey } from "@/lib/molkpute";

type Payload = {
  eventId?: string;
  action?: "submit-turn" | "set-finisher" | "reset-match";
  matchId?: string;
  teamKey?: MolkputeTeamKey;
  points?: number;
  finisherPlayerId?: string;
};

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = (await request.json()) as Payload;

    if (!payload.eventId || !payload.action || !payload.matchId) {
      return NextResponse.json({ error: "Payload incomplet." }, { status: 400 });
    }

    if (payload.action === "submit-turn") {
      if (!payload.teamKey || payload.points == null) {
        return NextResponse.json({ error: "Équipe et points requis." }, { status: 400 });
      }
      const points = Number(payload.points);
      if (!Number.isInteger(points) || points < 1) {
        return NextResponse.json({ error: "Nombre de points invalide." }, { status: 400 });
      }
      const result = await submitMolkputeTurnPoints(
        payload.eventId,
        null,
        payload.teamKey,
        payload.matchId,
        points
      );
      revalidatePath("/admin/molkpute");
      revalidatePath("/epreuves/2");
      return NextResponse.json({
        ok: true,
        overFiftyPenalty: result.overFiftyPenalty,
        needsFinisher: result.needsFinisher
      });
    }

    if (payload.action === "set-finisher") {
      if (!payload.teamKey || !payload.finisherPlayerId) {
        return NextResponse.json({ error: "Équipe et finisseur requis." }, { status: 400 });
      }
      await setMolkputeMatchFinisher(
        payload.eventId,
        null,
        payload.teamKey,
        payload.matchId,
        payload.finisherPlayerId
      );
    } else if (payload.action === "reset-match") {
      await resetMolkputeMatch(payload.eventId, payload.matchId);
    } else {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    revalidatePath("/admin/molkpute");
    revalidatePath("/epreuves/2");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
