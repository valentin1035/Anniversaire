import {
  DEBILE100_QUESTION_COUNT,
  getDebile100TimerState,
  getQuestionByIndex,
  type Debile100Phase,
  type Debile100Question,
  type Debile100TimerPhase
} from "@/lib/debile100";
import { createDefaultQuestions } from "@/lib/debile100";
import {
  getDebile100AnswersForQuestion,
  getDebile100PlayerStatuses,
  getDebile100State
} from "@/lib/data";

export type Debile100AdminView = {
  eventId: string;
  questions: Debile100Question[];
  currentQuestion: number;
  phase: Debile100Phase;
  timerPhase: Debile100TimerPhase;
  secondsRemaining: number;
  graceSecondsRemaining: number;
  answerCounts: Record<string, number>;
  activeCount: number;
  eliminatedCount: number;
};

export type Debile100PlayerView = {
  eventId: string;
  questions: Debile100Question[];
  currentQuestion: number;
  phase: Debile100Phase;
  timerPhase: Debile100TimerPhase;
  secondsRemaining: number;
  graceSecondsRemaining: number;
  questionStartedAt: string | null;
  playerStatus: "active" | "eliminated" | "spectator";
  myChoiceId: string | null;
  showQuestion: boolean;
  currentQuestionData: Debile100Question | null;
};

export async function loadDebile100AdminView(eventId: string): Promise<Debile100AdminView> {
  const state = await getDebile100State(eventId);
  const questions = state?.questions ?? createDefaultQuestions();
  const currentQuestion = state?.current_question ?? 0;
  const phase = state?.phase ?? "idle";
  const timer = getDebile100TimerState(state?.question_started_at ?? null, phase);
  const statuses = await getDebile100PlayerStatuses(eventId);

  const answerCounts: Record<string, number> = {};
  if (currentQuestion > 0) {
    const answers = await getDebile100AnswersForQuestion(eventId, currentQuestion);
    for (const answer of answers) {
      answerCounts[answer.choice_id] = (answerCounts[answer.choice_id] ?? 0) + 1;
    }
  }

  return {
    eventId,
    questions,
    currentQuestion,
    phase,
    timerPhase: timer.timerPhase,
    secondsRemaining: timer.secondsRemaining,
    graceSecondsRemaining: timer.graceSecondsRemaining,
    answerCounts,
    activeCount: statuses.filter((row) => row.status === "active").length,
    eliminatedCount: statuses.filter((row) => row.status === "eliminated").length
  };
}

export async function loadDebile100PlayerView(
  eventId: string,
  playerId: string | null
): Promise<Debile100PlayerView> {
  const state = await getDebile100State(eventId);
  const questions = state?.questions ?? [];
  const currentQuestion = state?.current_question ?? 0;
  const phase = state?.phase ?? "idle";
  const questionStartedAt = state?.question_started_at ?? null;
  const timer = getDebile100TimerState(questionStartedAt, phase);

  if (!playerId) {
    return {
      eventId,
      questions,
      currentQuestion,
      phase,
      questionStartedAt,
      timerPhase: timer.timerPhase,
      secondsRemaining: timer.secondsRemaining,
      graceSecondsRemaining: timer.graceSecondsRemaining,
      playerStatus: "spectator",
      myChoiceId: null,
      showQuestion: false,
      currentQuestionData: null
    };
  }

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
    eventId,
    questions,
    currentQuestion,
    phase,
    questionStartedAt,
    timerPhase: timer.timerPhase,
    secondsRemaining: timer.secondsRemaining,
    graceSecondsRemaining: timer.graceSecondsRemaining,
    playerStatus,
    myChoiceId,
    showQuestion,
    currentQuestionData: showQuestion ? getQuestionByIndex(questions, currentQuestion) : null
  };
}
