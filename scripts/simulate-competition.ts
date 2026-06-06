import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}

loadEnvFile();

async function main() {
  const { createDefaultQuestions, DEBILE100_QUESTION_COUNT } = await import("@/lib/debile100");
  const {
    finalizeDebile100Ranking,
    finalizeMolkputeRanking,
    getBeerPongState,
    getEventByOrder,
    getEventRanking,
    getGlobalRanking,
    getPlayers,
    registerPlayer,
    saveBeerPongDraw,
    saveDebile100Questions,
    saveMolkputeDraw,
    submitGolfDebileScore,
    updateBeerPongFinalWinner,
    updateBeerPongIndividualPlace,
    updateBeerPongWinner,
    validateBeerPongIndividual
  } = await import("@/lib/data");
  const { buildBeerPongTeamsFromPlayers } = await import("@/lib/beer-pong");
  const { buildMolkputeTeamsFromPlayers, createRoundRobinMatches } = await import("@/lib/molkpute");
  const { getSupabaseAdminClient } = await import("@/lib/supabase");
  type Player = import("@/lib/types").Player;
  type MolkputeTeamKey = import("@/lib/molkpute").MolkputeTeamKey;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Variables Supabase manquantes dans .env.local");
  }

  async function clearTable(table: string, column = "id") {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from(table)
      .delete()
      .neq(column, "00000000-0000-0000-0000-000000000000");
    if (error) {
      throw new Error(`clear ${table}: ${error.message}`);
    }
  }

  async function resetDatabase() {
    console.log("\n=== Réinitialisation base ===");
    const supabase = getSupabaseAdminClient();

    const tables: Array<[string, string]> = [
      ["scores", "id"],
      ["debile100_answers", "id"],
      ["debile100_player_status", "player_id"],
      ["debile100_state", "event_id"],
      ["molkpute_finishes", "id"],
      ["molkpute_state", "event_id"],
      ["golf_debile_submissions", "id"],
      ["golf_debile_state", "event_id"],
      ["beer_pong_state", "event_id"],
      ["matches", "id"],
      ["players", "id"]
    ];
    for (const [table, column] of tables) {
      await clearTable(table, column);
    }

    await supabase.from("events").delete().eq("name", "Parcours du Con Battant");
    await supabase.from("events").update({ order_index: 99 }).eq("order_index", 5);
    await supabase.from("events").update({ order_index: 4 }).eq("order_index", 99);

    const seed = [
      { name: "Beer Pong Géant", order_index: 1 },
      { name: "Molkpute", order_index: 2 },
      { name: "Golf Débile", order_index: 3 },
      { name: "100% Débile", order_index: 4 }
    ];
    for (const event of seed) {
      const { error } = await supabase.from("events").upsert(event, { onConflict: "order_index" });
      if (error) {
        throw new Error(`seed events: ${error.message}`);
      }
    }

    console.log("Base vidée, 4 épreuves configurées.");
  }

  async function createTestPlayers(): Promise<Player[]> {
    console.log("\n=== Création 12 joueurs ===");
    const players: Player[] = [];
    for (let index = 1; index <= 12; index += 1) {
      const pseudo = `Sim${String(index).padStart(2, "0")}`;
      const { player } = await registerPlayer(pseudo);
      players.push(player);
      console.log(`  + ${pseudo}`);
    }
    return players;
  }

  function printRanking(title: string, rows: { pseudo: string; total_points: number }[]) {
    console.log(`Classement ${title} :`);
    for (const [index, row] of rows.entries()) {
      console.log(`  ${index + 1}. ${row.pseudo} — ${row.total_points} pt(s)`);
    }
  }

  async function simulateBeerPong(eventId: string, players: Player[]) {
    console.log("\n=== Épreuve 1 : Beer Pong ===");
    const ids = players.map((player) => player.id);
    await saveBeerPongDraw(eventId, ids);
    await updateBeerPongWinner(eventId, "semi1", "A");
    await updateBeerPongWinner(eventId, "semi2", "C");
    await updateBeerPongFinalWinner(eventId, "final", "A");
    await updateBeerPongFinalWinner(eventId, "small", "B");

    const state = await getBeerPongState(eventId);
    if (!state || state.draw_player_ids.length !== 12) {
      throw new Error("Tirage Beer Pong invalide.");
    }

    const playersById = new Map(players.map((player) => [player.id, player]));
    const drawPlayers = state.draw_player_ids.map((id) => {
      const player = playersById.get(id);
      if (!player) {
        throw new Error(`Joueur introuvable dans le tirage: ${id}`);
      }
      return player;
    });
    const teams = buildBeerPongTeamsFromPlayers(drawPlayers);

    for (const team of teams) {
      const teamKey = team.key as "A" | "B" | "C" | "D";
      for (let place = 1; place <= 3; place += 1) {
        await updateBeerPongIndividualPlace(
          eventId,
          teamKey,
          place as 1 | 2 | 3,
          team.playerIds[place - 1]
        );
      }
    }

    await validateBeerPongIndividual(eventId);
    printRanking("Beer Pong", await getEventRanking(eventId));
  }

  async function simulateMolkpute(eventId: string, players: Player[]) {
    console.log("\n=== Épreuve 2 : Molkpute ===");
    const ids = players.map((player) => player.id);
    await saveMolkputeDraw(eventId, ids);

    const teams = buildMolkputeTeamsFromPlayers(players);
    const matches = createRoundRobinMatches();
    const teamStrength: Record<MolkputeTeamKey, number> = {
      "1": 6,
      "2": 5,
      "3": 4,
      "4": 3,
      "5": 2,
      "6": 1
    };

    const supabase = getSupabaseAdminClient();

    for (const match of matches) {
      const winner =
        teamStrength[match.teamA] >= teamStrength[match.teamB] ? match.teamA : match.teamB;
      const team = teams.find((entry) => entry.key === winner)!;
      match.scoreA = winner === match.teamA ? 50 : 32;
      match.scoreB = winner === match.teamB ? 50 : 32;
      match.winner = winner;
      match.completed = true;
      match.turnPhase = "submit";
      match.pendingFinisherTeam = null;
      match.activeTeam = null;
      match.finisherPlayerId = team.playerIds[0];
    }

    const { error: matchError } = await supabase
      .from("molkpute_state")
      .update({ matches })
      .eq("event_id", eventId);
    if (matchError) {
      throw new Error(matchError.message);
    }

    for (const match of matches) {
      if (!match.winner || !match.finisherPlayerId) {
        continue;
      }
      const { error } = await supabase.from("molkpute_finishes").upsert(
        {
          event_id: eventId,
          match_id: match.id,
          player_id: match.finisherPlayerId,
          team_key: match.winner
        },
        { onConflict: "event_id,match_id" }
      );
      if (error) {
        throw new Error(error.message);
      }
    }

    await finalizeMolkputeRanking(eventId);
    printRanking("Molkpute", await getEventRanking(eventId));
  }

  async function simulateGolfDebile(eventId: string, players: Player[]) {
    console.log("\n=== Épreuve 3 : Golf Débile ===");
    for (let index = 0; index < players.length; index += 1) {
      const base = 18 + index;
      await submitGolfDebileScore(eventId, players[index].id, {
        course1: base,
        course2: base + 1,
        course3: base + 2
      });
    }
    printRanking("Golf Débile", await getEventRanking(eventId));
  }

  async function simulateDebile100(eventId: string, players: Player[]) {
    console.log("\n=== Épreuve 4 : 100% Débile ===");
    await saveDebile100Questions(eventId, createDefaultQuestions());
    const supabase = getSupabaseAdminClient();

    for (let index = 0; index < players.length; index += 1) {
      const isWinner = index === 0;
      await supabase.from("debile100_player_status").upsert({
        event_id: eventId,
        player_id: players[index].id,
        status: isWinner ? "active" : "eliminated",
        eliminated_at_question: isWinner ? null : Math.max(1, DEBILE100_QUESTION_COUNT - index)
      });
    }

    const debilePayload = {
      event_id: eventId,
      questions: createDefaultQuestions(),
      current_question: DEBILE100_QUESTION_COUNT,
      phase: "revealed" as const,
      question_started_at: null,
      finalized_at: null
    };
    let debileStateError = (
      await supabase.from("debile100_state").upsert(debilePayload, { onConflict: "event_id" })
    ).error;
    if (debileStateError?.message.includes("finalized_at")) {
      const { finalized_at: _ignored, ...withoutFinalized } = debilePayload;
      debileStateError = (
        await supabase.from("debile100_state").upsert(withoutFinalized, { onConflict: "event_id" })
      ).error;
    }
    if (debileStateError) {
      throw new Error(debileStateError.message);
    }

    await finalizeDebile100Ranking(eventId);
    printRanking("100% Débile", await getEventRanking(eventId));
  }

  await resetDatabase();
  const players = await createTestPlayers();

  const beerPong = await getEventByOrder(1);
  const molkpute = await getEventByOrder(2);
  const golf = await getEventByOrder(3);
  const debile100 = await getEventByOrder(4);

  if (!beerPong || !molkpute || !golf || !debile100) {
    throw new Error("Une ou plusieurs épreuves sont introuvables (orders 1-4).");
  }

  await simulateBeerPong(beerPong.id, players);
  await simulateMolkpute(molkpute.id, players);
  await simulateGolfDebile(golf.id, players);
  await simulateDebile100(debile100.id, players);

  const globalRanking = await getGlobalRanking();
  console.log("\n=== Classement global ===");
  for (const [index, row] of globalRanking.entries()) {
    console.log(`  ${index + 1}. ${row.pseudo} — ${row.total_points} pt(s)`);
  }

  const allPlayers = await getPlayers();
  console.log(`\n✅ Simulation terminée — ${allPlayers.length} joueur(s) en base.`);
  console.log("Lance « npm run dev » puis ouvre http://localhost:3000/classement");
}

main().catch((error) => {
  console.error("\n❌ Échec simulation:", (error as Error).message);
  process.exit(1);
});
