"use client";

import type { BeerPongTeam } from "@/lib/beer-pong";
import {
  buildIndividualTeamViews,
  computeGlobalPlayerRanks,
  computeTeamRankings,
  emptyIndividualTeamState,
  getNextPlaceToPick,
  getPlayerPlaceInTeam,
  type IndividualState,
  type TeamKey
} from "@/lib/beer-pong-ranking";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = {
  eventId: string;
  teams: BeerPongTeam[];
  canEdit: boolean;
  semi1Winner: "A" | "B" | null;
  semi2Winner: "C" | "D" | null;
  finalWinner: TeamKey | null;
  smallFinalWinner: TeamKey | null;
  initialIndividualState: IndividualState;
  initialValidatedAt: string | null;
};

const PLACE_LABELS: Record<1 | 2 | 3, string> = {
  1: "1er",
  2: "2e",
  3: "3e"
};

function teamHasPicks(state: IndividualState, teamKey: TeamKey): boolean {
  const team = state[teamKey];
  return Boolean(team?.firstPlaceId || team?.secondPlaceId || team?.thirdPlaceId);
}

function PlayerSlot({
  pseudo,
  place,
  canEdit,
  disabled,
  onSelect
}: {
  pseudo: string;
  place: 1 | 2 | 3 | null;
  canEdit: boolean;
  disabled: boolean;
  onSelect?: () => void;
}) {
  const placeClass = place ? `place${place}` : "";

  if (canEdit && onSelect) {
    return (
      <button
        type="button"
        disabled={disabled}
        className={`bracketTeamSlot individualPlayerSlot ${placeClass} ${place ? "selected" : ""}`}
        onClick={onSelect}
      >
        <span className="individualPlayerPseudo">{pseudo}</span>
        {place ? <span className="individualPlaceBadge">{PLACE_LABELS[place]}</span> : null}
      </button>
    );
  }

  return (
    <div
      className={`bracketTeamSlot readonly individualPlayerSlot ${placeClass} ${place ? "selected" : ""}`}
      aria-readonly="true"
    >
      <span className="individualPlayerPseudo">{pseudo}</span>
      {place ? <span className="individualPlaceBadge">{PLACE_LABELS[place]}</span> : null}
    </div>
  );
}

