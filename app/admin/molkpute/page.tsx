import Link from "next/link";
import { redirect } from "next/navigation";
import { MolkputeDrawForm } from "@/components/molkpute-draw-form";
import { MolkputePool } from "@/components/molkpute-pool";
import { getAdminSession } from "@/lib/auth";
import { getEventByOrder } from "@/lib/data";
import { loadMolkputeView } from "@/lib/molkpute-page";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminMolkputePage({ searchParams }: Props) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    redirect("/admin");
  }

  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  const eventItem = await getEventByOrder(2);
  if (!eventItem) {
    redirect("/admin");
  }

  const view = await loadMolkputeView(eventItem.id);

  return (
    <main className="grid">
      <section className="card">
        <h1 className="title">🎯 Molkpute — gestion admin</h1>
        <p className="subtitle">
          Tirage des équipes, suivi de la poule et correction des matchs. Les joueurs saisissent leurs
          points sur{" "}
          <Link href="/epreuves/2">/epreuves/2</Link> une fois connectés.
        </p>
        {success ? <p className="ok">{success}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="beerPongActions">
          <Link href="/admin" className="beerPongBtnSecondary">
            ← Retour panneau admin
          </Link>
          <Link href="/epreuves/2" className="beerPongBtnSecondary">
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
        <h2>Molkpute — poule de 6</h2>
        <MolkputeDrawForm action="/api/admin/molkpute-draw" />
        <MolkputePool
          eventId={eventItem.id}
          teams={view.teams}
          matches={view.matches}
          standings={view.standings}
          playerFinishes={view.playerFinishes}
          hasDraw={view.hasDraw}
          playerTeamKey={null}
          playerPseudo={null}
          adminMode
        />
      </section>
    </main>
  );
}
