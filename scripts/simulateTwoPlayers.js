/**
 * simulateTwoPlayers.js
 *
 * Usage:
 * SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/simulateTwoPlayers.js <roomId> <userAId> <userAName> <userBId> <userBName>
 *
 * The script will upsert two players into `roomplayers` and toggle their `is_ready` state to true.
 * It requires the environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` to be set.
 */

const { createClient } = require("@supabase/supabase-js");

async function main() {
  const [,, roomId, userAId, userAName, userBId, userBName] = process.argv;

  if (!roomId || !userAId || !userAName || !userBId || !userBName) {
    console.error("Usage: node scripts/simulateTwoPlayers.js <roomId> <userAId> <userAName> <userBId> <userBName>");
    process.exit(1);
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    console.log(`Upserting players into room ${roomId}...`);

    const now = new Date().toISOString();

    const players = [
      {
        room_id: roomId,
        id: userAId,
        name: userAName,
        seat: 0,
        is_ready: false,
        is_connected: true,
        created_at: now,
      },
      {
        room_id: roomId,
        id: userBId,
        name: userBName,
        seat: 1,
        is_ready: false,
        is_connected: true,
        created_at: now,
      },
    ];

    const { error: upsertErr } = await supabase
      .from("roomplayers")
      .upsert(players, { onConflict: "id" });

    if (upsertErr) throw upsertErr;

    console.log("Players upserted. Setting both to ready...");

    const { error: readyErr } = await supabase
      .from("roomplayers")
      .update({ is_ready: true })
      .eq("room_id", roomId)
      .in("id", [userAId, userBId]);

    if (readyErr) throw readyErr;

    console.log("Both players marked ready.");

    // Optionally, fetch and print current state
    const { data: current } = await supabase
      .from("roomplayers")
      .select("*")
      .eq("room_id", roomId)
      .order("seat", { ascending: true });

    console.log("Current roomplayers:", current);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
