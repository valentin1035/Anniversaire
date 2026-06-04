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
