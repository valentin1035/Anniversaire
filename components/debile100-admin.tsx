"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createDebile100Choices,
  DEBILE100_QUESTION_COUNT,
  DEBILE100_SYNC_GRACE_SECONDS,
  type Debile100ChoiceCount,
  type Debile100OpenAnswerType,
  type Debile100Question
} from "@/lib/debile100";
import { isHintQuestion } from "@/lib/debile100-rules";
import { Debile100AnswerRecap } from "@/components/debile100-answer-recap";
import { Debile100Leaderboard } from "@/components/debile100-leaderboard";
import { Debile100ReinstatePanel } from "@/components/debile100-reinstate-panel";
import type { Debile100AdminView } from "@/lib/debile100-page";

type Props = Debile100AdminView;

export function Debile100Admin({
  eventId,
  questions,
  currentQuestion,
  phase,
  timerPhase,
  secondsRemaining,
  graceSecondsRemaining,
  answerCounts,
  activeCount,
  eliminatedCount,
  isFinalized,
  canFinalize,
  leaderboard,
  questionRecaps,
  pendingRecap,
  eliminatedPlayers
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Debile100Question[]>(questions);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "playing" && phase !== "revealed") {
      return;
    }
    const refreshMs = phase === "playing" ? 1500 : 4000;
    const refreshId = window.setInterval(() => router.refresh(), refreshMs);
    return () => window.clearInterval(refreshId);
  }, [phase, currentQuestion, router]);

  function formatLiveStatus(): string {
    if (phase !== "playing") {
      return "";
    }
    if (timerPhase === "grace") {
      return `, synchro ${graceSecondsRemaining}s puis chrono 30s`;
    }
    if (timerPhase === "running") {
      return `, chrono ${secondsRemaining}s`;
    }
    if (timerPhase === "expired") {
      return ", chrono terminé";
    }
    return "";
  }

  async function apiCall(body: Record<string, unknown>) {
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/admin/debile100", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, ...body })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erreur.");
      }
      router.refresh();
    } catch (callError) {
      setError((callError as Error).message);
    } finally {
      setPending(false);
    }
  }

  function updateQuestion(index: number, patch: Partial<Debile100Question>) {
    setDraft((prev) =>
      prev.map((question) => (question.index === index ? { ...question, ...patch } : question))
    );
  }

  function updateChoiceLabel(questionIndex: number, choiceId: string, label: string) {
    setDraft((prev) =>
      prev.map((question) => {
        if (question.index !== questionIndex) {
          return question;
        }
        return {
          ...question,
          choices: question.choices.map((choice) =>
            choice.id === choiceId ? { ...choice, label } : choice
          )
        };
      })
    );
  }

  function setQuestionType(questionIndex: number, questionType: "choice" | "open") {
    setDraft((prev) =>
      prev.map((question) => {
        if (question.index !== questionIndex) {
          return question;
        }
        if (questionType === "open") {
          return {
            ...question,
            questionType: "open",
            choices: [],
            correctChoiceId: "",
            openAnswerType: question.openAnswerType ?? "text",
            correctOpenAnswer: question.correctOpenAnswer ?? ""
          };
        }
        const choices =
          question.choices.length >= 2
            ? question.choices
            : createDebile100Choices(4);
        return {
          ...question,
          questionType: "choice",
          choices,
          correctChoiceId: choices.some((choice) => choice.id === question.correctChoiceId)
            ? question.correctChoiceId
            : choices[0].id,
          openAnswerType: undefined,
          correctOpenAnswer: undefined
        };
      })
    );
  }

  function setChoiceCount(questionIndex: number, count: Debile100ChoiceCount) {
    setDraft((prev) =>
      prev.map((question) => {
        if (question.index !== questionIndex || question.questionType !== "choice") {
          return question;
        }
        const nextChoices = createDebile100Choices(count).map((choice) => {
          const existing = question.choices.find((entry) => entry.id === choice.id);
          return existing ? { ...choice, label: existing.label } : choice;
        });
        const correctChoiceId = nextChoices.some(
          (choice) => choice.id === question.correctChoiceId
        )
          ? question.correctChoiceId
          : nextChoices[0].id;
        return {
          ...question,
          choices: nextChoices,
          correctChoiceId
        };
      })
    );
  }

  const canStart = (index: number) => {
    if (index === 1) {
      return phase === "idle" && currentQuestion === 0;
    }
    return phase === "revealed" && currentQuestion === index - 1;
  };

  const canReveal = (index: number) => {
    return phase === "playing" && currentQuestion === index;
  };

  return (
    <div className="debile100Admin">
      {error ? <p className="error">{error}</p> : null}

      <p className="subtitle">
        {activeCount} encore en jeu — {eliminatedCount} éliminés. Question en cours :{" "}
        {currentQuestion > 0 ? currentQuestion : "aucune"} ({phase}
        {formatLiveStatus()}).
      </p>
      <p className="subtitle debile100Hint">
        Au lancement, {DEBILE100_SYNC_GRACE_SECONDS} s de synchro puis 30 s de chrono. Q4–5 : indice
        (1×). Q6–9 : deuxième chance (6↔7, 8↔9). Q10–11 : Passe (1×). Q1–3 et Q12–14 : sans aide.
      </p>

      <section className="card">
        <h3>Configurer les {DEBILE100_QUESTION_COUNT} questions</h3>
        <div className="debile100AdminQuestions">
          {draft.map((question) => (
            <article key={question.index} className="debile100AdminQuestion">
              <h4>Question {question.index}</h4>
              <input
                type="text"
                value={question.text}
                disabled={pending}
                onChange={(event) => updateQuestion(question.index, { text: event.target.value })}
                placeholder="Texte de la question"
              />
              {isHintQuestion(question.index) ? (
                <textarea
                  value={question.hint ?? ""}
                  disabled={pending}
                  rows={2}
                  placeholder="Texte de l'indice (questions 4 à 5)"
                  onChange={(event) =>
                    updateQuestion(question.index, { hint: event.target.value })
                  }
                />
              ) : null}
              <div className="debile100AdminTypeRow">
                <label className="debile100AdminTypeLabel">
                  Type
                  <select
                    value={question.questionType}
                    disabled={pending}
                    onChange={(event) =>
                      setQuestionType(
                        question.index,
                        event.target.value === "open" ? "open" : "choice"
                      )
                    }
                  >
                    <option value="choice">QCM</option>
                    <option value="open">Question ouverte</option>
                  </select>
                </label>
                {question.questionType === "choice" ? (
                  <label className="debile100AdminTypeLabel">
                    Réponses
                    <select
                      value={question.choices.length}
                      disabled={pending}
                      onChange={(event) =>
                        setChoiceCount(
                          question.index,
                          Number(event.target.value) as Debile100ChoiceCount
                        )
                      }
                    >
                      <option value={2}>2 choix</option>
                      <option value={3}>3 choix</option>
                      <option value={4}>4 choix</option>
                    </select>
                  </label>
                ) : (
                  <label className="debile100AdminTypeLabel">
                    Format réponse
                    <select
                      value={question.openAnswerType ?? "text"}
                      disabled={pending}
                      onChange={(event) =>
                        updateQuestion(question.index, {
                          openAnswerType: event.target.value as Debile100OpenAnswerType
                        })
                      }
                    >
                      <option value="text">Texte</option>
                      <option value="number">Nombre</option>
                    </select>
                  </label>
                )}
              </div>
              {question.questionType === "choice" ? (
                question.choices.map((choice) => (
                  <div key={choice.id} className="debile100AdminChoiceRow">
                    <input
                      type="radio"
                      name={`correct-${question.index}`}
                      checked={question.correctChoiceId === choice.id}
                      disabled={pending}
                      onChange={() =>
                        updateQuestion(question.index, { correctChoiceId: choice.id })
                      }
                    />
                    <input
                      type="text"
                      value={choice.label}
                      disabled={pending}
                      onChange={(event) =>
                        updateChoiceLabel(question.index, choice.id, event.target.value)
                      }
                    />
                  </div>
                ))
              ) : (
                <label className="debile100AdminOpenAnswer">
                  Bonne réponse attendue
                  <input
                    type={question.openAnswerType === "number" ? "number" : "text"}
                    value={question.correctOpenAnswer ?? ""}
                    disabled={pending}
                    placeholder={
                      question.openAnswerType === "number"
                        ? "Ex. 42"
                        : "Ex. Paris"
                    }
                    onChange={(event) =>
                      updateQuestion(question.index, {
                        correctOpenAnswer: event.target.value
                      })
                    }
                  />
                </label>
              )}
            </article>
          ))}
        </div>
        <button
          type="button"
          className="btnPrimary"
          disabled={pending}
          onClick={() => void apiCall({ action: "save-questions", questions: draft })}
        >
          Enregistrer les questions
        </button>
      </section>

      <section className="card">
        <h3>Contrôle du direct</h3>
        <div className="debile100AdminControls">
          {Array.from({ length: DEBILE100_QUESTION_COUNT }, (_, offset) => {
            const index = offset + 1;
            const totalAnswers = Object.values(answerCounts).reduce((sum, n) => sum + n, 0);
            const showCounts = currentQuestion === index && phase === "playing";

            return (
              <div key={index} className="debile100AdminControlRow">
                <span className="badge">Q{index}</span>
                <button
                  type="button"
                  className="beerPongBtnPrimary"
                  disabled={pending || !canStart(index)}
                  onClick={() => void apiCall({ action: "start", questionIndex: index })}
                >
                  Démarrer question {index}
                </button>
                <button
                  type="button"
                  className="beerPongBtnSecondary"
                  disabled={pending || !canReveal(index)}
                  onClick={() => void apiCall({ action: "reveal", questionIndex: index })}
                >
                  Afficher réponse question {index}
                </button>
                {showCounts ? (
                  <span className="subtitle">{totalAnswers} réponse(s) reçue(s)</span>
                ) : null}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="beerPongBtnSecondary"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Réinitialiser toute la partie ?")) {
              void apiCall({ action: "reset" });
            }
          }}
        >
          Réinitialiser la partie
        </button>
        {canFinalize ? (
          <button
            type="button"
            className="btnPrimary"
            disabled={pending}
            onClick={() => {
              if (
                window.confirm(
                  "Attribuer les points (12 → 1) au classement global selon la survie des joueurs ?"
                )
              ) {
                void apiCall({ action: "finalize" });
              }
            }}
          >
            Valider le classement et attribuer les points
          </button>
        ) : null}
        {isFinalized ? (
          <p className="ok">Classement validé — points ajoutés au classement global.</p>
        ) : null}
      </section>

      <section className="card">
        <h3>Réponses des joueurs</h3>
        <p className="subtitle debile100Hint">
          À la fin du chrono : réponses brutes. Après « Afficher réponse » : bonne réponse et
          résultat par joueur.
        </p>
        <Debile100AnswerRecap
          questionRecaps={questionRecaps}
          pendingRecap={pendingRecap}
          currentQuestion={currentQuestion}
          phase={phase}
        />
      </section>

      <section className="card">
        <h3>Remettre en jeu</h3>
        <p className="subtitle debile100Hint">
          Réintègre un joueur éliminé — il reprend à partir de la question en cours (ou la
          suivante). Indice et Passe déjà utilisés restent consommés.
        </p>
        <Debile100ReinstatePanel
          eliminatedPlayers={eliminatedPlayers}
          isFinalized={isFinalized}
          pending={pending}
          onReinstate={(playerId, pseudo) => {
            if (
              window.confirm(
                `Remettre ${pseudo} en jeu ? Il pourra rejouer les prochaines questions.`
              )
            ) {
              void apiCall({ action: "reinstate", playerId });
            }
          }}
        />
      </section>

      <section className="card">
        <h3>Classement de l&apos;épreuve</h3>
        <Debile100Leaderboard isFinalized={isFinalized} leaderboard={leaderboard} />
      </section>
    </div>
  );
}
