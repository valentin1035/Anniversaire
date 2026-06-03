import {
  buildBeerPongPlaceholderTeams,
  buildBeerPongTeamsFromPlayers
} from "@/lib/beer-pong";
import type { IndividualState } from "@/lib/beer-pong-ranking";
import { getBeerPongState, getPlayers } from "@/lib/data";

export type BeerPongViewData = {
  teams: ReturnType<typeof buildBeerPongPlaceholderTeams>;
  hasRandomDraw: boolean;
  semi1WinnerKey: "A" | "B" | null;
  semi2WinnerKey: "C" | "D" | null;
  finalWinnerKey: "A" | "B" | "C" | "D" | null;
  smallFinalWinnerKey: "A" | "B" | "C" | "D" | null;
  individualState: IndividualState;
  individualValidatedAt: string | null;
};

export async function loadBeerPongView(eventId: string): Promise<BeerPongViewData> {
  const beerPongState = await getBeerPongState(eventId);
  const drawIds = beerPongState?.draw_player_ids ?? [];

  let teams = buildBeerPongPlaceholderTeams();
  let hasRandomDraw = false;
  let semi1WinnerKey: "A" | "B" | null = null;
  let semi2WinnerKey: "C" | "D" | null = null;
  let finalWinnerKey: "A" | "B" | "C" | "D" | null = null;
  let smallFinalWinnerKey: "A" | "B" | "C" | "D" | null = null;
  let individualState: IndividualState = {};
  let individualValidatedAt: string | null = null;

  if (drawIds.length === 12) {
    const players = await getPlayers();
    const playersById = new Map(players.map((player) => [player.id, player]));
    const selectedPlayers = drawIds
      .map((id) => playersById.get(id))
      .filter((player): player is NonNullable<typeof player> => Boolean(player));

    if (selectedPlayers.length === 12) {
      teams = buildBeerPongTeamsFromPlayers(selectedPlayers);
      hasRandomDraw = true;
      semi1WinnerKey = beerPongState?.semi1_winner_key ?? null;
      semi2WinnerKey = beerPongState?.semi2_winner_key ?? null;
      finalWinnerKey = beerPongState?.final_winner_key ?? null;
      smallFinalWinnerKey = beerPongState?.small_final_winner_key ?? null;
      individualState = beerPongState?.individual_state ?? {};
      individualValidatedAt = beerPongState?.individual_validated_at ?? null;
    }
  }

  return {
    teams,
    hasRandomDraw,
    semi1WinnerKey,
    semi2WinnerKey,
    finalWinnerKey,
    smallFinalWinnerKey,
    individualState,
    individualValidatedAt
  };
}
