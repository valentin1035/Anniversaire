"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BeerPongSpectatorSync } from "@/components/beer-pong-spectator-sync";
import type { GolfDebileLeaderboardRow } from "@/lib/golf-debile";
import { GOLF_DEBILE_COURSES, type GolfDebileSubmission } from "@/lib/golf-debile";

type Props = {
  eventId: string;
  courses: typeof GOLF_DEBILE_COURSES;
  mySubmission: GolfDebileSubmission | null;
  submissionCount: number;
  requiredCount: number;
  isFinalized: boolean;
  leaderboard: GolfDebileLeaderboardRow[];
  playerPseudo: string | null;
  adminMode?: boolean;
  spectatorSync?: boolean;
};

export function GolfDebileBoard({
  eventId,
  courses,
  mySubmission,
  submissionCount,
  requiredCount,
  isFinalized,
  leaderboard,
  playerPseudo,
  adminMode = false,
  spectatorSync = false
}: Props) {
  const router = useRouter();
  const [course1, setCourse1] = useState("");
  const [course2, setCourse2] = useState("");
  const [course3, setCourse3] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allFilled = useMemo(() => {
    const values = [course1, course2, course3];
    return values.every((value) => {
      const number = Number(value);
      return Number.isInteger(number) && number >= 1;
    });
  }, [course1, course2, course3]);

  const canSubmit = Boolean(playerPseudo) && !mySubmission && !isFinalized && allFilled;

  async function sendResults() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/golf-debile/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          course1: Number(course1),
          course2: Number(course2),
          course3: Number(course3)
        })
      });
      const payload = (await response.json()) as { error?: string; finalized?: boolean };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erreur lors de l'envoi.");
      }
      router.refresh();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function adminReset() {
    if (!window.confirm("Réinitialiser tous les résultats Golf Débile ?")) {
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/admin/golf-debile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, action: "reset" })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erreur.");
      }
      router.refresh();
    } catch (resetError) {
      setError((resetError as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function adminFinalize() {
    setPending(true);
    try {
      const response = await fetch("/api/admin/golf-debile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, action: "finalize" })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Erreur.");
      }
      router.refresh();
    } catch (finalizeError) {
      setError((finalizeError as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="golfDebileLayout">
      <BeerPongSpectatorSync enabled={spectatorSync} />

      <p className="subtitle golfDebileHint">
        {submissionCount}/{requiredCount} joueurs ont envoyé leurs résultats.
        {isFinalized ? " Classement final publié (points 12 → 1)." : " En attente des 12 validations."}
      </p>

      {!adminMode && !playerPseudo ? (
        <p className="subtitle">Connecte-toi pour saisir tes coups sur les 3 parcours.</p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      {!mySubmission && !isFinalized && playerPseudo ? (
        <section className="golfDebileCourses">
          {courses.map((course, index) => {
            const value = index === 0 ? course1 : index === 1 ? course2 : course3;
            const setter = index === 0 ? setCourse1 : index === 1 ? setCourse2 : setCourse3;
            return (
              <article key={course.id} className="golfDebileCourseCard glassCard">
                <h3>{course.title}</h3>
                <p className="golfDebileCourseName">{course.name}</p>
                <label className="golfDebileLabel">
                  Nombre de coups
                  <input
                    type="number"
                    min={1}
                    max={99}
                    step={1}
                    inputMode="numeric"
                    value={value}
                    disabled={pending}
                    onChange={(event) => setter(event.target.value)}
                  />
                </label>
              </article>
            );
          })}
          <div className="golfDebileSubmitRow">
            <button
              type="button"
              className="btnPrimary"
              disabled={!canSubmit || pending}
              onClick={() => void sendResults()}
            >
              Envoyer mes résultats
            </button>
            <p className="subtitle">Les 3 parcours doivent être remplis avant l&apos;envoi.</p>
          </div>
        </section>
      ) : null}

      {mySubmission ? (
        <section className="card ok">
          <h3>Tes résultats envoyés</h3>
          <p>
            {courses[0].name} : <strong>{mySubmission.course1}</strong> coups —{" "}
            {courses[1].name} : <strong>{mySubmission.course2}</strong> —{" "}
            {courses[2].name} : <strong>{mySubmission.course3}</strong>
          </p>
          <p>
            Total : <strong>{mySubmission.totalStrokes}</strong> coups
          </p>
        </section>
      ) : null}

      <section className="golfDebileLeaderboard">
        <h3>Classement {isFinalized ? "(points attribués)" : "(provisoire — moins de coups = mieux)"}</h3>
        {leaderboard.length === 0 ? (
          <p className="subtitle">Aucun résultat pour le moment.</p>
        ) : (
          <div className="tableWrap">
            <table className="molkputeTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Joueur</th>
                  <th>P1</th>
                  <th>P2</th>
                  <th>P3</th>
                  <th>Total</th>
                  {isFinalized ? <th>Points</th> : null}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.playerId}>
                    <td>{row.rank}</td>
                    <td>{row.pseudo}</td>
                    <td>{row.course1}</td>
                    <td>{row.course2}</td>
                    <td>{row.course3}</td>
                    <td>{row.totalStrokes}</td>
                    {isFinalized ? <td>{row.eventPoints ?? "—"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isFinalized ? (
          <p className="subtitle golfDebileHint">
            Égalité au total : le moins de coups sur « Le batard » passe devant. Égalité parfaite
            = même nombre de points à la fin.
          </p>
        ) : null}
      </section>

      {adminMode ? (
        <div className="beerPongActions">
          <button
            type="button"
            className="beerPongBtnSecondary"
            disabled={pending}
            onClick={() => void adminFinalize()}
          >
            Forcer le classement (si 12 envois)
          </button>
          <button
            type="button"
            className="beerPongBtnSecondary"
            disabled={pending}
            onClick={() => void adminReset()}
          >
            Tout réinitialiser
          </button>
        </div>
      ) : null}
    </div>
  );
}
