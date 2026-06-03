import Link from "next/link";
import { redirect } from "next/navigation";
import { GolfDebileBoard } from "@/components/golf-debile-board";
import { getAdminSession } from "@/lib/auth";
import { getEventByOrder } from "@/lib/data";
import { loadGolfDebileView } from "@/lib/golf-debile-page";

export const dynamic = "force-dynamic";

export default async function AdminGolfDebilePage() {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    redirect("/admin");
  }

  const eventItem = await getEventByOrder(3);
  if (!eventItem) {
    redirect("/admin");
  }

  const view = await loadGolfDebileView(eventItem.id, null);

  return (
    <main className="grid">
      <section className="card">
        <h1 className="title">⛳ Golf Débile — gestion admin</h1>
        <p className="subtitle">
          Suivi des envois et calcul des points. Page joueurs :{" "}
          <Link href="/epreuves/3">/epreuves/3</Link>
        </p>
        <div className="beerPongActions">
          <Link href="/admin" className="beerPongBtnSecondary">
            ← Retour panneau admin
          </Link>
        </div>
      </section>

      <section className="card">
        <GolfDebileBoard
          eventId={eventItem.id}
          courses={view.courses}
          mySubmission={null}
          submissionCount={view.submissionCount}
          requiredCount={view.requiredCount}
          isFinalized={view.isFinalized}
          leaderboard={view.leaderboard}
          playerPseudo={null}
          adminMode
        />
      </section>
    </main>
  );
}
