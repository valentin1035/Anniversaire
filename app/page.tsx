import Link from "next/link";
import { getPlayerSession } from "@/lib/auth";
import { getEvents } from "@/lib/data";
import { getEventDisplayName } from "@/lib/event-labels";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomeProps) {
  const [session, events] = await Promise.all([getPlayerSession(), getEvents()]);
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <main className="grid" style={{ gap: 20 }}>
      <section className="card">
        <h1 className="title">Compétition Anniversaire</h1>
        <p className="subtitle">
          Inscris-toi avec un pseudo pour suivre tes matchs, puis consulte le classement en direct.
        </p>
        {session ? (
          <p className="ok">
            Connecté en tant que <strong>{session.pseudo}</strong>
          </p>
        ) : (
          <span className="badge">Pas encore connecté</span>
        )}
        {success ? <p className="ok">{success}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="grid two">
        <article className="card">
          <h2>Inscription</h2>
          <p className="subtitle">
            Tu choisis un pseudo, le site te donne un code secret à conserver pour te reconnecter.
          </p>
          <form action="/api/auth/register" method="post" className="grid">
            <input required name="pseudo" placeholder="Ton pseudo" maxLength={20} />
            <button type="submit">S&apos;inscrire</button>
          </form>
        </article>

        <article className="card">
          <h2>Connexion joueur</h2>
          <form action="/api/auth/login" method="post" className="grid">
            <input required name="pseudo" placeholder="Pseudo" maxLength={20} />
            <input required name="secretCode" placeholder="Code secret" maxLength={20} />
            <button type="submit">Se connecter</button>
          </form>
          <form action="/api/auth/logout" method="post" style={{ marginTop: 10 }}>
            <button className="secondary" type="submit">
              Se déconnecter
            </button>
          </form>
        </article>
      </section>

      <section className="card">
        <h2>Épreuves</h2>
        <div className="row">
          {events.map((eventItem) => (
            <Link key={eventItem.id} className="badge" href={`/epreuves/${eventItem.order_index}`}>
              {getEventDisplayName(eventItem.order_index, eventItem.name)}
            </Link>
          ))}
        </div>
        <p style={{ marginTop: 14 }}>
          <Link href="/classement">Voir le classement global</Link>
        </p>
      </section>
    </main>
  );
}
