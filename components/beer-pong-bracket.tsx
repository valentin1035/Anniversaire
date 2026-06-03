"use client";

import { BeerPongIndividual } from "@/components/beer-pong-individual";
import type { BeerPongTeam } from "@/lib/beer-pong";
import {
  computeTeamRankings,
  type IndividualState,
  type TeamKey
} from "@/lib/beer-pong-ranking";
import { BeerPongSpectatorSync } from "@/components/beer-pong-spectator-sync";
import { useEffect, useMemo, useState } from "react";

type BeerPongBracketProps = {
  eventId: string;
  teams: BeerPongTeam[];
  hasRandomDraw: boolean;
  canEdit: boolean;
  initialSemi1Winner: "A" | "B" | null;
  initialSemi2Winner: "C" | "D" | null;
  initialFinalWinner: TeamKey | null;
  initialSmallFinalWinner: TeamKey | null;
  initialIndividualState: IndividualState;
  initialIndividualValidatedAt: string | null;
};

function TeamSlot({
  label,
  selected,
  canEdit,
  disabled,
  onSelect
}: {
  label: string;
  selected: boolean;
  canEdit: boolean;
  disabled: boolean;
  onSelect?: () => void;
}) {
  if (canEdit && onSelect) {
    return (
      <button
        type="button"
        disabled={disabled}
        className={`bracketTeamSlot ${selected ? "selected" : ""}`}
        onClick={onSelect}
      >
        {label}
      </button>
    );
  }
  return (
    <div className={`bracketTeamSlot readonly ${selected ? "selected" : ""}`} aria-readonly="true">
      {label}
    </div>
  );
}

