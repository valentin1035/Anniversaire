import {
  buildDebile100Leaderboard,
  canFinalizeDebile100State,
  DEBILE100_PASS_CHOICE_ID,
  DEBILE100_QUESTION_COUNT,
  getDebile100RevealedQuestionCount,
  getDebile100TimerState,
  getQuestionByIndex,
  type Debile100AnswerRecapResult,
  type Debile100AnswerRecapRow,
  type Debile100LeaderboardRow,
  type Debile100Phase,
  type Debile100Question,
  type Debile100QuestionRecap,
  type Debile100TimerPhase
} from "@/lib/debile100";
import { createDefaultQuestions } from "@/lib/debile100";
import {
  isAnswerQualifying,
  resolvePlayerView,
  type Debile100RevealOutcome,
  type Debile100ViewMode
} from "@/lib/debile100-rules";
import {
  getDebile100AnswersForQuestion,
  getDebile100AnswersUpToQuestion,
  getDebile100PlayerProgress,
  getDebile100PlayerStatuses,
  getDebile100RankingEntries,
  getDebile100State,
  getEventRanking,
  getPlayers
} from "@/lib/data";

type Debile100StatusRow = Awaited<ReturnType<typeof getDebile100PlayerStatuses>>[number];
type Debile100AnswerRow = Awaited<ReturnType<typeof getDebile100AnswersUpToQuestion>>[number];

function buildDebile100AnswerRecapRow(
  question: Debile100Question,
  status: Debile100StatusRow,
  pseudo: string,
  answer: Debile100AnswerRow | undefined
): Debile100AnswerRecapRow {
  const questionIndex = question.index;
  const eliminatedAt = status.eliminated_at_question;

  if (eliminatedAt !== null && eliminatedAt < questionIndex) {
    return {
      playerId: status.player_id,
      pseudo,
      choiceLabel: null,
      result: "not_playing"
    };
  }

  if (!answer) {
    if (eliminatedAt === questionIndex) {
      return {
        playerId: status.player_id,
        pseudo,
        choiceLabel: null,
        result: "no_answer"
      };
    }
    return {
      playerId: status.player_id,
      pseudo,
      choiceLabel: null,
      result: "not_playing"
    };
  }

  if (answer.choice_id === DEBILE100_PASS_CHOICE_ID) {
    return {
      playerId: status.player_id,
      pseudo,
      choiceLabel: "Passe",
      result: "pass"
    };
  }

  const choice = question.choices.find((entry) => entry.id === answer.choice_id);
  const choiceLabel = choice?.label ?? answer.choice_id;
  const result: Debile100AnswerRecapResult = isAnswerQualifying(
    answer.choice_id,
    question.correctChoiceId
  )
    ? "correct"
    : "wrong";

  return {
    playerId: status.player_id,
    pseudo,
    choiceLabel,
    result
  };
}

function buildDebile100QuestionRecaps(input: {
  questions: Debile100Question[];
  statuses: Debile100StatusRow[];
  answers: Debile100AnswerRow[];
  pseudoById: Map<string, string>;
  revealedCount: number;
}): Debile100QuestionRecap[] {
  const recaps: Debile100QuestionRecap[] = [];

  for (let questionIndex = 1; questionIndex <= input.revealedCount; questionIndex += 1) {
    const question = getQuestionByIndex(input.questions, questionIndex);
    if (!question) {
      continue;
    }

    const answersForQuestion = input.answers.filter(
      (answer) => answer.question_index === questionIndex
    );
    const correctChoice = question.choices.find(
      (choice) => choice.id === question.correctChoiceId
    );

    const rows = input.statuses
      .map((status) => {
        const pseudo = input.pseudoById.get(status.player_id) ?? "Joueur";
        const answer = answersForQuestion.find((entry) => entry.player_id === status.player_id);
        return buildDebile100AnswerRecapRow(question, status, pseudo, answer);
      })
      .sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"));

    recaps.push({
      questionIndex,
      correctChoiceLabel: correctChoice?.label ?? "—",
      rows
    });
  }

  return recaps;
}

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
  isFinalized: boolean;
  canFinalize: boolean;
  leaderboard: Debile100LeaderboardRow[];
  questionRecaps: Debile100QuestionRecap[];
  eliminatedPlayers: Array<{
    playerId: string;
    pseudo: string;
    eliminatedAtQuestion: number | null;
  }>;
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

