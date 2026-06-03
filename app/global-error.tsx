"use client";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  return (
    <html lang="fr">
      <body>
        <main className="card" style={{ margin: 24 }}>
          <h1>Erreur serveur</h1>
          <p className="error">{error.message || "Une erreur est survenue."}</p>
          <button type="button" className="btnPrimary" onClick={() => reset()}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
