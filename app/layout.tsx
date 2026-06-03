import type { Metadata } from "next";
import Link from "next/link";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Anniversaire - Compétition",
  description: "Suivi des épreuves et du classement en direct."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <div className="container">
          <nav className="mainNav">
            <Link href="/">Accueil</Link>
            <Link href="/classement">Classement global</Link>
            <Link href="/epreuves/1">Beer Pong Géant</Link>
            <Link href="/epreuves/2">Épreuve 2</Link>
            <Link href="/epreuves/3">Épreuve 3</Link>
            <Link href="/epreuves/4">Épreuve 4</Link>
            <Link href="/epreuves/5">Épreuve 5</Link>
            <Link href="/admin">Admin</Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
