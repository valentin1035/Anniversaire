export const DEBILE100_QUESTION_COUNT = 14;
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

export type Debile100Question = {
  index: number;
  text: string;
  /** Indice (questions 5 à 7), configurable dans l'admin. */
  hint?: string;
  choices: Debile100Choice[];
  correctChoiceId: string;
};

export type Debile100PlayerStatus = "active" | "eliminated";

export function createDefaultQuestions(): Debile100Question[] {
  return Array.from({ length: DEBILE100_QUESTION_COUNT }, (_, offset) => {
    const index = offset + 1;
    return {
      index,
      text: `Question ${index} — à personnaliser dans l'admin`,
      hint: index >= 5 && index <= 7 ? `Indice question ${index} — à personnaliser` : undefined,
      choices: [
        { id: "A", label: "Réponse A" },
        { id: "B", label: "Réponse B" },
        { id: "C", label: "Réponse C" },
        { id: "D", label: "Réponse D" }
      ],
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
    const hint = hintRaw || (base.index >= 5 && base.index <= 7 ? base.hint : undefined);
    const correctChoiceId =
      typeof row.correctChoiceId === "string" ? row.correctChoiceId : base.correctChoiceId;

    return {
      index: base.index,
      text: text || base.text,
      hint,
      choices: choices.length >= 2 ? choices : base.choices,
      correctChoiceId: choices.some((c) => c.id === correctChoiceId)
        ? correctChoiceId
        : choices[0]?.id ?? base.correctChoiceId
    };
  });
}

export function isHintQuestion(index: number): boolean {
  return index >= 5 && index <= 7;
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
  | "not_playing";

export type Debile100AnswerRecapRow = {
  playerId: string;
  pseudo: string;
  choiceLabel: string | null;
  result: Debile100AnswerRecapResult;
};

export type Debile100QuestionRecap = {
  questionIndex: number;
  correctChoiceLabel: string;
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
