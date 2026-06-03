import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import {
  resetBeerPongIndividual,
  updateBeerPongFinalWinner,
  updateBeerPongIndividualPlace,
  updateBeerPongWinner,
  validateBeerPongIndividual
} from "@/lib/data";

type WinnerPayload = {
  eventId?: string;
  action?: "semi" | "final" | "small" | "individual" | "individual-reset" | "validate";
  semi?: "semi1" | "semi2";
  winnerKey?: "A" | "B" | "C" | "D";
  teamKey?: "A" | "B" | "C" | "D";
  place?: 1 | 2 | 3;
  playerId?: string;
};

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = (await request.json()) as WinnerPayload;

    if (!payload.eventId || !payload.action) {
      return NextResponse.json({ error: "Payload incomplet." }, { status: 400 });
    }

    if (payload.action === "semi") {
      if (!payload.semi || !payload.winnerKey) {
        return NextResponse.json({ error: "Payload demi-finale incomplet." }, { status: 400 });
      }
      await updateBeerPongWinner(payload.eventId, payload.semi, payload.winnerKey);
    } else if (payload.action === "final" || payload.action === "small") {
      if (!payload.winnerKey) {
        return NextResponse.json({ error: "Gagnant requis." }, { status: 400 });
      }
      await updateBeerPongFinalWinner(payload.eventId, payload.action, payload.winnerKey);
    } else if (payload.action === "individual") {
      if (!payload.teamKey || !payload.place || !payload.playerId) {
        return NextResponse.json({ error: "Payload individuel incomplet." }, { status: 400 });
      }
      await updateBeerPongIndividualPlace(
        payload.eventId,
        payload.teamKey,
        payload.place,
        payload.playerId
      );
    } else if (payload.action === "individual-reset") {
      await resetBeerPongIndividual(payload.eventId, payload.teamKey);
    } else if (payload.action === "validate") {
      await validateBeerPongIndividual(payload.eventId);
    } else {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
