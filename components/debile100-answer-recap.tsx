import type { Debile100AnswerRecapResult, Debile100QuestionRecap } from "@/lib/debile100";
import type { Debile100Phase } from "@/lib/debile100";

type Props = {
  questionRecaps: Debile100QuestionRecap[];
  pendingRecap: Debile100QuestionRecap | null;
  currentQuestion: number;
  phase: Debile100Phase;
};

const RESULT_LABELS: Record<Debile100AnswerRecapResult, string> = {
  correct: "Correct",
  pass: "Passe",
  wrong: "Faux",
  no_answer: "Pas de réponse",
  not_playing: "Non concerné",
  pending: "—"
};

function resultClassName(result: Debile100AnswerRecapResult): string {
  if (result === "correct" || result === "pass") {
    return "debile100RecapOk";
  }
  if (result === "wrong" || result === "no_answer") {
    return "debile100RecapKo";
  }
  return "debile100RecapMuted";
}

function RecapTable({ recap, showResults }: { recap: Debile100QuestionRecap; showResults: boolean }) {
  return (
    <div className="tableWrap">
      <table className="molkputeTable debile100RecapTable">
        <thead>
          <tr>
            <th>Joueur</th>
            <th>Réponse</th>
            {showResults ? <th>Résultat</th> : null}
          </tr>
        </thead>
        <tbody>
          {recap.rows.map((row) => (
            <tr key={row.playerId}>
              <td>{row.pseudo}</td>
              <td>
                {row.result === "not_playing"
                  ? "—"
                  : row.result === "no_answer"
                    ? "Pas de réponse"
                    : (row.choiceLabel ?? "—")}
              </td>
              {showResults ? (
                <td className={resultClassName(row.result)}>{RESULT_LABELS[row.result]}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Debile100AnswerRecap({
  questionRecaps,
  pendingRecap,
  currentQuestion,
  phase
}: Props) {
  if (!pendingRecap && questionRecaps.length === 0) {
    return (
      <p className="subtitle">
        Les réponses s&apos;affichent ici à la fin du chrono, puis le détail complet après
        « Afficher réponse ».
      </p>
    );
  }

  const orderedRecaps = [...questionRecaps].sort(
    (a, b) => b.questionIndex - a.questionIndex
  );

  return (
    <div className="debile100RecapList">
      {pendingRecap ? (
        <article className="debile100RecapCard debile100RecapCardPending">
          <header className="debile100RecapHeader">
            <h4>Question {pendingRecap.questionIndex} — chrono terminé</h4>
            <p className="subtitle debile100RecapPendingHint">
              Réponses reçues avant révélation — clique « Afficher réponse » pour valider et
              afficher la bonne réponse.
            </p>
          </header>
          <RecapTable recap={pendingRecap} showResults={false} />
        </article>
      ) : null}

      {orderedRecaps.map((recap) => {
        const isCurrent = phase === "revealed" && currentQuestion === recap.questionIndex;

        return (
          <article
            key={recap.questionIndex}
            className={`debile100RecapCard${isCurrent ? " debile100RecapCardCurrent" : ""}`}
          >
            <header className="debile100RecapHeader">
              <h4>Question {recap.questionIndex}</h4>
              {recap.isRevealed ? (
                <p className="subtitle debile100RecapCorrect">
                  Bonne réponse : <strong>{recap.correctChoiceLabel}</strong>
                </p>
              ) : null}
            </header>
            <RecapTable recap={recap} showResults={recap.isRevealed} />
          </article>
        );
      })}
    </div>
  );
}
