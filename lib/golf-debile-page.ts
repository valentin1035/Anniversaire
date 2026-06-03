import {
  buildGolfDebileLeaderboard,
  GOLF_DEBILE_COURSES,
  GOLF_DEBILE_PLAYER_COUNT,
  type GolfDebileLeaderboardRow,
  type GolfDebileSubmission
} from "@/lib/golf-debile";
import { getEventRanking, getGolfDebileState, getGolfDebileSubmissions } from "@/lib/data";

export type GolfDebileViewData = {
  courses: typeof GOLF_DEBILE_COURSES;
  submissions: GolfDebileSubmission[];
  mySubmission: GolfDebileSubmission | null;
  submissionCount: number;
  requiredCount: number;
  isFinalized: boolean;
  leaderboard: GolfDebileLeaderboardRow[];
};

export async function loadGolfDebileView(
  eventId: string,
  playerId: string | null
): Promise<GolfDebileViewData> {
  const [state, submissions] = await Promise.all([
    getGolfDebileState(eventId),
    getGolfDebileSubmissions(eventId)
  ]);

  const isFinalized = Boolean(state?.finalized_at);
  let pointsByPlayer: Map<string, number> | null = null;
  if (isFinalized) {
    const ranking = await getEventRanking(eventId);
    pointsByPlayer = new Map(ranking.map((row) => [row.player_id, row.total_points]));
  }

  const mySubmission = playerId
    ? submissions.find((entry) => entry.playerId === playerId) ?? null
    : null;

  return {
    courses: GOLF_DEBILE_COURSES,
    submissions,
    mySubmission,
    submissionCount: submissions.length,
    requiredCount: GOLF_DEBILE_PLAYER_COUNT,
    isFinalized,
    leaderboard: buildGolfDebileLeaderboard(submissions, pointsByPlayer)
  };
}
