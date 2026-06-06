import type { Debile100LeaderboardRow } from "@/lib/debile100";

type Props = {
  isFinalized: boolean;
  leaderboard: Debile100LeaderboardRow[];
};

export function Debile100Leaderboard({ isFinalized, leaderboard }: Props) {
  if (leaderboard.length === 0) {
    return <p className="subtitle">Aucun participant pour le moment.</p>;
  }

  return (
    <div className="tableWrap">
      <table className="molkputeTable">
        <thead>
          <tr>
            <th>#</th>
            <th>Joueur</th>
            <th>Statut</th>
            <th>Survie</th>
            {isFinalized ? <th>Pts</th> : null}
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((row) => (
            <tr key={row.playerId}>
              <td>{row.rank}</td>
              <td>{row.pseudo}</td>
              <td>{row.status === "active" ? "En course" : "Éliminé"}</td>
              <td>
                {row.status === "active"
                  ? "Qualifié(e) jusqu'à la fin"
                  : row.eliminatedAtQuestion
                    ? `Éliminé(e) Q${row.eliminatedAtQuestion}`
                    : "—"}
              </td>
              {isFinalized ? <td>{row.eventPoints ?? "—"}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {isFinalized ? (
        <p className="subtitle molkputeHint">Points attribués (12 → 1).</p>
      ) : (
        <p className="subtitle molkputeHint">
          Classement provisoire — plus tu survives longtemps, mieux c&apos;est.
        </p>
      )}
    </div>
  );
}
