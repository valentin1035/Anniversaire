"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rafraîchit la page pour synchroniser l'état (quiz, spectateurs). */
export function BeerPongSpectatorSync({
  enabled,
  intervalMs = 5000
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [enabled, intervalMs, router]);

  return null;
}
