"use client";

import { useEffect, useRef, useState } from "react";
import {
  canSubmitDebile100Answer,
  DEBILE100_PASS_CHOICE_ID,
  DEBILE100_QUESTION_SECONDS,
  DEBILE100_SYNC_GRACE_SECONDS,
  getDebile100TimerState,
  type Debile100Phase
} from "@/lib/debile100";
import {
  isAnswerQualifying,
  isPassAnswer,
  type Debile100RevealOutcome
} from "@/lib/debile100-rules";
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
    currentQuestionData: props.currentQuestionData,
    viewMode: props.viewMode,
    waitingMessage: props.waitingMessage,
    finaleQualified: props.finaleQualified,
    hintAvailable: props.hintAvailable,
    hintUsed: props.hintUsed,
    hintText: props.hintText,
    passAvailable: props.passAvailable,
    passUsed: props.passUsed,
    revealOutcome: props.revealOutcome
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
    currentQuestionData: payload.currentQuestionData,
    viewMode: payload.viewMode,
    waitingMessage: payload.waitingMessage,
    finaleQualified: payload.finaleQualified,
    hintAvailable: payload.hintAvailable,
    hintUsed: payload.hintUsed,
    hintText: payload.hintText,
    passAvailable: payload.passAvailable,
    passUsed: payload.passUsed,
    revealOutcome: payload.revealOutcome
  };
}

function verdictMessage(
  outcome: Debile100RevealOutcome,
  questionIndex: number
): string | null {
  switch (outcome) {
    case "finale":
      return "Bravo, vous êtes qualifié(e) jusqu'à la finale !";
    case "qualified":
      if (questionIndex === 9) {
        return "Bonne réponse — vous êtes qualifié(e) pour la question 10.";
      }
      if (questionIndex === 11) {
        return "Bonne réponse — vous êtes qualifié(e) pour la question 12.";
      }
      return "Vous êtes qualifiés pour la question suivante.";
    case "qualified_skip":
      if (questionIndex === 8) {
        return "Bonne réponse — vous passez la question 9, rendez-vous à la question 10.";
      }
      if (questionIndex === 10) {
        return "Bonne réponse — vous passez la question 11, rendez-vous à la question 12.";
      }
      return "Bonne réponse — vous passez la question de rattrapage.";
    case "catchup_offer":
      if (questionIndex === 8) {
        return "Mauvaise réponse — vous aurez la question 9 pour vous rattraper.";
      }
      if (questionIndex === 10) {
        return "Mauvaise réponse — vous aurez la question 11 pour vous rattraper.";
      }
      return "Mauvaise réponse — question de rattrapage à venir.";
    case "pass_ok":
      return "Passe utilisé — vous êtes qualifié(e) pour la question suivante.";
    case "eliminated":
      return "Vous êtes éliminés.";
    default:
      return null;
  }
}

