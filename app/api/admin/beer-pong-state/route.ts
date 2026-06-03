import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { updateBeerPongWinner } from "@/lib/data";

type WinnerPayload = {
  eventId?: string;
  semi?: "semi1" | "semi2";
  winnerKey?: "A" | "B" | "C" | "D";
};

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = (await request.json()) as WinnerPayload;
    if (!payload.eventId || !payload.semi || !payload.winnerKey) {
      return NextResponse.json({ error: "Payload incomplet." }, { status: 400 });
    }

    await updateBeerPongWinner(payload.eventId, payload.semi, payload.winnerKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
