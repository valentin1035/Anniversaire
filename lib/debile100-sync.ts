import {
  getDebile100TimerState,
  getQuestionByIndex,
  DEBILE100_QUESTION_COUNT,
  type Debile100Phase,
  type Debile100Question,
  type Debile100TimerPhase
} from "@/lib/debile100";
import {
  getDebile100AnswersForQuestion,
  getDebile100PlayerStatuses,
  getDebile100State
} from "@/lib/data";

export type Debile100SyncPayload = {
  serverNow: number;
  questionStartedAt: string | null;
  currentQuestion: number;
  phase: Debile100Phase;
  timerPhase: Debile100TimerPhase;
  secondsRemaining: number;
  graceSecondsRemaining: number;
  playerStatus: "active" | "eliminated" | "spectator";
  myChoiceId: string | null;
  showQuestion: boolean;
  currentQuestionData: Debile100Question | null;
};

export async function buildDebile100SyncPayload(
  eventId: string,
  playerId: string | null
): Promise<Debile100SyncPayload> {
  const serverNow = Date.now();
  const state = await getDebile100State(eventId);
  const currentQuestion = state?.current_question ?? 0;
  const phase = state?.phase ?? "idle";
  const questionStartedAt = state?.question_started_at ?? null;
  const timer = getDebile100TimerState(questionStartedAt, phase);

  if (!playerId) {
    return {
      serverNow,
      questionStartedAt,
      currentQuestion,
      phase,
      timerPhase: timer.timerPhase,
      secondsRemaining: timer.secondsRemaining,
      graceSecondsRemaining: timer.graceSecondsRemaining,
      playerStatus: "spectator",
      myChoiceId: null,
      showQuestion: false,
      currentQuestionData: null
    };
  }

  const questions = state?.questions ?? [];
  const statuses = await getDebile100PlayerStatuses(eventId);
  const myStatus = statuses.find((row) => row.player_id === playerId);
  const playerStatus = myStatus?.status === "eliminated" ? "eliminated" : "active";

  let myChoiceId: string | null = null;
  if (currentQuestion > 0) {
    const answers = await getDebile100AnswersForQuestion(eventId, currentQuestion);
    myChoiceId = answers.find((row) => row.player_id === playerId)?.choice_id ?? null;
  }

  const showQuestion =
    playerStatus === "active" &&
    currentQuestion > 0 &&
    currentQuestion <= DEBILE100_QUESTION_COUNT &&
    (phase === "playing" || phase === "revealed");

  return {
    serverNow,
    currentQuestion,
    phase,
    timerPhase: timer.timerPhase,
    secondsRemaining: timer.secondsRemaining,
    graceSecondsRemaining: timer.graceSecondsRemaining,
    playerStatus,
    myChoiceId,
    showQuestion,
    currentQuestionData: showQuestion ? getQuestionByIndex(questions, currentQuestion) : null
  };
}
