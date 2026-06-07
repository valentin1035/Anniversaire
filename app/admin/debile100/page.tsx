import Link from "next/link";
import { redirect } from "next/navigation";
import { Debile100Admin } from "@/components/debile100-admin";
import { getAdminSession } from "@/lib/auth";
import { getEventByOrder } from "@/lib/data";
import { loadDebile100AdminView } from "@/lib/debile100-page";

export const dynamic = "force-dynamic";

export default async function AdminDebile100Page() {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    redirect("/admin");
  }

  const eventItem = await getEventByOrder(4);
  if (!eventItem) {
    redirect("/admin");
  }

  const view = await loadDebile100AdminView(eventItem.id);

  return (
    <main className="grid">
      <section className="card">
        <h1 className="title">😂 100% Débile — admin</h1>
        <p className="subtitle">
          14 questions — 2 s de synchro puis 30 s pour répondre. Indices (Q4–5), deuxième chance
          (Q6–9), Passe (Q10–11). Q12–14 sans aide. Affiche la réponse quand tu veux. Joueurs :{" "}
          <Link href="/epreuves/4">/epreuves/4</Link>.
        </p>
        <div className="beerPongActions">
          <Link href="/admin" className="beerPongBtnSecondary">
            ← Retour admin
          </Link>
          <Link href="/epreuves/4" className="beerPongBtnSecondary">
            Voir la page joueurs
          </Link>
        </div>
      </section>

      <section className="card">
        <Debile100Admin {...view} />
      </section>
    </main>
  );
}
