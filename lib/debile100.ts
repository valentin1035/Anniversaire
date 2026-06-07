export const DEBILE100_QUESTION_COUNT = 14;
/** Indice utilisable une fois sur les questions 4 et 5. */
export const DEBILE100_HINT_QUESTION_MIN = 4;
export const DEBILE100_HINT_QUESTION_MAX = 5;
/** Passe utilisable une fois sur les questions 10 et 11. */
export const DEBILE100_PASS_QUESTION_MIN = 10;
export const DEBILE100_PASS_QUESTION_MAX = 11;
/** Deuxième chance : portes 6 et 8, rattrapage 7 et 9. */
export const DEBILE100_CATCHUP_GATE_QUESTIONS = [6, 8] as const;
export const DEBILE100_CATCHUP_RETRY_QUESTIONS = [7, 9] as const;
export const DEBILE100_PASS_CHOICE_ID = "__PASS__";
export const DEBILE100_QUESTION_SECONDS = 30;
/** Délai avant le chrono : le temps que les téléphones reçoivent la question. */
export const DEBILE100_SYNC_GRACE_SECONDS = 2;
/** Marge serveur pour la latence réseau au moment du clic (ms). */
export const DEBILE100_SUBMIT_LEEWAY_MS = 1500;

export type Debile100TimerPhase = "idle" | "grace" | "running" | "expired";

export type Debile100Phase = "idle" | "playing" | "revealed";

export type Debile100Choice = {
  id: string;
  label: string;
};

export type Debile100QuestionType = "choice" | "open";
export type Debile100OpenAnswerType = "text" | "number";
export type Debile100ChoiceCount = 2 | 3 | 4;

export const DEBILE100_CHOICE_IDS = ["A", "B", "C", "D"] as const;

export type Debile100Question = {
  index: number;
  text: string;
  /** Indice (questions 4 à 5), configurable dans l'admin. */
  hint?: string;
  questionType: Debile100QuestionType;
  choices: Debile100Choice[];
  correctChoiceId: string;
  openAnswerType?: Debile100OpenAnswerType;
  correctOpenAnswer?: string;
};

export function createDebile100Choices(count: Debile100ChoiceCount): Debile100Choice[] {
  return DEBILE100_CHOICE_IDS.slice(0, count).map((id) => ({
    id,
    label: `Réponse ${id}`
  }));
}

export function isDebile100OpenQuestion(question: Debile100Question): boolean {
  return question.questionType === "open";
}

export function getDebile100CorrectAnswerLabel(question: Debile100Question): string {
  if (isDebile100OpenQuestion(question)) {
    return question.correctOpenAnswer?.trim() || "—";
  }
  const choice = question.choices.find((entry) => entry.id === question.correctChoiceId);
  return choice?.label ?? question.correctChoiceId;
}

export function formatDebile100StoredAnswer(
  question: Debile100Question,
  choiceId: string
): string {
  if (choiceId === DEBILE100_PASS_CHOICE_ID) {
    return "Passe";
  }
  if (isDebile100OpenQuestion(question)) {
    return choiceId;
  }
  const choice = question.choices.find((entry) => entry.id === choiceId);
  return choice?.label ?? choiceId;
}

export function normalizeDebile100OpenAnswerInput(
  raw: string,
  type: Debile100OpenAnswerType
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Réponse vide." };
  }

  if (type === "number") {
    const compact = trimmed.replace(/\s/g, "").replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(compact)) {
      return { ok: false, error: "Entre un nombre valide." };
    }
    const num = Number(compact);
    if (!Number.isFinite(num)) {
      return { ok: false, error: "Entre un nombre valide." };
    }
    return { ok: true, value: String(num) };
  }

  return { ok: true, value: trimmed };
}

