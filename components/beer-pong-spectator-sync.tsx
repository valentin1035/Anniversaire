"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rafraîchit la page toutes les 5 s pour les spectateurs (pas l'admin). */
export function BeerPongSpectatorSync({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [enabled, router]);

  return null;
}
