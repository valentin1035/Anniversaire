import { generateSecretCode, hashSecretCode } from "@/lib/auth";
import { getSupabaseAdminClient, getSupabasePublicClient } from "@/lib/supabase";
import type {
  BeerPongState,
  EventItem,
  EventRankingRow,
  GlobalRankingRow,
  MatchItem,
  Player,
  ScoreItem
} from "@/lib/types";

function sanitizePseudo(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

export function validatePseudo(pseudo: string) {
  const clean = sanitizePseudo(pseudo);
  const isValid = /^[a-zA-Z0-9_\- ]{3,20}$/.test(clean);
  if (!isValid) {
    throw new Error("Le pseudo doit contenir 3 à 20 caractères (lettres, chiffres, espace, _ ou -).");
  }
  return clean;
}

export async function registerPlayer(pseudoInput: string) {
  const pseudo = validatePseudo(pseudoInput);
  const secretCode = generateSecretCode();
  const secretCodeHash = hashSecretCode(secretCode);
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("players")
    .insert({ pseudo, secret_code_hash: secretCodeHash })
    .select("id,pseudo,created_at")
    .single<Player>();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ce pseudo est déjà pris.");
    }
    throw new Error(error.message);
  }

  return {
    player: data,
    secretCode
  };
}

export async function loginPlayer(pseudoInput: string, secretCodeInput: string) {
  const pseudo = validatePseudo(pseudoInput);
  const secretCodeHash = hashSecretCode(secretCodeInput.trim().toUpperCase());
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("players")
    .select("id,pseudo,created_at,secret_code_hash")
    .eq("pseudo", pseudo)
    .single<Player & { secret_code_hash: string }>();

  if (error || !data) {
    throw new Error("Pseudo introuvable.");
  }

  if (data.secret_code_hash !== secretCodeHash) {
    throw new Error("Code secret invalide.");
  }

  return {
    id: data.id,
    pseudo: data.pseudo
  };
}

export async function getGlobalRanking() {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("global_ranking")
    .select("player_id,pseudo,total_points")
    .order("total_points", { ascending: false })
    .order("pseudo", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as GlobalRankingRow[];
}

export async function getEvents() {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("events")
    .select("id,name,order_index")
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as EventItem[];
}

export async function getEventByOrder(order: number) {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("events")
    .select("id,name,order_index")
    .eq("order_index", order)
    .single<EventItem>();

  if (error) {
    return null;
  }

  return data;
}

export async function getPlayers() {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("players")
    .select("id,pseudo,created_at")
    .order("pseudo", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Player[];
}

export async function getEventMatches(eventId: string) {
  const supabase = getSupabasePublicClient();
  const [{ data: matchesData, error: matchesError }, players] = await Promise.all([
    supabase
      .from("matches")
      .select("id,event_id,player_a_id,player_b_id,winner_id,scheduled_at")
      .eq("event_id", eventId)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
    getPlayers()
  ]);

  if (matchesError) {
    throw new Error(matchesError.message);
  }

  const pseudoById = new Map(players.map((player) => [player.id, player.pseudo]));
  return (matchesData ?? []).map((match) => ({
    ...match,
    player_a_pseudo: pseudoById.get(match.player_a_id) ?? "Inconnu",
    player_b_pseudo: pseudoById.get(match.player_b_id) ?? "Inconnu",
    winner_pseudo: match.winner_id ? pseudoById.get(match.winner_id) ?? null : null
  })) as MatchItem[];
}

export async function getAllMatches() {
  const [events, players] = await Promise.all([getEvents(), getPlayers()]);
  const pseudoById = new Map(players.map((player) => [player.id, player.pseudo]));
  const eventById = new Map(events.map((eventItem) => [eventItem.id, eventItem]));
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("matches")
    .select("id,event_id,player_a_id,player_b_id,winner_id,scheduled_at")
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((match) => ({
    ...match,
    event_name: eventById.get(match.event_id)?.name ?? "Épreuve inconnue",
    player_a_pseudo: pseudoById.get(match.player_a_id) ?? "Inconnu",
    player_b_pseudo: pseudoById.get(match.player_b_id) ?? "Inconnu",
    winner_pseudo: match.winner_id ? pseudoById.get(match.winner_id) ?? null : null
  })) as Array<MatchItem & { event_name: string }>;
}

export async function getEventRanking(eventId: string) {
  const supabase = getSupabasePublicClient();
  const [{ data: playersData, error: playersError }, { data: scoresData, error: scoresError }] =
    await Promise.all([
      supabase.from("players").select("id,pseudo"),
      supabase.from("scores").select("player_id,points").eq("event_id", eventId)
    ]);

  if (playersError) {
    throw new Error(playersError.message);
  }
  if (scoresError) {
    throw new Error(scoresError.message);
  }

  const totals = new Map<string, number>();
  for (const score of scoresData ?? []) {
    const current = totals.get(score.player_id) ?? 0;
    totals.set(score.player_id, current + score.points);
  }

  const rows = (playersData ?? []).map((player) => ({
    player_id: player.id,
    pseudo: player.pseudo,
    total_points: totals.get(player.id) ?? 0
  }));

  rows.sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    return a.pseudo.localeCompare(b.pseudo, "fr");
  });

  return rows as EventRankingRow[];
}

