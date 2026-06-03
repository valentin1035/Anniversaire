"use client";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: Props) {
  return (
    <main className="card">
      <h1>Erreur</h1>
      <p className="error">{error.message || "Une erreur est survenue."}</p>
      <button type="button" className="btnPrimary" onClick={() => reset()}>
        Réessayer
      </button>
    </main>
  );
}
