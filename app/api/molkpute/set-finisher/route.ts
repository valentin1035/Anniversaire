import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { setMolkputeMatchFinisher } from "@/lib/data";

type Payload = {
  eventId?: string;
  matchId?: string;
  finisherPlayerId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getPlayerSession();
    if (!session) {
      return NextResponse.json(
        { error: "Connecte-toi avec ton pseudo pour valider." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as Payload;
    if (!payload.eventId || !payload.matchId || !payload.finisherPlayerId) {
      return NextResponse.json({ error: "Payload incomplet." }, { status: 400 });
    }

    await setMolkputeMatchFinisher(
      payload.eventId,
      session.playerId,
      null,
      payload.matchId,
      payload.finisherPlayerId
    );

    revalidatePath("/epreuves/2");
    revalidatePath("/admin/molkpute");
    revalidatePath("/classement");
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
