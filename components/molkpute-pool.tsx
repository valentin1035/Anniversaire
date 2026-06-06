"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BeerPongSpectatorSync } from "@/components/beer-pong-spectator-sync";
import {
  MOLKPUTE_OVER_PENALTY_SCORE,
  MOLKPUTE_WIN_SCORE,
  getTeamFinishRanking,
  teamScore,
  type MolkputeLeaderboardRow,
  type MolkputeMatch,
  type MolkputePlayerFinishRow,
  type MolkputeStanding,
  type MolkputeTeam,
  type MolkputeTeamKey
} from "@/lib/molkpute";

type Props = {
  eventId: string;
  teams: MolkputeTeam[];
  matches: MolkputeMatch[];
  standings: MolkputeStanding[];
  playerFinishes: MolkputePlayerFinishRow[];
  hasDraw: boolean;
  playerTeamKey: MolkputeTeamKey | null;
  playerPseudo: string | null;
  isFinalized?: boolean;
  allMatchesCompleted?: boolean;
  leaderboard?: MolkputeLeaderboardRow[];
  adminMode?: boolean;
  spectatorSync?: boolean;
};

function teamLabel(teams: MolkputeTeam[], key: MolkputeTeamKey): string {
  const team = teams.find((entry) => entry.key === key);
  if (!team) {
    return `Équipe ${key}`;
  }
  return `${team.label} — ${team.players[0]} & ${team.players[1]}`;
}

function finishCountsMap(rows: MolkputePlayerFinishRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.playerId] = row.finishCount;
  }
  return map;
}

