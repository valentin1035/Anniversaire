import Link from "next/link";

export default function NotFound() {
  return (
    <main className="card">
      <h1>Page introuvable</h1>
      <p className="subtitle">Le contenu demandé n&apos;existe pas.</p>
      <p>
        <Link href="/">Retour à l&apos;accueil</Link>
      </p>
    </main>
  );
}
