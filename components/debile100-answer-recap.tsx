import type { Debile100AnswerRecapResult, Debile100QuestionRecap } from "@/lib/debile100";
import type { Debile100Phase } from "@/lib/debile100";

type Props = {
  questionRecaps: Debile100QuestionRecap[];
  currentQuestion: number;
  phase: Debile100Phase;
};

const RESULT_LABELS: Record<Debile100AnswerRecapResult, string> = {
  correct: "Correct",
  pass: "Passe",
  wrong: "Faux",
  no_answer: "Pas de réponse",
  not_playing: "Non concerné"
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

export function Debile100AnswerRecap({ questionRecaps, currentQuestion, phase }: Props) {
  if (questionRecaps.length === 0) {
    return (
      <p className="subtitle">
        Les réponses apparaîtront ici après chaque « Afficher réponse ».
      </p>
    );
  }

  const orderedRecaps = [...questionRecaps].sort(
    (a, b) => b.questionIndex - a.questionIndex
  );

  return (
    <div className="debile100RecapList">
      {orderedRecaps.map((recap) => {
        const isCurrent = phase === "revealed" && currentQuestion === recap.questionIndex;

        return (
          <article
            key={recap.questionIndex}
            className={`debile100RecapCard${isCurrent ? " debile100RecapCardCurrent" : ""}`}
          >
            <header className="debile100RecapHeader">
              <h4>Question {recap.questionIndex}</h4>
              <p className="subtitle debile100RecapCorrect">
                Bonne réponse : <strong>{recap.correctChoiceLabel}</strong>
              </p>
            </header>
            <div className="tableWrap">
              <table className="molkputeTable debile100RecapTable">
                <thead>
                  <tr>
                    <th>Joueur</th>
                    <th>Réponse</th>
                    <th>Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.rows.map((row) => (
                    <tr key={row.playerId}>
                      <td>{row.pseudo}</td>
                      <td>{row.choiceLabel ?? "—"}</td>
                      <td className={resultClassName(row.result)}>
                        {RESULT_LABELS[row.result]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}
    </div>
  );
}
