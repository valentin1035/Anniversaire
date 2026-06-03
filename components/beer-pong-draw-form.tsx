"use client";

type Props = {
  action: string;
};

export function BeerPongDrawForm({ action }: Props) {
  return (
    <form
      action={action}
      method="post"
      className="beerDrawForm"
      onSubmit={(event) => {
        const ok = window.confirm(
          "Nouveau tirage aléatoire ?\n\n• Les 12 participants seront retirés au hasard\n• Le bracket et le classement individuel seront effacés\n• Les points Beer Pong seront retirés du classement général"
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
