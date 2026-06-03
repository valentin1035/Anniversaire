"use client";

type Props = {
  action: string;
};

export function MolkputeDrawForm({ action }: Props) {
  return (
    <form
      action={action}
      method="post"
      className="beerDrawForm"
      onSubmit={(event) => {
        const ok = window.confirm(
          "Nouveau tirage aléatoire ?\n\n• 12 participants → 6 équipes de 2\n• Tous les matchs de la poule seront remis à zéro"
        );
        if (!ok) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit">Tirage aléatoire des 12 participants</button>
    </form>
  );
}
