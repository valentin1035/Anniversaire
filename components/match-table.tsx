import type { MatchItem } from "@/lib/types";

export function MatchTable({ matches }: { matches: MatchItem[] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Match</th>
            <th>Adversaires</th>
            <th>Gagnant</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match, index) => (
            <tr key={match.id}>
              <td>M{index + 1}</td>
              <td>
                {match.player_a_pseudo} vs {match.player_b_pseudo}
              </td>
              <td>{match.winner_pseudo ?? "-"}</td>
              <td>{match.scheduled_at ? new Date(match.scheduled_at).toLocaleString("fr-FR") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
