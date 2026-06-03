import Link from "next/link";
import { getAdminSession } from "@/lib/auth";
import { getAllMatches, getEvents, getPlayers } from "@/lib/data";
import { getEventDisplayName } from "@/lib/event-labels";

type AdminProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: AdminProps) {
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const adminSession = await getAdminSession();

  if (!adminSession) {
    return (
      <main className="grid">
        <section className="card">
          <h1 className="title">Accès administrateur</h1>
          <p className="subtitle">Connecte-toi avec le mot de passe admin pour gérer les scores.</p>
        </section>
        <section className="card">
          <form action="/api/admin/login" method="post" className="grid">
            <input required name="password" type="password" placeholder="Mot de passe admin" />
            <button type="submit">Se connecter</button>
          </form>
          {success ? <p className="ok">{success}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </section>
      </main>
    );
  }

  const [events, players, matches] = await Promise.all([getEvents(), getPlayers(), getAllMatches()]);

  return (
    <main className="grid" style={{ gap: 16 }}>
      <section className="card">
        <h1 className="title">Panneau admin</h1>
        <p className="subtitle">Ajoute des matchs, attribue des points et mets à jour les gagnants.</p>
        {success ? <p className="ok">{success}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <form action="/api/admin/logout" method="post">
          <button className="secondary" type="submit">
            Se déconnecter
          </button>
        </form>
        <p style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href="/admin/beer-pong" className="btnPrimary" style={{ display: "inline-block" }}>
            🍺 Gérer Beer Pong Géant
          </Link>
          <Link href="/admin/molkpute" className="btnPrimary" style={{ display: "inline-block" }}>
            🎯 Gérer Molkpute
          </Link>
          <Link href="/admin/golf-debile" className="btnPrimary" style={{ display: "inline-block" }}>
            ⛳ Gérer Golf Débile
          </Link>
          <Link href="/admin/debile100" className="btnPrimary" style={{ display: "inline-block" }}>
            😂 Gérer 100% Débile
          </Link>
        </p>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>Ajouter un match</h2>
          <form action="/api/admin/matches" method="post" className="grid">
            <select required name="eventId" defaultValue="">
              <option value="" disabled>
                Choisir une épreuve
              </option>
              {events.map((eventItem) => (
                <option value={eventItem.id} key={eventItem.id}>
                  {getEventDisplayName(eventItem.order_index, eventItem.name)}
                </option>
              ))}
            </select>

            <select required name="playerAId" defaultValue="">
              <option value="" disabled>
                Joueur A
              </option>
              {players.map((player) => (
                <option value={player.id} key={player.id}>
                  {player.pseudo}
                </option>
              ))}
            </select>

            <select required name="playerBId" defaultValue="">
              <option value="" disabled>
                Joueur B
              </option>
              {players.map((player) => (
                <option value={player.id} key={player.id}>
                  {player.pseudo}
                </option>
              ))}
            </select>

            <input name="scheduledAt" type="datetime-local" />
            <button type="submit">Créer le match</button>
          </form>
        </article>

        <article className="card">
          <h2>Ajouter des points</h2>
          <form action="/api/admin/scores" method="post" className="grid">
            <select required name="eventId" defaultValue="">
              <option value="" disabled>
                Choisir une épreuve
              </option>
              {events.map((eventItem) => (
                <option value={eventItem.id} key={eventItem.id}>
                  {getEventDisplayName(eventItem.order_index, eventItem.name)}
                </option>
              ))}
            </select>

            <select required name="playerId" defaultValue="">
              <option value="" disabled>
                Choisir un joueur
              </option>
              {players.map((player) => (
                <option value={player.id} key={player.id}>
                  {player.pseudo}
                </option>
              ))}
            </select>

            <input required name="points" type="number" min={-99} max={99} placeholder="Points (+/-)" />
            <button type="submit">Ajouter les points</button>
          </form>
        </article>
      </section>

      <section className="card">
        <h2>Mettre à jour les gagnants</h2>
        <div className="grid">
          {matches.length === 0 ? (
            <p className="subtitle">Aucun match créé.</p>
          ) : (
            matches.map((match) => (
              <form key={match.id} action="/api/admin/matches" method="post" className="row">
                <input type="hidden" name="action" value="updateWinner" />
                <input type="hidden" name="matchId" value={match.id} />
                <span className="badge">{match.event_name}</span>
                <span>
                  {match.player_a_pseudo} vs {match.player_b_pseudo}
                </span>
                <select name="winnerId" defaultValue={match.winner_id ?? ""}>
                  <option value="">Pas encore</option>
                  <option value={match.player_a_id}>{match.player_a_pseudo}</option>
                  <option value={match.player_b_id}>{match.player_b_pseudo}</option>
                </select>
                <button className="secondary" type="submit">
                  Enregistrer
                </button>
              </form>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
