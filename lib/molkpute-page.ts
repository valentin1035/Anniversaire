import {
  allMolkputeMatchesCompleted,
  buildMolkputeLeaderboard,
  buildMolkputePlaceholderTeams,
  buildMolkputeTeamsFromPlayers,
  computeMolkputeGlobalRanks,
  computePlayerFinishRows,
  computeStandings,
  createRoundRobinMatches,
  normalizeMolkputeMatches,
  type MolkputeLeaderboardRow,
  type MolkputeMatch,
  type MolkputePlayerFinishRow,
  type MolkputeStanding,
  type MolkputeTeam
} from "@/lib/molkpute";
import { getEventRanking, getMolkputeFinishCounts, getMolkputeState, getPlayers } from "@/lib/data";

export type MolkputeViewData = {
  teams: MolkputeTeam[];
  matches: MolkputeMatch[];
  standings: MolkputeStanding[];
  playerFinishes: MolkputePlayerFinishRow[];
  hasDraw: boolean;
  isFinalized: boolean;
  allMatchesCompleted: boolean;
  leaderboard: MolkputeLeaderboardRow[];
};

export async function loadMolkputeView(eventId: string): Promise<MolkputeViewData> {
  const state = await getMolkputeState(eventId);
  const drawIds = state?.draw_player_ids ?? [];
  const emptyTeams = buildMolkputePlaceholderTeams();
  const emptyMatches = createRoundRobinMatches();

  if (drawIds.length !== 12) {
    return {
      teams: emptyTeams,
      matches: emptyMatches,
      standings: computeStandings(emptyTeams, emptyMatches),
      playerFinishes: computePlayerFinishRows(emptyTeams, {}),
      hasDraw: false,
      isFinalized: false,
      allMatchesCompleted: false,
      leaderboard: []
    };
  }

  const players = await getPlayers();
  const playersById = new Map(players.map((player) => [player.id, player]));
  const selectedPlayers = drawIds
    .map((id) => playersById.get(id))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));

  if (selectedPlayers.length !== 12) {
    return {
      teams: emptyTeams,
      matches: emptyMatches,
      standings: computeStandings(emptyTeams, emptyMatches),
      playerFinishes: computePlayerFinishRows(emptyTeams, {}),
      hasDraw: false,
      isFinalized: false,
      allMatchesCompleted: false,
      leaderboard: []
    };
  }

  const teams = buildMolkputeTeamsFromPlayers(selectedPlayers);
  const matches = normalizeMolkputeMatches(state?.matches ?? []);
  const finishCounts = await getMolkputeFinishCounts(eventId);
  const standings = computeStandings(teams, matches);
  const ranks = computeMolkputeGlobalRanks(teams, standings, finishCounts);
  const isFinalized = Boolean(state?.finalized_at);
  let pointsByPlayer: Map<string, number> | null = null;

  if (isFinalized) {
    const ranking = await getEventRanking(eventId);
    pointsByPlayer = new Map(ranking.map((row) => [row.player_id, row.total_points]));
  }

  return {
    teams,
    matches,
    standings,
    playerFinishes: computePlayerFinishRows(teams, finishCounts),
    hasDraw: true,
    isFinalized,
    allMatchesCompleted: allMolkputeMatchesCompleted(matches),
    leaderboard: buildMolkputeLeaderboard(ranks, pointsByPlayer)
  };
}
