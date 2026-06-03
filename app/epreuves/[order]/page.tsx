import { notFound } from "next/navigation";
import { BeerPongBracket } from "@/components/beer-pong-bracket";
import { MatchTable } from "@/components/match-table";
import { RankingTable } from "@/components/ranking-table";
import { getAdminSession } from "@/lib/auth";
import {
  buildBeerPongPlaceholderTeams,
  buildBeerPongTeamsFromPlayers
} from "@/lib/beer-pong";
import {
  getBeerPongState,
  getEventByOrder,
  getEventMatches,
  getEventRanking,
  getPlayers
} from "@/lib/data";
import { getEventDisplayName } from "@/lib/event-labels";

type Props = {
  params: Promise<{ order: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EpreuvePage({ params, searchParams }: Props) {
  const { order } = await params;
  const paramsQuery = (await searchParams) ?? {};
  const orderNumber = Number(order);
  if (!Number.isInteger(orderNumber) || orderNumber < 1 || orderNumber > 5) {
    notFound();
  }

  const eventItem = await getEventByOrder(orderNumber);
  if (!eventItem) {
    notFound();
  }

  const [matches, ranking, adminSession] = await Promise.all([
    getEventMatches(eventItem.id),
    getEventRanking(eventItem.id),
    getAdminSession()
  ]);
  const displayName = getEventDisplayName(eventItem.order_index, eventItem.name);
  const isBeerPong = eventItem.order_index === 1;
  const success = typeof paramsQuery.success === "string" ? paramsQuery.success : undefined;
  const error = typeof paramsQuery.error === "string" ? paramsQuery.error : undefined;

  let teams = buildBeerPongPlaceholderTeams();
  let hasRandomDraw = false;
  let semi1WinnerKey: "A" | "B" | null = null;
  let semi2WinnerKey: "C" | "D" | null = null;
  if (isBeerPong) {
    const beerPongState = await getBeerPongState(eventItem.id);
    const drawIds = beerPongState?.draw_player_ids ?? [];
    if (drawIds.length === 12) {
      const players = await getPlayers();
      const playersById = new Map(players.map((player) => [player.id, player]));
      const selectedPlayers = drawIds
        .map((id) => playersById.get(id))
        .filter((player): player is NonNullable<typeof player> => Boolean(player));
      if (selectedPlayers.length === 12) {
        teams = buildBeerPongTeamsFromPlayers(selectedPlayers);
        hasRandomDraw = true;
        semi1WinnerKey = beerPongState?.semi1_winner_key ?? null;
        semi2WinnerKey = beerPongState?.semi2_winner_key ?? null;
      }
    }
  }

  return (
    <main className="grid">
      <section className="card">
        <h1 className="title">
          {isBeerPong ? "🍺 " : ""}
          {displayName}
        </h1>
        <p className="subtitle">Affichage des duels et du classement de l&apos;épreuve.</p>
        {success ? <p className="ok">{success}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {isBeerPong ? (
        <section className="card">
          <h2>Tableau Beer Pong Géant</h2>
          {adminSession ? (
            <form action="/api/admin/beer-pong-draw" method="post" style={{ marginBottom: 14 }}>
              <button type="submit">Tirage aléatoire des 12 participants</button>
            </form>
          ) : (
            <p className="subtitle">Connecte-toi en admin pour lancer le tirage aléatoire.</p>
          )}
          <BeerPongBracket
            eventId={eventItem.id}
            teams={teams}
            hasRandomDraw={hasRandomDraw}
            canEdit={Boolean(adminSession)}
            initialSemi1Winner={semi1WinnerKey}
            initialSemi2Winner={semi2WinnerKey}
          />
        </section>
      ) : null}

      {!isBeerPong ? (
        <section className="card">
          <h2>Matchs</h2>
          {matches.length === 0 ? <p className="subtitle">Aucun match planifié.</p> : <MatchTable matches={matches} />}
        </section>
      ) : null}

      <section className="card">
        <h2>Classement de l&apos;épreuve</h2>
        <RankingTable rows={ranking} />
      </section>
    </main>
  );
}