export function isDebile100OpenAnswerCorrect(
  playerAnswer: string,
  expectedAnswer: string,
  type: Debile100OpenAnswerType
): boolean {
  const player = normalizeDebile100OpenAnswerInput(playerAnswer, type);
  const expected = normalizeDebile100OpenAnswerInput(expectedAnswer, type);
  if (!player.ok || !expected.ok) {
    return false;
  }

  if (type === "number") {
    return player.value === expected.value;
  }

  return player.value.toLocaleLowerCase("fr") === expected.value.toLocaleLowerCase("fr");
}

export function assertDebile100QuestionsValid(questions: Debile100Question[]): void {
  if (questions.length !== DEBILE100_QUESTION_COUNT) {
    throw new Error(`Il faut exactement ${DEBILE100_QUESTION_COUNT} questions.`);
  }

  for (const question of questions) {
    if (!question.text.trim()) {
      throw new Error(`La question ${question.index} est vide.`);
    }

    if (isDebile100OpenQuestion(question)) {
      const openType = question.openAnswerType ?? "text";
      const expected = question.correctOpenAnswer?.trim() ?? "";
      if (!expected) {
        throw new Error(`La question ${question.index} : indique la bonne réponse attendue.`);
      }
      const normalized = normalizeDebile100OpenAnswerInput(expected, openType);
      if (!normalized.ok) {
        throw new Error(`La question ${question.index} : ${normalized.error}`);
      }
      continue;
    }

    if (question.choices.length < 2 || question.choices.length > 4) {
      throw new Error(`La question ${question.index} doit avoir 2, 3 ou 4 réponses.`);
    }
    for (const choice of question.choices) {
      if (!choice.id.trim() || !choice.label.trim()) {
        throw new Error(`La question ${question.index} : toutes les réponses doivent être renseignées.`);
      }
    }
    if (!question.choices.some((choice) => choice.id === question.correctChoiceId)) {
      throw new Error(`La question ${question.index} : bonne réponse invalide.`);
    }
  }
}

export type Debile100PlayerStatus = "active" | "eliminated";

export function createDefaultQuestions(): Debile100Question[] {
  return Array.from({ length: DEBILE100_QUESTION_COUNT }, (_, offset) => {
    const index = offset + 1;
    return {
      index,
      text: `Question ${index} — à personnaliser dans l'admin`,
      hint:
        index >= DEBILE100_HINT_QUESTION_MIN && index <= DEBILE100_HINT_QUESTION_MAX
          ? `Indice question ${index} — à personnaliser`
          : undefined,
      questionType: "choice",
      choices: createDebile100Choices(4),
      correctChoiceId: "A"
    };
  });
}

export function normalizeQuestions(raw: unknown): Debile100Question[] {
  const defaults = createDefaultQuestions();
  if (!Array.isArray(raw)) {
    return defaults;
  }

  return defaults.map((base, offset) => {
    const entry = raw[offset];
    if (!entry || typeof entry !== "object") {
      return base;
    }
    const row = entry as Record<string, unknown>;
    const choicesRaw = Array.isArray(row.choices) ? row.choices : [];
    const choices: Debile100Choice[] = [];
    for (const choiceEntry of choicesRaw) {
      if (!choiceEntry || typeof choiceEntry !== "object") {
        continue;
      }
      const choice = choiceEntry as Record<string, unknown>;
      const id = typeof choice.id === "string" ? choice.id.trim() : "";
      const label = typeof choice.label === "string" ? choice.label.trim() : "";
      if (id && label) {
        choices.push({ id, label });
      }
    }

    const text = typeof row.text === "string" ? row.text.trim() : base.text;
    const hintRaw = typeof row.hint === "string" ? row.hint.trim() : base.hint ?? "";
    const hint =
      hintRaw ||
      (base.index >= DEBILE100_HINT_QUESTION_MIN && base.index <= DEBILE100_HINT_QUESTION_MAX
        ? base.hint
        : undefined);
    const questionType: Debile100QuestionType =
      row.questionType === "open" || row.questionType === "choice"
        ? row.questionType
        : base.questionType;
    const openAnswerType: Debile100OpenAnswerType =
      row.openAnswerType === "number" ? "number" : "text";
    const correctOpenAnswer =
      typeof row.correctOpenAnswer === "string" ? row.correctOpenAnswer.trim() : "";
    const correctChoiceId =
      typeof row.correctChoiceId === "string" ? row.correctChoiceId : base.correctChoiceId;

    if (questionType === "open") {
      return {
        index: base.index,
        text: text || base.text,
        hint,
        questionType: "open",
        choices: [],
        correctChoiceId: "",
        openAnswerType,
        correctOpenAnswer: correctOpenAnswer || base.correctOpenAnswer || ""
      };
    }

    const normalizedChoices =
      choices.length >= 2 && choices.length <= 4 ? choices : base.choices;

    return {
      index: base.index,
      text: text || base.text,
      hint,
      questionType: "choice",
      choices: normalizedChoices,
      correctChoiceId: normalizedChoices.some((c) => c.id === correctChoiceId)
        ? correctChoiceId
        : normalizedChoices[0]?.id ?? base.correctChoiceId
    };
  });
}

