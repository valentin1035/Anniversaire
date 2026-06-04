import {
  getDebile100TimerState,
  getQuestionByIndex,
  DEBILE100_QUESTION_COUNT,
  type Debile100Phase,
  type Debile100Question,
  type Debile100TimerPhase
} from "@/lib/debile100";
import {
  resolvePlayerView,
  type Debile100RevealOutcome,
  type Debile100ViewMode
} from "@/lib/debile100-rules";
import {
  getDebile100AnswersForQuestion,
  getDebile100PlayerStatuses,
  getDebile100State,
  toDebile100PlayerProgress
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
  viewMode: Debile100ViewMode;
  waitingMessage: string | null;
  finaleQualified: boolean;
  hintAvailable: boolean;
  hintUsed: boolean;
  hintText: string | null;
  passAvailable: boolean;
  passUsed: boolean;
  revealOutcome: Debile100RevealOutcome;
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
  const questions = state?.questions ?? [];

  const base = {
    serverNow,
    questionStartedAt,
    currentQuestion,
    phase,
    timerPhase: timer.timerPhase,
    secondsRemaining: timer.secondsRemaining,
    graceSecondsRemaining: timer.graceSecondsRemaining
  };

  if (!playerId) {
    return {
      ...base,
      playerStatus: "spectator",
      myChoiceId: null,
      showQuestion: false,
      currentQuestionData: null,
      viewMode: "waiting",
      waitingMessage: null,
      finaleQualified: false,
      hintAvailable: false,
      hintUsed: false,
      hintText: null,
      passAvailable: false,
      passUsed: false,
      revealOutcome: null
    };
  }

  const statuses = await getDebile100PlayerStatuses(eventId);
  const myRow = statuses.find((row) => row.player_id === playerId);
  const progress = myRow ? toDebile100PlayerProgress(myRow) : null;
  const playerStatus = progress?.status === "eliminated" ? "eliminated" : "active";

  let myChoiceId: string | null = null;
  if (currentQuestion > 0) {
    const answers = await getDebile100AnswersForQuestion(eventId, currentQuestion);
    myChoiceId = answers.find((row) => row.player_id === playerId)?.choice_id ?? null;
  }

  const question =
    currentQuestion > 0 && currentQuestion <= DEBILE100_QUESTION_COUNT
      ? getQuestionByIndex(questions, currentQuestion)
      : null;

  const inRound =
    playerStatus === "active" &&
    currentQuestion > 0 &&
    (phase === "playing" || phase === "revealed");

  const view = inRound && progress
    ? resolvePlayerView(progress, currentQuestion, phase, question, myChoiceId)
    : {
        viewMode: playerStatus === "eliminated" ? ("eliminated" as const) : ("waiting" as const),
        showQuestion: false,
        waitingMessage: null,
        finaleQualified: false,
        hintAvailable: false,
        passAvailable: false,
        revealOutcome: null
      };

  const hintUsed = progress?.hint_used_at_question != null;
  const hintText =
    hintUsed && question?.hint && progress?.hint_used_at_question === currentQuestion
      ? question.hint
      : null;

  return {
    ...base,
    playerStatus,
    myChoiceId,
    showQuestion: view.showQuestion,
    currentQuestionData: view.showQuestion ? question : null,
    viewMode: view.viewMode,
    waitingMessage: view.waitingMessage,
    finaleQualified: view.finaleQualified,
    hintAvailable: view.hintAvailable,
    hintUsed,
    hintText,
    passAvailable: view.passAvailable,
    passUsed: progress?.pass_used_at_question != null,
    revealOutcome: view.revealOutcome
  };
}