export function BeerPongIndividual({
  eventId,
  teams,
  canEdit,
  semi1Winner,
  semi2Winner,
  finalWinner,
  smallFinalWinner,
  initialIndividualState,
  initialValidatedAt
}: Props) {
  const router = useRouter();
  const [individualState, setIndividualState] = useState<IndividualState>(initialIndividualState);
  const [validatedAt, setValidatedAt] = useState<string | null>(initialValidatedAt);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isValidated = Boolean(validatedAt);

  useEffect(() => {
    setIndividualState(initialIndividualState);
    setValidatedAt(initialValidatedAt);
  }, [initialIndividualState, initialValidatedAt, semi1Winner, semi2Winner, finalWinner, smallFinalWinner]);

  const teamByKey = useMemo(() => new Map(teams.map((team) => [team.key as TeamKey, team])), [teams]);

  const teamRankRows = useMemo(() => {
    const rows = computeTeamRankings(semi1Winner, semi2Winner, finalWinner, smallFinalWinner);
    if (!rows) {
      return null;
    }
    return rows.map((row) => ({
      ...row,
      label: teamByKey.get(row.teamKey)?.label ?? row.teamKey
    }));
  }, [semi1Winner, semi2Winner, finalWinner, smallFinalWinner, teamByKey]);

  const teamViews = useMemo(() => buildIndividualTeamViews(teams, teamRankRows), [teams, teamRankRows]);

  const globalRanks = useMemo(
    () => computeGlobalPlayerRanks(teams, teamRankRows, individualState),
    [teams, teamRankRows, individualState]
  );

  const hasAnyIndividualPick = useMemo(
    () => (["A", "B", "C", "D"] as const).some((key) => teamHasPicks(individualState, key)),
    [individualState]
  );

  const slotDisabled = !canEdit || isSaving || isValidated;

  async function postAction(body: Record<string, unknown>) {
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

  async function savePlace(teamKey: TeamKey, place: 1 | 2 | 3, playerId: string) {
    if (!canEdit || isValidated) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);
    const previous = { ...individualState };

    const nextTeam = { ...(individualState[teamKey] ?? emptyIndividualTeamState()) };
    if (place === 1) {
      nextTeam.firstPlaceId = playerId;
      nextTeam.secondPlaceId = null;
      nextTeam.thirdPlaceId = null;
    } else if (place === 2) {
      nextTeam.secondPlaceId = playerId;
      nextTeam.thirdPlaceId = null;
    } else {
      nextTeam.thirdPlaceId = playerId;
    }
    setIndividualState({ ...individualState, [teamKey]: nextTeam });

    try {
      await postAction({ eventId, action: "individual", teamKey, place, playerId });
    } catch (error) {
      setIndividualState(previous);
      setSaveError((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function resetTeam(teamKey: TeamKey) {
    if (!canEdit || isValidated) {
      return;
    }
    if (!teamHasPicks(individualState, teamKey)) {
      return;
    }
    if (!window.confirm(`Réinitialiser le classement de ${teamByKey.get(teamKey)?.label ?? teamKey} ?`)) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    const previous = { ...individualState };

    const next = { ...individualState };
    delete next[teamKey];
    setIndividualState(next);

    try {
      await postAction({ eventId, action: "individual-reset", teamKey });
    } catch (error) {
      setIndividualState(previous);
      setSaveError((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function resetAll() {
    if (!canEdit || !hasAnyIndividualPick) {
      return;
    }
    if (
      !window.confirm(
        "Réinitialiser tout le classement individuel ? Les points déjà validés seront aussi effacés."
      )
    ) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);
    const previousState = { ...individualState };
    const previousValidated = validatedAt;

    setIndividualState({});
    setValidatedAt(null);

    try {
      await postAction({ eventId, action: "individual-reset" });
      router.refresh();
    } catch (error) {
      setIndividualState(previousState);
      setValidatedAt(previousValidated);
      setSaveError((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function validateScores() {
    if (!canEdit || !globalRanks) {
      return;
    }
    if (
      !window.confirm(
        "Valider le classement et attribuer les points au classement général ? (1er = 12 pts, 2e = 11 pts, …, 12e = 1 pt)"
      )
    ) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      await postAction({ eventId, action: "validate" });
      setValidatedAt(new Date().toISOString());
      router.refresh();
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  if (!teamRankRows) {
    return (
      <div className="individualFrame">
        <h3 className="bracketFrameTitle">Classement individuel</h3>
        <p className="subtitle">
          Choisis les gagnants de la <strong>finale</strong> et de la <strong>petite finale</strong> pour
          débloquer le classement individuel.
        </p>
      </div>
    );
  }

  return (
    <div className="individualFrame">
      <h3 className="bracketFrameTitle">Classement individuel</h3>
      <p className="subtitle bracketHint">
        Les 3 joueurs de chaque équipe s&apos;affrontent ensemble. Clique dans l&apos;ordre le{" "}
        <strong>1er</strong>, puis le <strong>2e</strong>, puis le <strong>3e</strong>. Valide ensuite pour
        créditer les points (12 → 1).
      </p>
      {isValidated ? (
        <p className="ok">Classement validé — points enregistrés dans le classement général.</p>
      ) : null}
      {isSaving ? <p className="subtitle">Enregistrement...</p> : null}
      {saveError ? <p className="error">{saveError}</p> : null}

      {canEdit && !isValidated && hasAnyIndividualPick ? (
        <div className="beerPongActions">
          <button type="button" className="beerPongBtnSecondary" disabled={isSaving} onClick={() => void resetAll()}>
            Réinitialiser tout
          </button>
        </div>
      ) : null}

      <div className="teamRankList">
        {teamRankRows.map((row) => (
          <div key={row.teamKey} className="teamRankItem">
            <span className="teamRankPlace">#{row.rank}</span>
            <span>{row.label}</span>
          </div>
        ))}
      </div>

      <div className="individualMatchesGrid">
        {teamViews.map((view) => {
          const state = individualState[view.teamKey] ?? emptyIndividualTeamState();
          const nextPlace = getNextPlaceToPick(state);
          const stepHint = isValidated
            ? "Classement figé"
            : nextPlace === null
              ? "Classement équipe terminé"
              : `Clique le ${PLACE_LABELS[nextPlace]} de l'équipe`;
          const showReset = canEdit && !isValidated && teamHasPicks(individualState, view.teamKey);

          return (
            <article key={view.teamKey} className="individualTeamCard">
              <div className="individualTeamCardHeader">
                <h4>
                  {view.teamLabel} — places {view.globalRankStart} à {view.globalRankStart + 2}
                </h4>
                {showReset ? (
                  <button
                    type="button"
                    className="beerPongBtnSecondary beerPongBtnSmall"
                    disabled={isSaving}
                    onClick={() => void resetTeam(view.teamKey)}
                  >
                    Réinitialiser
                  </button>
                ) : null}
              </div>
              <p className="individualStepHint">{stepHint}</p>

              <div className="individualTripleRow">
                {view.players.map((player, index) => {
                  const assignedPlace = getPlayerPlaceInTeam(state, player.id);
                  const isNextPick = !isValidated && nextPlace !== null && assignedPlace === null;
                  const disabled =
                    slotDisabled || !isNextPick || (assignedPlace !== null && assignedPlace !== nextPlace);

                  return (
                    <span key={player.id} className="individualTripleCell">
                      {index > 0 ? <span className="bracketVs">vs</span> : null}
                      <PlayerSlot
                        pseudo={player.pseudo}
                        place={assignedPlace}
                        canEdit={canEdit && !isValidated}
                        disabled={disabled}
                        onSelect={
                          isNextPick && nextPlace
                            ? () => void savePlace(view.teamKey, nextPlace, player.id)
                            : undefined
                        }
                      />
                    </span>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      {globalRanks ? (
        <div className="globalRankResult">
          <h4>Classement général individuel</h4>
          <ol>
            {globalRanks.map((row) => (
              <li key={row.playerId}>
                <strong>#{row.globalRank}</strong> {row.pseudo}
                <span className="individualPointsTag"> — {row.points} pts</span>
              </li>
            ))}
          </ol>

          {canEdit && !isValidated ? (
            <div className="beerPongActions beerPongActionsValidate">
              <button
                type="button"
                className="beerPongBtnPrimary"
                disabled={isSaving}
                onClick={() => void validateScores()}
              >
                Valider et attribuer les points
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="subtitle">Termine le classement des 4 équipes pour afficher le classement général.</p>
      )}
    </div>
  );
}