export function BeerPongBracket({
  eventId,
  teams,
  hasRandomDraw,
  canEdit,
  initialSemi1Winner,
  initialSemi2Winner,
  initialFinalWinner,
  initialSmallFinalWinner,
  initialIndividualState,
  initialIndividualValidatedAt
}: BeerPongBracketProps) {
  const [semi1Winner, setSemi1Winner] = useState<"A" | "B" | null>(initialSemi1Winner);
  const [semi2Winner, setSemi2Winner] = useState<"C" | "D" | null>(initialSemi2Winner);
  const [finalWinner, setFinalWinner] = useState<TeamKey | null>(initialFinalWinner);
  const [smallFinalWinner, setSmallFinalWinner] = useState<TeamKey | null>(initialSmallFinalWinner);
  const [individualState, setIndividualState] = useState<IndividualState>(initialIndividualState);
  const [individualValidatedAt, setIndividualValidatedAt] = useState<string | null>(
    initialIndividualValidatedAt
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSemi1Winner(initialSemi1Winner);
    setSemi2Winner(initialSemi2Winner);
    setFinalWinner(initialFinalWinner);
    setSmallFinalWinner(initialSmallFinalWinner);
    setIndividualState(initialIndividualState);
    setIndividualValidatedAt(initialIndividualValidatedAt);
  }, [
    initialSemi1Winner,
    initialSemi2Winner,
    initialFinalWinner,
    initialSmallFinalWinner,
    initialIndividualState,
    initialIndividualValidatedAt
  ]);

  useEffect(() => {
    if (!canEdit) {
      setSaveError(null);
      setIsSaving(false);
    }
  }, [canEdit]);

  const teamsByKey = useMemo(() => new Map(teams.map((team) => [team.key, team])), [teams]);

  const teamRankPreview = useMemo(() => {
    const rows = computeTeamRankings(semi1Winner, semi2Winner, finalWinner, smallFinalWinner);
    if (!rows) {
      return null;
    }
    return rows.map((row) => ({
      ...row,
      label: teamsByKey.get(row.teamKey)?.label ?? row.teamKey
    }));
  }, [semi1Winner, semi2Winner, finalWinner, smallFinalWinner, teamsByKey]);

  const [teamA, teamB, teamC, teamD] = teams;
  if (!teamA || !teamB || !teamC || !teamD) {
    return <p className="subtitle">Le tableau n&apos;est pas prêt.</p>;
  }

  const semi1Loser: TeamKey | null =
    semi1Winner === "A" ? "B" : semi1Winner === "B" ? "A" : null;
  const semi2Loser: TeamKey | null =
    semi2Winner === "C" ? "D" : semi2Winner === "D" ? "C" : null;

  const finalTeam1 = semi1Winner
    ? (teamsByKey.get(semi1Winner)?.label ?? "—")
    : "Gagnant DF1";
  const finalTeam2 = semi2Winner
    ? (teamsByKey.get(semi2Winner)?.label ?? "—")
    : "Gagnant DF2";
  const smallFinalTeam1 = semi1Loser
    ? (teamsByKey.get(semi1Loser)?.label ?? "—")
    : "Perdant DF1";
  const smallFinalTeam2 = semi2Loser
    ? (teamsByKey.get(semi2Loser)?.label ?? "—")
    : "Perdant DF2";

  const slotDisabled = !hasRandomDraw || isSaving;
  const finalsReady = Boolean(semi1Winner && semi2Winner);
  const smallReady = Boolean(semi1Loser && semi2Loser);

  async function postState(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/beer-pong-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Erreur de sauvegarde.");
    }
  }

  async function selectSemiWinner(
    semi: "semi1" | "semi2",
    winnerKey: "A" | "B" | "C" | "D"
  ) {
    if (!canEdit || !hasRandomDraw) {
      return;
    }
    if (semi === "semi1" && winnerKey !== "A" && winnerKey !== "B") {
      return;
    }
    if (semi === "semi2" && winnerKey !== "C" && winnerKey !== "D") {
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    const previous = {
      semi1: semi1Winner,
      semi2: semi2Winner,
      final: finalWinner,
      small: smallFinalWinner,
      individual: individualState
    };

    if (semi === "semi1") {
      setSemi1Winner(winnerKey as "A" | "B");
    } else {
      setSemi2Winner(winnerKey as "C" | "D");
    }
    setFinalWinner(null);
    setSmallFinalWinner(null);
    setIndividualState({});
    setIndividualValidatedAt(null);

    try {
      await postState({ eventId, action: "semi", semi, winnerKey });
    } catch (error) {
      setSemi1Winner(previous.semi1);
      setSemi2Winner(previous.semi2);
      setFinalWinner(previous.final);
      setSmallFinalWinner(previous.small);
      setIndividualState(previous.individual);
      setIndividualValidatedAt(initialIndividualValidatedAt);
      setSaveError((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function selectFinalWinner(winnerKey: TeamKey) {
    if (!canEdit || !finalsReady || !semi1Winner || !semi2Winner) {
      return;
    }
    if (winnerKey !== semi1Winner && winnerKey !== semi2Winner) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    const previous = { final: finalWinner, small: smallFinalWinner, individual: individualState };
    setFinalWinner(winnerKey);
    setIndividualState({});
    setIndividualValidatedAt(null);

    try {
      await postState({ eventId, action: "final", winnerKey });
    } catch (error) {
      setFinalWinner(previous.final);
      setSmallFinalWinner(previous.small);
      setIndividualState(previous.individual);
      setIndividualValidatedAt(initialIndividualValidatedAt);
      setSaveError((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function selectSmallFinalWinner(winnerKey: TeamKey) {
    if (!canEdit || !smallReady || !semi1Loser || !semi2Loser) {
      return;
    }
    if (winnerKey !== semi1Loser && winnerKey !== semi2Loser) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    const previous = { small: smallFinalWinner, individual: individualState };
    setSmallFinalWinner(winnerKey);
    setIndividualState({});
    setIndividualValidatedAt(null);

    try {
      await postState({ eventId, action: "small", winnerKey });
    } catch (error) {
      setSmallFinalWinner(previous.small);
      setIndividualState(previous.individual);
      setIndividualValidatedAt(initialIndividualValidatedAt);
      setSaveError((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="beerPongLayout">
      <BeerPongSpectatorSync enabled={!canEdit} />
      <div className="beerDrawBlock">
        <p className="subtitle">
          12 joueurs, 4 équipes de 3.{" "}
          {hasRandomDraw ? "Tirage effectué." : "Lance le tirage pour générer les équipes."}
        </p>

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
      </div>

      <div className="bracketFrame">
        <h3 className="bracketFrameTitle">Bracket</h3>
        {!canEdit ? (
          <p className="subtitle bracketHint">
            Mode spectateur — la page se met à jour automatiquement quand l&apos;organisateur valide les
            résultats.
          </p>
        ) : null}
        {isSaving ? <p className="subtitle">Enregistrement en cours...</p> : null}
        {saveError ? <p className="error">{saveError}</p> : null}

        <div className="bracketTree">
          <div className="bracketTreeMain">
            <div className="bracketColumn bracketColumnSemis">
              <div className="bracketMatch">
                <span className="bracketMatchLabel">Demi-finale 1</span>
                <TeamSlot
                  label={teamA.label}
                  selected={semi1Winner === "A"}
                  canEdit={canEdit}
                  disabled={slotDisabled}
                  onSelect={() => void selectSemiWinner("semi1", "A")}
                />
                <span className="bracketVs">vs</span>
                <TeamSlot
                  label={teamB.label}
                  selected={semi1Winner === "B"}
                  canEdit={canEdit}
                  disabled={slotDisabled}
                  onSelect={() => void selectSemiWinner("semi1", "B")}
                />
              </div>

              <div className="bracketMatch">
                <span className="bracketMatchLabel">Demi-finale 2</span>
                <TeamSlot
                  label={teamC.label}
                  selected={semi2Winner === "C"}
                  canEdit={canEdit}
                  disabled={slotDisabled}
                  onSelect={() => void selectSemiWinner("semi2", "C")}
                />
                <span className="bracketVs">vs</span>
                <TeamSlot
                  label={teamD.label}
                  selected={semi2Winner === "D"}
                  canEdit={canEdit}
                  disabled={slotDisabled}
                  onSelect={() => void selectSemiWinner("semi2", "D")}
                />
              </div>
            </div>

            <div className="bracketColumn bracketColumnLines" aria-hidden="true">
              <div className="bracketLinesSvg">
                <svg viewBox="0 0 56 200" preserveAspectRatio="none">
                  <path d="M 0 50 H 24 V 100 H 48" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M 0 150 H 24 V 100" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M 48 100 H 56" fill="none" stroke="currentColor" strokeWidth="2.5" />
                </svg>
              </div>
            </div>

            <div className="bracketColumn bracketColumnFinal">
              <div className="bracketMatch bracketMatchFinal">
                <span className="bracketMatchLabel">Finale</span>
                {finalsReady && semi1Winner && semi2Winner ? (
                  <>
                    <TeamSlot
                      label={finalTeam1}
                      selected={finalWinner === semi1Winner}
                      canEdit={canEdit}
                      disabled={slotDisabled}
                      onSelect={() => void selectFinalWinner(semi1Winner)}
                    />
                    <span className="bracketVs">vs</span>
                    <TeamSlot
                      label={finalTeam2}
                      selected={finalWinner === semi2Winner}
                      canEdit={canEdit}
                      disabled={slotDisabled}
                      onSelect={() => void selectFinalWinner(semi2Winner)}
                    />
                  </>
                ) : (
                  <>
                    <div className="bracketTeamSlot readonly">{finalTeam1}</div>
                    <span className="bracketVs">vs</span>
                    <div className="bracketTeamSlot readonly">{finalTeam2}</div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bracketSmallFinal">
            <div className="bracketMatch bracketMatchSmall">
              <span className="bracketMatchLabel">Petite finale</span>
              {smallReady && semi1Loser && semi2Loser ? (
                <>
                  <TeamSlot
                    label={smallFinalTeam1}
                    selected={smallFinalWinner === semi1Loser}
                    canEdit={canEdit}
                    disabled={slotDisabled}
                    onSelect={() => void selectSmallFinalWinner(semi1Loser)}
                  />
                  <span className="bracketVs">vs</span>
                  <TeamSlot
                    label={smallFinalTeam2}
                    selected={smallFinalWinner === semi2Loser}
                    canEdit={canEdit}
                    disabled={slotDisabled}
                    onSelect={() => void selectSmallFinalWinner(semi2Loser)}
                  />
                </>
              ) : (
                <>
                  <div className="bracketTeamSlot readonly">{smallFinalTeam1}</div>
                  <span className="bracketVs">vs</span>
                  <div className="bracketTeamSlot readonly">{smallFinalTeam2}</div>
                </>
              )}
            </div>
          </div>
        </div>

        {teamRankPreview ? (
          <div className="teamRankPreview">
            <h4>Classement équipes</h4>
            <ul>
              {teamRankPreview.map((row) => (
                <li key={row.teamKey}>
                  <strong>#{row.rank}</strong> — {row.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <BeerPongIndividual
        eventId={eventId}
        teams={teams}
        canEdit={canEdit}
        semi1Winner={semi1Winner}
        semi2Winner={semi2Winner}
        finalWinner={finalWinner}
        smallFinalWinner={smallFinalWinner}
        initialIndividualState={individualState}
        initialValidatedAt={individualValidatedAt}
      />
    </div>
  );
}
