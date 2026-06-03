import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { submitMolkputeTurnPoints } from "@/lib/data";

type Payload = {
  eventId?: string;
  matchId?: string;
  points?: number;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getPlayerSession();
    if (!session) {
      return NextResponse.json(
        { error: "Connecte-toi avec ton pseudo pour jouer." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as Payload;
    if (!payload.eventId || !payload.matchId || payload.points == null) {
      return NextResponse.json({ error: "Payload incomplet." }, { status: 400 });
    }

    const points = Number(payload.points);
    if (!Number.isInteger(points) || points < 1) {
      return NextResponse.json({ error: "Nombre de points invalide." }, { status: 400 });
    }

    const result = await submitMolkputeTurnPoints(
      payload.eventId,
      session.playerId,
      null,
      payload.matchId,
      points
    );

    revalidatePath("/epreuves/2");
    revalidatePath("/admin/molkpute");

    return NextResponse.json({
      ok: true,
      overFiftyPenalty: result.overFiftyPenalty,
      needsFinisher: result.needsFinisher
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