export async function addScore(eventId: string, playerId: string, points: number) {
  const supabase = getSupabaseAdminClient();
  const payload = { event_id: eventId, player_id: playerId, points };
  const { data, error } = await supabase.from("scores").insert(payload).select("*").single<ScoreItem>();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function createMatch(eventId: string, playerAId: string, playerBId: string, scheduledAt?: string) {
  if (playerAId === playerBId) {
    throw new Error("Un joueur ne peut pas s'affronter lui-même.");
  }

  const supabase = getSupabaseAdminClient();
  const payload = {
    event_id: eventId,
    player_a_id: playerAId,
    player_b_id: playerBId,
    scheduled_at: scheduledAt || null
  };
  const { data, error } = await supabase.from("matches").insert(payload).select("*").single<MatchItem>();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function updateMatchWinner(matchId: string, winnerId: string | null) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("matches").update({ winner_id: winnerId }).eq("id", matchId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getBeerPongState(eventId: string) {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("beer_pong_state")
    .select("event_id,draw_player_ids,semi1_winner_key,semi2_winner_key")
    .eq("event_id", eventId)
    .maybeSingle<BeerPongState>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function saveBeerPongDraw(eventId: string, drawPlayerIds: string[]) {
  if (drawPlayerIds.length !== 12) {
    throw new Error("Le tirage Beer Pong doit contenir exactement 12 joueurs.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("beer_pong_state").upsert(
    {
      event_id: eventId,
      draw_player_ids: drawPlayerIds,
      semi1_winner_key: null,
      semi2_winner_key: null
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateBeerPongWinner(
  eventId: string,
  semi: "semi1" | "semi2",
  winnerKey: "A" | "B" | "C" | "D"
) {
  if (semi === "semi1" && winnerKey !== "A" && winnerKey !== "B") {
    throw new Error("Le gagnant de demi-finale 1 doit être A ou B.");
  }
  if (semi === "semi2" && winnerKey !== "C" && winnerKey !== "D") {
    throw new Error("Le gagnant de demi-finale 2 doit être C ou D.");
  }

  const column = semi === "semi1" ? "semi1_winner_key" : "semi2_winner_key";
  const currentState = await getBeerPongState(eventId);
  if (!currentState || currentState.draw_player_ids.length !== 12) {
    throw new Error("Lance d'abord le tirage aléatoire pour créer les équipes.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("beer_pong_state").upsert(
    {
      event_id: eventId,
      draw_player_ids: currentState.draw_player_ids,
      semi1_winner_key: semi === "semi1" ? winnerKey : currentState.semi1_winner_key,
      semi2_winner_key: semi === "semi2" ? winnerKey : currentState.semi2_winner_key,
      [column]: winnerKey
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
