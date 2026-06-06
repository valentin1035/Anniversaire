import type { Player } from "@/lib/types";
import { shuffleArray } from "@/lib/beer-pong";

export const MOLKPUTE_WIN_SCORE = 50;
export const MOLKPUTE_OVER_PENALTY_SCORE = 25;
export const MOLKPUTE_TEAM_COUNT = 6;
export const MOLKPUTE_PLAYERS_PER_TEAM = 2;
export const MOLKPUTE_PLAYER_COUNT = MOLKPUTE_TEAM_COUNT * MOLKPUTE_PLAYERS_PER_TEAM;

export type MolkputeTeamKey = "1" | "2" | "3" | "4" | "5" | "6";
export type MolkputeTurnPhase = "submit" | "await-finisher";

export type MolkputeTeam = {
  key: MolkputeTeamKey;
  label: string;
  players: [string, string];
  playerIds: [string, string];
};

export type MolkputeMatch = {
  id: string;
  teamA: MolkputeTeamKey;
  teamB: MolkputeTeamKey;
  scoreA: number;
  scoreB: number;
  startingTeam: MolkputeTeamKey;
  activeTeam: MolkputeTeamKey | null;
  turnPhase: MolkputeTurnPhase;
  pendingFinisherTeam: MolkputeTeamKey | null;
  finisherPlayerId: string | null;
  winner: MolkputeTeamKey | null;
  completed: boolean;
};

export type MolkputeStanding = {
  teamKey: MolkputeTeamKey;
  label: string;
  playersLabel: string;
  wins: number;
  played: number;
  rank: number;
};

export type MolkputePlayerFinishRow = {
  playerId: string;
  pseudo: string;
  teamKey: MolkputeTeamKey;
  finishCount: number;
};

export type MolkputeSubmitTurnResult = {
  match: MolkputeMatch;
  overFiftyPenalty: boolean;
  needsFinisher: boolean;
};

const TEAM_KEYS: MolkputeTeamKey[] = ["1", "2", "3", "4", "5", "6"];

function pickStartingTeam(teamA: MolkputeTeamKey, teamB: MolkputeTeamKey, seed: string): MolkputeTeamKey {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % 2;
  }
  return hash === 0 ? teamA : teamB;
}

export function opponentTeam(
  match: MolkputeMatch,
  teamKey: MolkputeTeamKey
): MolkputeTeamKey {
  return match.teamA === teamKey ? match.teamB : match.teamA;
}

export function teamScore(match: MolkputeMatch, teamKey: MolkputeTeamKey): number {
  return teamKey === match.teamA ? match.scoreA : match.scoreB;
}

function setTeamScore(match: MolkputeMatch, teamKey: MolkputeTeamKey, score: number): MolkputeMatch {
  const next = { ...match };
  if (teamKey === next.teamA) {
    next.scoreA = score;
  } else {
    next.scoreB = score;
  }
  return next;
}

export function buildMolkputePlaceholderTeams(): MolkputeTeam[] {
  return TEAM_KEYS.map((key, index) => {
    const base = index * 2;
    return {
      key,
      label: `Équipe ${key}`,
      players: [`Joueur ${base + 1}`, `Joueur ${base + 2}`],
      playerIds: [`p${base + 1}`, `p${base + 2}`]
    };
  });
}

export function buildMolkputeTeamsFromPlayers(players: Player[]): MolkputeTeam[] {
  const ids = players.map((player) => player.id);
  const names = players.map((player) => player.pseudo);
  return TEAM_KEYS.map((key, index) => {
    const offset = index * 2;
    return {
      key,
      label: `Équipe ${key}`,
      players: [names[offset], names[offset + 1]],
      playerIds: [ids[offset], ids[offset + 1]]
    };
  });
}