export function MolkputePool({
  eventId,
  teams,
  matches,
  standings,
  playerFinishes,
  hasDraw,
  playerTeamKey,
  playerPseudo,
  isFinalized = false,
  allMatchesCompleted = false,
  leaderboard = [],
  adminMode = false,
  spectatorSync = false
}: Props) {
  const router = useRouter();
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pointInputs, setPointInputs] = useState<Record<string, string>>({});
  const [penaltyPopup, setPenaltyPopup] = useState(false);

  const teamByKey = useMemo(() => new Map(teams.map((team) => [team.key, team])), [teams]);
  const finishCounts = useMemo(() => finishCountsMap(playerFinishes), [playerFinishes]);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return a.id.localeCompare(b.id);
    });
  }, [matches]);

  async function apiCall(body: Record<string, unknown>) {
    const endpoint = adminMode ? "/api/admin/molkpute-state" : "/api/molkpute/add-points";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as {
      error?: string;
      overFiftyPenalty?: boolean;
      needsFinisher?: boolean;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? "Erreur lors de l'enregistrement.");
    }
    return payload;
  }

  async function submitTurn(matchId: string, teamKey: MolkputeTeamKey) {
    const raw = pointInputs[matchId] ?? "";
    const points = Number(raw);
    if (!Number.isInteger(points) || points < 1) {
      setError("Entre un nombre entier de points (minimum 1).");
      return;
    }

    setError(null);
    setPendingMatchId(matchId);

    try {
      const payload = adminMode
        ? await apiCall({
            eventId,
            action: "submit-turn",
            matchId,
            teamKey,
            points
          })
        : await apiCall({ eventId, matchId, points });

      if (payload.overFiftyPenalty) {
        setPenaltyPopup(true);
      }
      setPointInputs((prev) => ({ ...prev, [matchId]: "" }));
      router.refresh();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setPendingMatchId(null);
    }
  }

  async function submitFinisher(
    matchId: string,
    teamKey: MolkputeTeamKey,
    finisherPlayerId: string
  ) {
    setError(null);
    setPendingMatchId(matchId);

    try {
      if (adminMode) {
        await fetch("/api/admin/molkpute-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            action: "set-finisher",
            matchId,
            teamKey,
            finisherPlayerId
          })
        }).then(async (response) => {
          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            throw new Error(payload.error ?? "Erreur.");
          }
        });
      } else {
        const response = await fetch("/api/molkpute/set-finisher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, matchId, finisherPlayerId })
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Erreur.");
        }
      }
      router.refresh();
    } catch (finisherError) {
      setError((finisherError as Error).message);
    } finally {
      setPendingMatchId(null);
    }
  }

  async function finalizeRanking() {
    if (
      !window.confirm(
        "Valider le classement individuel et attribuer les points (12 → 1) au classement global ?"
      )
    ) {
      return;
    }

    setError(null);
    setPendingMatchId("__finalize__");

    try {
      const response = await fetch("/api/admin/molkpute-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, action: "finalize" })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erreur lors de la validation.");
      }
      router.refresh();
    } catch (finalizeError) {
      setError((finalizeError as Error).message);
    } finally {
      setPendingMatchId(null);
    }
  }

  async function resetMatch(matchId: string) {
    if (!window.confirm("Réinitialiser ce match ? Scores, tours et finisseur seront effacés.")) {
      return;
    }

    setError(null);
    setPendingMatchId(matchId);

    try {
      const response = await fetch("/api/admin/molkpute-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, action: "reset-match", matchId })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erreur lors de la réinitialisation.");
      }
      router.refresh();
    } catch (resetError) {
      setError((resetError as Error).message);
    } finally {
      setPendingMatchId(null);
    }
  }

  function canPlayTeam(match: MolkputeMatch, teamKey: MolkputeTeamKey): boolean {
    if (match.completed || match.turnPhase !== "submit") {
      return false;
    }
    if (match.activeTeam !== teamKey) {
      return false;
    }
    if (adminMode) {
      return true;
    }
    return playerTeamKey === teamKey;
  }

  function canPickFinisher(match: MolkputeMatch, teamKey: MolkputeTeamKey): boolean {
    if (match.turnPhase !== "await-finisher" || match.pendingFinisherTeam !== teamKey) {
      return false;
    }
    if (adminMode) {
      return true;
    }
    return playerTeamKey === teamKey;
  }

  if (!hasDraw) {
    return (
      <p className="subtitle">
        Le tirage des équipes n&apos;a pas encore été effectué par l&apos;organisateur.
      </p>
    );
  }

  return (
    <div className="molkputeLayout">
      <BeerPongSpectatorSync enabled={spectatorSync} />

      {penaltyPopup ? (
        <div className="molkputeModalBackdrop" role="dialog" aria-modal="true">
          <div className="molkputeModal">
            <h3>Ça pue la merde ce move</h3>
            <p className="subtitle">
              Tu dépasses 50 points : ton score tombe à {MOLKPUTE_OVER_PENALTY_SCORE}, c&apos;est à
              l&apos;autre équipe de jouer.
            </p>
            <button type="button" className="btnPrimary" onClick={() => setPenaltyPopup(false)}>
              OK
            </button>
          </div>
        </div>
      ) : null}

      {!adminMode && !playerTeamKey ? (
        <p className="subtitle molkputeHint">
          Connecte-toi pour jouer à ton tour et désigner le finisseur quand ton équipe atteint 50.
        </p>
      ) : null}

      {!adminMode && playerTeamKey && playerPseudo ? (
        <p className="ok molkputeHint">
          Connecté : <strong>{playerPseudo}</strong> — {teamLabel(teams, playerTeamKey)}
        </p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <section className="molkputeStandings">
        <h3>Classement poule (victoires d&apos;équipe)</h3>
        <table className="molkputeTable">
          <thead>
            <tr>
              <th>#</th>
              <th>Équipe</th>
              <th>Joueurs</th>
              <th>V</th>
              <th>J</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.teamKey}
                className={playerTeamKey === row.teamKey ? "molkputeRowHighlight" : undefined}
              >
                <td>{row.rank}</td>
                <td>{row.label}</td>
                <td>{row.playersLabel}</td>
                <td>{row.wins}</td>
                <td>{row.played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="molkputeStandings">
        <h3>
          Classement individuel{" "}
          {isFinalized ? "(points attribués)" : "(provisoire — rang équipe puis finisseurs)"}
        </h3>
        {leaderboard.length > 0 ? (
          <div className="tableWrap">
            <table className="molkputeTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Joueur</th>
                  <th>Équipe</th>
                  <th>Fin.</th>
                  {isFinalized ? <th>Pts</th> : null}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.playerId}>
                    <td>{row.rank}</td>
                    <td>{row.pseudo}</td>
                    <td>
                      {row.teamRank}e ({row.teamKey})
                    </td>
                    <td>{row.finishCount}</td>
                    {isFinalized ? <td>{row.eventPoints ?? "—"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="subtitle">En attente du tirage.</p>
        )}
        {adminMode && allMatchesCompleted && !isFinalized ? (
          <button
            type="button"
            className="btnPrimary"
            disabled={pendingMatchId !== null}
            onClick={() => void finalizeRanking()}
          >
            Valider et attribuer les points
          </button>
        ) : null}
        {isFinalized ? (
          <p className="ok molkputeHint">Classement validé — points ajoutés au classement global.</p>
        ) : null}
      </section>

      <section className="molkputeStandings">
        <h3>Finisseurs (qui clôt le plus de parties à 50)</h3>
        <p className="subtitle molkputeHint">
          Dans chaque équipe, le joueur avec le plus de finitions est devant pour le classement
          interne.
        </p>
        <div className="molkputeTeamsList">
          {teams.map((team) => {
            const ranking = getTeamFinishRanking(teams, finishCounts, team.key);
            if (!ranking) {
              return null;
            }
            return (
              <article key={team.key} className="molkputeTeamCard">
                <h4>{team.label}</h4>
                <p>
                  1. {ranking.first.pseudo} ({ranking.first.finishCount}) — 2. {ranking.second.pseudo}{" "}
                  ({ranking.second.finishCount})
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="molkputeMatches">
        <h3>
          Matchs ({matches.filter((m) => m.completed).length}/{matches.length} terminés)
        </h3>
        <p className="subtitle molkputeHint">
          Une équipe commence au hasard. À ton tour : saisis tes points du lancer et valide. Premier
          à {MOLKPUTE_WIN_SCORE} gagne le match (+1 victoire poule) après avoir indiqué qui a fini.
        </p>

        <div className="molkputeMatchList">
          {sortedMatches.map((match) => {
            const teamA = teamByKey.get(match.teamA);
            const teamB = teamByKey.get(match.teamB);
            const busy = pendingMatchId === match.id;
            const activeLabel = match.activeTeam
              ? teamLabel(teams, match.activeTeam)
              : null;

            return (
              <article
                key={match.id}
                className={match.completed ? "molkputeMatchCard molkputeMatchDone" : "molkputeMatchCard"}
              >
                <header className="molkputeMatchHeader">
                  <span className="badge">{match.id}</span>
                  {match.completed && match.winner ? (
                    <span className="ok">
                      Victoire {teamLabel(teams, match.winner)}
                      {match.finisherPlayerId
                        ? ` — finisseur : ${
                            playerFinishes.find((r) => r.playerId === match.finisherPlayerId)
                              ?.pseudo ?? "?"
                          }`
                        : ""}
                    </span>
                  ) : match.turnPhase === "await-finisher" ? (
                    <span className="ok">50 pts — qui a fini ?</span>
                  ) : activeLabel ? (
                    <span className="subtitle">Au tour : {activeLabel}</span>
                  ) : (
                    <span className="subtitle">En cours</span>
                  )}
                  {!match.completed ? (
                    <span className="badge">
                      Départ : {teamLabel(teams, match.startingTeam)}
                    </span>
                  ) : null}
                </header>

                <div className="molkputeScoreboard">
                  <div className="molkputeScoreSide">
                    <strong>{teamA?.label ?? match.teamA}</strong>
                    <span className="molkputeScoreValue">{match.scoreA}</span>
                    <div
                      className="molkputeProgress"
                      style={{ width: `${(match.scoreA / MOLKPUTE_WIN_SCORE) * 100}%` }}
                    />
                  </div>
                  <span className="molkputeVs">VS</span>
                  <div className="molkputeScoreSide">
                    <strong>{teamB?.label ?? match.teamB}</strong>
                    <span className="molkputeScoreValue">{match.scoreB}</span>
                    <div
                      className="molkputeProgress"
                      style={{ width: `${(match.scoreB / MOLKPUTE_WIN_SCORE) * 100}%` }}
                    />
                  </div>
                </div>

                {match.turnPhase === "await-finisher" && match.pendingFinisherTeam ? (
                  <div className="molkputeFinisherPick">
                    <p className="molkputeScoringLabel">
                      Qui a terminé la partie pour {teamLabel(teams, match.pendingFinisherTeam)} ?
                    </p>
                    {canPickFinisher(match, match.pendingFinisherTeam) ? (
                      <div className="molkputeFinisherBtns">
                        {teamByKey.get(match.pendingFinisherTeam)?.playerIds.map((id, index) => (
                          <button
                            key={id}
                            type="button"
                            className="beerPongBtnPrimary"
                            disabled={busy}
                            onClick={() =>
                              submitFinisher(match.id, match.pendingFinisherTeam!, id)
                            }
                          >
                            {teamByKey.get(match.pendingFinisherTeam!)?.players[index]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="subtitle">En attente du choix de l&apos;équipe à 50 points.</p>
                    )}
                  </div>
                ) : null}

                {!match.completed && match.turnPhase === "submit" ? (
                  <div className="molkputeScoreActions">
                    {[match.teamA, match.teamB].map((teamKey) => {
                      const isActive = match.activeTeam === teamKey;
                      const canPlay = canPlayTeam(match, teamKey);

                      return (
                        <div
                          key={teamKey}
                          className={
                            isActive ? "molkputeTeamScoring molkputeTeamScoringActive" : "molkputeTeamScoring"
                          }
                        >
                          <p className="molkputeScoringLabel">{teamLabel(teams, teamKey)}</p>
                          {canPlay ? (
                            <div className="molkputeTurnForm">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                inputMode="numeric"
                                placeholder="Points du lancer"
                                value={pointInputs[match.id] ?? ""}
                                disabled={busy}
                                onChange={(event) =>
                                  setPointInputs((prev) => ({
                                    ...prev,
                                    [match.id]: event.target.value
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="beerPongBtnPrimary"
                                disabled={busy}
                                onClick={() => submitTurn(match.id, teamKey)}
                              >
                                Valider
                              </button>
                            </div>
                          ) : (
                            <p className="subtitle">
                              {isActive
                                ? "En attente de la saisie de cette équipe."
                                : `Score actuel : ${teamScore(match, teamKey)}`}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {adminMode ? (
                  <div className="molkputeAdminActions">
                    <button
                      type="button"
                      className="beerPongBtnSecondary beerPongBtnSmall"
                      disabled={busy}
                      onClick={() => resetMatch(match.id)}
                    >
                      Réinitialiser le match
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
