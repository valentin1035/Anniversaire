export const GOLF_DEBILE_PLAYER_COUNT = 12;

export const GOLF_DEBILE_COURSES = [
  { id: 1 as const, title: "Parcours 1", name: "La chaudasse du quartier" },
  { id: 2 as const, title: "Parcours 2", name: "Le batard" },
  { id: 3 as const, title: "Parcours 3", name: "Les zigzags infernals" }
] as const;

export type GolfDebileCourseId = 1 | 2 | 3;

export type GolfDebileSubmission = {
  playerId: string;
  pseudo: string;
  course1: number;
  course2: number;
  course3: number;
  totalStrokes: number;
  submittedAt: string;
};

export type GolfDebileLeaderboardRow = {
  rank: number;
  playerId: string;
  pseudo: string;
  course1: number;
  course2: number;
  course3: number;
  totalStrokes: number;
  eventPoints: number | null;
};

export type GolfDebileSubmitInput = {
  course1: number;
  course2: number;
  course3: number;
};

function validateStrokes(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1 || value > 99) {
    throw new Error(`${label} : entre 1 et 99 coups.`);
  }
}

export function parseGolfDebileInput(input: GolfDebileSubmitInput): GolfDebileSubmitInput {
  const course1 = Number(input.course1);
  const course2 = Number(input.course2);
  const course3 = Number(input.course3);
  validateStrokes(course1, "Parcours 1");
  validateStrokes(course2, "Parcours 2 (Le batard)");
  validateStrokes(course3, "Parcours 3");
  return { course1, course2, course3 };
}

/** Tri : total croissant, puis parcours 2 (Le batard) en cas d'égalité. */
export function sortGolfDebileSubmissions(submissions: GolfDebileSubmission[]): GolfDebileSubmission[] {
  return [...submissions].sort((a, b) => {
    if (a.totalStrokes !== b.totalStrokes) {
      return a.totalStrokes - b.totalStrokes;
    }
    if (a.course2 !== b.course2) {
      return a.course2 - b.course2;
    }
    return a.pseudo.localeCompare(b.pseudo, "fr");
  });
}

function sameTieGroup(a: GolfDebileSubmission, b: GolfDebileSubmission): boolean {
  return a.totalStrokes === b.totalStrokes && a.course2 === b.course2;
}

/** 12 → 1 points ; ex-aequo = même nombre de points, rang suivant sauté. */
export function computeGolfDebileEventPoints(
  submissions: GolfDebileSubmission[]
): Map<string, number> {
  const sorted = sortGolfDebileSubmissions(submissions);
  const pointsByPlayer = new Map<string, number>();
  let index = 0;

  while (index < sorted.length) {
    const group: GolfDebileSubmission[] = [sorted[index]];
    let next = index + 1;
    while (next < sorted.length && sameTieGroup(sorted[index], sorted[next])) {
      group.push(sorted[next]);
      next += 1;
    }

    const points = Math.max(1, GOLF_DEBILE_PLAYER_COUNT - index);
    for (const entry of group) {
      pointsByPlayer.set(entry.playerId, points);
    }
    index = next;
  }

  return pointsByPlayer;
}

export function buildGolfDebileLeaderboard(
  submissions: GolfDebileSubmission[],
  pointsByPlayer: Map<string, number> | null
): GolfDebileLeaderboardRow[] {
  const sorted = sortGolfDebileSubmissions(submissions);
  let rank = 0;
  let index = 0;
  const rows: GolfDebileLeaderboardRow[] = [];

  while (index < sorted.length) {
    const group: GolfDebileSubmission[] = [sorted[index]];
    let next = index + 1;
    while (next < sorted.length && sameTieGroup(sorted[index], sorted[next])) {
      group.push(sorted[next]);
      next += 1;
    }

    rank += 1;
    for (const entry of group) {
      rows.push({
        rank,
        playerId: entry.playerId,
        pseudo: entry.pseudo,
        course1: entry.course1,
        course2: entry.course2,
        course3: entry.course3,
        totalStrokes: entry.totalStrokes,
        eventPoints: pointsByPlayer?.get(entry.playerId) ?? null
      });
    }
    index = next;
  }

  return rows;
}