export function getQuestionByIndex(
  questions: Debile100Question[],
  index: number
): Debile100Question | null {
  return questions.find((question) => question.index === index) ?? null;
}

export function getDebile100Deadlines(launchedAt: string): {
  graceEndMs: number;
  answerEndMs: number;
} {
  const launchedMs = new Date(launchedAt).getTime();
  const graceEndMs = launchedMs + DEBILE100_SYNC_GRACE_SECONDS * 1000;
  const answerEndMs = graceEndMs + DEBILE100_QUESTION_SECONDS * 1000;
  return { graceEndMs, answerEndMs };
}

export function getDebile100TimerState(
  launchedAt: string | null,
  phase: Debile100Phase,
  nowMs: number = Date.now()
): {
  timerPhase: Debile100TimerPhase;
  secondsRemaining: number;
  graceSecondsRemaining: number;
} {
  if (phase !== "playing" || !launchedAt) {
    return { timerPhase: "idle", secondsRemaining: 0, graceSecondsRemaining: 0 };
  }

  const { graceEndMs, answerEndMs } = getDebile100Deadlines(launchedAt);

  if (nowMs < graceEndMs) {
    return {
      timerPhase: "grace",
      secondsRemaining: DEBILE100_QUESTION_SECONDS,
      graceSecondsRemaining: Math.max(0, Math.floor((graceEndMs - nowMs) / 1000))
    };
  }

  if (nowMs < answerEndMs) {
    return {
      timerPhase: "running",
      secondsRemaining: Math.max(0, Math.floor((answerEndMs - nowMs) / 1000)),
      graceSecondsRemaining: 0
    };
  }

  return { timerPhase: "expired", secondsRemaining: 0, graceSecondsRemaining: 0 };
}

export function getQuestionSecondsRemaining(
  launchedAt: string | null,
  phase: Debile100Phase
): number {
  return getDebile100TimerState(launchedAt, phase).secondsRemaining;
}

export function isQuestionTimerExpired(startedAt: string | null, phase: Debile100Phase): boolean {
  return getDebile100TimerState(startedAt, phase).timerPhase === "expired";
}

export function canSubmitDebile100Answer(
  startedAt: string | null,
  phase: Debile100Phase,
  nowMs: number = Date.now()
): boolean {
  if (phase !== "playing" || !startedAt) {
    return false;
  }
  const { graceEndMs, answerEndMs } = getDebile100Deadlines(startedAt);
  return nowMs >= graceEndMs && nowMs < answerEndMs + DEBILE100_SUBMIT_LEEWAY_MS;
}

export const DEBILE100_PLAYER_COUNT = 12;

export type Debile100AnswerRecapResult =
  | "correct"
  | "pass"
  | "wrong"
  | "no_answer"
  | "not_playing"
  | "pending";