export function Debile100Quiz({ eventId, playerPseudo, ...initial }: Props) {
  const [game, setGame] = useState<GameState>(() => toGameFromProps({ eventId, ...initial }));
  const [localHintText, setLocalHintText] = useState<string | null>(initial.hintText);
  const clockSkewMsRef = useRef(0);
  const [timer, setTimer] = useState(() =>
    getDebile100TimerState(initial.questionStartedAt, initial.phase)
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function serverNowMs() {
    return Date.now() + clockSkewMsRef.current;
  }

  useEffect(() => {
    setLocalHintText(game.hintText);
  }, [game.hintText, game.currentQuestion]);

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
        setGame(toGameFromPayload(payload));
      } catch {
        /* ignore */
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
      setTimer(
        getDebile100TimerState(game.questionStartedAt, game.phase as Debile100Phase, serverNow)
      );
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

  async function requestHint() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/debile100/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      });
      const payload = (await response.json()) as { error?: string; hintText?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erreur.");
      }
      setLocalHintText(payload.hintText ?? null);
      setGame((prev) => ({
        ...prev,
        hintUsed: true,
        hintAvailable: false,
        hintText: payload.hintText ?? null
      }));
    } catch (hintError) {
      setError((hintError as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function requestPass() {
    if (!canSubmitDebile100Answer(game.questionStartedAt, game.phase, serverNowMs())) {
      setError("Le temps est écoulé — trop tard pour utiliser Passe.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/debile100/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erreur.");
      }
      setGame((prev) => ({
        ...prev,
        myChoiceId: DEBILE100_PASS_CHOICE_ID,
        passUsed: true,
        passAvailable: false
      }));
    } catch (passError) {
      setError((passError as Error).message);
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

  if (game.viewMode === "eliminated" || game.playerStatus === "eliminated") {
    return (
      <div className="debile100Eliminated card">
        <h3>Tu es éliminé</h3>
        <p className="subtitle">La partie continue sans toi. Merci d&apos;avoir joué !</p>
      </div>
    );
  }

  if (game.viewMode === "waiting" || !game.showQuestion || !game.currentQuestionData) {
    return (
      <div className="debile100Waiting">
        {game.finaleQualified ? (
          <p className="ok debile100FinaleBanner">
            Bravo, vous êtes qualifié(e) jusqu&apos;à la finale !
          </p>
        ) : null}
        <p className="subtitle">
          {game.waitingMessage ??
            (game.phase === "playing" && game.currentQuestion > 0
              ? `Question ${game.currentQuestion} — chargement…`
              : game.phase === "revealed" && game.currentQuestion > 0
                ? "En attente de la prochaine question…"
                : "En attente du lancement par l'organisateur…")}
        </p>
      </div>
    );
  }

  const question = game.currentQuestionData;
  const correctId = question.correctChoiceId;
  const isRevealed = game.phase === "revealed";
  const usedPass = isPassAnswer(game.myChoiceId);
  const inGrace = game.phase === "playing" && timer.timerPhase === "grace";
  const timerRunning = game.phase === "playing" && timer.timerPhase === "running";
  const timerExpired = game.phase === "playing" && timer.timerPhase === "expired";
  const verdict = verdictMessage(game.revealOutcome, question.index);

  const canAnswer =
    canSubmitDebile100Answer(game.questionStartedAt, game.phase, serverNowMs()) &&
    !game.myChoiceId &&
    game.playerStatus === "active";

  const showHintButton = game.hintAvailable && !game.hintUsed && !localHintText;
  const hintDisabled = !showHintButton || pending || inGrace || isRevealed;
  const passDisabled =
    !game.passAvailable ||
    game.passUsed ||
    pending ||
    Boolean(game.myChoiceId) ||
    inGrace ||
    isRevealed ||
    !canSubmitDebile100Answer(game.questionStartedAt, game.phase, serverNowMs());

  return (
    <div className="debile100Quiz">
      {game.finaleQualified ? (
        <p className="ok debile100FinaleBanner">
          Bravo, vous êtes qualifié(e) jusqu&apos;à la finale !
        </p>
      ) : null}

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

        <div className="debile100Powerups">
          {question.index >= 5 && question.index <= 7 ? (
            <button
              type="button"
              className={
                showHintButton
                  ? "beerPongBtnSecondary debile100HintBtn"
                  : "beerPongBtnSecondary debile100HintBtn debile100PowerupUsed"
              }
              disabled={hintDisabled}
              onClick={() => void requestHint()}
            >
              {game.hintUsed || localHintText ? "Indice utilisé" : "Indice"}
            </button>
          ) : null}
          {question.index >= 12 && question.index <= 14 ? (
            <button
              type="button"
              className={
                game.passAvailable && !game.passUsed && !usedPass
                  ? "beerPongBtnSecondary debile100PassBtn"
                  : "beerPongBtnSecondary debile100PassBtn debile100PowerupUsed"
              }
              disabled={passDisabled}
              onClick={() => void requestPass()}
            >
              {game.passUsed || usedPass ? "Passe utilisé" : "Passe"}
            </button>
          ) : null}
        </div>

        {localHintText ? (
          <p className="debile100HintBox">
            <strong>Indice :</strong> {localHintText}
          </p>
        ) : null}

        <h3 className="debile100QuestionText">{question.text}</h3>

        {!usedPass ? (
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
        ) : (
          <p className="ok">Tu as utilisé Passe — en attente de la fin du chrono.</p>
        )}

        {inGrace ? (
          <p className="subtitle debile100Hint">
            Lis la question — le chrono de {DEBILE100_QUESTION_SECONDS} secondes démarre dans quelques
            instants ({DEBILE100_SYNC_GRACE_SECONDS} s de synchro).
          </p>
        ) : null}

        {timerRunning && game.myChoiceId && !usedPass ? (
          <p className="ok">Réponse enregistrée — en attente de la fin du chrono.</p>
        ) : null}

        {timerExpired && !game.myChoiceId ? (
          <p className="error">Temps écoulé — tu n&apos;as pas répondu à temps.</p>
        ) : null}

        {timerExpired && game.myChoiceId && !isRevealed ? (
          <p className="subtitle">Temps écoulé — en attente de la correction.</p>
        ) : null}

        {isRevealed && verdict ? (
          <p
            className={
              game.revealOutcome === "eliminated"
                ? "error debile100Verdict"
                : "ok debile100Verdict"
            }
          >
            {verdict}
          </p>
        ) : null}
      </article>

      {timerRunning ? (
        <p className="subtitle debile100Hint">
          {DEBILE100_QUESTION_SECONDS} secondes pour répondre. Indice (Q5–7) et Passe (Q12–14) : une
          seule utilisation chacun sur toute la manche.
        </p>
      ) : null}
    </div>
  );
}