function createEmptyMatch(teamA: MolkputeTeamKey, teamB: MolkputeTeamKey): MolkputeMatch {
  const id = matchIdForTeams(teamA, teamB);
  const startingTeam = pickStartingTeam(teamA, teamB, id);
  return {
    id,
    teamA,
    teamB,
    scoreA: 0,
    scoreB: 0,
    startingTeam,
    activeTeam: startingTeam,
    turnPhase: "submit",
    pendingFinisherTeam: null,
    finisherPlayerId: null,
    winner: null,
    completed: false
  };
}

export function createRoundRobinMatches(): MolkputeMatch[] {
  const matches: MolkputeMatch[] = [];
  for (let i = 0; i < TEAM_KEYS.length; i += 1) {
    for (let j = i + 1; j < TEAM_KEYS.length; j += 1) {
      matches.push(createEmptyMatch(TEAM_KEYS[i], TEAM_KEYS[j]));
    }
  }
  return matches;
}

export function matchIdForTeams(teamA: MolkputeTeamKey, teamB: MolkputeTeamKey): string {
  return teamA < teamB ? `${teamA}-${teamB}` : `${teamB}-${teamA}`;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(MOLKPUTE_WIN_SCORE, Math.floor(value));
}

function isTeamKey(value: unknown): value is MolkputeTeamKey {
  return typeof value === "string" && TEAM_KEYS.includes(value as MolkputeTeamKey);
}

function normalizeTurnPhase(value: unknown, completed: boolean): MolkputeTurnPhase {
  if (completed) {
    return "submit";
  }
  return value === "await-finisher" ? "await-finisher" : "submit";
}

export function normalizeMolkputeMatches(raw: unknown): MolkputeMatch[] {
  const defaultMatches = createRoundRobinMatches();
  if (!Array.isArray(raw)) {
    return defaultMatches;
  }

  const byId = new Map(defaultMatches.map((match) => [match.id, { ...match }]));

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : null;
    if (!id || !byId.has(id)) {
      continue;
    }

    const base = byId.get(id)!;
    base.scoreA = clampScore(Number(row.scoreA ?? base.scoreA));
    base.scoreB = clampScore(Number(row.scoreB ?? base.scoreB));
    base.completed = Boolean(row.completed);
    base.winner = isTeamKey(row.winner) ? row.winner : null;
    base.startingTeam = isTeamKey(row.startingTeam)
      ? row.startingTeam
      : pickStartingTeam(base.teamA, base.teamB, base.id);
    base.turnPhase = normalizeTurnPhase(row.turnPhase, base.completed);
    base.pendingFinisherTeam = isTeamKey(row.pendingFinisherTeam) ? row.pendingFinisherTeam : null;
    base.finisherPlayerId =
      typeof row.finisherPlayerId === "string" ? row.finisherPlayerId : null;

    if (base.completed) {
      base.activeTeam = null;
      if (!base.winner) {
        base.winner = base.scoreA >= base.scoreB ? base.teamA : base.teamB;
      }
    } else if (base.turnPhase === "await-finisher") {
      base.activeTeam = null;
      if (!base.pendingFinisherTeam) {
        const leader =
          base.scoreA >= MOLKPUTE_WIN_SCORE
            ? base.teamA
            : base.scoreB >= MOLKPUTE_WIN_SCORE
              ? base.teamB
              : null;
        base.pendingFinisherTeam = leader;
      }
    } else {
      base.activeTeam = isTeamKey(row.activeTeam) ? row.activeTeam : base.startingTeam;
      base.pendingFinisherTeam = null;
    }

    byId.set(id, base);
  }

  return Array.from(byId.values());
}

export function findPlayerTeam(teams: MolkputeTeam[], playerId: string): MolkputeTeamKey | null {
  for (const team of teams) {
    if (team.playerIds.includes(playerId)) {
      return team.key;
    }
  }
  return null;
}

