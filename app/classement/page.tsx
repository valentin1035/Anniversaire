import { RankingTable } from "@/components/ranking-table";
import { getGlobalRanking } from "@/lib/data";

export default async function ClassementPage() {
  const ranking = await getGlobalRanking();

  return (
    <main className="grid">
      <section className="card">
        <h1 className="title">Classement global</h1>
        <p className="subtitle">Somme des points sur les 5 épreuves.</p>
      </section>
      <section className="card">
        {ranking.length === 0 ? (
          <p className="subtitle">Aucun score pour le moment.</p>
        ) : (
          <RankingTable rows={ranking} />
        )}
      </section>
    </main>
  );
}
