import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { normalizeQuestions, type Debile100Question } from "@/lib/debile100";
import {
  finalizeDebile100Ranking,
  reinstateDebile100Player,
  resetDebile100,
  revealDebile100Question,
  saveDebile100Questions,
  startDebile100Question
} from "@/lib/data";

type Payload = {
  eventId?: string;
  action?: "save-questions" | "start" | "reveal" | "reset" | "finalize" | "reinstate";
  questionIndex?: number;
  playerId?: string;
  questions?: Debile100Question[];
};

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = (await request.json()) as Payload;

    if (!payload.eventId || !payload.action) {
      return NextResponse.json({ error: "Payload incomplet." }, { status: 400 });
    }

    if (payload.action === "save-questions") {
      if (!payload.questions) {
        return NextResponse.json({ error: "Questions requises." }, { status: 400 });
      }
      await saveDebile100Questions(payload.eventId, normalizeQuestions(payload.questions));
    } else if (payload.action === "start") {
      if (!payload.questionIndex) {
        return NextResponse.json({ error: "Numéro de question requis." }, { status: 400 });
      }
      await startDebile100Question(payload.eventId, payload.questionIndex);
    } else if (payload.action === "reveal") {
      if (!payload.questionIndex) {
        return NextResponse.json({ error: "Numéro de question requis." }, { status: 400 });
      }
      await revealDebile100Question(payload.eventId, payload.questionIndex);
    } else if (payload.action === "reset") {
      await resetDebile100(payload.eventId);
    } else if (payload.action === "finalize") {
      await finalizeDebile100Ranking(payload.eventId);
    } else if (payload.action === "reinstate") {
      if (!payload.playerId) {
        return NextResponse.json({ error: "Joueur requis." }, { status: 400 });
      }
      await reinstateDebile100Player(payload.eventId, payload.playerId);
    } else {
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    }

    revalidatePath("/epreuves/4");
    revalidatePath("/admin/debile100");
    revalidatePath("/classement");
    revalidatePath("/");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
