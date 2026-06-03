import { notFound } from "next/navigation";
import { BeerPongBracket } from "@/components/beer-pong-bracket";
import { MatchTable } from "@/components/match-table";
import { Debile100Quiz } from "@/components/debile100-quiz";
import { GolfDebileBoard } from "@/components/golf-debile-board";
import { MolkputePool } from "@/components/molkpute-pool";
import { RankingTable } from "@/components/ranking-table";
import { getPlayerSession } from "@/lib/auth";
import { loadBeerPongView } from "@/lib/beer-pong-page";
import { loadGolfDebileView } from "@/lib/golf-debile-page";
import { loadDebile100PlayerView } from "@/lib/debile100-page";
import {
  getEventByOrder,
  getEventMatches,
  getEventRanking
} from "@/lib/data";
import { getEventDisplayName } from "@/lib/event-labels";
import { findPlayerTeam } from "@/lib/molkpute";
import { loadMolkputeView } from "@/lib/molkpute-page";

type Props = {
  params: Promise<{ order: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

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

  const [matches, ranking] = await Promise.all([
    getEventMatches(eventItem.id),
    getEventRanking(eventItem.id)
  ]);
  const displayName = getEventDisplayName(eventItem.order_index, eventItem.name);
  const isBeerPong = eventItem.order_index === 1;
  const isMolkpute = eventItem.order_index === 2;
  const isGolfDebile = eventItem.order_index === 3;
  const isDebile100 = eventItem.order_index === 5;
  const success = typeof paramsQuery.success === "string" ? paramsQuery.success : undefined;
  const error = typeof paramsQuery.error === "string" ? paramsQuery.error : undefined;

  const needsPlayerSession = isMolkpute || isGolfDebile || isDebile100;

  const [beerPongView, molkputeView, playerSession] = await Promise.all([
    isBeerPong ? loadBeerPongView(eventItem.id) : Promise.resolve(null),
    isMolkpute ? loadMolkputeView(eventItem.id) : Promise.resolve(null),
    needsPlayerSession ? getPlayerSession() : Promise.resolve(null)
  ]);

  const golfDebileView = isGolfDebile
    ? await loadGolfDebileView(eventItem.id, playerSession?.playerId ?? null)
    : null;

  const debile100View = isDebile100
    ? await loadDebile100PlayerView(eventItem.id, playerSession?.playerId ?? null)
    : null;

  const playerTeamKey =
    molkputeView && playerSession
      ? findPlayerTeam(molkputeView.teams, playerSession.playerId)
      : null;

  return (
    <main className="grid">
      <section className="card">
        <h1 className="title">
          {isBeerPong ? "🍺 " : ""}
          {isMolkpute ? "🎯 " : ""}
          {isGolfDebile ? "⛳ " : ""}
          {isDebile100 ? "😂 " : ""}
          {displayName}
        </h1>
        <p className="subtitle">Affichage des duels et du classement de l&apos;épreuve.</p>
        {success ? <p className="ok">{success}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {isBeerPong && beerPongView ? (
        <section className="card">
          <h2>Beer Pong Géant</h2>
          <p className="subtitle bracketHint">
            Mode spectateur — le bracket se met à jour automatiquement.
          </p>
          <BeerPongBracket
            eventId={eventItem.id}
            teams={beerPongView.teams}
            hasRandomDraw={beerPongView.hasRandomDraw}
            canEdit={false}
            initialSemi1Winner={beerPongView.semi1WinnerKey}
            initialSemi2Winner={beerPongView.semi2WinnerKey}
            initialFinalWinner={beerPongView.finalWinnerKey}
            initialSmallFinalWinner={beerPongView.smallFinalWinnerKey}
            initialIndividualState={beerPongView.individualState}
            initialIndividualValidatedAt={beerPongView.individualValidatedAt}
          />
        </section>
      ) : null}

      {isMolkpute && molkputeView ? (
        <section className="card">
          <h2>Molkpute — poule de 6</h2>
          <p className="subtitle bracketHint">
            Tours alternés, saisie des points au lancer. La page se met à jour automatiquement.
          </p>
          <MolkputePool
            eventId={eventItem.id}
            teams={molkputeView.teams}
            matches={molkputeView.matches}
            standings={molkputeView.standings}
            playerFinishes={molkputeView.playerFinishes}
            hasDraw={molkputeView.hasDraw}
            playerTeamKey={playerTeamKey}
            playerPseudo={playerSession?.pseudo ?? null}
            spectatorSync
          />
        </section>
      ) : null}

      {isGolfDebile && golfDebileView ? (
        <section className="card">
          <h2>Golf Débile</h2>
          <GolfDebileBoard
            eventId={eventItem.id}
            courses={golfDebileView.courses}
            mySubmission={golfDebileView.mySubmission}
            submissionCount={golfDebileView.submissionCount}
            requiredCount={golfDebileView.requiredCount}
            isFinalized={golfDebileView.isFinalized}
            leaderboard={golfDebileView.leaderboard}
            playerPseudo={playerSession?.pseudo ?? null}
            spectatorSync
          />
        </section>
      ) : null}

      {isDebile100 && debile100View ? (
        <section className="card">
          <h2>100% Débile — quiz en direct</h2>
          <Debile100Quiz {...debile100View} playerPseudo={playerSession?.pseudo ?? null} />
        </section>
      ) : null}

      {!isBeerPong && !isMolkpute && !isGolfDebile && !isDebile100 ? (
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
