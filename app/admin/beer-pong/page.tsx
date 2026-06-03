import Link from "next/link";
import { redirect } from "next/navigation";
import { BeerPongBracket } from "@/components/beer-pong-bracket";
import { BeerPongDrawForm } from "@/components/beer-pong-draw-form";
import { getAdminSession } from "@/lib/auth";
import { loadBeerPongView } from "@/lib/beer-pong-page";
import { getEventByOrder } from "@/lib/data";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminBeerPongPage({ searchParams }: Props) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    redirect("/admin");
  }

  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  const eventItem = await getEventByOrder(1);
  if (!eventItem) {
    redirect("/admin");
  }

  const view = await loadBeerPongView(eventItem.id);

  return (
    <main className="grid">
      <section className="card">
        <h1 className="title">🍺 Beer Pong — gestion admin</h1>
        <p className="subtitle">
          Seul cet écran permet de modifier le tirage et le bracket. La page publique{" "}
          <Link href="/epreuves/1">/epreuves/1</Link> est en lecture seule pour tout le monde.
        </p>
        {success ? <p className="ok">{success}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="beerPongActions">
          <Link href="/admin" className="beerPongBtnSecondary">
            ← Retour panneau admin
          </Link>
          <Link href="/epreuves/1" className="beerPongBtnSecondary">
            Voir la page publique
          </Link>
        </div>
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="secondary">
            Se déconnecter (admin)
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Beer Pong Géant</h2>
        <BeerPongDrawForm action="/api/admin/beer-pong-draw" />
        <BeerPongBracket
          eventId={eventItem.id}
          teams={view.teams}
          hasRandomDraw={view.hasRandomDraw}
          canEdit
          initialSemi1Winner={view.semi1WinnerKey}
          initialSemi2Winner={view.semi2WinnerKey}
          initialFinalWinner={view.finalWinnerKey}
          initialSmallFinalWinner={view.smallFinalWinnerKey}
          initialIndividualState={view.individualState}
          initialIndividualValidatedAt={view.individualValidatedAt}
        />
      </section>
    </main>
  );
}
