import type { BeerPongTeam } from "@/lib/beer-pong";

export type TeamKey = "A" | "B" | "C" | "D";

export type IndividualTeamState = {
  firstPlaceId: string | null;
  secondPlaceId: string | null;
  thirdPlaceId: string | null;
};

export type IndividualState = Partial<Record<TeamKey, IndividualTeamState>>;

export type TeamRankRow = {
  rank: 1 | 2 | 3 | 4;
  teamKey: TeamKey;
  label: string;
};

export type IndividualTeamView = {
  teamRank: 1 | 2 | 3 | 4;
  teamKey: TeamKey;
  teamLabel: string;
  globalRankStart: number;
  players: { id: string; pseudo: string }[];
};

export type GlobalPlayerRank = {
  playerId: string;
  pseudo: string;
  globalRank: number;
  points: number;
};

/** 1er = 12 pts, 2e = 11 pts, …, 12e = 1 pt */
export function pointsForBeerPongRank(globalRank: number): number {
  if (!Number.isInteger(globalRank) || globalRank < 1 || globalRank > 12) {
    throw new Error("Le rang doit être entre 1 et 12.");
  }
  return 13 - globalRank;
}

export function emptyIndividualTeamState(): IndividualTeamState {
  return { firstPlaceId: null, secondPlaceId: null, thirdPlaceId: null };
}

export function normalizeIndividualState(raw: unknown): IndividualState {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const result: IndividualState = {};
  for (const key of ["A", "B", "C", "D"] as const) {
    const entry = (raw as Record<string, unknown>)[key];
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const team = entry as Record<string, unknown>;
    if ("firstPlaceId" in team || "secondPlaceId" in team || "thirdPlaceId" in team) {
      result[key] = {
        firstPlaceId: typeof team.firstPlaceId === "string" ? team.firstPlaceId : null,
        secondPlaceId: typeof team.secondPlaceId === "string" ? team.secondPlaceId : null,
        thirdPlaceId: typeof team.thirdPlaceId === "string" ? team.thirdPlaceId : null
      };
    }
  }
  return result;
}

export function getNextPlaceToPick(state: IndividualTeamState): 1 | 2 | 3 | null {
  if (!state.firstPlaceId) {
    return 1;
  }
  if (!state.secondPlaceId) {
    return 2;
  }
  if (!state.thirdPlaceId) {
    return 3;
  }
  return null;
}

export function getPlayerPlaceInTeam(
  state: IndividualTeamState,
  playerId: string
): 1 | 2 | 3 | null {
  if (state.firstPlaceId === playerId) {
    return 1;
  }
  if (state.secondPlaceId === playerId) {
    return 2;
  }
  if (state.thirdPlaceId === playerId) {
    return 3;
  }
  return null;
}

function loserOfSemi(semiWinner: "A" | "B" | "C" | "D"): TeamKey {
  if (semiWinner === "A") return "B";
  if (semiWinner === "B") return "A";
  if (semiWinner === "C") return "D";
  return "C";
}

export function computeTeamRankings(
  semi1Winner: "A" | "B" | null,
  semi2Winner: "C" | "D" | null,
  finalWinner: TeamKey | null,
  smallFinalWinner: TeamKey | null
): TeamRankRow[] | null {
  if (!semi1Winner || !semi2Winner || !finalWinner || !smallFinalWinner) {
    return null;
  }

  const finalLoser = finalWinner === semi1Winner ? semi2Winner : semi1Winner;
  const smallLoser =
    smallFinalWinner === loserOfSemi(semi1Winner) ? loserOfSemi(semi2Winner) : loserOfSemi(semi1Winner);

  return [
    { rank: 1, teamKey: finalWinner, label: "" },
    { rank: 2, teamKey: finalLoser, label: "" },
    { rank: 3, teamKey: smallFinalWinner, label: "" },
    { rank: 4, teamKey: smallLoser, label: "" }
  ];
}

export function buildIndividualTeamViews(
  teams: BeerPongTeam[],
  teamRankRows: TeamRankRow[] | null
): IndividualTeamView[] {
  if (!teamRankRows) {
    return [];
  }

  const teamByKey = new Map(teams.map((team) => [team.key as TeamKey, team]));
  const views: IndividualTeamView[] = [];

  for (const row of teamRankRows) {
    const team = teamByKey.get(row.teamKey);
    if (!team) {
      continue;
    }

    views.push({
      teamRank: row.rank,
      teamKey: row.teamKey,
      teamLabel: team.label,
      globalRankStart: (row.rank - 1) * 3 + 1,
      players: team.playerIds.map((id, index) => ({
        id,
        pseudo: team.players[index]
      }))
    });
  }

  return views;
}

export function computeGlobalPlayerRanks(
  teams: BeerPongTeam[],
  teamRankRows: TeamRankRow[] | null,
  individualState: IndividualState
): GlobalPlayerRank[] | null {
  if (!teamRankRows) {
    return null;
  }

  const teamByKey = new Map(teams.map((team) => [team.key as TeamKey, team]));
  const results: GlobalPlayerRank[] = [];

  for (const row of teamRankRows) {
    const team = teamByKey.get(row.teamKey);
    if (!team) {
      continue;
    }

    const state = individualState[row.teamKey];
    if (!state?.firstPlaceId || !state.secondPlaceId || !state.thirdPlaceId) {
      return null;
    }

    const pseudoById = new Map(team.playerIds.map((id, index) => [id, team.players[index]]));
    const base = (row.rank - 1) * 3 + 1;

    const ranks = [state.firstPlaceId, state.secondPlaceId, state.thirdPlaceId] as const;
    for (let offset = 0; offset < 3; offset += 1) {
      const playerId = ranks[offset];
      const globalRank = base + offset;
      results.push({
        playerId,
        pseudo: pseudoById.get(playerId) ?? "?",
        globalRank,
        points: pointsForBeerPongRank(globalRank)
      });
    }
  }

  return results.sort((a, b) => a.globalRank - b.globalRank);
}

export function getTeamPlayerIdsFromDraw(drawPlayerIds: string[], teamKey: TeamKey): string[] {
  const offset = { A: 0, B: 3, C: 6, D: 9 }[teamKey];
  return drawPlayerIds.slice(offset, offset + 3);
}
