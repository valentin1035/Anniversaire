import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { submitDebile100Pass } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getPlayerSession();
    if (!session) {
      return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    }

    const body = (await request.json()) as { eventId?: string };
    if (!body.eventId) {
      return NextResponse.json({ error: "eventId requis." }, { status: 400 });
    }

    await submitDebile100Pass(body.eventId, session.playerId);
    revalidatePath("/epreuves/5");
    revalidatePath("/admin/debile100");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
