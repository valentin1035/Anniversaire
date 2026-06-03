import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { finalizeGolfDebileRanking, resetGolfDebile } from "@/lib/data";

type Payload = {
  eventId?: string;
  action?: "reset" | "finalize";
};

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = (await request.json()) as Payload;

    if (!payload.eventId || !payload.action) {
      return NextResponse.json({ error: "Payload incomplet." }, { status: 400 });
    }

    if (payload.action === "reset") {
      await resetGolfDebile(payload.eventId);
    } else if (payload.action === "finalize") {
      await finalizeGolfDebileRanking(payload.eventId);
    } else {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    revalidatePath("/epreuves/3");
    revalidatePath("/admin/golf-debile");
    revalidatePath("/classement");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
