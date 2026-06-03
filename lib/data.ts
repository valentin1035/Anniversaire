import { buildBeerPongTeamsFromPlayers } from "@/lib/beer-pong";
import {
  applyMolkputeFinisher,
  buildMolkputeTeamsFromPlayers,
  createRoundRobinMatches,
  findPlayerTeam,
  normalizeMolkputeMatches,
  resetMolkputeMatchState,
  submitMolkputeTurn,
  type MolkputeTeamKey
} from "@/lib/molkpute";
import {
  computeGlobalPlayerRanks,
  computeTeamRankings,
  emptyIndividualTeamState,
  getNextPlaceToPick,
  getTeamPlayerIdsFromDraw,
  normalizeIndividualState,
  type IndividualState,
  type TeamKey
} from "@/lib/beer-pong-ranking";
import { hashSecretCode } from "@/lib/auth";
import { getSupabaseAdminClient, getSupabasePublicClient } from "@/lib/supabase";
import {
  createDefaultQuestions,
  DEBILE100_QUESTION_COUNT,
  canSubmitDebile100Answer,
  getQuestionByIndex,
  isQuestionTimerExpired,
  normalizeQuestions,
  type Debile100Phase,
  type Debile100Question
} from "@/lib/debile100";
import {
  computeGolfDebileEventPoints,
  GOLF_DEBILE_PLAYER_COUNT,
  parseGolfDebileInput,
  type GolfDebileSubmission
} from "@/lib/golf-debile";
import type {
  BeerPongState,
  Debile100State,
  GolfDebileState,
  MolkputeState,
  EventItem,
  EventRankingRow,
  GlobalRankingRow,
  MatchItem,
  Player,
  ScoreItem
} from "@/lib/types";

function sanitizePseudo(input: string | null | undefined) {
  if (typeof input !== "string") {
    return "";
  }
  return input.trim().replace(/\s+/g, " ");
}

export function validatePseudo(pseudo: string | null | undefined) {
  const clean = sanitizePseudo(pseudo);
  const isValid = /^[a-zA-Z0-9_\- ]{3,20}$/.test(clean);
  if (!isValid) {
    throw new Error("Le pseudo doit contenir 3 à 20 caractères (lettres, chiffres, espace, _ ou -).");
  }
  return clean;
}

function secretHashForPseudo(pseudo: string) {
  return hashSecretCode(pseudo);
}

export async function registerPlayer(pseudoInput: string) {
  const pseudo = validatePseudo(pseudoInput);
  const secretCodeHash = secretHashForPseudo(pseudo);
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

  return { player: data };
}

