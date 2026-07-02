const { getSupabase, isConfigured } = require("../lib/supabase");
const historyService = require("./historyService");

const GAMES = ["mm2", "adoptme", "growagarden"];
const MOVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_MOVES_PER_GAME = 200;

// Runs after each market refresh: for every recent value move on an item that
// a premium user has favorited, insert an inbox notification. The unique
// constraint on (user_id, game, item_id, move_at) makes re-scans idempotent.
async function generateAlerts() {
  if (!isConfigured()) return;
  const supabase = getSupabase();

  for (const game of GAMES) {
    try {
      const items = await historyService.readHistory(game);
      const moves = historyService
        .getRecentMoves(items, MAX_MOVES_PER_GAME)
        .filter((move) => Date.now() - new Date(move.timestamp).getTime() < MOVE_WINDOW_MS);
      if (!moves.length) continue;

      const { data: favs, error } = await supabase
        .from("favorites")
        .select("user_id, item_id, profiles!inner(premium)")
        .eq("game", game)
        .eq("profiles.premium", true)
        .in("item_id", moves.map((move) => move.id));
      if (error) throw error;
      if (!favs?.length) continue;

      const moveMap = new Map(moves.map((move) => [move.id, move]));
      const rows = favs.map((fav) => {
        const move = moveMap.get(fav.item_id);
        return {
          user_id: fav.user_id,
          game,
          item_id: move.id,
          item_name: move.name,
          old_value: move.previous,
          new_value: move.current,
          move_at: move.timestamp,
        };
      });

      const { error: insertError } = await supabase
        .from("notifications")
        .upsert(rows, { onConflict: "user_id,game,item_id,move_at", ignoreDuplicates: true });
      if (insertError) throw insertError;

      console.log(`[alerts] ${game}: ${rows.length} alert(s) processed`);
    } catch (err) {
      console.error(`[alerts] ${game} failed:`, err.message);
    }
  }
}

module.exports = { generateAlerts };
