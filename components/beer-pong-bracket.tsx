 "use client";

import type { BeerPongTeam } from "@/lib/beer-pong";
import { useMemo, useState } from "react";

type BeerPongBracketProps = {
  eventId: string;
  teams: BeerPongTeam[];
  hasRandomDraw: boolean;
  canEdit: boolean;
  initialSemi1Winner: "A" | "B" | null;
  initialSemi2Winner: "C" | "D" | null;
};

export function BeerPongBracket({
  eventId,
  teams,
  hasRandomDraw,
  canEdit,
  initialSemi1Winner,
  initialSemi2Winner
}: BeerPongBracketProps) {
  const [semi1Winner, setSemi1Winner] = useState<"A" | "B" | null>(initialSemi1Winner);
  const [semi2Winner, setSemi2Winner] = useState<"C" | "D" | null>(initialSemi2Winner);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const teamsByKey = useMemo(() => new Map(teams.map((team) => [team.key, team])), [teams]);

  const [teamA, teamB, teamC, teamD] = teams;
  if (!teamA || !teamB || !teamC || !teamD) {
    return <p className="subtitle">Le tableau n&apos;est pas prêt.</p>;
  }

  const semi1Loser =
    semi1Winner === "A" ? "B" : semi1Winner === "B" ? "A" : null;
  const semi2Loser =
    semi2Winner === "C" ? "D" : semi2Winner === "D" ? "C" : null;

  const finalTeam1 = semi1Winner ? teamsByKey.get(semi1Winner)?.label ?? "Gagnant demi-finale 1" : "Gagnant demi-finale 1";
  const finalTeam2 = semi2Winner ? teamsByKey.get(semi2Winner)?.label ?? "Gagnant demi-finale 2" : "Gagnant demi-finale 2";
  const smallFinalTeam1 = semi1Loser ? teamsByKey.get(semi1Loser)?.label ?? "Perdant demi-finale 1" : "Perdant demi-finale 1";
  const smallFinalTeam2 = semi2Loser ? teamsByKey.get(semi2Loser)?.label ?? "Perdant demi-finale 2" : "Perdant demi-finale 2";

  async function selectWinner(semi: "semi1" | "semi2", winnerKey: "A" | "B" | "C" | "D") {
    if (!canEdit || !hasRandomDraw) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    const previousSemi1 = semi1Winner;
    const previousSemi2 = semi2Winner;
    if (semi === "semi1" && (winnerKey === "A" || winnerKey === "B")) {
      setSemi1Winner(winnerKey);
    }
    if (semi === "semi2" && (winnerKey === "C" || winnerKey === "D")) {
      setSemi2Winner(winnerKey);
    }

    try {
      const response = await fetch("/api/admin/beer-pong-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          eventId,
          semi,
          winnerKey
        })
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erreur de sauvegarde.");
      }
    } catch (error) {
      setSemi1Winner(previousSemi1);
      setSemi2Winner(previousSemi2);
      setSaveError((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <p className="subtitle">
        Format prévu: 12 joueurs, 4 équipes de 3. {hasRandomDraw ? "Tirage effectué." : "Aucun tirage effectué pour le moment."}
      </p>
      {!canEdit ? <p className="subtitle">Mode spectateur: seul l&apos;admin peut sélectionner les gagnants.</p> : null}
      {isSaving ? <p className="subtitle">Enregistrement en cours...</p> : null}
      {saveError ? <p className="error">{saveError}</p> : null}

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Équipe</th>
              <th>Joueur 1</th>
              <th>Joueur 2</th>
              <th>Joueur 3</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.key}>
                <td>{team.label}</td>
                <td>{team.players[0]}</td>
                <td>{team.players[1]}</td>
                <td>{team.players[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="beerBracket">
        <div className="beerBracketRound">
          <h3>Demi-finales</h3>
          <div className="beerBracketMatch">
            {canEdit ? (
              <>
                <button
                  type="button"
                  disabled={!hasRandomDraw || isSaving}
                  className={`beerBracketTeamButton ${semi1Winner === "A" ? "selected" : ""}`}
                  onClick={() => void selectWinner("semi1", "A")}
                >
                  {teamA.label}
                </button>
                <button
                  type="button"
                  disabled={!hasRandomDraw || isSaving}
                  className={`beerBracketTeamButton ${semi1Winner === "B" ? "selected" : ""}`}
                  onClick={() => void selectWinner("semi1", "B")}
                >
                  {teamB.label}
                </button>
              </>
            ) : (
              <>
                <div className={semi1Winner === "A" ? "beerBracketStaticTeam selected" : "beerBracketStaticTeam"}>
                  {teamA.label}
                </div>
                <div className={semi1Winner === "B" ? "beerBracketStaticTeam selected" : "beerBracketStaticTeam"}>
                  {teamB.label}
                </div>
              </>
            )}
          </div>
          <div className="beerBracketMatch">
            {canEdit ? (
              <>
                <button
                  type="button"
                  disabled={!hasRandomDraw || isSaving}
                  className={`beerBracketTeamButton ${semi2Winner === "C" ? "selected" : ""}`}
                  onClick={() => void selectWinner("semi2", "C")}
                >
                  {teamC.label}
                </button>
                <button
                  type="button"
                  disabled={!hasRandomDraw || isSaving}
                  className={`beerBracketTeamButton ${semi2Winner === "D" ? "selected" : ""}`}
                  onClick={() => void selectWinner("semi2", "D")}
                >
                  {teamD.label}
                </button>
              </>
            ) : (
              <>
                <div className={semi2Winner === "C" ? "beerBracketStaticTeam selected" : "beerBracketStaticTeam"}>
                  {teamC.label}
                </div>
                <div className={semi2Winner === "D" ? "beerBracketStaticTeam selected" : "beerBracketStaticTeam"}>
                  {teamD.label}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="beerBracketRound">
          <h3>Finales</h3>
          <div className="beerBracketMatch">
            <div>{finalTeam1}</div>
            <div>{finalTeam2}</div>
          </div>
          <div className="beerBracketMatch">
            <div>{smallFinalTeam1}</div>
            <div>{smallFinalTeam2}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
