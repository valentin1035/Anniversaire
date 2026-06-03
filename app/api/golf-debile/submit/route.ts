import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { submitGolfDebileScore } from "@/lib/data";

type Payload = {
  eventId?: string;
  course1?: number;
  course2?: number;
  course3?: number;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getPlayerSession();
    if (!session) {
      return NextResponse.json(
        { error: "Connecte-toi avec ton pseudo pour envoyer tes résultats." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as Payload;
    if (!payload.eventId) {
      return NextResponse.json({ error: "Épreuve introuvable." }, { status: 400 });
    }

    await submitGolfDebileScore(payload.eventId, session.playerId, {
      course1: Number(payload.course1),
      course2: Number(payload.course2),
      course3: Number(payload.course3)
    });

    revalidatePath("/epreuves/3");
    revalidatePath("/admin/golf-debile");
    revalidatePath("/classement");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