export type Debile100AnswerRecapRow = {
  playerId: string;
  pseudo: string;
  choiceLabel: string | null;
  result: Debile100AnswerRecapResult;
};

export type Debile100QuestionRecap = {
  questionIndex: number;
  correctChoiceLabel: string | null;
  isRevealed: boolean;
  rows: Debile100AnswerRecapRow[];
};

export function getDebile100RevealedQuestionCount(
  currentQuestion: number,
  phase: Debile100Phase
): number {
  if (currentQuestion <= 0) {
    return 0;
  }
  if (phase === "revealed") {
    return currentQuestion;
  }
  return currentQuestion - 1;
}

export type Debile100RankingEntry = {
  playerId: string;
  pseudo: string;
  status: Debile100PlayerStatus;
  eliminatedAtQuestion: number | null;
  survivalScore: number;
};

export type Debile100LeaderboardRow = {
  rank: number;
  playerId: string;
  pseudo: string;
  status: Debile100PlayerStatus;
  eliminatedAtQuestion: number | null;
  survivalScore: number;
  eventPoints: number | null;
};

export function computeDebile100SurvivalScore(
  status: Debile100PlayerStatus,
  eliminatedAtQuestion: number | null
): number {
  if (status === "active") {
    return DEBILE100_QUESTION_COUNT + 1;
  }
  return eliminatedAtQuestion ?? 0;
}

export function sortDebile100RankingEntries(
  entries: Debile100RankingEntry[]
): Debile100RankingEntry[] {
  return [...entries].sort((a, b) => {
    if (b.survivalScore !== a.survivalScore) {
      return b.survivalScore - a.survivalScore;
    }
    return a.pseudo.localeCompare(b.pseudo, "fr");
  });
}

function sameDebile100TieGroup(a: Debile100RankingEntry, b: Debile100RankingEntry): boolean {
  return a.survivalScore === b.survivalScore;
}

/** 12 → 1 points ; ex-aequo = mêmes points. */
export function computeDebile100EventPoints(
  entries: Debile100RankingEntry[]
): Map<string, number> {
  const sorted = sortDebile100RankingEntries(entries);
  const pointsByPlayer = new Map<string, number>();
  let index = 0;

  while (index < sorted.length) {
    const group: Debile100RankingEntry[] = [sorted[index]];
    let next = index + 1;
    while (next < sorted.length && sameDebile100TieGroup(sorted[index], sorted[next])) {
      group.push(sorted[next]);
      next += 1;
    }

    const points = Math.max(1, DEBILE100_PLAYER_COUNT - index);
    for (const entry of group) {
      pointsByPlayer.set(entry.playerId, points);
    }
    index = next;
  }

  return pointsByPlayer;
}

export function buildDebile100Leaderboard(
  entries: Debile100RankingEntry[],
  pointsByPlayer: Map<string, number> | null
): Debile100LeaderboardRow[] {
  const sorted = sortDebile100RankingEntries(entries);
  let rank = 0;
  let index = 0;
  const rows: Debile100LeaderboardRow[] = [];

  while (index < sorted.length) {
    const group: Debile100RankingEntry[] = [sorted[index]];
    let next = index + 1;
    while (next < sorted.length && sameDebile100TieGroup(sorted[index], sorted[next])) {
      group.push(sorted[next]);
      next += 1;
    }

    rank += 1;
    for (const entry of group) {
      rows.push({
        rank,
        playerId: entry.playerId,
        pseudo: entry.pseudo,
        status: entry.status,
        eliminatedAtQuestion: entry.eliminatedAtQuestion,
        survivalScore: entry.survivalScore,
        eventPoints: pointsByPlayer?.get(entry.playerId) ?? null
      });
    }
    index = next;
  }

  return rows;
}

export function canFinalizeDebile100State(state: {
  current_question: number;
  phase: Debile100Phase;
}): boolean {
  return state.current_question === DEBILE100_QUESTION_COUNT && state.phase === "revealed";
}
