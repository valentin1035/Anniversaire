import { NextRequest, NextResponse } from "next/server";
import { getPlayerSession } from "@/lib/auth";
import { buildDebile100SyncPayload } from "@/lib/debile100-sync";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json({ error: "eventId requis." }, { status: 400 });
    }

    const session = await getPlayerSession();
    const payload = await buildDebile100SyncPayload(eventId, session?.playerId ?? null);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
