import { Crown, LogIn, User } from "lucide-react";
import { NyanCatFlyby } from "@/components/nyan-cat-flyby";
import { getPlayerSession } from "@/lib/auth";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: HomeProps) {
  const session = await getPlayerSession();
  const params = (await searchParams) ?? {};
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="homePage">
      <section className="heroSection">
        <NyanCatFlyby />
        <div className="heroGlow heroGlowViolet" />
        <div className="heroGlow heroGlowBlue" />
        <div className="heroGlow heroGlowPink" />
        <div className="confettiLayer" aria-hidden="true" />

        <div className="heroContent">
          <div className="heroCrown" aria-hidden="true">
            <Crown size={72} strokeWidth={1.6} />
          </div>
          <h1 className="heroTitle">
            ANNIVERSAIRE
            <span>GAME ON !</span>
          </h1>
          <p className="heroSubtitle">
            Bienvenue dans la compétition la plus débile de l&apos;année.
          </p>

          {session ? (
            <p className="sessionBadge ok">
              Connecté : <strong>{session.pseudo}</strong>
            </p>
          ) : null}
          {success ? <p className="flashMessage ok">{success}</p> : null}
          {error ? <p className="flashMessage error">{error}</p> : null}
        </div>
      </section>

      <section className="homeCards">
        <article className="glassCard">
          <div className="cardHeader cardHeaderBlue">
            <div className="cardIconWrap cardIconWrapBlue">
              <User size={22} />
            </div>
            <h2>Inscription</h2>
          </div>
          <p className="cardHint">Pseudo obligatoire et unique.</p>
          <form action="/api/auth/register" method="post" className="formStack">
            <input required name="pseudo" placeholder="Ton pseudo" maxLength={20} />
            <button type="submit" className="btnBlue">
              S&apos;inscrire
            </button>
          </form>
        </article>

        <article className="glassCard">
          <div className="cardHeader cardHeaderViolet">
            <div className="cardIconWrap cardIconWrapViolet">
              <LogIn size={22} />
            </div>
            <h2>Connexion</h2>
          </div>
          <p className="cardHint">Entre ton pseudo pour te reconnecter (c&apos;est aussi ton &quot;code&quot;).</p>
          {session ? (
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="btnGhost">
                Se déconnecter ({session.pseudo})
              </button>
            </form>
          ) : (
            <form action="/api/auth/login" method="post" className="formStack">
              <input required name="pseudo" placeholder="Ton pseudo" maxLength={20} />
              <button type="submit" className="btnViolet">
                Se connecter
              </button>
            </form>
          )}
        </article>
      </section>

      <section className="infoHeroCard glassCard pulseGlow">
        <p className="infoHeroText">
          4 défis, <span>1 seul champion.</span>
        </p>
        <p className="infoHeroTagline">
          Affrontes tes potes plus débiles les uns que les autres et grimpe au classement
        </p>
      </section>
    </div>
  );
}
