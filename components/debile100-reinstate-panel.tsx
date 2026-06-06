"use client";

type EliminatedPlayer = {
  playerId: string;
  pseudo: string;
  eliminatedAtQuestion: number | null;
};

type Props = {
  eliminatedPlayers: EliminatedPlayer[];
  isFinalized: boolean;
  pending: boolean;
  onReinstate: (playerId: string, pseudo: string) => void;
};

export function Debile100ReinstatePanel({
  eliminatedPlayers,
  isFinalized,
  pending,
  onReinstate
}: Props) {
  if (isFinalized) {
    return (
      <p className="subtitle">
        Le classement est validé — remise en jeu impossible sans réinitialiser la partie.
      </p>
    );
  }

  if (eliminatedPlayers.length === 0) {
    return <p className="subtitle">Aucun joueur éliminé pour le moment.</p>;
  }

  return (
    <ul className="debile100ReinstateList">
      {eliminatedPlayers.map((player) => (
        <li key={player.playerId} className="debile100ReinstateRow">
          <div>
            <strong>{player.pseudo}</strong>
            <span className="subtitle debile100ReinstateMeta">
              {player.eliminatedAtQuestion
                ? `Éliminé(e) à la question ${player.eliminatedAtQuestion}`
                : "Éliminé(e)"}
            </span>
          </div>
          <button
            type="button"
            className="beerPongBtnSecondary"
            disabled={pending}
            onClick={() => onReinstate(player.playerId, player.pseudo)}
          >
            Remettre en jeu
          </button>
        </li>
      ))}
    </ul>
  );
}
