"use client";

import { useEffect, useRef, useState } from "react";
import {
  canSubmitDebile100Answer,
  DEBILE100_QUESTION_SECONDS,
  DEBILE100_SYNC_GRACE_SECONDS,
  getDebile100TimerState,
  type Debile100Phase
} from "@/lib/debile100";
import type { Debile100SyncPayload } from "@/lib/debile100-sync";
import type { Debile100PlayerView } from "@/lib/debile100-page";

type Props = Debile100PlayerView & {
  playerPseudo: string | null;
};

type GameState = Omit<
  Debile100SyncPayload,
  "serverNow" | "timerPhase" | "secondsRemaining" | "graceSecondsRemaining"
>;

function toGameFromProps(props: Debile100PlayerView): GameState {
  return {
    questionStartedAt: props.questionStartedAt,
    currentQuestion: props.currentQuestion,
    phase: props.phase,
    playerStatus: props.playerStatus,
    myChoiceId: props.myChoiceId,
    showQuestion: props.showQuestion,
    currentQuestionData: props.currentQuestionData
  };
}

function toGameFromPayload(payload: Debile100SyncPayload): GameState {
  return {
    questionStartedAt: payload.questionStartedAt,
    currentQuestion: payload.currentQuestion,
    phase: payload.phase,
    playerStatus: payload.playerStatus,
    myChoiceId: payload.myChoiceId,
    showQuestion: payload.showQuestion,
    currentQuestionData: payload.currentQuestionData
  };
}

