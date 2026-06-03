type RankingRow = {
  pseudo: string;
  total_points: number;
};

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Joueur</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.pseudo}>
              <td>{index + 1}</td>
              <td>{row.pseudo}</td>
              <td>{row.total_points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
