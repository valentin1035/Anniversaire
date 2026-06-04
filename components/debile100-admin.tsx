"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DEBILE100_QUESTION_COUNT,
  DEBILE100_SYNC_GRACE_SECONDS,
  isHintQuestion
} from "@/lib/debile100";
import type { Debile100Question } from "@/lib/debile100";
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
  eliminatedCount
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Debile100Question[]>(questions);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "playing") {
      return;
    }
    const refreshId = window.setInterval(() => router.refresh(), 1500);
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
        Au lancement, {DEBILE100_SYNC_GRACE_SECONDS} s de synchro puis 30 s de chrono. Q5–7 : indice
        (1× sur les 3 questions). Q8–11 : rattrapage (8↔9, 10↔11). Q12–14 : Passe (1× sur les 3).
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
                  placeholder="Texte de l'indice (questions 5 à 7)"
                  onChange={(event) =>
                    updateQuestion(question.index, { hint: event.target.value })
                  }
                />
              ) : null}
              {question.choices.map((choice) => (
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
              ))}
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
      </section>
    </div>
  );
}
