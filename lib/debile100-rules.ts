import {
  DEBILE100_PASS_CHOICE_ID,
  DEBILE100_QUESTION_COUNT,
  type Debile100Phase,
  type Debile100Question
} from "@/lib/debile100";

export { DEBILE100_PASS_CHOICE_ID };

export type Debile100PlayerProgress = {
  player_id: string;
  status: "active" | "eliminated";
  eliminated_at_question: number | null;
  hint_used_at_question: number | null;
  pass_used_at_question: number | null;
  catchup_question_index: number | null;
  skip_question_index: number | null;
};

/** Joueur connecté sans encore de ligne en base (avant la 1re réponse). */
export function createDefaultDebile100Progress(playerId: string): Debile100PlayerProgress {
  return {
    player_id: playerId,
    status: "active",
    eliminated_at_question: null,
    hint_used_at_question: null,
    pass_used_at_question: null,
    catchup_question_index: null,
    skip_question_index: null
  };
}

export type Debile100ViewMode = "question" | "waiting" | "eliminated" | "finale";

export type Debile100RevealOutcome =
  | "qualified"
  | "eliminated"
  | "catchup_offer"
  | "qualified_skip"
  | "finale"
  | "pass_ok"
  | null;

export function isHintQuestion(index: number): boolean {
  return index >= 5 && index <= 7;
}

export function isPassQuestion(index: number): boolean {
  return index >= 12 && index <= 14;
}

export function isCatchupGateQuestion(index: number): boolean {
  return index === 8 || index === 10;
}

export function isCatchupRetryQuestion(index: number): boolean {
  return index === 9 || index === 11;
}

export function getCatchupQuestionAfterGate(gateIndex: number): number {
  return gateIndex + 1;
}

export function shouldAssignCatchupOnQuestionStart(questionIndex: number): boolean {
  return questionIndex === 9 || questionIndex === 11;
}

/** Après la Q8 ou Q10 : ce joueur doit-il jouer la Q9 ou Q11 ? */
export function mustPlayCatchupQuestion(
  progress: Debile100PlayerProgress,
  catchupQuestionIndex: number,
  gateAnswerChoiceId: string | null,
  gateCorrectChoiceId: string
): boolean {
  const gateIndex = catchupQuestionIndex - 1;
  if (progress.skip_question_index === catchupQuestionIndex) {
    return false;
  }
  if (progress.catchup_question_index === catchupQuestionIndex) {
    return true;
  }
  return !isAnswerQualifying(gateAnswerChoiceId, gateCorrectChoiceId);
}

export function canUseHint(progress: Debile100PlayerProgress | null, questionIndex: number): boolean {
  return (
    isHintQuestion(questionIndex) &&
    progress?.status === "active" &&
    progress.hint_used_at_question == null
  );
}

export function canUsePass(progress: Debile100PlayerProgress | null, questionIndex: number): boolean {
  return (
    isPassQuestion(questionIndex) &&
    progress?.status === "active" &&
    progress.pass_used_at_question == null
  );
}

export function isPassAnswer(choiceId: string | null | undefined): boolean {
  return choiceId === DEBILE100_PASS_CHOICE_ID;
}

export function isAnswerCorrect(choiceId: string | null | undefined, correctChoiceId: string): boolean {
  return Boolean(choiceId) && choiceId === correctChoiceId;
}

export function isAnswerQualifying(
  choiceId: string | null | undefined,
  correctChoiceId: string
): boolean {
  return isPassAnswer(choiceId) || isAnswerCorrect(choiceId, correctChoiceId);
}

/** Le joueur doit-il voir et répondre à la question globale en cours ? */
export function shouldPlayerPlayQuestion(
  progress: Debile100PlayerProgress | null,
  currentQuestion: number
): boolean {
  if (!progress) {
    return currentQuestion > 0 && !isCatchupRetryQuestion(currentQuestion);
  }
  if (progress.status !== "active") {
    return false;
  }
  if (progress.skip_question_index === currentQuestion) {
    return false;
  }
  if (isCatchupRetryQuestion(currentQuestion)) {
    return progress.catchup_question_index === currentQuestion;
  }
  return true;
}

export function getWaitingMessage(
  progress: Debile100PlayerProgress,
  currentQuestion: number
): string {
  if (progress.skip_question_index === currentQuestion) {
    if (currentQuestion === 9) {
      return "Tu as validé la question 8 — en attente de la question 10.";
    }
    if (currentQuestion === 11) {
      return "Tu as validé la question 10 — en attente de la question 12.";
    }
    const next = Math.min(currentQuestion + 1, DEBILE100_QUESTION_COUNT);
    return `Tu es qualifié(e) — en attente de la question ${next}.`;
  }
  if (
    isCatchupRetryQuestion(currentQuestion) &&
    progress.catchup_question_index !== currentQuestion
  ) {
    return "Tu es qualifié(e) pour la suite — cette question de rattrapage ne te concerne pas.";
  }
  return "En attente de la prochaine question…";
}