export function computeStandings(teams: MolkputeTeam[], matches: MolkputeMatch[]): MolkputeStanding[] {
  const teamByKey = new Map(teams.map((team) => [team.key, team]));
  const rows = TEAM_KEYS.map((teamKey) => {
    const team = teamByKey.get(teamKey);
    let wins = 0;
    let played = 0;
    for (const match of matches) {
      if (!match.completed) {
        continue;
      }
      if (match.teamA !== teamKey && match.teamB !== teamKey) {
        continue;
      }
      played += 1;
      if (match.winner === teamKey) {
        wins += 1;
      }
    }
    return {
      teamKey,
      label: team?.label ?? `Équipe ${teamKey}`,
      playersLabel: team ? `${team.players[0]} & ${team.players[1]}` : "—",
      wins,
      played,
      rank: 0
    };
  });

  rows.sort((a, b) => {
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    return a.teamKey.localeCompare(b.teamKey);
  });

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function computePlayerFinishRows(
  teams: MolkputeTeam[],
  finishCounts: Record<string, number>
): MolkputePlayerFinishRow[] {
  const rows: MolkputePlayerFinishRow[] = [];
  for (const team of teams) {
    for (let i = 0; i < 2; i += 1) {
      const playerId = team.playerIds[i];
      rows.push({
        playerId,
        pseudo: team.players[i],
        teamKey: team.key,
        finishCount: finishCounts[playerId] ?? 0
      });
    }
  }

  rows.sort((a, b) => {
    if (a.teamKey !== b.teamKey) {
      return a.teamKey.localeCompare(b.teamKey);
    }
    if (b.finishCount !== a.finishCount) {
      return b.finishCount - a.finishCount;
    }
    return a.pseudo.localeCompare(b.pseudo, "fr");
  });

  return rows;
}

export function getTeamFinishRanking(
  teams: MolkputeTeam[],
  finishCounts: Record<string, number>,
  teamKey: MolkputeTeamKey
): { first: MolkputePlayerFinishRow; second: MolkputePlayerFinishRow } | null {
  const team = teams.find((entry) => entry.key === teamKey);
  if (!team) {
    return null;
  }

  const rows = team.playerIds.map((playerId, index) => ({
    playerId,
    pseudo: team.players[index],
    teamKey,
    finishCount: finishCounts[playerId] ?? 0
  }));

  rows.sort((a, b) => {
    if (b.finishCount !== a.finishCount) {
      return b.finishCount - a.finishCount;
    }
    return a.pseudo.localeCompare(b.pseudo, "fr");
  });

  return { first: rows[0], second: rows[1] };
}

export function submitMolkputeTurn(
  match: MolkputeMatch,
  teamKey: MolkputeTeamKey,
  points: number
): MolkputeSubmitTurnResult {
  if (match.completed) {
    throw new Error("Ce match est déjà terminé.");
  }
  if (match.turnPhase !== "submit") {
    throw new Error("Indique d'abord qui a terminé la partie (50 points).");
  }
  if (match.activeTeam !== teamKey) {
    throw new Error("Ce n'est pas le tour de ton équipe.");
  }
  if (!Number.isInteger(points) || points < 1) {
    throw new Error("Entre un nombre de points entier (minimum 1).");
  }

  const currentScore = teamScore(match, teamKey);
  const newScore = currentScore + points;
  let next = { ...match };
  const other = opponentTeam(match, teamKey);

  if (newScore > MOLKPUTE_WIN_SCORE) {
    next = setTeamScore(next, teamKey, MOLKPUTE_OVER_PENALTY_SCORE);
    next.activeTeam = other;
    return { match: next, overFiftyPenalty: true, needsFinisher: false };
  }

  if (newScore === MOLKPUTE_WIN_SCORE) {
    next = setTeamScore(next, teamKey, MOLKPUTE_WIN_SCORE);
    next.turnPhase = "await-finisher";
    next.pendingFinisherTeam = teamKey;
    next.activeTeam = null;
    return { match: next, overFiftyPenalty: false, needsFinisher: true };
  }

  next = setTeamScore(next, teamKey, newScore);
  next.activeTeam = other;
  return { match: next, overFiftyPenalty: false, needsFinisher: false };
}

export function applyMolkputeFinisher(
  match: MolkputeMatch,
  teamKey: MolkputeTeamKey,
  playerId: string,
  teamPlayerIds: string[]
): MolkputeMatch {
  if (match.completed) {
    throw new Error("Ce match est déjà terminé.");
  }
  if (match.turnPhase !== "await-finisher" || match.pendingFinisherTeam !== teamKey) {
    throw new Error("Ce match n'attend pas de finisseur.");
  }
  if (!teamPlayerIds.includes(playerId)) {
    throw new Error("Ce joueur n'appartient pas à l'équipe gagnante.");
  }
  if (teamScore(match, teamKey) !== MOLKPUTE_WIN_SCORE) {
    throw new Error("L'équipe doit être à 50 points pour terminer.");
  }

  return {
    ...match,
    finisherPlayerId: playerId,
    winner: teamKey,
    completed: true,
    turnPhase: "submit",
    pendingFinisherTeam: null,
    activeTeam: null
  };
}

export function resetMolkputeMatchState(match: MolkputeMatch): MolkputeMatch {
  return createEmptyMatch(match.teamA, match.teamB);
}

export type MolkputeGlobalRank = {
  playerId: string;
  pseudo: string;
  teamKey: MolkputeTeamKey;
  teamRank: number;
  globalRank: number;
  finishCount: number;
};

export type MolkputeLeaderboardRow = {
  rank: number;
  playerId: string;
  pseudo: string;
  teamKey: MolkputeTeamKey;
  teamRank: number;
  finishCount: number;
  eventPoints: number | null;
};

export function allMolkputeMatchesCompleted(matches: MolkputeMatch[]): boolean {
  const expected = createRoundRobinMatches().length;
  return matches.length >= expected && matches.every((match) => match.completed);
}

/** Classement individuel : rang équipe (victoires poule) puis finisseurs dans l'équipe. */
export function computeMolkputeGlobalRanks(
  teams: MolkputeTeam[],
  standings: MolkputeStanding[],
  finishCounts: Record<string, number>
): MolkputeGlobalRank[] {
  const results: MolkputeGlobalRank[] = [];

  for (const standing of standings) {
    const team = teams.find((entry) => entry.key === standing.teamKey);
    if (!team) {
      continue;
    }

    const baseGlobalRank = (standing.rank - 1) * MOLKPUTE_PLAYERS_PER_TEAM + 1;
    const players = team.playerIds.map((playerId, index) => ({
      playerId,
      pseudo: team.players[index],
      finishCount: finishCounts[playerId] ?? 0
    }));

    players.sort((a, b) => {
      if (b.finishCount !== a.finishCount) {
        return b.finishCount - a.finishCount;
      }
      return a.pseudo.localeCompare(b.pseudo, "fr");
    });

    for (let offset = 0; offset < players.length; offset += 1) {
      const player = players[offset];
      results.push({
        playerId: player.playerId,
        pseudo: player.pseudo,
        teamKey: standing.teamKey,
        teamRank: standing.rank,
        globalRank: baseGlobalRank + offset,
        finishCount: player.finishCount
      });
    }
  }

  return results.sort((a, b) => a.globalRank - b.globalRank);
}

/** 12 → 1 points selon le rang individuel. */
export function computeMolkputeEventPoints(
  ranks: MolkputeGlobalRank[]
): Map<string, number> {
  const pointsByPlayer = new Map<string, number>();
  for (const row of ranks) {
    pointsByPlayer.set(row.playerId, Math.max(1, MOLKPUTE_PLAYER_COUNT - row.globalRank + 1));
  }
  return pointsByPlayer;
}

export function buildMolkputeLeaderboard(
  ranks: MolkputeGlobalRank[],
  pointsByPlayer: Map<string, number> | null
): MolkputeLeaderboardRow[] {
  return ranks.map((row) => ({
    rank: row.globalRank,
    playerId: row.playerId,
    pseudo: row.pseudo,
    teamKey: row.teamKey,
    teamRank: row.teamRank,
    finishCount: row.finishCount,
    eventPoints: pointsByPlayer?.get(row.playerId) ?? null
  }));
}

export { shuffleArray };
