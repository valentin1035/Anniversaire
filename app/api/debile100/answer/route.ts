import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { submitDebile100Answer } from "@/lib/data";

type Payload = {
  eventId?: string;
  choiceId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getPlayerSession();
    if (!session) {
      return NextResponse.json(
        { error: "Connecte-toi pour répondre au quiz." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as Payload;
    if (!payload.eventId || !payload.choiceId) {
      return NextResponse.json({ error: "Payload incomplet." }, { status: 400 });
    }

    await submitDebile100Answer(payload.eventId, session.playerId, payload.choiceId);

    revalidatePath("/epreuves/4");
    revalidatePath("/admin/debile100");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