export async function loginPlayer(pseudoInput: string) {
  const pseudo = validatePseudo(pseudoInput);
  const secretCodeHash = secretHashForPseudo(pseudo);
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
    throw new Error(
      "Compte créé avec l'ancien système. Demande à l'organisateur de réinitialiser ton accès ou réinscris-toi si le pseudo est libre."
    );
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

async function clearBeerPongEventScores(eventId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("scores").delete().eq("event_id", eventId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getBeerPongState(eventId: string) {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("beer_pong_state")
    .select(
      "event_id,draw_player_ids,semi1_winner_key,semi2_winner_key,final_winner_key,small_final_winner_key,individual_state,individual_validated_at"
    )
    .eq("event_id", eventId)
    .maybeSingle<BeerPongState>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    individual_state: normalizeIndividualState(data.individual_state)
  };
}

export async function saveBeerPongDraw(eventId: string, drawPlayerIds: string[]) {
  if (drawPlayerIds.length !== 12) {
    throw new Error("Le tirage Beer Pong doit contenir exactement 12 joueurs.");
  }

  await clearBeerPongEventScores(eventId);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("beer_pong_state").upsert(
    {
      event_id: eventId,
      draw_player_ids: drawPlayerIds,
      semi1_winner_key: null,
      semi2_winner_key: null,
      final_winner_key: null,
      small_final_winner_key: null,
      individual_state: {},
      individual_validated_at: null,
      updated_at: new Date().toISOString()
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
      final_winner_key: null,
      small_final_winner_key: null,
      individual_state: {},
      individual_validated_at: null
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
  await clearBeerPongEventScores(eventId);
}

export async function updateBeerPongFinalWinner(
  eventId: string,
  phase: "final" | "small",
  winnerKey: "A" | "B" | "C" | "D"
) {
  const currentState = await getBeerPongState(eventId);
  if (!currentState || currentState.draw_player_ids.length !== 12) {
    throw new Error("Lance d'abord le tirage aléatoire pour créer les équipes.");
  }
  if (!currentState.semi1_winner_key || !currentState.semi2_winner_key) {
    throw new Error("Choisis d'abord les gagnants des demi-finales.");
  }

  const semi1Loser = currentState.semi1_winner_key === "A" ? "B" : "A";
  const semi2Loser = currentState.semi2_winner_key === "C" ? "D" : "C";

  if (phase === "final") {
    const allowed = [currentState.semi1_winner_key, currentState.semi2_winner_key];
    if (!allowed.includes(winnerKey)) {
      throw new Error("Le gagnant de la finale doit être un finaliste.");
    }
  } else {
    const allowed = [semi1Loser, semi2Loser];
    if (!allowed.includes(winnerKey)) {
      throw new Error("Le gagnant de la petite finale doit être un perdant de demi-finale.");
    }
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("beer_pong_state").upsert(
    {
      event_id: eventId,
      draw_player_ids: currentState.draw_player_ids,
      semi1_winner_key: currentState.semi1_winner_key,
      semi2_winner_key: currentState.semi2_winner_key,
      final_winner_key: phase === "final" ? winnerKey : currentState.final_winner_key,
      small_final_winner_key: phase === "small" ? winnerKey : currentState.small_final_winner_key,
      individual_state: {},
      individual_validated_at: null
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
  await clearBeerPongEventScores(eventId);
}

export async function updateBeerPongIndividualPlace(
  eventId: string,
  teamKey: TeamKey,
  place: 1 | 2 | 3,
  playerId: string
) {
  const currentState = await getBeerPongState(eventId);
  if (!currentState?.final_winner_key || !currentState.small_final_winner_key) {
    throw new Error("Choisis d'abord les gagnants de la finale et de la petite finale.");
  }
  if (currentState.draw_player_ids.length !== 12) {
    throw new Error("Tirage incomplet.");
  }
  if (currentState.individual_validated_at) {
    throw new Error("Le classement individuel est validé. Réinitialise-le pour modifier.");
  }

  const teamPlayerIds = getTeamPlayerIdsFromDraw(currentState.draw_player_ids, teamKey);
  if (!teamPlayerIds.includes(playerId)) {
    throw new Error("Ce joueur n'appartient pas à cette équipe.");
  }

  const individualState: IndividualState = { ...(currentState.individual_state ?? {}) };
  const teamState = individualState[teamKey] ?? emptyIndividualTeamState();
  const expectedPlace = getNextPlaceToPick(teamState);

  if (expectedPlace === null) {
    throw new Error("Le classement de cette équipe est déjà complet.");
  }
  if (place !== expectedPlace) {
    throw new Error(`Choisis d'abord la ${expectedPlace}e place de l'équipe.`);
  }
  if (
    playerId === teamState.firstPlaceId ||
    playerId === teamState.secondPlaceId ||
    playerId === teamState.thirdPlaceId
  ) {
    throw new Error("Ce joueur est déjà classé dans cette équipe.");
  }

  if (place === 1) {
    teamState.firstPlaceId = playerId;
    teamState.secondPlaceId = null;
    teamState.thirdPlaceId = null;
  } else if (place === 2) {
    teamState.secondPlaceId = playerId;
    teamState.thirdPlaceId = null;
  } else {
    teamState.thirdPlaceId = playerId;
  }

  individualState[teamKey] = teamState;

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("beer_pong_state")
    .update({ individual_state: individualState })
    .eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function resetBeerPongIndividual(eventId: string, teamKey?: TeamKey) {
  const currentState = await getBeerPongState(eventId);
  if (!currentState) {
    throw new Error("État Beer Pong introuvable.");
  }

  const individualState: IndividualState = { ...(currentState.individual_state ?? {}) };
  if (teamKey) {
    delete individualState[teamKey];
  } else {
    for (const key of Object.keys(individualState) as TeamKey[]) {
      delete individualState[key];
    }
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("beer_pong_state")
    .update({
      individual_state: individualState,
      individual_validated_at: null
    })
    .eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }

  if (currentState.individual_validated_at) {
    await clearBeerPongEventScores(eventId);
  }
}

export async function validateBeerPongIndividual(eventId: string) {
  const currentState = await getBeerPongState(eventId);
  if (!currentState?.final_winner_key || !currentState.small_final_winner_key) {
    throw new Error("Choisis d'abord les gagnants de la finale et de la petite finale.");
  }
  if (currentState.draw_player_ids.length !== 12) {
    throw new Error("Tirage incomplet.");
  }

  const players = await getPlayers();
  const playersById = new Map(players.map((player) => [player.id, player]));
  const selectedPlayers = currentState.draw_player_ids
    .map((id) => playersById.get(id))
    .filter((player): player is Player => Boolean(player));

  if (selectedPlayers.length !== 12) {
    throw new Error("Impossible de retrouver les 12 joueurs du tirage.");
  }

  const teams = buildBeerPongTeamsFromPlayers(selectedPlayers);
  const teamRankRows = computeTeamRankings(
    currentState.semi1_winner_key,
    currentState.semi2_winner_key,
    currentState.final_winner_key,
    currentState.small_final_winner_key
  );
  const globalRanks = computeGlobalPlayerRanks(
    teams,
    teamRankRows,
    currentState.individual_state ?? {}
  );

  if (!globalRanks || globalRanks.length !== 12) {
    throw new Error("Termine le classement individuel des 4 équipes avant de valider.");
  }

  await clearBeerPongEventScores(eventId);
  for (const row of globalRanks) {
    await addScore(eventId, row.playerId, row.points);
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("beer_pong_state")
    .update({ individual_validated_at: new Date().toISOString() })
    .eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getMolkputeState(eventId: string) {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("molkpute_state")
    .select("event_id,draw_player_ids,matches")
    .eq("event_id", eventId)
    .maybeSingle<MolkputeState>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    matches: normalizeMolkputeMatches(data.matches)
  };
}

export async function saveMolkputeDraw(eventId: string, drawPlayerIds: string[]) {
  if (drawPlayerIds.length !== 12) {
    throw new Error("Le tirage Molkpute doit contenir exactement 12 joueurs.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("molkpute_state").upsert(
    {
      event_id: eventId,
      draw_player_ids: drawPlayerIds,
      matches: createRoundRobinMatches(),
      updated_at: new Date().toISOString()
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  const supabaseFinishes = getSupabaseAdminClient();
  await supabaseFinishes.from("molkpute_finishes").delete().eq("event_id", eventId);
}

async function loadMolkputeTeamsForEvent(eventId: string) {
  const state = await getMolkputeState(eventId);
  if (!state || state.draw_player_ids.length !== 12) {
    throw new Error("Lance d'abord le tirage pour créer les équipes.");
  }

  const players = await getPlayers();
  const playersById = new Map(players.map((player) => [player.id, player]));
  const selectedPlayers = state.draw_player_ids
    .map((id) => playersById.get(id))
    .filter((player): player is Player => Boolean(player));

  if (selectedPlayers.length !== 12) {
    throw new Error("Tirage incomplet ou joueurs introuvables.");
  }

  return { state, teams: buildMolkputeTeamsFromPlayers(selectedPlayers) };
}

async function saveMolkputeMatches(eventId: string, drawPlayerIds: string[], matches: unknown) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("molkpute_state").upsert(
    {
      event_id: eventId,
      draw_player_ids: drawPlayerIds,
      matches,
      updated_at: new Date().toISOString()
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getMolkputeFinishCounts(eventId: string): Promise<Record<string, number>> {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("molkpute_finishes")
    .select("player_id")
    .eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.player_id] = (counts[row.player_id] ?? 0) + 1;
  }
  return counts;
}

export async function submitMolkputeTurnPoints(
  eventId: string,
  actorPlayerId: string | null,
  teamKey: MolkputeTeamKey | null,
  matchId: string,
  points: number
) {
  const { state, teams } = await loadMolkputeTeamsForEvent(eventId);
  let scoringTeamKey = teamKey;

  if (actorPlayerId) {
    const playerTeam = findPlayerTeam(teams, actorPlayerId);
    if (!playerTeam) {
      throw new Error("Tu ne fais pas partie du tirage Molkpute.");
    }
    if (scoringTeamKey && scoringTeamKey !== playerTeam) {
      throw new Error("Tu ne peux jouer que pour ton équipe.");
    }
    scoringTeamKey = playerTeam;
  } else if (!scoringTeamKey) {
    throw new Error("Équipe requise.");
  }

  const matches = normalizeMolkputeMatches(state.matches);
  const matchIndex = matches.findIndex((match) => match.id === matchId);
  if (matchIndex < 0) {
    throw new Error("Match introuvable.");
  }

  const result = submitMolkputeTurn(matches[matchIndex], scoringTeamKey, points);
  const nextMatches = [...matches];
  nextMatches[matchIndex] = result.match;
  await saveMolkputeMatches(eventId, state.draw_player_ids, nextMatches);

  return result;
}

export async function setMolkputeMatchFinisher(
  eventId: string,
  actorPlayerId: string | null,
  teamKey: MolkputeTeamKey | null,
  matchId: string,
  finisherPlayerId: string
) {
  const { state, teams } = await loadMolkputeTeamsForEvent(eventId);
  let pickingTeamKey = teamKey;

  if (actorPlayerId) {
    const playerTeam = findPlayerTeam(teams, actorPlayerId);
    if (!playerTeam) {
      throw new Error("Tu ne fais pas partie du tirage Molkpute.");
    }
    if (pickingTeamKey && pickingTeamKey !== playerTeam) {
      throw new Error("Seule l'équipe à 50 points peut désigner le finisseur.");
    }
    pickingTeamKey = playerTeam;
  } else if (!pickingTeamKey) {
    throw new Error("Équipe requise.");
  }

  const team = teams.find((entry) => entry.key === pickingTeamKey);
  if (!team) {
    throw new Error("Équipe introuvable.");
  }

  const matches = normalizeMolkputeMatches(state.matches);
  const matchIndex = matches.findIndex((match) => match.id === matchId);
  if (matchIndex < 0) {
    throw new Error("Match introuvable.");
  }

  const updatedMatch = applyMolkputeFinisher(
    matches[matchIndex],
    pickingTeamKey,
    finisherPlayerId,
    [...team.playerIds]
  );

  const nextMatches = [...matches];
  nextMatches[matchIndex] = updatedMatch;
  await saveMolkputeMatches(eventId, state.draw_player_ids, nextMatches);

  const supabase = getSupabaseAdminClient();
  const { error: finishError } = await supabase.from("molkpute_finishes").upsert(
    {
      event_id: eventId,
      match_id: matchId,
      player_id: finisherPlayerId,
      team_key: pickingTeamKey
    },
    { onConflict: "event_id,match_id" }
  );

  if (finishError) {
    throw new Error(finishError.message);
  }
}

export async function resetMolkputeMatch(eventId: string, matchId: string) {
  const state = await getMolkputeState(eventId);
  if (!state) {
    throw new Error("Aucun état Molkpute.");
  }

  const matches = normalizeMolkputeMatches(state.matches);
  const matchIndex = matches.findIndex((match) => match.id === matchId);
  if (matchIndex < 0) {
    throw new Error("Match introuvable.");
  }

  const nextMatches = [...matches];
  nextMatches[matchIndex] = resetMolkputeMatchState(matches[matchIndex]);
  await saveMolkputeMatches(eventId, state.draw_player_ids, nextMatches);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("molkpute_finishes")
    .delete()
    .eq("event_id", eventId)
    .eq("match_id", matchId);

  if (error) {
    throw new Error(error.message);
  }
}

async function clearGolfDebileEventScores(eventId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("scores").delete().eq("event_id", eventId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function getGolfDebileState(eventId: string) {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("golf_debile_state")
    .select("event_id,finalized_at")
    .eq("event_id", eventId)
    .maybeSingle<GolfDebileState>();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function ensureGolfDebileState(eventId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("golf_debile_state").upsert(
    { event_id: eventId, finalized_at: null },
    { onConflict: "event_id" }
  );
  if (error) {
    throw new Error(error.message);
  }
}

export async function getGolfDebileSubmissions(eventId: string): Promise<GolfDebileSubmission[]> {
  const supabase = getSupabasePublicClient();
  const [submissionsResult, players] = await Promise.all([
    supabase
      .from("golf_debile_submissions")
      .select(
        "player_id,course_1_strokes,course_2_strokes,course_3_strokes,total_strokes,submitted_at"
      )
      .eq("event_id", eventId),
    getPlayers()
  ]);

  if (submissionsResult.error) {
    throw new Error(submissionsResult.error.message);
  }

  const pseudoById = new Map(players.map((player) => [player.id, player.pseudo]));

  return (submissionsResult.data ?? []).map((row) => ({
    playerId: row.player_id,
    pseudo: pseudoById.get(row.player_id) ?? "?",
    course1: row.course_1_strokes,
    course2: row.course_2_strokes,
    course3: row.course_3_strokes,
    totalStrokes: row.total_strokes,
    submittedAt: row.submitted_at
  }));
}

export async function submitGolfDebileScore(
  eventId: string,
  playerId: string,
  input: { course1: number; course2: number; course3: number }
) {
  const state = await getGolfDebileState(eventId);
  if (state?.finalized_at) {
    throw new Error("Le Golf Débile est terminé : les points sont figés.");
  }

  const parsed = parseGolfDebileInput(input);
  const total = parsed.course1 + parsed.course2 + parsed.course3;

  const existing = await getGolfDebileSubmissions(eventId);
  if (existing.some((entry) => entry.playerId === playerId)) {
    throw new Error("Tu as déjà envoyé tes résultats.");
  }

  await ensureGolfDebileState(eventId);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("golf_debile_submissions").insert({
    event_id: eventId,
    player_id: playerId,
    course_1_strokes: parsed.course1,
    course_2_strokes: parsed.course2,
    course_3_strokes: parsed.course3,
    total_strokes: total
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Tu as déjà envoyé tes résultats.");
    }
    throw new Error(error.message);
  }

  const submissions = await getGolfDebileSubmissions(eventId);
  if (submissions.length >= GOLF_DEBILE_PLAYER_COUNT) {
    await finalizeGolfDebileRanking(eventId);
  }
}

export async function finalizeGolfDebileRanking(eventId: string) {
  const submissions = await getGolfDebileSubmissions(eventId);
  if (submissions.length < GOLF_DEBILE_PLAYER_COUNT) {
    throw new Error(
      `Il manque ${GOLF_DEBILE_PLAYER_COUNT - submissions.length} joueur(s) avant de calculer le classement.`
    );
  }

  const pointsByPlayer = computeGolfDebileEventPoints(submissions);
  await clearGolfDebileEventScores(eventId);

  for (const [playerId, points] of pointsByPlayer.entries()) {
    await addScore(eventId, playerId, points);
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("golf_debile_state").upsert(
    {
      event_id: eventId,
      finalized_at: new Date().toISOString()
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function resetGolfDebile(eventId: string) {
  const supabase = getSupabaseAdminClient();
  await supabase.from("golf_debile_submissions").delete().eq("event_id", eventId);
  await supabase.from("golf_debile_state").upsert(
    { event_id: eventId, finalized_at: null },
    { onConflict: "event_id" }
  );
  await clearGolfDebileEventScores(eventId);
}

export async function getDebile100State(eventId: string) {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("debile100_state")
    .select("event_id,questions,current_question,phase,question_started_at")
    .eq("event_id", eventId)
    .maybeSingle<Debile100State>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    questions: normalizeQuestions(data.questions)
  };
}

async function ensureDebile100State(eventId: string) {
  const existing = await getDebile100State(eventId);
  if (existing) {
    return existing;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("debile100_state").insert({
    event_id: eventId,
    questions: createDefaultQuestions(),
    current_question: 0,
    phase: "idle",
    question_started_at: null
  });

  if (error) {
    throw new Error(error.message);
  }

  return getDebile100State(eventId);
}

export async function saveDebile100Questions(eventId: string, questions: Debile100Question[]) {
  if (questions.length !== DEBILE100_QUESTION_COUNT) {
    throw new Error(`Il faut exactement ${DEBILE100_QUESTION_COUNT} questions.`);
  }

  for (const question of questions) {
    if (!question.text.trim()) {
      throw new Error(`La question ${question.index} est vide.`);
    }
    if (question.choices.length < 2) {
      throw new Error(`La question ${question.index} doit avoir au moins 2 réponses.`);
    }
    if (!question.choices.some((choice) => choice.id === question.correctChoiceId)) {
      throw new Error(`La question ${question.index} : bonne réponse invalide.`);
    }
  }

  await ensureDebile100State(eventId);
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("debile100_state").upsert(
    {
      event_id: eventId,
      questions
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getDebile100PlayerStatuses(eventId: string) {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("debile100_player_status")
    .select("player_id,status,eliminated_at_question")
    .eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function getDebile100AnswersForQuestion(eventId: string, questionIndex: number) {
  const supabase = getSupabasePublicClient();
  const { data, error } = await supabase
    .from("debile100_answers")
    .select("player_id,choice_id,question_index")
    .eq("event_id", eventId)
    .eq("question_index", questionIndex);

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

async function ensureDebile100PlayerActive(eventId: string, playerId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("debile100_player_status").upsert(
    {
      event_id: eventId,
      player_id: playerId,
      status: "active",
      eliminated_at_question: null
    },
    { onConflict: "event_id,player_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function submitDebile100Answer(
  eventId: string,
  playerId: string,
  choiceId: string
) {
  const state = await getDebile100State(eventId);
  if (!state) {
    throw new Error("Le quiz n'est pas encore configuré.");
  }
  if (state.phase !== "playing") {
    throw new Error("Ce n'est pas le moment de répondre.");
  }
  if (state.current_question < 1) {
    throw new Error("Aucune question en cours.");
  }
  if (!canSubmitDebile100Answer(state.question_started_at, state.phase)) {
    throw new Error("Le temps est écoulé — trop tard pour répondre.");
  }

  const statuses = await getDebile100PlayerStatuses(eventId);
  const myStatus = statuses.find((row) => row.player_id === playerId);
  if (myStatus?.status === "eliminated") {
    throw new Error("Tu es éliminé.");
  }

  const question = getQuestionByIndex(state.questions, state.current_question);
  if (!question) {
    throw new Error("Question introuvable.");
  }
  if (!question.choices.some((choice) => choice.id === choiceId)) {
    throw new Error("Réponse invalide.");
  }

  const existing = await getDebile100AnswersForQuestion(eventId, state.current_question);
  if (existing.some((row) => row.player_id === playerId)) {
    throw new Error("Tu as déjà répondu.");
  }

  await ensureDebile100PlayerActive(eventId, playerId);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("debile100_answers").insert({
    event_id: eventId,
    player_id: playerId,
    question_index: state.current_question,
    choice_id: choiceId
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Tu as déjà répondu.");
    }
    throw new Error(error.message);
  }
}

export async function startDebile100Question(eventId: string, questionIndex: number) {
  if (questionIndex < 1 || questionIndex > DEBILE100_QUESTION_COUNT) {
    throw new Error("Numéro de question invalide.");
  }

  const state = await ensureDebile100State(eventId);
  if (!state) {
    throw new Error("État introuvable.");
  }

  if (questionIndex === 1) {
    if (state.phase !== "idle" || state.current_question !== 0) {
      throw new Error("Réinitialise la partie pour relancer la question 1.");
    }
  } else if (state.phase !== "revealed" || state.current_question !== questionIndex - 1) {
    throw new Error(`Affiche d'abord la réponse de la question ${questionIndex - 1}.`);
  }

  const supabase = getSupabaseAdminClient();

  if (questionIndex === 1) {
    await supabase.from("debile100_player_status").delete().eq("event_id", eventId);
    await supabase.from("debile100_answers").delete().eq("event_id", eventId);
  }

  const { error } = await supabase.from("debile100_state").upsert(
    {
      event_id: eventId,
      questions: state.questions,
      current_question: questionIndex,
      phase: "playing",
      question_started_at: new Date().toISOString()
    },
    { onConflict: "event_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function revealDebile100Question(eventId: string, questionIndex: number) {
  const state = await getDebile100State(eventId);
  if (!state) {
    throw new Error("État introuvable.");
  }
  if (state.current_question !== questionIndex) {
    throw new Error(`La question ${questionIndex} n'est pas celle en cours.`);
  }
  if (state.phase !== "playing") {
    throw new Error("La question doit être lancée avant d'afficher la réponse.");
  }

  const question = getQuestionByIndex(state.questions, questionIndex);
  if (!question) {
    throw new Error("Question introuvable.");
  }

  const answers = await getDebile100AnswersForQuestion(eventId, questionIndex);
  const statuses = await getDebile100PlayerStatuses(eventId);
  const activePlayers = statuses.filter((row) => row.status === "active");

  const supabase = getSupabaseAdminClient();
  const toEliminate = new Set<string>();

  for (const row of activePlayers) {
    const answer = answers.find((entry) => entry.player_id === row.player_id);
    if (!answer || answer.choice_id !== question.correctChoiceId) {
      toEliminate.add(row.player_id);
    }
  }

  for (const playerId of toEliminate) {
    const { error } = await supabase.from("debile100_player_status").upsert(
      {
        event_id: eventId,
        player_id: playerId,
        status: "eliminated",
        eliminated_at_question: questionIndex
      },
      { onConflict: "event_id,player_id" }
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  const { error } = await supabase.from("debile100_state").update({
    phase: "revealed",
    question_started_at: null
  }).eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function resetDebile100(eventId: string) {
  const state = await getDebile100State(eventId);
  const supabase = getSupabaseAdminClient();
  await supabase.from("debile100_answers").delete().eq("event_id", eventId);
  await supabase.from("debile100_player_status").delete().eq("event_id", eventId);
  await supabase.from("debile100_state").upsert(
    {
      event_id: eventId,
      questions: state?.questions ?? createDefaultQuestions(),
      current_question: 0,
      phase: "idle",
      question_started_at: null
    },
    { onConflict: "event_id" }
  );
}