export function Debile100Quiz({ eventId, playerPseudo, ...initial }: Props) {
  const [game, setGame] = useState<GameState>(() => toGameFromProps({ eventId, ...initial }));
  const clockSkewMsRef = useRef(0);
  const clockReadyRef = useRef(false);
  const [timer, setTimer] = useState(() =>
    getDebile100TimerState(initial.questionStartedAt, initial.phase)
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function serverNowMs() {
    return Date.now() + clockSkewMsRef.current;
  }

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/debile100/sync?eventId=${encodeURIComponent(eventId)}`, {
          cache: "no-store"
        });
        if (!response.ok || cancelled) {
          return;
        }
        const payload = (await response.json()) as Debile100SyncPayload;
        if (cancelled) {
          return;
        }
        clockSkewMsRef.current = payload.serverNow - Date.now();
        clockReadyRef.current = true;
        setGame(toGameFromPayload(payload));
      } catch {
        /* ignore réseau ponctuel */
      }
    }

    void poll();
    const pollId = window.setInterval(() => void poll(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [eventId]);

  useEffect(() => {
    if (game.phase !== "playing" || !game.questionStartedAt) {
      setTimer(getDebile100TimerState(game.questionStartedAt, game.phase));
      return;
    }

    function tick() {
      const serverNow = Date.now() + clockSkewMsRef.current;
      setTimer(getDebile100TimerState(game.questionStartedAt, game.phase as Debile100Phase, serverNow));
    }

    tick();
    const tickId = window.setInterval(tick, 200);
    return () => window.clearInterval(tickId);
  }, [game.phase, game.questionStartedAt, game.currentQuestion]);

  async function submitAnswer(choiceId: string) {
    if (!canSubmitDebile100Answer(game.questionStartedAt, game.phase, serverNowMs())) {
      setError("Le temps est écoulé — trop tard pour répondre.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/debile100/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, choiceId })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erreur.");
      }
      setGame((prev) => ({ ...prev, myChoiceId: choiceId }));
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (!playerPseudo) {
    return (
      <p className="subtitle">
        Connecte-toi avec ton pseudo pour participer au quiz en direct.
      </p>
    );
  }

  if (game.playerStatus === "eliminated") {
    return (
      <div className="debile100Eliminated card">
        <h3>Tu es éliminé</h3>
        <p className="subtitle">La partie continue sans toi. Merci d&apos;avoir joué !</p>
      </div>
    );
  }

  if (!game.showQuestion || !game.currentQuestionData) {
    return (
      <div className="debile100Waiting">
        <p className="subtitle">
          En attente de la question {game.currentQuestion > 0 ? game.currentQuestion + 1 : 1}…
          L&apos;organisateur lance le chrono depuis l&apos;admin.
        </p>
        {game.currentQuestion > 0 && game.phase === "revealed" ? (
          <p className="ok">Dernière question terminée — prépare-toi pour la suite.</p>
        ) : null}
      </div>
    );
  }

  const question = game.currentQuestionData;
  const correctId = question.correctChoiceId;
  const isRevealed = game.phase === "revealed";
  const isCorrect = game.myChoiceId === correctId;
  const inGrace = game.phase === "playing" && timer.timerPhase === "grace";
  const timerRunning = game.phase === "playing" && timer.timerPhase === "running";
  const timerExpired = game.phase === "playing" && timer.timerPhase === "expired";

  const canAnswer =
    canSubmitDebile100Answer(game.questionStartedAt, game.phase, serverNowMs()) &&
    !game.myChoiceId &&
    game.playerStatus === "active";

  return (
    <div className="debile100Quiz">
      {error ? <p className="error">{error}</p> : null}

      <article className="debile100QuestionCard">
        <header className="debile100QuestionHeader">
          <span className="badge">Question {question.index}</span>
          {inGrace ? (
            <span className="debile100Timer debile100TimerGrace">
              Chrono dans {timer.graceSecondsRemaining}s
            </span>
          ) : null}
          {timerRunning ? (
            <span
              className={
                timer.secondsRemaining <= 5
                  ? "debile100Timer debile100TimerUrgent"
                  : "debile100Timer"
              }
            >
              {timer.secondsRemaining}s
            </span>
          ) : null}
        </header>

        <h3 className="debile100QuestionText">{question.text}</h3>

        <div className="debile100Choices">
          {question.choices.map((choice) => {
            const isMine = game.myChoiceId === choice.id;
            const isCorrectChoice = choice.id === correctId;

            let className = "debile100Choice";
            if (isRevealed) {
              if (isCorrectChoice) {
                className += " debile100ChoiceCorrect";
              } else if (isMine) {
                className += " debile100ChoiceWrong";
              } else {
                className += " debile100ChoiceMuted";
              }
            } else if (isMine) {
              className += " debile100ChoiceSelected";
            }

            const disabled =
              pending ||
              Boolean(game.myChoiceId) ||
              inGrace ||
              timerExpired ||
              isRevealed ||
              !canAnswer;

            return (
              <button
                key={choice.id}
                type="button"
                className={className}
                disabled={disabled}
                onClick={() => void submitAnswer(choice.id)}
              >
                {choice.label}
              </button>
            );
          })}
        </div>

        {inGrace ? (
          <p className="subtitle debile100Hint">
            Lis la question — le chrono de {DEBILE100_QUESTION_SECONDS} secondes démarre dans quelques
            instants ({DEBILE100_SYNC_GRACE_SECONDS} s de synchro pour tout le monde).
          </p>
        ) : null}

        {timerRunning && game.myChoiceId ? (
          <p className="ok">Réponse enregistrée — en attente de la fin du chrono.</p>
        ) : null}

        {timerExpired && !game.myChoiceId ? (
          <p className="error">Temps écoulé — tu n&apos;as pas répondu à temps.</p>
        ) : null}

        {timerExpired && game.myChoiceId ? (
          <p className="subtitle">
            Temps écoulé — en attente de la correction par l&apos;organisateur.
          </p>
        ) : null}

        {isRevealed && isCorrect ? (
          <p className="ok debile100Verdict">
            Vous êtes qualifiés pour la question suivante.
          </p>
        ) : null}

        {isRevealed && game.myChoiceId && !isCorrect ? (
          <p className="error debile100Verdict">Vous êtes éliminés.</p>
        ) : null}

        {isRevealed && !game.myChoiceId ? (
          <p className="error debile100Verdict">
            Pas de réponse — vous êtes éliminés.
          </p>
        ) : null}
      </article>

      {timerRunning ? (
        <p className="subtitle debile100Hint">
          {DEBILE100_QUESTION_SECONDS} secondes pour répondre, un seul clic, sans modification possible.
        </p>
      ) : null}
    </div>
  );
}