export function resolvePlayerView(
  progress: Debile100PlayerProgress | null,
  currentQuestion: number,
  phase: Debile100Phase,
  question: Debile100Question | null,
  myChoiceId: string | null
): {
  viewMode: Debile100ViewMode;
  showQuestion: boolean;
  waitingMessage: string | null;
  finaleQualified: boolean;
  hintAvailable: boolean;
  passAvailable: boolean;
  revealOutcome: Debile100RevealOutcome;
} {
  if (progress?.status === "eliminated") {
    return {
      viewMode: "eliminated",
      showQuestion: false,
      waitingMessage: null,
      finaleQualified: false,
      hintAvailable: false,
      passAvailable: false,
      revealOutcome: null
    };
  }

  const activeProgress = progress ?? createDefaultDebile100Progress("unknown");
  const revealOutcome = getRevealOutcome(currentQuestion, phase, myChoiceId, question, activeProgress);
  const finaleQualified =
    currentQuestion === 14 &&
    phase === "revealed" &&
    revealOutcome === "finale";

  const canPlay = shouldPlayerPlayQuestion(activeProgress, currentQuestion);
  const inRound = currentQuestion > 0 && (phase === "playing" || phase === "revealed") && Boolean(question);

  if (!inRound || !canPlay) {
    const waiting =
      inRound && !canPlay
        ? getWaitingMessage(activeProgress, currentQuestion)
        : null;
    return {
      viewMode: waiting ? "waiting" : "waiting",
      showQuestion: false,
      waitingMessage: waiting,
      finaleQualified: false,
      hintAvailable: false,
      passAvailable: false,
      revealOutcome: null
    };
  }

  return {
    viewMode: "question",
    showQuestion: true,
    waitingMessage: null,
    finaleQualified: false,
    hintAvailable: canUseHint(activeProgress, currentQuestion) && phase === "playing",
    passAvailable: canUsePass(activeProgress, currentQuestion) && phase === "playing",
    revealOutcome
  };
}

export function getRevealOutcome(
  questionIndex: number,
  phase: Debile100Phase,
  myChoiceId: string | null,
  question: Debile100Question | null,
  _progress: Debile100PlayerProgress
): Debile100RevealOutcome {
  if (phase !== "revealed" || !question) {
    return null;
  }

  const correctId = question.correctChoiceId;
  const qualifying = isAnswerQualifying(myChoiceId, correctId);

  if (questionIndex === 14 && qualifying) {
    return "finale";
  }

  if (isPassAnswer(myChoiceId)) {
    return "pass_ok";
  }

  if (isCatchupGateQuestion(questionIndex)) {
    if (qualifying) {
      return "qualified_skip";
    }
    return "catchup_offer";
  }

  if (isCatchupRetryQuestion(questionIndex)) {
    if (questionIndex === 9 && qualifying) {
      return "qualified";
    }
    if (questionIndex === 11 && qualifying) {
      return "qualified";
    }
    return qualifying ? "qualified" : "eliminated";
  }

  if (!myChoiceId) {
    return "eliminated";
  }

  return qualifying ? "qualified" : "eliminated";
}

/** Mise à jour du statut joueur après reveal (côté serveur). */
export function getProgressAfterReveal(
  progress: Debile100PlayerProgress,
  questionIndex: number,
  choiceId: string | null,
  correctChoiceId: string
): Debile100PlayerProgress {
  const qualifying = isAnswerQualifying(choiceId, correctChoiceId);
  const next = { ...progress };

  if (isCatchupGateQuestion(questionIndex)) {
    if (qualifying) {
      next.catchup_question_index = null;
      next.skip_question_index = questionIndex + 1;
      return next;
    }
    next.catchup_question_index = questionIndex + 1;
    next.skip_question_index = null;
    return next;
  }

  if (isCatchupRetryQuestion(questionIndex)) {
    next.catchup_question_index = null;
    if (!qualifying) {
      next.status = "eliminated";
      next.eliminated_at_question = questionIndex;
    }
    return next;
  }

  if (!qualifying && !isPassAnswer(choiceId)) {
    next.status = "eliminated";
    next.eliminated_at_question = questionIndex;
  }

  return next;
}

/** Efface le skip une fois la question de rattrapage passée pour les qualifiés. */
export function clearSkipAfterCatchupRound(
  progress: Debile100PlayerProgress,
  revealedQuestionIndex: number
): Debile100PlayerProgress {
  if (
    isCatchupRetryQuestion(revealedQuestionIndex) &&
    progress.skip_question_index === revealedQuestionIndex
  ) {
    return { ...progress, skip_question_index: null };
  }
  return progress;
}