export async function loadDebile100AdminView(eventId: string): Promise<Debile100AdminView> {
  const state = await getDebile100State(eventId);
  const questions = state?.questions ?? createDefaultQuestions();
  const currentQuestion = state?.current_question ?? 0;
  const phase = state?.phase ?? "idle";
  const timer = getDebile100TimerState(state?.question_started_at ?? null, phase);
  const revealedCount = getDebile100RevealedQuestionCount(currentQuestion, phase);
  const [statuses, players, answersUpToRevealed] = await Promise.all([
    getDebile100PlayerStatuses(eventId),
    getPlayers(),
    revealedCount > 0
      ? getDebile100AnswersUpToQuestion(eventId, revealedCount)
      : Promise.resolve([])
  ]);
  const pseudoById = new Map(players.map((player) => [player.id, player.pseudo]));

  const answerCounts: Record<string, number> = {};
  if (currentQuestion > 0) {
    const answers = await getDebile100AnswersForQuestion(eventId, currentQuestion);
    for (const answer of answers) {
      answerCounts[answer.choice_id] = (answerCounts[answer.choice_id] ?? 0) + 1;
    }
  }

  const questionRecaps = buildDebile100QuestionRecaps({
    questions,
    statuses,
    answers: answersUpToRevealed,
    pseudoById,
    revealedCount
  });

  const isFinalized = Boolean(state?.finalized_at);
  const entries = await getDebile100RankingEntries(eventId);
  let pointsByPlayer: Map<string, number> | null = null;
  if (isFinalized) {
    const ranking = await getEventRanking(eventId);
    pointsByPlayer = new Map(ranking.map((row) => [row.player_id, row.total_points]));
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
    eliminatedCount: statuses.filter((row) => row.status === "eliminated").length,
    isFinalized,
    canFinalize: Boolean(state && canFinalizeDebile100State(state) && !isFinalized),
    leaderboard: buildDebile100Leaderboard(entries, pointsByPlayer),
    questionRecaps,
    eliminatedPlayers: statuses
      .filter((row) => row.status === "eliminated")
      .map((row) => ({
        playerId: row.player_id,
        pseudo: pseudoById.get(row.player_id) ?? "Joueur",
        eliminatedAtQuestion: row.eliminated_at_question
      }))
      .sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"))
  };
}

export async function loadDebile100PublicLeaderboard(eventId: string) {
  const state = await getDebile100State(eventId);
  const isFinalized = Boolean(state?.finalized_at);
  const entries = await getDebile100RankingEntries(eventId);
  let pointsByPlayer: Map<string, number> | null = null;

  if (isFinalized) {
    const ranking = await getEventRanking(eventId);
    pointsByPlayer = new Map(ranking.map((row) => [row.player_id, row.total_points]));
  }

  return {
    isFinalized,
    canFinalize: Boolean(state && canFinalizeDebile100State(state) && !isFinalized),
    leaderboard: buildDebile100Leaderboard(entries, pointsByPlayer)
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

  const emptyExtras = {
    viewMode: "waiting" as const,
    waitingMessage: null,
    finaleQualified: false,
    hintAvailable: false,
    hintUsed: false,
    hintText: null,
    passAvailable: false,
    passUsed: false,
    revealOutcome: null
  };

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
      currentQuestionData: null,
      ...emptyExtras
    };
  }

  const statuses = await getDebile100PlayerStatuses(eventId);
  const myRow = statuses.find((row) => row.player_id === playerId);
  const progress = getDebile100PlayerProgress(playerId, myRow);
  const playerStatus = progress.status === "eliminated" ? "eliminated" : "active";

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

  const view = inRound
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
