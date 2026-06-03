import {
  buildMolkputePlaceholderTeams,
  buildMolkputeTeamsFromPlayers,
  computePlayerFinishRows,
  computeStandings,
  createRoundRobinMatches,
  normalizeMolkputeMatches,
  type MolkputeMatch,
  type MolkputePlayerFinishRow,
  type MolkputeStanding,
  type MolkputeTeam
} from "@/lib/molkpute";
import { getMolkputeFinishCounts, getMolkputeState, getPlayers } from "@/lib/data";

export type MolkputeViewData = {
  teams: MolkputeTeam[];
  matches: MolkputeMatch[];
  standings: MolkputeStanding[];
  playerFinishes: MolkputePlayerFinishRow[];
  hasDraw: boolean;
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
      hasDraw: false
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
      hasDraw: false
    };
  }

  const teams = buildMolkputeTeamsFromPlayers(selectedPlayers);
  const matches = normalizeMolkputeMatches(state?.matches ?? []);
  const finishCounts = await getMolkputeFinishCounts(eventId);

  return {
    teams,
    matches,
    standings: computeStandings(teams, matches),
    playerFinishes: computePlayerFinishRows(teams, finishCounts),
    hasDraw: true
  };
}
