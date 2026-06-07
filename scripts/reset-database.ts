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

async function clearTable(
  supabase: Awaited<ReturnType<typeof import("../lib/supabase").getSupabaseAdminClient>>,
  table: string,
  column: string
) {
  const { error } = await supabase
    .from(table)
    .delete()
    .neq(column, "00000000-0000-0000-0000-000000000000");
  if (error) {
    throw new Error(`clear ${table}: ${error.message}`);
  }
}

async function resetDatabase() {
  const { getSupabaseAdminClient } = await import("../lib/supabase");
  console.log("Réinitialisation de la base…");
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
    await clearTable(supabase, table, column);
  }

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

  console.log("Base nettoyée — 0 joueur, 4 épreuves prêtes.");
}

resetDatabase().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
