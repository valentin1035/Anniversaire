import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Anniversaire Game On",
  description: "Compétition d'anniversaire - défis, classement et beer pong géant."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <div className="appShell">
          <SiteNav />
          <main className="mainContent">{children}</main>
        </div>
      </body>
    </html>
  );
}
